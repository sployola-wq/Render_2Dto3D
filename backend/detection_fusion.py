"""Coordinate-preserving detection fusion. Absence in one model is not a veto."""
import math

ALIASES = {}


def overlap(a, b):
    intersection = max(0, min(a[2], b[2])-max(a[0], b[0])) * max(0, min(a[3], b[3])-max(a[1], b[1]))
    aa, ab = (a[2]-a[0])*(a[3]-a[1]), (b[2]-b[0])*(b[3]-b[1])
    return intersection/max(1, aa+ab-intersection), intersection/max(1, min(aa, ab))


def merge_detections(objects, width, height):
    valid = []
    for obj in objects:
        box = obj.get('bbox', [])
        if len(box) != 4 or not all(math.isfinite(v) for v in box):
            continue
        a, b, c, d = box
        box = [max(0, a), max(0, b), min(width, c), min(height, d)]
        if box[2]-box[0] < 2 or box[3]-box[1] < 2:
            continue
        valid.append({**obj, 'bbox': box, 'category': ALIASES.get(obj['category'], obj['category'])})
    kept = []
    for obj in sorted(valid, key=lambda o: o['confidence'], reverse=True):
        duplicate = next((q for q in kept if q['category'] == obj['category'] and
                          (overlap(q['bbox'], obj['bbox'])[0] > .45 or overlap(q['bbox'], obj['bbox'])[1] > .85)), None)
        if duplicate:
            duplicate['evidenceSources'] = sorted(set(duplicate.get('evidenceSources', [duplicate['source']]) + [obj['source']]))
            continue
        kept.append(obj)
    return kept


def fuse_semantics(detector, semantic, width, height, return_review=False):
    """Prefer segmentation for a matching fixture; keep unpaired YOLO evidence."""
    semantic = merge_detections(semantic, width, height)
    selected = []
    for obj in merge_detections(detector, width, height):
        if obj['category'] == 'loadbearing_wall':
            continue
        conflicting = [q for q in semantic if q['confidence'] >= .5 and
                       (q['category'] == obj['category'] or {q['category'], obj['category']} <= {'sink', 'toilet', 'bathtub'}) and
                       (overlap(q['bbox'], obj['bbox'])[0] > .35 or overlap(q['bbox'], obj['bbox'])[1] > .8)]
        if not conflicting:
            selected.append(obj)
    merged=merge_detections(semantic + selected, width, height)
    rejected=[];kept=[]
    for obj in sorted(merged,key=lambda o:o['confidence'],reverse=True):
        rival=next((q for q in kept if q['category']!=obj['category'] and overlap(q['bbox'],obj['bbox'])[0]>.55),None)
        if rival:
            # A generic segmented appliance and a specific detected fixture are
            # one object. Never stack two catalogue meshes at the same location.
            if rival['category']=='appliance' and obj['category'] in ['stove','washingmachine','refrigerator','sink'] and obj['confidence']>=.5:
                kept.remove(rival);rejected.append(dict(rival,reason='Generic appliance refined by a matching specific detection'));kept.append(obj)
            else:
                rejected.append(dict(obj,reason='Conflicting category at the same source location',conflictingCategory=rival['category']))
        else:kept.append(obj)
    return (kept,rejected) if return_review else kept


def detail_tiles(width, height, bounds):
    """At most six overlapping tiles; offsets always refer to the original image."""
    x0, y0, x1, y1 = bounds
    w, h = x1-x0, y1-y0
    if max(w, h) < 900:
        return [bounds] if w*h < width*height*.65 else []
    nx, ny = (3, 2) if w > h*1.7 else (2, 3) if h > w*1.7 else (2, 2)
    tw, th = math.ceil(w/(1+(nx-1)*.75)), math.ceil(h/(1+(ny-1)*.75))
    return [(round(x0+i*(w-tw)/(nx-1)), round(y0+j*(h-th)/(ny-1)),
             round(x0+i*(w-tw)/(nx-1))+tw, round(y0+j*(h-th)/(ny-1))+th)
            for j in range(ny) for i in range(nx)]


def supported_detail_detections(objects, semantic):
    """A close crop can turn a wardrobe into a sofa: require contextual support.
    Preserve novel, uncorroborated candidates for user review rather than 3D.
    """
    selected=[];review=[]
    for obj in objects:
        supported=obj['source']!='neural-detail-tile' or 'neural-detector' in obj.get('evidenceSources',[])
        supported=supported or any(q['category']==obj['category'] and q['confidence']>=.35 and overlap(q['bbox'],obj['bbox'])[0]>.35 for q in semantic)
        if supported:selected.append(obj)
        else:review.append(dict(obj,reason='Detail-only candidate without whole-sheet or semantic support'))
    return selected,review
