import http from 'node:http';
import { createLocalEngine } from './backend/local-engine.mjs';
import { CGIError, generateCGI } from './backend/cgi-service.mjs';
try { process.loadEnvFile?.('.env'); } catch (error) { if(error.code!=='ENOENT') console.warn('No se pudo leer el archivo .env.'); }
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpeg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.webp':'image/webp', '.svg':'image/svg+xml', '.wasm':'application/wasm' };
const localEngine=createLocalEngine({root:path.dirname(root),port:Number(process.env.INFERENCE_PORT||4174)});
let generating=false;
export const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const json=(status,payload)=>res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(payload));
    if(pathname==='/api/health'&&req.method==='GET')return json(200,await localEngine.health());
    if(pathname==='/api/analyze'){
      if(req.method!=='POST')return json(405,{error:'Usa POST para analizar el plano.'});
      const origin=req.headers.origin,port=server.address().port;
      if(req.headers['sec-fetch-site']==='cross-site'||origin&&![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(origin))return json(403,{error:'Origen no permitido.'});
      const mime=req.headers['content-type']?.split(';')[0];if(!['image/jpeg','image/png','image/webp'].includes(mime))return json(415,{error:'Se requiere una imagen JPEG, PNG o WEBP.'});
      let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>20*1024*1024){json(413,{error:'El plano supera 20 MB.'});req.resume();return;}chunks.push(chunk);}
      if(!size)return json(400,{error:'La imagen está vacía.'});
      const result=await localEngine.analyze(Buffer.concat(chunks),mime);return json(result.status,result.data);
    }
    if(pathname==='/api/cgi/status'&&req.method==='GET')return json(200,{provider:'OpenAI',ready:!!process.env.OPENAI_API_KEY&&process.env.OPENAI_API_KEY!=='YOUR_OPENAI_API_KEY',model:process.env.OPENAI_IMAGE_MODEL||'gpt-image-2.5-sunburst'});
    if(pathname==='/api/cgi/render'){
      if(req.method!=='POST')return json(405,{error:'Usa POST para generar el render.'});
      const origin=req.headers.origin,port=server.address().port;
      if(origin&&![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(origin))return json(403,{error:'Origen no permitido.'});
      if(req.headers['sec-fetch-site']==='cross-site')return json(403,{error:'Origen no permitido.'});
      if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{error:'Se requiere JSON.'});
      if(generating)return json(409,{error:'Ya hay un render en curso. Espera a que termine.'});
      generating=true;
      const controller=new AbortController();
      res.on('close',()=>{if(!res.writableEnded)controller.abort();});
      try{
        let size=0;const chunks=[];
        for await(const chunk of req){size+=chunk.length;if(size>16*1024*1024){json(413,{error:'La lámina supera el límite permitido.'});req.resume();return;}chunks.push(chunk);}
        let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return json(400,{error:'Solicitud JSON no válida.'});}
        const result=await generateCGI(body,{signal:controller.signal});return json(200,result);
      }catch(error){if(res.destroyed)return;if(error instanceof CGIError)return json(error.status,{code:error.code,error:error.message});return json(503,{error:'No se pudo completar la generación. Se conserva el render anterior.'});}
      finally{generating=false;}
    }
    if(req.method!=='GET'&&req.method!=='HEAD')return json(405,{error:'Método no permitido.'});
    const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!target.startsWith(root + path.sep) && target !== root) { res.writeHead(403).end(); return; }
    const data = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(data);
  } catch { res.writeHead(404).end('Archivo no encontrado'); }
});
server.on('close',()=>localEngine.stop());
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{localEngine.stop();server.close(()=>process.exit(0));});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${server.address().port}`));
