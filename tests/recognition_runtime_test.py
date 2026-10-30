"""Optional integration tests with the actual pinned local neural models."""
import io,json,struct,sys,unittest,zlib
from pathlib import Path
from PIL import Image,ImageOps
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'backend'))

def image_bytes(name):
    data=(ROOT/'tests/fixtures'/f'{name}.rgba.z').read_bytes();w,h=struct.unpack('<II',data[:8]);stream=io.BytesIO();Image.frombytes('RGBA',(w,h),zlib.decompress(data[8:])).convert('RGB').save(stream,format='PNG');return stream.getvalue()

@unittest.skipUnless((ROOT/'models/drawing-classifier/pytorch_model.bin').exists(),'Run setup-local.sh to enable neural integration tests')
class RecognitionRuntime(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import torch
        torch.set_num_threads(4)
        from drawing_classifier import DrawingClassifier
        cls.classifier=DrawingClassifier()
    def test_drawing_types(self):
        for name,expected in [('interior-reported','interior'),('mechanical','mechanical'),('facade','exterior'),('perspective-house','exterior'),('house-gabled','exterior'),('es-coupe','exterior')]:
            with self.subTest(name=name):
                result=self.classifier.classify(image_bytes(name));self.assertEqual(result['domain'],expected);self.assertTrue(result['confident'])
    def test_roof_families_and_local_garage_candidate(self):
        gable=self.classifier.classify(image_bytes('house-gabled'))['exteriorEnvelope']
        coupe=self.classifier.classify(image_bytes('es-coupe'))['exteriorEnvelope']
        flat=self.classifier.classify((ROOT/'tests/fixtures/perspective-house-original.jpg').read_bytes())['exteriorEnvelope']
        self.assertEqual(gable['roofKind'],'gable');self.assertEqual(coupe['roofKind'],'gable');self.assertEqual(flat['roofKind'],'flat')
        if (ROOT/'models/exterior/yolov8s-worldv2.pt').exists():
            self.assertEqual(flat['openingMethod'],'yolo-world-open-vocabulary-v1')
            self.assertTrue(any(o['kind']=='garage' for o in flat['openings']))
    def test_blank_sheet_requires_selection(self):
        out=io.BytesIO();Image.new('RGB',(500,400),'white').save(out,format='PNG');r=self.classifier.classify(out.getvalue());self.assertFalse(r['confident'])
    def test_scans_keep_their_discipline_with_rotation_margins_and_dark_paper(self):
        for name,expected in [('interior-reported','interior'),('mechanical','mechanical'),('house-gabled','exterior')]:
            original=Image.open(io.BytesIO(image_bytes(name))).convert('RGB')
            for variant,image in [('rotation',original.rotate(90,expand=True)),('margin',ImageOps.expand(original,border=round(max(original.size)*.4),fill='white')),('dark',ImageOps.invert(original))]:
                with self.subTest(name=name,variant=variant):
                    out=io.BytesIO();image.save(out,format='PNG');r=self.classifier.classify(out.getvalue())
                    self.assertEqual(r['domain'],expected);self.assertTrue(r['confident'])
    def test_reported_interior_has_live_structure_and_equipment(self):
        from inference import Engine
        result=Engine().predict(image_bytes('interior-reported'))
        furniture=[o for o in result['objects'] if o['confidence']>=.35 and o['category'] not in ['door','window']]
        self.assertGreaterEqual(len(result['wallPolygons']),8);self.assertGreaterEqual(len(furniture),10)
        for category in ['chair','table','sofa','window','door']:self.assertTrue(any(o['category']==category and o['confidence']>=.35 for o in result['objects']),category)

if __name__=='__main__':unittest.main()
