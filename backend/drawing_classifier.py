"""Local visual/text matching for drawing disciplines; no filename rules."""
from pathlib import Path
from PIL import Image, ImageOps, ImageChops
import hashlib
import io
import torch
from transformers import CLIPModel, CLIPProcessor
from exterior_envelope import exterior_envelope
from drawing_input import read_drawing, classification_views

MODEL_DIR=Path(__file__).resolve().parents[1]/'models/drawing-classifier'
PROMPTS={
    'interior':[
        'An architectural floor plan, viewed from above, with rooms, doors, beds, tables and bathroom fixtures.',
        'A technical drawing of a furnished apartment layout with interior walls and room divisions.',
        'A house floorplan blueprint showing bedrooms, a kitchen and bathrooms from above.',
        'An unfurnished architectural floor plan with empty rooms, corridors and door swing arcs, seen from above.',
        'A scanned blueprint of an apartment floor plan with dimensions and room labels.',
    ],
    'exterior':[
        'An architectural perspective sketch of the outside of a house, showing its roof, facade and windows.',
        'An architectural elevation or cross-section drawing showing the exterior facade, pitched roof and levels of a building.',
        'A drawing of a house seen from outside with a roof, front door and windows.',
        'A front elevation of a multistorey building with rows of windows and balconies.',
        'An exterior photograph or architectural rendering of a building facade.',
    ],
    'mechanical':[
        'A mechanical engineering technical drawing of a machine part with dimensions and orthographic views.',
        'A sectional engineering drawing of shafts, bearings, gears and mechanical components.',
        'A CAD blueprint of a manufactured metal part with holes, dimensions and cross hatching.',
        'A dimensioned orthographic engineering drawing of a single machined component.',
        'An isometric technical drawing of an assembled machine or mechanical part.',
    ],
    'structure':[
        'A structural engineering drawing of a steel frame with columns and beams.',
        'A technical diagram of a truss with bars, joints and supports.',
        'A structural frame elevation showing beams and columns without rooms or furniture.',
        'An engineering plan of beams and columns on a structural grid.',
        'A dimensioned drawing of a steel truss bridge with diagonal members.',
    ],
    'unknown':[
        'A blank sheet of paper with no drawing.',
        'A photograph of a person, an animal, food or a landscape.',
        'A map, a graph, a document of text or a logo, without a building or mechanical drawing.',
        'A site map, electrical wiring diagram or plumbing schematic.',
        'An interior photograph of a room, rather than a floor plan drawing.',
    ],
}

