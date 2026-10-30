"""Local neural inference. This module never reads manual annotations."""
from __future__ import annotations
import argparse
import hashlib
import importlib
import io
import json
import time
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[1]
_runtime = ROOT/'models/runtime'
(_runtime/'Ultralytics').mkdir(parents=True,exist_ok=True)
os.environ.setdefault('YOLO_CONFIG_DIR',str(_runtime))

import cv2
import numpy as np
from PIL import Image, ImageOps
import torch
import torch.nn.functional as F
from cubicasa_model import hg_furukawa_original
from symbol_repetition import refine_repeated_beds, refine_sanitary_conflicts
from ultralytics import YOLO
from drawing_input import read_drawing, normalize_drawing, content_bounds
from detection_fusion import detail_tiles, merge_detections, fuse_semantics, supported_detail_detections

STRUCTURE_SOURCE = 'https://github.com/CubiCasa/CubiCasa5k'
OBJECT_SOURCE = 'https://github.com/REIkd/FYP-Floorplan'

def digest(path):
    hasher = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b''):
            hasher.update(chunk)
    return hasher.hexdigest()

def load_detection_model(path):
    # Do not enable unrestricted pickle loading for downloaded .pt files.
    allowed = []
    for name in torch.serialization.get_unsafe_globals_in_checkpoint(path):
        if name == 'builtins.set':
            allowed.append(set)
            continue
        module_name, attr = name.rsplit('.', 1)
        if not (module_name.startswith('torch.nn.') or module_name.startswith('ultralytics.nn.')):
            raise ValueError(f'Unsupported checkpoint global: {name}')
        value = getattr(importlib.import_module(module_name), attr)
        if not isinstance(value, type) or not issubclass(value, torch.nn.Module):
            raise ValueError(f'Checkpoint global is not an nn.Module: {name}')
        allowed.append(value)
    with torch.serialization.safe_globals(allowed):
        checkpoint = torch.load(path, map_location='cpu', weights_only=True)
    network = checkpoint.get('ema') or checkpoint['model']
    predictor = YOLO('yolov8n.yaml')
    predictor.model = network.float().eval()
    predictor.overrides = {'task': 'detect', 'model': str(path), 'imgsz': 640}
    return predictor

