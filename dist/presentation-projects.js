/** Explicit design references supplied/approved by the user; never inference output. */
export const REFERENCE_PROJECTS=Object.freeze({
  '9f3f598dd2db7f26fa7374c0b5bbbf7764e70bda9febb9aca65243fe3389f049':{url:'./assets/presentation/reference-v23.png',name:'Referencia de diseño aprobada · v2.3',imageBounds:{x0:126,y0:98,x1:2535,y1:1480}},
  'e31bf22f4e6e71bc96e679cde230ee6d243b02d3064cabbce085312e7999c34e':{url:'./assets/presentation/reference-v23.png',name:'Referencia de diseño aprobada · v2.3',imageBounds:{x0:126,y0:98,x1:2535,y1:1480}}
});
export function presentationKey(identity,width,height){if(!/^[a-f0-9]{64}$/.test(identity??'')||![width,height].every(n=>Number.isInteger(n)&&n>0))throw new Error('Identidad de presentación no válida.');return `${identity}:${width}x${height}`;}
export function canRestorePresentation(saved,identity,width,height){return !!saved&&saved.assetIdentity===identity&&saved.width===width&&saved.height===height&&saved.blob instanceof Blob;}
export function createPresentationStore(indexedDB=globalThis.indexedDB){
  let pending;
  const open=()=>pending??=(new Promise((resolve,reject)=>{if(!indexedDB){reject(new Error('El navegador no ofrece almacenamiento de proyectos.'));return;}const req=indexedDB.open('prodalam-design-references',1);req.onupgradeneeded=()=>req.result.createObjectStore('presentations');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);}));
  async function transact(mode,key,value){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('presentations',mode),store=tx.objectStore('presentations'),req=value===undefined?store.get(key):store.put(value,key);tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  const key=(identity,w,h,domain)=>{if(!['interior','exterior','mechanical','structure'].includes(domain))throw new Error('Disciplina no válida.');return (domain==='interior'?'':domain+':')+presentationKey(identity,w,h);};
  return {get:(identity,w,h,domain='interior')=>transact('readonly',key(identity,w,h,domain)),put:(identity,w,h,value,domain='interior')=>transact('readwrite',key(identity,w,h,domain),{...value,assetIdentity:identity,width:w,height:h})};
}

/** AI artwork is paired only to its actual source, never by file name. */
export const GENERATED_EXTERIOR_PROJECTS=Object.freeze({
  '81331e9731e53cb39c46ec13616d3e519998f829a38610496a8332ced6a3641d':{url:'./assets/presentation/facade-ai-v28.png',name:'Propuesta de fachada IA · v2.8',provider:'OpenAI',model:'image_gen · Codex',domain:'exterior',geometryValidated:false}
});