class DrawingClassifier:
    def __init__(self):
        expected='a63082132ba4f97a80bea76823f544493bffa8082296d62d71581a4feff1576f'
        with (MODEL_DIR/'pytorch_model.bin').open('rb') as stream:
            if hashlib.file_digest(stream,'sha256').hexdigest()!=expected:raise ValueError('Pesos del clasificador no válidos.')
        self.processor=CLIPProcessor.from_pretrained(MODEL_DIR,local_files_only=True,use_fast=False)
        self.model=CLIPModel.from_pretrained(MODEL_DIR,local_files_only=True,weights_only=True).eval()
        self.exterior_detector=None
        self.domains=list(PROMPTS)
        with torch.inference_mode():
            prompts=[p for group in PROMPTS.values() for p in group]
            data=self.processor(text=prompts,return_tensors='pt',padding=True)
            vectors=self.model.get_text_features(**data)
            vectors=vectors/vectors.norm(dim=-1,keepdim=True)
            self.text=vectors.reshape(len(self.domains),5,-1).mean(1)
            self.text=self.text/self.text.norm(dim=-1,keepdim=True)
            roof_prompts=['An exterior architectural drawing of a modern building with flat roofs and rectangular volumes.',
                          'A perspective sketch of a modern house with a flat roof.',
                          'An architectural drawing of a house with pitched gable roofs and triangular gable ends.',
                          'A perspective sketch of a traditional house with a sloping roof and a front gable.']
            roof=self.model.get_text_features(**self.processor(text=roof_prompts,return_tensors='pt',padding=True))
            roof=roof/roof.norm(dim=-1,keepdim=True)
            self.roof_text=roof.reshape(2,2,-1).mean(1)
            self.roof_text=self.roof_text/self.roof_text.norm(dim=-1,keepdim=True)

    @torch.inference_mode()
    def classify(self, image_bytes):
        image=read_drawing(image_bytes)
        views,preparation=classification_views(image)
        feature=self.model.get_image_features(**self.processor(images=views,return_tensors='pt'))
        feature=feature/feature.norm(dim=-1,keepdim=True)
        # Rotations are competing orientation hypotheses, not votes against an
        # upright facade. Compare whole sheet and content at each orientation.
        logits=(feature@self.text.T)*self.model.logit_scale.exp()
        votes=logits.softmax(1)
        pairs=votes.reshape(4,2,-1)
        paired=pairs.mean(1)
        def evaluate_orientation(rot):
            vals=paired[rot].tolist()
            rk=sorted(zip(self.domains,vals),key=lambda x:x[1],reverse=True)
            w,s=rk[0];m=s-rk[1][1]
            ag=sum(self.domains[int(v)]==w for v in pairs[rot].argmax(1))
            conf=w!='unknown' and s>=.58 and m>=.20 and ag==2
            return {'rot':rot,'values':vals,'ranked':rk,'winner':w,'score':s,'margin':m,'agreement':ag,'confident':conf}
        hypotheses=[evaluate_orientation(r) for r in range(4)]
        ext_confident=[h for h in hypotheses if h['winner']=='exterior' and h['confident']]
        chosen=max(ext_confident,key=lambda h:h['score']) if ext_confident and all(h['winner'] in ('interior','exterior') for h in hypotheses if h['confident']) else max(hypotheses,key=lambda h:h['score'])
        orientation=chosen['rot']
        values=chosen['values']
        ranked=chosen['ranked']
        winner,score=chosen['winner'],chosen['score'];margin=chosen['margin']
        agreement=chosen['agreement']
        confident=chosen['confident']
        result={'imageSha256':hashlib.sha256(image_bytes).hexdigest(),'domain':None if winner=='unknown' else winner,
                'scores':dict(ranked),'margin':round(margin,4),'confident':confident,
                'method':'clip-drawing-multiview-v2','model':'openai/clip-vit-base-patch32',
                'preparation':preparation,'viewAgreement':agreement,'viewCount':2,'orientationHypothesis':orientation*90,
                'alternatives':[{'domain':d,'score':round(v,4)} for d,v in ranked[:3]],
                'execution':'local','note':'Similitudes relativas entre categorías; no son probabilidades calibradas.'}
        if winner=='exterior':
            result['exteriorEnvelope']=exterior_envelope(image_bytes)
            # Roof context includes ridge extensions outside the dense crop.
            roof_scores=((feature[orientation*2:orientation*2+1]@self.roof_text.T)[0]*self.model.logit_scale.exp()).softmax(0).tolist()
            if result['exteriorEnvelope']:
                index=max(range(2),key=lambda i:roof_scores[i])
                result['exteriorEnvelope']['roofKind']=['flat','gable'][index] if roof_scores[index]>=.58 else 'unknown'
                result['exteriorEnvelope']['roofScores']=dict(zip(['flat','gable'],roof_scores))
                try:
                    if self.exterior_detector is None:
                        from exterior_openings import ExteriorOpenings
                        self.exterior_detector=ExteriorOpenings(self.processor,self.model)
                    result['exteriorEnvelope']['openings']=self.exterior_detector.detect(image,result['exteriorEnvelope'])
                    result['exteriorEnvelope']['openingMethod']='yolo-world-open-vocabulary-v1'
                except (ImportError,FileNotFoundError,ValueError,RuntimeError) as error:
                    result['exteriorEnvelope']['openingMethod']='geometric-candidates-only'
                    result['exteriorEnvelope']['openingNote']='Detector opcional no disponible: '+str(error)
        return result
