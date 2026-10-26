import unittest
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
import numpy as np
from symbol_repetition import refine_repeated_beds,refine_sanitary_conflicts
class RepetitionTests(unittest.TestCase):
    def fixture(self):
        image=np.full((160,220,3),255,dtype=np.uint8)
        patch=np.random.default_rng(42).integers(20,230,size=(18,34,1),dtype=np.uint8).repeat(3,axis=2)
        for x,y,flip in [(15,20,False),(90,20,True),(90,90,False)]:image[y:y+18,x:x+34]=patch[:,::-1] if flip else patch
        objects=[{'id':'seed','category':'bed','bbox':[15,20,49,38],'confidence':.9},{'id':'conflict','category':'sofa','bbox':[90,90,124,108],'confidence':.8}]
        return image,objects
    def test_same_input_recovers_repeated_and_mirrored_symbols_without_mutating_detections(self):
        import copy
        image,objects=self.fixture();before=copy.deepcopy(objects);out,diag=refine_repeated_beds(image,objects,[])
        self.assertEqual(diag['matchedBeds'],3);self.assertEqual(sum(o['category']=='bed' for o in out),3);self.assertNotIn('conflict',[o['id'] for o in out]);self.assertEqual(objects,before)
    def test_no_seed_and_blank_input_do_not_invent_beds(self):
        image,objects=self.fixture();self.assertEqual(refine_repeated_beds(image,[],[])[0],[])
        blank=np.full_like(image,255);out,diag=refine_repeated_beds(blank,objects,[]);self.assertEqual(out,objects);self.assertEqual(diag['matchedBeds'],0)
    def test_confirmed_sanitary_fixture_cannot_become_a_repeated_bed(self):
        image,objects=self.fixture();out,diag=refine_repeated_beds(image,objects,[{'category':'bathtub','bbox':[90,90,124,108],'confidence':.95}]);self.assertEqual(diag['matchedBeds'],2)
    def test_sanitary_conflict_reuses_a_neural_footprint_and_preserves_raw_detections(self):
        import copy
        image,objects=self.fixture();seed={'id':'bath-seed','category':'bathtub','bbox':[15,20,49,38],'confidence':.9};before=copy.deepcopy(objects)
        out,semantic,changes=refine_sanitary_conflicts(image,objects,[seed]);self.assertEqual(len(changes),1);self.assertEqual(changes[0]['to'],'bathtub');self.assertTrue(any(o['bbox']==[90,90,124,108] for o in semantic));self.assertEqual(objects,before)
if __name__=='__main__':unittest.main()
