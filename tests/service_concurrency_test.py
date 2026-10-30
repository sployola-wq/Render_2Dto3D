"""Exercise both API routes against the running local service at the same time."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request,urlopen
import io,json,struct,unittest,zlib
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
BASE='http://127.0.0.1:4173'
def image_bytes(name):
    data=(ROOT/'tests/fixtures'/f'{name}.rgba.z').read_bytes();w,h=struct.unpack('<II',data[:8]);out=io.BytesIO();Image.frombytes('RGBA',(w,h),zlib.decompress(data[8:])).convert('RGB').save(out,format='PNG');return out.getvalue()
def post(route,payload):
    request=Request(BASE+route,data=payload,headers={'Content-Type':'image/png'},method='POST')
    with urlopen(request,timeout=70) as response:return json.load(response)
class ConcurrentRecognition(unittest.TestCase):
    def test_classification_and_inference_preserve_both_results(self):
        with ThreadPoolExecutor(2) as pool:
            classify=pool.submit(post,'/api/classify',image_bytes('house-gabled'))
            analyze=pool.submit(post,'/api/analyze',image_bytes('interior-reported'))
            classification=classify.result(timeout=70);result=analyze.result(timeout=70)
        self.assertEqual(classification['domain'],'exterior');self.assertTrue(classification['confident'])
        self.assertGreaterEqual(len(result['wallPolygons']),8)
        furniture=[o for o in result['objects'] if o['confidence']>=.35 and o['category'] not in ['door','window']]
        self.assertGreaterEqual(len(furniture),10)
if __name__=='__main__':unittest.main()
