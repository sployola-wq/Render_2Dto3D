"""Manual reference for one image; never consumed by inference.

Coordinates were visually annotated on bocetos/plano.jpeg. This is an initial
reference requiring independent review, not an audited ground-truth dataset.
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
image = ROOT / 'dist/assets/archive/plano-724x424.jpeg'
if hashlib.sha256(image.read_bytes()).hexdigest() != '1eaaa77811f87c7a623468c69f533e6f1221fea1f1112e60d2ca82315ed78f90':
    raise ValueError('Estas coordenadas pertenecen solo al archivo histórico de 724 × 424. Para otra resolución, usar prepare_sample.py y revisar el registro.')
walls = []
def wall(axis, c, intervals, thickness=5):
    for start, end in intervals:
        walls.append(dict(id=f'ref-wall-{len(walls)+1}', axis=axis, c=c, **{'from': start, 'to': end}, thickness=thickness))

wall('h', 35, [(19,43),(96,135),(175,280),(320,352),(370,431),(468,566),(614,677)], 7)
wall('v', 22.5, [(33,158),(205,267)], 7)
wall('v', 673, [(33,112),(159,214),(261,315),(361,406)], 7)
wall('h', 264, [(19,53),(99,151),(200,266),(301,333),(352,407)], 7)
wall('h', 403, [(443,479),(528,592),(640,677)], 7)
wall('v', 444, [(237,292),(337,406)], 7)
wall('h', 135, [(53,155),(182,207)])
wall('v', 133, [(37,73),(97,136)])
wall('v', 205, [(37,137),(163,264)])
wall('h', 134, [(205,295),(320,344),(373,427),(453,543)])
wall('v', 344, [(37,136)])
wall('v', 403, [(37,136)])
wall('v', 542, [(38,137)])
wall('h', 185, [(542,673)])
wall('v', 542, [(164,185)])
wall('h', 165, [(205,280),(306,333),(358,385)])
wall('v', 331, [(165,264)])
wall('v', 385, [(165,264)])

objects = []
def boxes(category, values):
    for box in values:
        objects.append(dict(id=f'ref-{category}-{sum(o["category"]==category for o in objects)+1}', category=category, bbox=box, source='manual-reference', reviewRequired=True))

# Opening boxes annotate the physical wall opening, excluding swing arcs.
boxes('door', [[25,133,54,138],[155,133,182,138],[203,137,208,163],[295,132,322,137],[347,132,373,137],[427,132,452,137],[280,163,308,168],[333,163,359,168],[407,261,441,268],[444,190,449,239],[441,292,448,337],[540,137,545,164]])
boxes('window', [[43,29,96,40],[135,29,175,40],[280,29,320,40],[352,29,370,40],[431,29,468,40],[566,29,614,40],[17,158,28,205],[53,259,99,270],[151,259,200,270],[266,259,301,270],[333,259,352,270],[667,112,679,159],[667,214,679,261],[667,315,679,361],[479,398,528,409],[592,398,640,409]])
boxes('bed', [[64,140,127,204],[208,42,272,84],[208,84,272,118],[477,42,539,85],[477,85,539,118],[208,185,270,217],[208,231,270,262]])
boxes('sofa', [[99,241,148,263],[525,312,589,332],[493,331,513,375],[596,331,617,375]])
boxes('table', [[558,58,586,104],[570,227,643,253],[113,218,139,242],[535,344,579,364]])
# These additional categories are annotated for inspection, but excluded from
# the first quantitative comparison until coverage is reviewed independently.
boxes('chair', [[49,216,76,246],[562,47,581,59],[562,102,581,113],[548,62,559,78],[548,89,559,105],[585,62,597,78],[585,89,597,105],[558,232,572,247],[642,232,654,247],[573,216,587,229],[598,216,612,229],[623,216,637,229],[573,251,587,264],[598,251,612,264],[623,251,637,264]])
boxes('toilet', [[57,37,77,62],[347,60,371,82],[363,170,386,197]])
boxes('sink', [[58,113,83,134],[83,113,108,134],[82,35,102,59],[347,42,373,63],[379,96,403,125],[356,207,384,232]])
boxes('bathtub', [[26,42,50,98],[378,40,400,98]])
boxes('wardrobe', [[105,36,134,72],[135,36,157,73],[134,96,157,136],[310,165,332,261],[320,38,343,134],[445,163,521,190]])
boxes('stove', [[649,75,671,102]])

reference = dict(
    schemaVersion=2, imageSha256=hashlib.sha256(image.read_bytes()).hexdigest(), width=724, height=424,
    provenance=dict(kind='manual-reference', status='initial-review', description='Anotación visual inicial de un único plano. Requiere revisión independiente; no es una validación de precisión general.', usedForTraining=False),
    evaluation=dict(objectCategories=['door','window','bed','sofa','table'], bboxIouThreshold=.5, wallMetric='raster-union-IoU', boxDefinition='Puertas y ventanas: huella de la abertura; mobiliario: huella exterior del símbolo. No se incluyen arcos de giro en cajas de puerta.', scope='Las categorías evaluadas se anotaron de forma exhaustiva según la lectura visual inicial. Sillas y equipamiento son anotaciones auxiliares no evaluadas.'),
    walls=walls, objects=objects,
    assumptions=dict(wallHeightMeters=2.7, doorHeightMeters=2.1, windowSillMeters=.9, windowHeightMeters=1.2, furnitureHeights='Valores de catálogo aproximados; no inferidos del plano.'),
)
target = ROOT / 'dist/data/archive/724x424/plano-reference.json'
target.write_text(json.dumps(reference, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Reference: {len(walls)} wall segments, {len(objects)} objects; sha256={reference["imageSha256"]}')
