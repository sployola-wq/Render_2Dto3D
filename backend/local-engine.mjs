import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
/** The public server owns a private loopback inference worker. No upload leaves this machine. */
export function createLocalEngine({root,port=4174}={}){
  let child=null,state='unavailable',readyPromise=Promise.resolve(false);
  const base=`http://127.0.0.1:${port}`;
  async function probe(){try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(1200)}),data=await r.json();return r.ok&&data.ready===true&&data.engine==='local-cpu';}catch{return false;}}
  async function start(){
    if(await probe()){state='ready';return true;}
    const python=path.join(root,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
    if(!existsSync(python)||!['cubicasa.pkl','furniture-yolov8.pt'].every(f=>existsSync(path.join(root,'models',f))))return false;
    state='starting';
    return new Promise(resolve=>{
      let settled=false;const finish=ok=>{if(settled)return;settled=true;clearTimeout(timer);if(ok)state='ready';resolve(ok);};
      const timer=setTimeout(()=>finish(false),90000);timer.unref();
      child=spawn(python,['-u',path.join(root,'backend/server.py'),'--port',String(port)],{cwd:root,stdio:['ignore','pipe','pipe'],env:{...process.env,PYTHONUNBUFFERED:'1',MPLCONFIGDIR:path.join(root,'models/runtime/matplotlib')}});
      child.stdout.on('data',data=>{const line=data.toString();process.stdout.write('[IA local] '+line);if(line.includes('Local:'))finish(true);});
      child.stderr.on('data',data=>process.stderr.write('[IA local] '+data.toString()));
      child.on('error',()=>{state='failed';finish(false);});child.on('exit',()=>{state='stopped';child=null;finish(false);});
    });
  }
  readyPromise=start();
  return {
    async health(){await readyPromise;const ready=await probe();return {ready,engine:'local-cpu',schemaVersion:2,status:ready?'ready':state,detail:ready?'Reconocimiento local de estructura, aberturas y mobiliario.':'Reconocimiento de mobiliario no disponible. Instala el motor local; los contornos por sí solos no generan un interior amueblado.'};},
    async analyze(bytes,mime,signal){await readyPromise;if(!await probe())return {status:503,data:{error:'El motor de reconocimiento local no está disponible. No se ha generado mobiliario ficticio.'}};try{const response=await fetch(base+'/api/analyze',{method:'POST',headers:{'Content-Type':mime},body:bytes,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(180000)]):AbortSignal.timeout(180000)});return {status:response.status,data:await response.json()};}catch{return {status:503,data:{error:'No se pudo completar el reconocimiento local. Conserva el plano y vuelve a intentar.'}};}},
    stop(){child?.kill('SIGTERM');}
  };
}
