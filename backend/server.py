"""Serve the frontend and local inference on the same origin, CPU only."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
import json
import argparse
import threading
import os
from collections import OrderedDict
from pathlib import Path
runtime = Path(__file__).resolve().parents[1]/'models/runtime'
(runtime/'Ultralytics').mkdir(parents=True,exist_ok=True)
os.environ.setdefault('YOLO_CONFIG_DIR',str(runtime))
from inference import Engine, ROOT
MODEL_DIR=ROOT/'models/drawing-classifier'

engine = None
classifier = None
classification_cache = OrderedDict()
inference_lock = threading.Lock()
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(ROOT/'dist'),**kwargs)
    def end_headers(self):
        # Development files must refresh together when editing buildless modules.
        self.send_header('Cache-Control','no-store')
        super().end_headers()
    def json(self,status,data):
        payload = json.dumps(data,ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
    def do_GET(self):
        if self.path == '/api/health':
            self.json(200,{'ready':engine is not None, 'classificationReady':(MODEL_DIR/'pytorch_model.bin').exists(), 'engine':'local-cpu', 'schemaVersion':2})
        else:
            super().do_GET()
    def do_POST(self):
        global classifier
        if self.path not in ['/api/analyze','/api/classify']: return self.json(404,{'error':'Ruta no disponible.'})
        origin = self.headers.get('Origin')
        if origin and origin != f'http://127.0.0.1:{self.server.server_port}' and origin != f'http://localhost:{self.server.server_port}':
            return self.json(403,{'error':'Origen no permitido.'})
        content_type = self.headers.get('Content-Type','').split(';')[0]
        if content_type not in ['image/jpeg','image/png','image/webp']:
            return self.json(415,{'error':'Se requiere una imagen JPEG, PNG o WEBP.'})
        try: length = int(self.headers.get('Content-Length','0'))
        except ValueError: return self.json(400,{'error':'Tamaño no válido.'})
        if length <= 0 or length > 20*1024*1024:
            return self.json(413,{'error':'Límite de 20 MB.'})
        # Both routes share the same neural worker. Queue either direction of
        # overlap instead of silently forcing an interior back to line detection.
        acquired=inference_lock.acquire(timeout=30)
        if not acquired: return self.json(503,{'error':'El motor está ocupado; vuelve a intentar.'})
        try:
            payload=self.rfile.read(length)
            if self.path == '/api/classify':
                import hashlib
                key=hashlib.sha256(payload).hexdigest()
                if key in classification_cache:
                    result=classification_cache[key]
                    classification_cache.move_to_end(key)
                else:
                    if classifier is None:
                        from drawing_classifier import DrawingClassifier
                        classifier=DrawingClassifier()
                    result=classifier.classify(payload)
                    classification_cache[key]=result
                    if len(classification_cache)>32: classification_cache.popitem(last=False)
            else:
                result = engine.predict(payload)
            self.json(200,result)
        except Exception as error:
            self.json(422,{'error':str(error)[:300]})
        finally:
            inference_lock.release()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4173)
    args = parser.parse_args()
    print('Cargando modelos locales…',flush=True)
    engine = Engine()
    server = ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    print(f'Local: http://127.0.0.1:{args.port}',flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: server.server_close()
