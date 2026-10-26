"""Refine repeated bed symbols using evidence from this input only.

Seeds are high-confidence neural beds. Matching never uses an example image,
manual annotations, saved coordinates or the presentation render.
"""
import cv2
import numpy as np

def overlap(a, b, minimum=False):
    intersection=max(0,min(a[2],b[2])-max(a[0],b[0]))*max(0,min(a[3],b[3])-max(a[1],b[1]))
    aa=max(1,(a[2]-a[0])*(a[3]-a[1]));bb=max(1,(b[2]-b[0])*(b[3]-b[1]))
    return intersection/(min(aa,bb) if minimum else max(1,aa+bb-intersection))

def refine_repeated_beds(rgb, objects, semantic_objects):
    gray=cv2.cvtColor(np.asarray(rgb),cv2.COLOR_RGB2GRAY)
    height,width=gray.shape
    seeds=sorted([o for o in objects if o['category']=='bed' and o['confidence']>=.70],key=lambda o:-o['confidence'])[:3]
    if not seeds:return list(objects),{'method':'same-input-symbol-repetition','seeds':0,'matchedBeds':0}
    candidates=[]
    fixtures=[o for o in semantic_objects if o['category'] in ['toilet','bathtub','sink'] and o['confidence']>=.5]
    for seed in seeds:
        x0,y0,x1,y1=[int(round(v)) for v in seed['bbox']]
        original=gray[max(0,y0):min(height,y1),max(0,x0):min(width,x1)]
        if min(original.shape)<10 or original.std()<14:continue
        for turns in range(4):
            rotated=np.rot90(original,turns).copy()
            for mirror in [False,True]:
                source=cv2.flip(rotated,1) if mirror else rotated
                for spread in [1.,1.5]:
                    h,w=source.shape
                    tw=int(w*(spread if w<h else 1));th=int(h*(spread if h<w else 1))
                    if tw>=width or th>=height:continue
                    template=cv2.resize(source,(tw,th))
                    scores=cv2.matchTemplate(gray,template,cv2.TM_CCOEFF_NORMED)
                    for _ in range(12):
                        _,score,_,(x,y)=cv2.minMaxLoc(scores)
                        if not np.isfinite(score) or score<.78:break
                        bbox=[x,y,x+tw,y+th]
                        scores[max(0,y-th//2):y+th//2+1,max(0,x-tw//2):x+tw//2+1]=-1
                        if any(overlap(bbox,f['bbox'])>.3 for f in fixtures):continue
                        alignment=max([overlap(bbox,o['bbox']) for o in objects if o['category']=='bed'] or [0])
                        candidates.append({'bbox':bbox,'score':float(score),'rank':float(score)+alignment*.08,'seed':seed})
    kept=[]
    for c in sorted(candidates,key=lambda c:-c['rank']):
        if not any(overlap(c['bbox'],k['bbox'],True)>.6 for k in kept):kept.append(c)
        if len(kept)>=32:break
    corrected=[];suppressed=[]
    for obj in objects:
        matches=[c for c in kept if overlap(obj['bbox'],c['bbox'],True)>.6]
        if obj['category'] in ['bed','sofa','table','desk','chair'] and matches:
            suppressed.append(obj['id'])
        else:corrected.append(obj)
    for index,c in enumerate(kept):
        corrected.append({'id':f'repeated-bed-{index+1}','category':'bed','bbox':c['bbox'],'confidence':round(c['seed']['confidence']*c['score'],4),'source':'same-image-symbol-match','reviewRequired':True,'evidence':{'seedObjectId':c['seed']['id'],'templateCorrelation':round(c['score'],4),'usesOtherImage':False}})
    return corrected,{'method':'same-input-symbol-repetition','seeds':len(seeds),'matchedBeds':len(kept),'suppressedConflictingIds':suppressed}

def refine_sanitary_conflicts(rgb, objects, semantic_objects):
    """Reclassify an existing ambiguous proposal only when a same-image bath matches.
    No location or footprint is synthesized. Original detector results remain in the export.
    """
    gray=cv2.cvtColor(np.asarray(rgb),cv2.COLOR_RGB2GRAY)
    semantics=[dict(o,bbox=list(o['bbox'])) for o in semantic_objects]
    seeds=[o for o in semantic_objects if o['category']=='bathtub' and o['confidence']>=.5]
    kept=[];changes=[]
    for obj in objects:
        if obj['category'] not in ['sofa','table','desk'] or obj['confidence']<.35:
            kept.append(obj);continue
        a,b,c,d=[int(round(v)) for v in obj['bbox']];roi=gray[max(0,b):d,max(0,a):c];best=None
        for seed in seeds:
            x,y,u,v=[int(round(k)) for k in seed['bbox']];template=gray[y:v,x:u]
            if min(template.shape)<8 or template.std()<14:continue
            for turn in range(4):
                rotated=np.rot90(template,turn).copy()
                for stretch in [1,1.25,1.5]:
                    h,w=rotated.shape;tw=int(w*(stretch if w<h else 1));th=int(h*(stretch if h<w else 1))
                    if th>roi.shape[0] or tw>roi.shape[1]:continue
                    score=float(cv2.minMaxLoc(cv2.matchTemplate(roi,cv2.resize(rotated,(tw,th)),cv2.TM_CCOEFF_NORMED))[1])
                    if score>=.82 and (best is None or score>best[0]):best=(score,seed)
        if best is None:kept.append(obj);continue
        score,seed=best;existing=next((o for o in semantics if o['category']=='bathtub' and overlap(o['bbox'],obj['bbox'])>.3),None)
        if existing:
            existing['bbox']=list(obj['bbox']);existing['source']='same-image-sanitary-match';existing['evidence']={'seedObjectId':seed['id'],'templateCorrelation':round(score,4)}
        else:semantics.append({'id':f'same-image-bath-{len(changes)+1}','category':'bathtub','bbox':list(obj['bbox']),'confidence':round(seed['confidence']*score,4),'source':'same-image-sanitary-match','reviewRequired':True,'evidence':{'seedObjectId':seed['id'],'templateCorrelation':round(score,4)}})
        changes.append({'objectId':obj['id'],'from':obj['category'],'to':'bathtub','templateCorrelation':round(score,4)})
    return kept,semantics,changes
