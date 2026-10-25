"""Apply explicit visual annotations to their exact image; not an inference input."""
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def apply_review(reference, review):
    if reference['imageSha256'] != review['imageSha256']:
        raise ValueError('La revisión visual pertenece a otra imagen.')
    updated = copy.deepcopy(reference)
    known = {o['id']: o for o in updated['objects']}
    for addition in review['referenceAdditions']:
        if addition['id'] in known:
            existing = known[addition['id']]
            if existing['category'] != addition['category'] or existing['bbox'] != addition['bbox']:
                raise ValueError('La revisión entraría en conflicto con una anotación existente.')
        else:
            updated['objects'].append(copy.deepcopy(addition))
    updated['provenance']['visualReview'] = dict(
        reviewer=review['reviewer'], independentReview=False, date=review['date'],
        scope=review['scope'], caseCount=len(review['cases']),
        additions=[a['id'] for a in review['referenceAdditions']],
        remainingGeometryReview=[c['objectId'] for c in review['cases'] if c['geometryReview']])
    updated['provenance']['description'] = 'Referencia inicial transferida entre resoluciones, con revisión visual parcial por un agente y dos puertas omitidas incorporadas. Requiere revisión independiente.'
    return updated

if __name__ == '__main__':
    path = ROOT / 'dist/data/plano-reference.json'
    reference = json.loads(path.read_text(encoding='utf-8'))
    review = json.loads((ROOT / 'dist/data/openings-visual-review.json').read_text(encoding='utf-8'))
    archive = ROOT / 'dist/data/archive/1280x749-before-opening-audit'
    archive.mkdir(parents=True, exist_ok=True)
    for name in ['plano-reference.json', 'plano-evaluation.json', 'plano-reconstruction-report.json']:
        original = ROOT / 'dist/data' / name
        if original.exists() and not (archive / name).exists():
            (archive / name).write_bytes(original.read_bytes())
    updated = apply_review(reference, review)
    path.write_text(json.dumps(updated, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(updated['provenance']['visualReview'], ensure_ascii=False))
