import sys, unittest
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from detection_fusion import merge_detections, fuse_semantics, detail_tiles, supported_detail_detections
from drawing_input import content_bounds, classification_views, normalize_drawing

def obj(category, bbox, confidence=.8, source='detector'):
    return dict(category=category,bbox=bbox,confidence=confidence,source=source)

class DetectionFusion(unittest.TestCase):
    def test_detail_only_proposals_cannot_replace_whole_sheet_context(self):
        sofa=obj('sofa',[10,10,30,30],.95,'neural-detail-tile')
        kept,review=supported_detail_detections([sofa],[obj('wardrobe',[10,10,30,30],.8,'semantic')])
        self.assertEqual(kept,[]);self.assertEqual(len(review),1)
        kept,review=supported_detail_detections([sofa],[obj('sofa',[10,10,30,30],.8,'semantic')])
        self.assertEqual(len(kept),1);self.assertEqual(review,[])
    def test_unpaired_doors_windows_and_fixtures_survive(self):
        for category in ['door','window','wardrobe','toilet','sink','bathtub']:
            result=fuse_semantics([obj(category,[10,20,30,50])],[],100,100)
            self.assertEqual(len(result),1,category)
            self.assertEqual(result[0]['bbox'],[10,20,30,50])

    def test_segmentation_only_replaces_spatially_matching_fixture(self):
        detector=[obj('door',[10,10,30,50]),obj('door',[60,10,80,50])]
        semantic=[obj('door',[11,11,31,51],.9,'semantic')]
        result=fuse_semantics(detector,semantic,100,100)
        self.assertEqual(len(result),2)
        self.assertTrue(any(o['source']=='semantic' for o in result))

    def test_overlapping_tiles_do_not_duplicate_objects_or_merge_adjacent_chairs(self):
        result=merge_detections([obj('chair',[10,10,30,30]),obj('chair',[11,10,31,30],.7,'tile'),obj('chair',[35,10,55,30])],100,100)
        self.assertEqual(len(result),2)
        self.assertEqual(result[0]['evidenceSources'],['detector','tile'])

    def test_conflicting_categories_are_kept_for_review_not_stacked_in_3d(self):
        kept,review=fuse_semantics([obj('table',[10,10,40,40],.4)],[obj('sink',[11,11,41,41],.9,'semantic')],100,100,return_review=True)
        self.assertEqual([o['category'] for o in kept],['sink'])
        self.assertEqual(review[0]['category'],'table')
        kept=fuse_semantics([obj('stove',[10,10,40,40],.8)],[obj('appliance',[11,11,41,41],.9,'semantic')],100,100)
        self.assertEqual([o['category'] for o in kept],['stove'])

    def test_tiles_cover_the_source_without_exceeding_it(self):
        for width,height,bounds in [(1800,1200,(100,70,1700,1100)),(1000,2200,(0,0,1000,2200))]:
            tiles=detail_tiles(width,height,bounds)
            self.assertLessEqual(len(tiles),6)
            for x0,y0,x1,y1 in tiles:
                self.assertTrue(0<=x0<x1<=width and 0<=y0<y1<=height)
            for x,y in [(bounds[0],bounds[1]),(bounds[2]-1,bounds[3]-1),((bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2)]:
                self.assertTrue(any(a<=x<c and b<=y<d for a,b,c,d in tiles))

    def test_content_crop_keeps_both_views_and_removes_large_margins(self):
        image=Image.new('RGB',(1400,1000),'white');draw=ImageDraw.Draw(image)
        draw.rectangle((350,300,600,650),outline='black',width=4)
        draw.ellipse((750,350,1050,650),outline='black',width=4)
        b=content_bounds(image)
        self.assertTrue(200<b[0]<350 and 1050<b[2]<1200)
        views,details=classification_views(image)
        self.assertEqual(len(views),8)
        self.assertTrue(all(v.size==(224,224) for v in views))

    def test_dark_blueprint_normalization_keeps_geometry(self):
        image=Image.new('RGB',(100,80),'black');ImageDraw.Draw(image).rectangle((20,20,70,60),outline='white',width=2)
        normalized,details=normalize_drawing(image)
        self.assertTrue(details['darkPaperInverted'])
        self.assertEqual(normalized.getpixel((20,20)),(0,0,0))
        self.assertEqual(normalized.getpixel((0,0)),(255,255,255))

if __name__=='__main__':unittest.main()
