"""Prepare a replacement sample and transfer annotations only after image registration.

Inference is executed separately. Neither registration nor annotations feed a model.
"""
from pathlib import Path
from PIL import Image, ImageOps
import cv2
import numpy as np
import copy
import gzip
import hashlib
import json
from opening_reference_review import apply_review

ROOT = Path(__file__).resolve().parents[1]
archive = ROOT / 'dist/data/archive/724x424'
original_path = ROOT / 'dist/assets/archive/plano-724x424.jpeg'
current_path = ROOT / 'dist/assets/plano.jpeg'
original = cv2.imread(str(original_path), cv2.IMREAD_GRAYSCALE)
current_image = ImageOps.exif_transpose(Image.open(current_path)).convert('RGB')
natural_size = current_image.size
factor = min(1, 1400 / max(natural_size))
if factor < 1:
    current_image = current_image.resize(tuple(round(v * factor) for v in natural_size), Image.Resampling.LANCZOS)
width, height = current_image.size
current = cv2.cvtColor(np.array(current_image), cv2.COLOR_RGB2GRAY)
reference = json.loads((archive / 'plano-reference.json').read_text(encoding='utf-8'))
if hashlib.sha256(original_path.read_bytes()).hexdigest() != reference['imageSha256']:
    raise RuntimeError('La imagen histórica no corresponde a las anotaciones originales.')

sift = cv2.SIFT_create(nfeatures=2500)
old_keys, old_descriptors = sift.detectAndCompute(original, None)
new_keys, new_descriptors = sift.detectAndCompute(current, None)
matches = cv2.BFMatcher().knnMatch(old_descriptors, new_descriptors, k=2)
good = [a for a, b in matches if a.distance < .74 * b.distance]
if len(good) < 20:
    raise RuntimeError('No hay suficientes correspondencias para trasladar la referencia.')
source = np.float32([old_keys[m.queryIdx].pt for m in good])
target = np.float32([new_keys[m.trainIdx].pt for m in good])
matrix, inliers = cv2.estimateAffine2D(source, target, method=cv2.RANSAC, ransacReprojThreshold=3)
if matrix is None or inliers is None:
    raise RuntimeError('No se pudo registrar la nueva imagen.')
selection = inliers.ravel().astype(bool)
source, target = source[selection], target[selection]
sx, tx = np.linalg.lstsq(np.column_stack([source[:, 0], np.ones(len(source))]), target[:, 0], rcond=None)[0]
sy, ty = np.linalg.lstsq(np.column_stack([source[:, 1], np.ones(len(source))]), target[:, 1], rcond=None)[0]
mapped = source * np.array([sx, sy]) + np.array([tx, ty])
median_error = float(np.median(np.linalg.norm(mapped - target, axis=1)))
if (len(source) < 20 or len(source) / len(good) < .6 or median_error > 2.5
        or sx <= 0 or sy <= 0 or abs(sx / sy - 1) > .02
        or abs(matrix[0, 1]) > .01 or abs(matrix[1, 0]) > .01
        or np.ptp(source[:, 0]) < original.shape[1] * .6
        or np.ptp(source[:, 1]) < original.shape[0] * .6):
    raise RuntimeError('La alineación no es suficientemente fiable; se requiere revisar las anotaciones.')

sha = hashlib.sha256(current_path.read_bytes()).hexdigest()
registration = dict(method='SIFT-RANSAC-axis-aligned-affine', matches=len(good), inliers=len(source),
                    medianErrorPixels=round(median_error, 4), scaleX=float(sx), scaleY=float(sy),
                    translateX=float(tx), translateY=float(ty))
updated = copy.deepcopy(reference)
updated.update(imageSha256=sha, width=width, height=height, naturalSize=list(natural_size))
updated['provenance'].update(status='transferred-initial-review',
    description='Referencia manual inicial trasladada mediante registro entre resoluciones. Pendiente de revisión independiente sobre la nueva imagen.',
    transferredFrom=dict(imageSha256=reference['imageSha256'], width=reference['width'], height=reference['height']),
    registration=registration)
for wall in updated['walls']:
    horizontal = wall['axis'] == 'h'
    along_scale, along_offset = (sx, tx) if horizontal else (sy, ty)
    across_scale, across_offset = (sy, ty) if horizontal else (sx, tx)
    for field in ['from', 'to']:
        wall[field] = round(float(wall[field] * along_scale + along_offset), 3)
    wall['c'] = round(float(wall['c'] * across_scale + across_offset), 3)
    wall['thickness'] = round(float(wall['thickness'] * across_scale), 3)
for obj in updated['objects']:
    x0, y0, x1, y1 = obj['bbox']
    obj['bbox'] = [round(float(x0 * sx + tx), 3), round(float(y0 * sy + ty), 3),
                   round(float(x1 * sx + tx), 3), round(float(y1 * sy + ty), 3)]
    obj['annotationStatus'] = 'transferred-review-required'
review_path = ROOT / 'dist/data/openings-visual-review.json'
if review_path.exists():
    review = json.loads(review_path.read_text(encoding='utf-8'))
    if review['imageSha256'] == sha:
        updated = apply_review(updated, review)
(ROOT / 'dist/data/plano-reference.json').write_text(json.dumps(updated, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

rgba = current_image.convert('RGBA').tobytes()
(ROOT / 'tests/fixtures/plano-current.rgba.gz').write_bytes(gzip.compress(rgba, mtime=0))
metadata = dict(imageSha256=sha, width=width, height=height, naturalSize=list(natural_size), referenceStatus=updated['provenance']['status'], registration=registration)
(ROOT / 'tests/fixtures/plano-current.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
(ROOT / 'dist/data/sample-manifest.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
sample = dict(imageUrl=f'./assets/plano.jpeg?v={sha[:12]}', referenceUrl=f'./data/plano-reference.json?v={sha[:12]}',
              predictionUrl=f'./data/plano-prediction.json?v={sha[:12]}', imageSha256=sha, width=width, height=height)
(ROOT / 'dist/sample.js').write_text('export const SAMPLE = ' + json.dumps(sample, indent=2) + ';\n', encoding='utf-8')
print(json.dumps(metadata, indent=2))
