"""Optional local open-vocabulary facade detector, reusing the installed CLIP encoder."""
from pathlib import Path
import hashlib
import torch
from ultralytics import YOLOWorld

class ExteriorOpenings:
    def __init__(self,processor,encoder):
        path=Path(__file__).resolve().parents[1]/'models/exterior/yolov8s-worldv2.pt'
        with path.open('rb') as stream:
            if hashlib.file_digest(stream,'sha256').hexdigest()!='9b2c17ab6124a913e9b3a5c170617920d91b0f01111a8479da69f00e2cf27792':raise ValueError('Pesos del detector de fachadas no válidos.')
        self.classes=['window','door','garage door','roof','gable','house']
        with torch.inference_mode():
            features=encoder.get_text_features(**processor(text=self.classes,return_tensors='pt',padding=True))
            features=features/features.norm(dim=-1,keepdim=True)
        self.model=YOLOWorld(str(path))
        self.model.model.txt_feats=features[None]
        self.model.model.model[-1].nc=len(self.classes)
        self.model.model.names=dict(enumerate(self.classes))

    @torch.inference_mode()
    def detect(self,image,frame):
        result=self.model.predict(image,device='cpu',imgsz=1280,conf=.18,iou=.45,max_det=40,verbose=False)[0]
        sx=frame['width']/image.width;sy=frame['height']/image.height;out=[]
        for box,confidence,category in zip(result.boxes.xyxy,result.boxes.conf,result.boxes.cls):
            if int(category)>=3:continue
            x0,y0,x1,y1=box.tolist()
            if (x1-x0)*(y1-y0)<image.width*image.height*.001:continue
            out.append({'bounds':[round(x0*sx,2),round(y0*sy,2),round(x1*sx,2),round(y1*sy,2)],'kind':['window','door','garage'][int(category)],'confidence':round(float(confidence),4)})
        return out
