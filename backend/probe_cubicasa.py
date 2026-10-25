"""Standalone baseline check; no reference annotations loaded."""
from pathlib import Path
import json
import numpy as np
from PIL import Image
import torch
import torch.nn.functional as F
from cubicasa_model import hg_furukawa_original

root=Path(__file__).resolve().parents[1]
torch.set_num_threads(4)
model=hg_furukawa_original(44)
checkpoint=torch.load(root/'models/cubicasa.pkl',map_location='cpu',weights_only=True)
model.load_state_dict(checkpoint['model_state']);model.eval();del checkpoint
im=Image.open(root/'dist/assets/plano.jpeg').convert('RGB')
tensor=torch.from_numpy(np.array(im)).permute(2,0,1).float()[None]/127.5-1
with torch.inference_mode():
    result=model(tensor)
    result=F.interpolate(result,size=(im.height,im.width),mode='bilinear',align_corners=False)
rooms=result[0,21:33].argmax(0).numpy().astype(np.uint8)
icons=result[0,33:44].argmax(0).numpy().astype(np.uint8)
np.savez_compressed(root/'models/cubicasa-probe.npz',rooms=rooms,icons=icons)
print(json.dumps({'roomCounts':dict(zip(*[a.tolist() for a in np.unique(rooms,return_counts=True)])), 'iconCounts':dict(zip(*[a.tolist() for a in np.unique(icons,return_counts=True)]))}))