class Engine:
    def __init__(self):
        torch.set_num_threads(max(1, min(4, torch.get_num_threads())))
        manifest = json.loads((ROOT/'backend/model-manifest.json').read_text(encoding='utf-8'))
        for entry in manifest['models']:
            if digest(ROOT/entry['path']) != entry['sha256']:
                raise ValueError(f'Los pesos no coinciden con el modelo evaluado: {entry["path"]}')
        wall_path = ROOT / 'models/cubicasa.pkl'
        furniture_path = ROOT / 'models/furniture-yolov8.pt'
        self.structure = hg_furukawa_original(44)
        checkpoint = torch.load(wall_path, map_location='cpu', weights_only=True)
        self.structure.load_state_dict(checkpoint['model_state'])
        del checkpoint
        self.structure.eval()
        self.detector = load_detection_model(furniture_path)
        self.provenance = {
            'kind': 'neural-inference', 'device': 'cpu', 'structureModel': STRUCTURE_SOURCE,
            'objectModel': OBJECT_SOURCE, 'structureWeightsSha256': digest(wall_path),
            'objectWeightsSha256': digest(furniture_path), 'referenceUsedForInference': False,
            'structureClasses': ['wall','door','window','wardrobe','toilet','sink','bathtub','appliance'], 'structureArchitecture':'CubiCasa5K hourglass', 'objectClasses': self.detector.names,
            'fusion':'CubiCasa openings and fixtures; YOLO furniture with overlapping fixture proposals suppressed at bbox IoU > 0.35.', 'notes': ['Modelos externos sin ajuste con este plano.', 'Las puntuaciones del detector no están calibradas como probabilidades.', 'Alturas y orientación de muebles son aproximaciones de catálogo.'],
        }

    @torch.inference_mode()
    def predict(self, image_bytes):
        started = time.perf_counter()
        image = read_drawing(image_bytes)
        natural_size = list(image.size)
        image, preparation = normalize_drawing(image)
        detail_image = image
        factor = min(1, 1400 / max(image.size))
        if factor < 1:
            image = image.resize((round(image.width * factor), round(image.height * factor)), Image.Resampling.LANCZOS)
        width, height = image.size
        # Original CubiCasa preprocessing: RGB pixels normalized to [-1, 1].
        tensor = torch.from_numpy(np.asarray(image).copy()).permute(2,0,1).float()[None] / 127.5 - 1
        prediction_logits = self.structure(tensor)
        prediction_logits = F.interpolate(prediction_logits,size=(height,width),mode='bilinear',align_corners=False)
        room_prob = prediction_logits[0,21:33].softmax(0)
        icon_prob = prediction_logits[0,33:44].softmax(0)
        rooms = room_prob.argmax(0).cpu().numpy().astype(np.uint8)
        icons = icon_prob.argmax(0).cpu().numpy().astype(np.uint8)
        # Semantic room classes from the existing model: Kitchen=3, Bath=6.
        # Finish masks do not replace wall geometry or measured surfaces.
        finish_regions = []
        for class_id, category in [(3, 'kitchen'), (6, 'bathroom')]:
            binary = (rooms == class_id).astype(np.uint8)
            count, ids, stats, _ = cv2.connectedComponentsWithStats(binary)
            probabilities = room_prob[class_id].cpu().numpy()
            for component, (rx,ry,rw,rh,area) in enumerate(stats[1:],1):
                if area < width*height*.003: continue
                confidence = float(probabilities[ids == component].mean())
                if confidence < .7: continue
                contours, _ = cv2.findContours((ids == component).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                for contour in contours:
                    outer = cv2.approxPolyDP(contour, 1, True).reshape(-1,2).tolist()
                    if len(outer)>=3: finish_regions.append({'category':category,'outer':outer,'holes':[],'confidence':round(confidence,4),'source':'cubicasa-room-segmentation','reviewRequired':True})
        labels = np.zeros((height,width),dtype=np.uint8)
        labels[rooms == 2] = 1
        labels[icons == 2] = 2
        labels[icons == 1] = 3
        polygons = []
        wall_mask = (labels == 1).astype(np.uint8)
        contours, hierarchy = cv2.findContours(wall_mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        if hierarchy is not None:
            for i, contour in enumerate(contours):
                if hierarchy[0][i][3] >= 0 or cv2.contourArea(contour) < 8:
                    continue
                outer = cv2.approxPolyDP(contour, .6, True).reshape(-1,2).tolist()
                if len(outer) < 3:
                    continue
                holes = []
                child = hierarchy[0][i][2]
                while child >= 0:
                    hole = cv2.approxPolyDP(contours[child], .6, True).reshape(-1,2).tolist()
                    if len(hole) >= 3: holes.append(hole)
                    child = hierarchy[0][child][0]
                polygons.append({'id':f'wall-{len(polygons)+1}', 'outer':outer, 'holes':holes})

        objects = []
        tiles = detail_tiles(*detail_image.size, content_bounds(detail_image))
        jobs = [(image, (0, 0), (1, 1), 'neural-detector')]
        jobs += [(detail_image.crop(b), b[:2], (width/detail_image.width, height/detail_image.height), 'neural-detail-tile') for b in tiles]
        for tile, offset, scale, source in jobs:
            prediction = self.detector.predict(tile, imgsz=640, conf=.10 if source=='neural-detector' else .30, iou=.45, device='cpu', verbose=False)[0]
            for box in prediction.boxes:
                raw_category = self.detector.names[int(box.cls.item())]
                if raw_category == 'loadbearing_wall': continue
                local = [float(v) for v in box.xyxy[0].tolist()]
                # Do not extrude objects cut by an artificial tile boundary.
                if source=='neural-detail-tile' and (local[0]<3 or local[1]<3 or local[2]>tile.width-3 or local[3]>tile.height-3): continue
                mapped = [(v+offset[i%2])*scale[i%2] for i,v in enumerate(local)]
                objects.append({'id':f'prediction-{len(objects)+1}', 'category':raw_category,
                    'bbox':[round(v,2) for v in mapped], 'confidence':round(float(box.conf.item()),4),
                    'source':source, 'sourceTile':[offset[0],offset[1],tile.width,tile.height], 'reviewRequired':True})
        objects = merge_detections(objects, width, height)

        regions, semantic_objects = [], []
        icon_categories = {1:'window',2:'door',3:'wardrobe',4:'appliance',5:'toilet',6:'sink',9:'bathtub'}
        for class_id, category in icon_categories.items():
            count, component_ids, stats, _ = cv2.connectedComponentsWithStats((icons == class_id).astype(np.uint8))
            for component, (x,y,w,h,area) in enumerate(stats[1:],1):
                if area < (6 if class_id in [1,2] else 14): continue
                confidence = float(icon_prob[class_id].cpu().numpy()[component_ids == component].mean())
                bbox = [int(x),int(y),int(x+w),int(y+h)]
                regions.append({'category':category,'bbox':bbox,'areaPixels':int(area),'confidence':round(confidence,4),'source':'structural-segmentation'})
                semantic_objects.append({'id':f'semantic-{len(semantic_objects)+1}','category':category,'bbox':bbox,'confidence':round(confidence,4),'source':'cubicasa-segmentation','reviewRequired':True})
        raw_objects = objects
        objects,detail_review = supported_detail_detections(objects,semantic_objects)
        refined_objects, repetition = refine_repeated_beds(image, objects, semantic_objects)
        def iou(a,b):
            overlap=max(0,min(a[2],b[2])-max(a[0],b[0]))*max(0,min(a[3],b[3])-max(a[1],b[1]))
            return overlap / max(1,(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-overlap)
        refined_objects, semantic_objects, sanitary_changes = refine_sanitary_conflicts(image, refined_objects, semantic_objects)
        review_only=[o for o in semantic_objects if o['category'] in ['wardrobe','appliance'] and (min(o['bbox'][2]-o['bbox'][0],o['bbox'][3]-o['bbox'][1])<max(3,width*.01) or (o['bbox'][2]-o['bbox'][0])*(o['bbox'][3]-o['bbox'][1])<width*height*.0005)]
        excluded={o['id'] for o in review_only}
        objects,conflicts=fuse_semantics(refined_objects, [o for o in semantic_objects if o['id'] not in excluded], width, height,return_review=True)
        # Unique IDs after merging sources are part of the editable/exported model.
        objects=[dict(o,id=f'object-{i+1}') for i,o in enumerate(objects)]
        return {'schemaVersion':2, 'imageSha256':hashlib.sha256(image_bytes).hexdigest(),
            'width':width, 'height':height, 'naturalSize':natural_size, 'walls':[], 'openings':[],
            'wallPolygons':polygons, 'objects':objects, 'rawObjectDetections':raw_objects, 'structuralRegions':regions,
            'method':'cubicasa-hourglass-and-yolov8-floorplan', 'provenance':{**self.provenance,
                'fusion':'Source-coordinate NMS; unpaired detector doors, windows and fixtures retained.',
                'preparation':preparation,'detailTiles':len(tiles),'coordinateFrame':'original-image-scaled-to-analysis'},
            'elapsedSeconds':round(time.perf_counter()-started,3), 'minimumStoredConfidence':.10,'finishRegions':finish_regions,'symbolRefinement':repetition,'sanitaryRefinement':sanitary_changes,'reviewOnlyObjects':[dict(o,reason='Small fixture fragment; not extruded as tall furniture') for o in review_only]+conflicts+detail_review}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--image', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    engine = Engine()
    result = engine.predict(Path(args.image).read_bytes())
    Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'wallPolygons':len(result['wallPolygons']), 'objects':len(result['objects']), 'seconds':result['elapsedSeconds']},ensure_ascii=False))
