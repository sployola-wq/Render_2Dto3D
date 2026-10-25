import * as THREE from 'three';
import { blueprintBridge as bridge } from './app.js?v=5';
import { createCalibration, restoreCalibration } from './calibration.js';
import { SAMPLE } from './sample.js?v=4';
import { distance, polygonMetrics, geometryBounds, pointOnCanvas, pixelToWorld, worldToPixel, validSupportURL, vectorSVG, dxfPaths, boundsOf, isSimplePolygon, cadWallGeometry } from './technical-geometry.js';

const $=id=>document.getElementById(id), readStore=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},saveStore=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{message('El navegador no permite guardar las preferencias. Se aplican en esta sesión.');}};
const model={step:1,queue:[],asset:null,selection:0,version:0,processed:false,boundary:[],mode:null,points:[],measurements:[],calibration:null,bounds:null,vectors:null,render:null,compare:true,threeRuler:false,busy:false};
const original=$('originalCanvas'),render=$('renderCanvas'),overlay=$('measureCanvas');
const clean=document.createElement('canvas'),preview=document.createElement('canvas');
let topRenderer,lastCalibration,lastWorkflowHash,extensionGroup=new THREE.Group(),last3DModel,textureModel,frameId;
extensionGroup.name='ProdalamV2TechnicalOverlay';
const theme=readStore('prodalam.theme','light');
function setTheme(value){document.documentElement.dataset.theme=value;$('themeToggle').setAttribute('aria-label',value==='dark'?'Activar modo claro':'Activar modo oscuro');$('themeToggle').querySelector('span').textContent=value==='dark'?'Modo claro':'Modo oscuro';}
setTheme(theme);$('themeToggle').onclick=()=>{const value=document.documentElement.dataset.theme==='dark'?'light':'dark';setTheme(value);saveStore('prodalam.theme',value);};
let developer=readStore('prodalam.developer',{name:'',role:'Ingeniero de Software',org:'Prodalam',contact:''});
function updateDeveloper(){for(const [id,key] of [['developerName','name'],['developerRole','role'],['developerOrg','org']])$(id).value=developer[key]??'';$('developerContact').value=developer.contact??'';for(const [id,key,fallback] of [['aboutName','name','Por configurar'],['aboutRole','role','Ingeniero de Software'],['aboutOrg','org','Prodalam']])$(id).textContent=developer[key]||fallback;const href=validSupportURL(developer.contact);$('aboutContact').hidden=!href;$('aboutNoContact').hidden=!!href;if(href)$('aboutContact').href=href;else $('aboutContact').removeAttribute('href');}
updateDeveloper();
for(const id of ['aboutButton','footerAbout'])$(id).onclick=()=>$('aboutDialog').showModal();
$('settingsButton').onclick=()=>$('settingsDialog').showModal();
$('configureDeveloper').onclick=()=>{$('aboutDialog').close();$('settingsDialog').showModal();};
for(const el of document.querySelectorAll('[data-close]'))el.onclick=()=>$(el.dataset.close).close();
$('developerForm').onsubmit=e=>{e.preventDefault();const contact=$('developerContact').value.trim();if(contact&&!validSupportURL(contact)){message('Usa un enlace de contacto HTTP o HTTPS.',true);return;}developer={name:$('developerName').value.trim(),role:$('developerRole').value.trim(),org:$('developerOrg').value.trim(),contact};saveStore('prodalam.developer',developer);updateDeveloper();$('settingsDialog').close();};
function message(text,error=false){$('boardMessage').textContent=text;$('boardMessage').classList.toggle('error',error);}
const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
function save(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
const blobFromCanvas=canvas=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('No se pudo convertir la lámina.')),'image/png'));
function fmt(n,digits=2){return n.toLocaleString('es-CL',{maximumFractionDigits:digits,minimumFractionDigits:digits});}
function scale(){return model.calibration?.metersPerPixel??24/clean.width;}
function distanceLabel(value){return $('measureUnit').value==='mm'?`${fmt(value*1000,0)} mm`:`${fmt(value)} m`;}
function setBusy(busy){model.busy=busy;for(const id of ['processVectors','advance3d','flowFiles','pdfPage','vectorWidth','grayscale','invertContrast'])$(id).disabled=busy;for(const el of document.querySelectorAll('.flow-step'))el.disabled=busy||(['2','3'].includes(el.dataset.step)&&!model.processed);for(const el of $('fileQueue').querySelectorAll('button'))el.disabled=busy;}
function setStep(step){
  if(model.busy||step===2&&!model.processed)return;
  model.step=step;$('workflow').hidden=step===3;$('step3Host').hidden=step!==3;
  for(const el of document.querySelectorAll('.flow-step')){const selected=Number(el.dataset.step)===step;el.classList.toggle('active',selected);el.classList.toggle('done',Number(el.dataset.step)<step);if(selected)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');}
  if(step===3){bridge.show3D();refreshThree();return;}
  $('flowTitle').innerHTML=step===1?'Todo comienza<br>con un plano.':'Del trazo<br>al espacio.';
  $('flowDescription').textContent=step===1?'Prepara tu lámina, define una escala y transforma el trazo en espacio.':'Desliza la cortina para comprobar la alineación de la geometría sobre el plano.';
  $('boardEyebrow').textContent=step===1?'PASO 1 / MESA TÉCNICA':'PASO 2 / RENDER CENITAL';
  for(const id of ['preprocessControls','processVectors'])$(id).hidden=step!==1;
  for(const id of ['advance3d','backToPlan','comparatorControls','downloadRender','renderBadge'])$(id).hidden=step!==2;
  render.hidden=step!==2;$('curtainLine').hidden=step!==2||!model.compare;
  drawBoard();applyCurtain();
}
for(const el of document.querySelectorAll('.flow-step'))el.onclick=()=>setStep(Number(el.dataset.step));
$('backToPlan').onclick=()=>setStep(1);$('resetBoard').onclick=()=>{$('boardStage').scrollIntoView({block:'nearest',behavior:'smooth'});};
function drawQueue(){
  $('fileQueue').replaceChildren(...model.queue.map(asset=>{const b=document.createElement('button');b.type='button';b.classList.toggle('active',asset===model.asset);b.setAttribute('aria-label',`Abrir ${asset.name}`);b.setAttribute('aria-pressed',String(asset===model.asset));const span=document.createElement('span');span.textContent=asset.name;const small=document.createElement('small');small.textContent=asset.kind.toUpperCase();b.append(span,small);b.disabled=model.busy;b.onclick=()=>selectAsset(asset);return b;}));
}
async function decodeImage(blob){const image=new Image(),url=URL.createObjectURL(blob);try{image.src=url;await image.decode();if(image.naturalWidth<64||image.naturalHeight<64)throw new Error('La imagen debe medir al menos 64 × 64 píxeles.');if(image.naturalWidth*image.naturalHeight>25000000)throw new Error('La imagen supera 25 millones de píxeles.');return image;}finally{URL.revokeObjectURL(url);}}
async function addFiles(files){
  if(model.busy)return;
  const accepted=[],errors=[];
  for(const file of [...files].slice(0,20)){
    const ext=file.name.split('.').pop().toLowerCase(),kind=['png','jpg','jpeg','webp'].includes(ext)?'image':ext;
    if(!['image','pdf','dxf'].includes(kind)){errors.push(`${file.name}: formato no compatible`);continue;}
    if(file.size>20*1024*1024){errors.push(`${file.name}: supera 20 MB`);continue;}
    const asset={name:file.name,kind,file,page:1};model.queue.push(asset);accepted.push(asset);
  }
  drawQueue();if(accepted.length)await selectAsset(accepted[0]);if(errors.length)message(errors.join(' · '),true);
}
$('flowFiles').onchange=async e=>{await addFiles(e.target.files);e.target.value='';};
$('flowDrop').ondragover=e=>{e.preventDefault();$('flowDrop').classList.add('dragging');};$('flowDrop').ondragleave=()=>$('flowDrop').classList.remove('dragging');$('flowDrop').ondrop=e=>{e.preventDefault();$('flowDrop').classList.remove('dragging');addFiles(e.dataTransfer.files);};
async function selectAsset(asset){
  if(model.busy)return;const token=++model.selection;setBusy(true);message('Abriendo lámina…');
  try{
    let source,dxf=null;
    if(asset.kind==='pdf'){
      if(!asset.pdf){const pdf=await import('./vendor/pdfjs/pdf.js');pdf.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.js',import.meta.url).href;asset.pdf=await pdf.getDocument({data:new Uint8Array(await asset.file.arrayBuffer()),cMapUrl:new URL('./vendor/pdfjs/cmaps/',import.meta.url).href,cMapPacked:true,standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',import.meta.url).href,wasmUrl:new URL('./vendor/pdfjs/wasm/',import.meta.url).href,iccUrl:new URL('./vendor/pdfjs/iccs/',import.meta.url).href,isEvalSupported:false}).promise;}
      const page=await asset.pdf.getPage(asset.page),base=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(2,1400/Math.max(base.width,base.height))});
      source=document.createElement('canvas');source.width=Math.max(64,Math.round(viewport.width));source.height=Math.max(64,Math.round(viewport.height));await page.render({canvasContext:source.getContext('2d'),viewport}).promise;
    }else if(asset.kind==='dxf'){
      if(!asset.dxf){const Parser=(await import('./vendor/dxf-parser.js')).default;asset.dxf=dxfPaths(new Parser().parseSync(await asset.file.text()));}
      dxf=asset.dxf;source=document.createElement('canvas');const b=dxf.bounds,f=1280/Math.max(b.width,b.height,1);source.width=Math.max(64,Math.ceil(b.width*f)+60);source.height=Math.max(64,Math.ceil(b.height*f)+60);
      asset.mappedPaths=dxf.paths.map(p=>({...p,points:p.points.map(([x,y])=>[30+(x-b.x0)*f,30+(b.y1-y)*f])}));asset.cadMetersPerPixel=({1:.0254,2:.3048,4:.001,5:.01,6:1,7:1000}[dxf.units]??null);if(asset.cadMetersPerPixel)asset.cadMetersPerPixel/=f;
      const ctx=source.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,source.width,source.height);ctx.strokeStyle='#1c2933';ctx.lineWidth=1;for(const p of asset.mappedPaths){ctx.beginPath();p.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(p.closed)ctx.closePath();ctx.stroke();}
    }else source=asset.image??await decodeImage(asset.file);
    if(token!==model.selection)return;
    model.asset=asset;model.source=source;model.calibration=null;model.measurements=[];model.points=[];model.mode=null;model.vectors=null;model.bounds=null;model.render=null;model.boundary=[];model.processed=false;model.version++;
    $('grayscale').checked=false;$('invertContrast').checked=false;$('vectorWidth').value='1';$('vectorWidthValue').textContent='1,0 px';
    drawQueue();$('boardFilename').textContent=asset.name+(asset.kind==='pdf'?` · página ${asset.page}`:'');$('pdfPageRow').hidden=asset.kind!=='pdf';
    if(asset.pdf){$('pdfPage').replaceChildren(...Array.from({length:asset.pdf.numPages},(_,i)=>new Option(`${i+1} / ${asset.pdf.numPages}`,i+1)));$('pdfPage').value=asset.page;}
    prepareClean();
    const bytes=asset.kind==='image'?await asset.file.arrayBuffer():await (await blobFromCanvas(clean)).arrayBuffer();
    asset.identity=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
    try{model.calibration=restoreCalibration(localStorage.getItem(`prodalam.scale.${asset.identity}`),{imageSha256:asset.identity,width:clean.width,height:clean.height});}catch{}
    setBusy(false);setStep(1);updateMetrics();
    const omitted=dxf?.unsupported.length?` Entidades omitidas: ${dxf.unsupported.join(', ')}.`:'';
    message(`${asset.kind==='dxf'?'DXF importado como trazos 2D.':asset.kind==='pdf'?'Página PDF rasterizada localmente; extrae los contornos para continuar.':'Lámina lista. Ajusta su presentación y procesa los vectores.'}${omitted}${asset.cadMetersPerPixel?' Unidades CAD disponibles; confirma una cota antes de medir.':''}`);
  }catch(error){message(`No se pudo abrir ${asset.name}: ${error.message}`,true);}finally{setBusy(false);}
}
$('pdfPage').onchange=e=>{if(model.asset?.kind==='pdf'){model.asset.page=Number(e.target.value);selectAsset(model.asset);}};
function prepareClean(){
  if(!model.source)return;const sw=model.source.naturalWidth??model.source.width,sh=model.source.naturalHeight??model.source.height,f=Math.min(1,1400/Math.max(sw,sh));clean.width=Math.round(sw*f);clean.height=Math.round(sh*f);
  const ctx=clean.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,clean.width,clean.height);
  ctx.filter=`grayscale(${$('grayscale').checked?1:0}) invert(${$('invertContrast').checked?1:0})`;
  if(model.asset.kind==='dxf'){
    const c=document.createElement('canvas');c.width=sw;c.height=sh;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,sw,sh);x.lineWidth=Number($('vectorWidth').value);x.strokeStyle='#1c2933';for(const p of model.asset.mappedPaths){x.beginPath();p.points.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));if(p.closed)x.closePath();x.stroke();}ctx.drawImage(c,0,0,clean.width,clean.height);
  }else ctx.drawImage(model.source,0,0,clean.width,clean.height);
  ctx.filter='none';
  for(const c of [original,render,overlay,preview]){c.width=clean.width;c.height=clean.height;}
  $('boardFrame').style.aspectRatio=`${clean.width}/${clean.height}`;drawBoard();
}
function invalidate(){model.processed=false;model.render=null;model.vectors=null;model.bounds=null;model.version++;$('downloadVectors').disabled=true;document.querySelector('[data-step="2"]').disabled=true;document.querySelector('[data-step="3"]').disabled=true;prepareClean();updateMetrics();message('Preparación actualizada. Procesa de nuevo para sincronizar los Pasos 2 y 3.');}
for(const id of ['grayscale','invertContrast','vectorWidth'])$(id).oninput=()=>{$('vectorWidthValue').textContent=`${fmt(Number($('vectorWidth').value),1)} px`;invalidate();};
$('technicalGrid').onchange=drawBoard;$('dimensionToggle').onchange=()=>{drawOverlay();refreshThree();};$('measureUnit').onchange=()=>{drawOverlay();updateMetrics();refreshThree();};
function drawBoard(){
  const ctx=original.getContext('2d');ctx.clearRect(0,0,original.width,original.height);ctx.drawImage(clean,0,0);
  if(model.vectors&&model.step===1){ctx.strokeStyle='#005b9a99';ctx.lineWidth=Number($('vectorWidth').value);const data=model.vectors;for(const p of data.wallPolygons??[])for(const ring of [p.outer,...(p.holes??[])]){ctx.beginPath();ring.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.stroke();}for(const w of data.walls??[]){ctx.beginPath();ctx.moveTo(w.axis==='h'?w.from:w.c,w.axis==='h'?w.c:w.from);ctx.lineTo(w.axis==='h'?w.to:w.c,w.axis==='h'?w.c:w.to);ctx.stroke();}}
  if(model.render)render.getContext('2d').drawImage(model.render,0,0,render.width,render.height);drawOverlay();
}
function line2D(ctx,a,b,label,color='#005b9a'){
  ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();for(const p of [a,b]){ctx.beginPath();ctx.arc(...p,3.5,0,Math.PI*2);ctx.fill();}if(label){ctx.font=`600 ${Math.max(11,clean.width/95)}px Arial`;const tw=ctx.measureText(label).width,x=Math.max(tw/2+4,Math.min(clean.width-tw/2-4,(a[0]+b[0])/2)),y=Math.max(20,(a[1]+b[1])/2-10);ctx.fillStyle='#fffffff0';ctx.fillRect(x-tw/2-5,y-14,tw+10,20);ctx.fillStyle=color;ctx.textAlign='center';ctx.fillText(label,x,y);}ctx.restore();
}
function drawOverlay(){
  const ctx=overlay.getContext('2d');ctx.clearRect(0,0,overlay.width,overlay.height);
  if($('technicalGrid').checked&&model.step===1){
    const spacing=model.calibration?1/scale():100;let step=spacing;while(step<45)step*=2;while(step>220)step/=2;
    ctx.strokeStyle='#005b9a24';ctx.fillStyle='#005b9a';ctx.font='9px monospace';ctx.lineWidth=.7;
    for(let x=0;x<clean.width;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,clean.height);ctx.stroke();ctx.fillText(model.calibration?`${fmt(x*scale(),1)}m`:`${Math.round(x)}px`,x+3,12);}
    for(let y=0;y<clean.height;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(clean.width,y);ctx.stroke();if(y>15)ctx.fillText(model.calibration?`${fmt(y*scale(),1)}m`:`${Math.round(y)}px`,3,y+11);}
  }
  for(const m of model.measurements)line2D(ctx,...m,`${model.calibration?'':'≈ '}${distanceLabel(distance(...m,scale()))}`);
  if(model.boundary.length){ctx.fillStyle='#0086cb16';ctx.strokeStyle='#0086cb';ctx.lineWidth=2;ctx.beginPath();model.boundary.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();ctx.stroke();}
  if(model.mode==='area'&&model.points.length>1)for(let i=1;i<model.points.length;i++)line2D(ctx,model.points[i-1],model.points[i],'');
  for(const p of model.points)line2D(ctx,p,p,'','#cb8730');
  if($('dimensionToggle').checked&&model.bounds){const b=model.bounds,y=Math.max(18,b.y0-18),x=Math.min(clean.width-20,b.x1+18);line2D(ctx,[b.x0,y],[b.x1,y],`${model.calibration?'':'≈ '}${distanceLabel(b.width*scale())}`);line2D(ctx,[x,b.y0],[x,b.y1],`${model.calibration?'':'≈ '}${distanceLabel(b.height*scale())}`);}
}
function updateMetrics(){
  const b=model.bounds??(model.boundary.length?boundsOf(model.boundary):null),s=scale(),provisional=!model.calibration;
  $('flowScaleStatus').textContent=model.calibration?`Escala calibrada · ${fmt(s*1000,3)} mm / píxel`:'Sin calibrar · ancho de imagen supuesto de 24 m';
  const boundaryMetrics=model.boundary.length?polygonMetrics(model.boundary,s):null;
  const values=b?[distanceLabel(Math.max(b.width,b.height)*s),distanceLabel(Math.min(b.width,b.height)*s),`${fmt(boundaryMetrics?.perimeter??2*(b.width+b.height)*s)} m`,`${fmt(boundaryMetrics?.area??b.width*b.height*s*s)} m²`]:['—','—','—','—'];
  ['metricLength','metricWidth','metricPerimeter','metricArea'].forEach((id,i)=>$(id).textContent=(b&&provisional?'≈ ':'')+values[i]);
  $('metricNote').textContent=boundaryMetrics?`Superficie y perímetro del contorno definido por el usuario.${provisional?' Escala provisional: calibra una distancia.':''}`:b?`Envolvente rectangular de la estructura detectada; superficie y perímetro de esa envolvente, no superficie útil.${provisional?' Escala provisional: calibra una distancia conocida.':' Medidas según la calibración del usuario.'}`:'Procesa el plano para medir la envolvente de la estructura. La superficie útil requiere delimitar su contorno.';
  if(model.measurements.length){const m=model.measurements.at(-1);$('rulerResult').textContent=`${model.calibration?'':'Provisional · '}${distanceLabel(distance(...m,s))} · ${model.measurements.length} medición(es)`;}drawOverlay();
}
function tool(mode){model.mode=model.mode===mode?null:mode;model.points=[];$('rulerToggle').setAttribute('aria-pressed',String(model.mode==='ruler'));$('areaToggle').setAttribute('aria-pressed',String(model.mode==='area'));$('closeArea').hidden=model.mode!=='area';$('boardFrame').classList.toggle('measuring',!!model.mode);message(model.mode==='area'?'Marca los vértices del perímetro en orden y pulsa Cerrar contorno. Evita cruces entre segmentos.':model.mode==='calibrate'?'Calibración: marca dos puntos separados al menos 10 píxeles y escribe su distancia real.':model.mode==='ruler'?'Regla: marca dos puntos. La distancia se calcula sobre el plano.':'Herramienta desactivada.');drawOverlay();}
$('areaToggle').onclick=()=>tool('area');$('closeArea').onclick=()=>{if(model.points.length<3){message('Marca al menos tres vértices para cerrar el contorno.',true);return;}if(!isSimplePolygon(model.points)){message('El contorno tiene cruces, puntos duplicados o superficie nula. Define un perímetro simple.',true);return;}model.boundary=model.points.map(p=>[...p]);model.points=[];model.mode=null;$('closeArea').hidden=true;$('areaToggle').setAttribute('aria-pressed','false');$('boardFrame').classList.remove('measuring');updateMetrics();refreshThree();message('Superficie y perímetro calculados sobre el contorno definido.');};
$('flowCalibrate').onclick=()=>tool('calibrate');$('rulerToggle').onclick=()=>tool('ruler');
$('clearMeasurements').onclick=()=>{model.measurements=[];model.boundary=[];model.points=[];updateMetrics();refreshThree();$('rulerResult').textContent='Selecciona la regla y marca dos puntos.';};
overlay.onclick=e=>{
  if(!model.mode||model.busy)return;const p=pointOnCanvas(e,overlay);model.points.push(p);drawOverlay();if(model.mode==='area')return;
  if(model.points.length===2){if(distance(...model.points)<10){model.points=[];message('Separa los puntos al menos 10 píxeles.',true);return;}
    if(model.mode==='calibrate'){$('flowDistanceDialog').showModal();$('flowDistance').focus();}else{model.measurements.push(model.points.map(p=>[...p]));model.points=[];updateMetrics();refreshThree();}}
};
$('flowDistanceForm').onsubmit=e=>{
  e.preventDefault();try{model.calibration=createCalibration({imageSha256:model.asset.identity,width:clean.width,height:clean.height,points:model.points,distanceMeters:Number($('flowDistance').value)});try{localStorage.setItem(`prodalam.scale.${model.asset.identity}`,JSON.stringify(model.calibration));}catch{}if(model.processed){applySharedScale();generateRender();}model.points=[];model.mode=null;$('boardFrame').classList.remove('measuring');$('flowDistanceDialog').close();updateMetrics();refreshThree();message('Escala aplicada al plano, al render y al modelo 3D.');}catch(error){message(error.message,true);}
};
const cancelScale=()=>{model.points=[];model.mode=null;$('flowDistanceDialog').close();$('boardFrame').classList.remove('measuring');drawOverlay();};$('cancelFlowDistance').onclick=cancelScale;$('flowDistanceDialog').addEventListener('cancel',cancelScale);
function applySharedScale(){if(model.calibration){const s=bridge.snapshot();bridge.applyCalibration({...model.calibration,imageSha256:s.imageSha256,width:s.result.width,height:s.result.height});}}
$('processVectors').onclick=async()=>{
  if(model.busy)return;setBusy(true);message('Extrayendo contornos y preparando el render cenital…');await nextPaint();
  try{
    const unchanged=model.asset.kind==='image'&&!$('grayscale').checked&&!$('invertContrast').checked;
    const blob=unchanged?model.asset.file:await blobFromCanvas(clean),url=URL.createObjectURL(blob),previousToken=bridge.snapshot().fileToken;
    try{await bridge.loadImage(url,model.asset.name,model.asset.sample&&unchanged);}finally{URL.revokeObjectURL(url);}
    if(model.asset.kind==='dxf')bridge.importVectorGeometry(cadWallGeometry(model.asset.mappedPaths,clean.width,clean.height,Math.max(2,Number($('vectorWidth').value))));
    const snap=bridge.snapshot();if(snap.fileToken===previousToken||!snap.result)throw new Error('El motor no devolvió una geometría válida.');
    model.vectors=structuredClone(bridge.architecture());model.bounds=geometryBounds(model.vectors);
    if(!model.bounds)throw new Error('No se detectó estructura en esta lámina. Revisa contraste y orientación antes de continuar.');
    if(!model.calibration&&snap.calibration)model.calibration={...snap.calibration,imageSha256:model.asset.identity};
    applySharedScale();generateRender();model.processed=true;model.processedHash=snap.imageSha256;
    $('downloadVectors').disabled=false;setBusy(false);setStep(2);updateMetrics();
    message((model.asset.kind==='dxf'?'CAD: contornos pareados como muros; trazos aislados con espesor supuesto. Revisa la interpretación. ':'')+'CGI cenital alineado con el plano. Materiales y alturas de catálogo; no es una reconstrucción fotográfica validada. Desliza la cortina para revisar.');
  }catch(error){message(error.message,true);}finally{setBusy(false);}
};
function generateRender(){
  const {scene,model:sourceModel}=bridge.context(),s=bridge.snapshot();if(!sourceModel)throw new Error('El visor WebGL no está disponible para generar el render.');
  if(!topRenderer){topRenderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});topRenderer.setPixelRatio(1);topRenderer.shadowMap.enabled=true;topRenderer.shadowMap.type=THREE.PCFSoftShadowMap;topRenderer.outputColorSpace=THREE.SRGBColorSpace;topRenderer.toneMapping=THREE.ACESFilmicToneMapping;topRenderer.toneMappingExposure=1.05;}
  // A separate camera and renderer preserve the Step 3 camera, controls and scene.
  const topScene=new THREE.Scene();topScene.background=new THREE.Color('#f5f4ef');
  for(const child of scene.children)if(child.isLight)topScene.add(child.clone());
  const clone=sourceModel.clone(true);clone.traverse(o=>{if(o.isMesh&&o.geometry?.type==='PlaneGeometry'&&o.material?.map)o.visible=false;});topScene.add(clone);
  const w=s.result.width*s.metersPerPixel,h=s.result.height*s.metersPerPixel,camera=new THREE.OrthographicCamera(-w/2,w/2,h/2,-h/2,.1,1000);camera.position.set(0,100,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  topRenderer.setSize(clean.width,clean.height,false);topRenderer.render(topScene,camera);model.render=document.createElement('canvas');model.render.width=clean.width;model.render.height=clean.height;model.render.getContext('2d').drawImage(topRenderer.domElement,0,0);drawBoard();
}
function applyCurtain(){const value=Number($('curtainRange').value);$('curtainValue').textContent=`${value} %`;$('curtainLine').style.left=`${value}%`;render.style.clipPath=model.compare?`inset(0 0 0 ${value}%)`:'none';$('curtainLine').hidden=model.step!==2||!model.compare;$('originalBadge').hidden=model.step===2&&!model.compare;}
$('curtainRange').oninput=applyCurtain;
for(const [id,compare] of [['compareMode',true],['renderMode',false]])$(id).onclick=()=>{model.compare=compare;for(const [other,value] of [['compareMode',true],['renderMode',false]]){$(other).classList.toggle('active',value===compare);$(other).setAttribute('aria-pressed',String(value===compare));}applyCurtain();};
$('curtainLine').onpointerdown=e=>{if(model.mode)return;e.preventDefault();$('curtainLine').setPointerCapture(e.pointerId);};$('curtainLine').onpointermove=e=>{if(!$('curtainLine').hasPointerCapture(e.pointerId))return;const rect=$('boardFrame').getBoundingClientRect();$('curtainRange').value=Math.max(0,Math.min(100,(e.clientX-rect.left)/rect.width*100));applyCurtain();};$('curtainLine').onpointerup=e=>{if($('curtainLine').hasPointerCapture(e.pointerId))$('curtainLine').releasePointerCapture(e.pointerId);};
$('downloadVectors').onclick=()=>{const vectors=model.asset.kind==='dxf'?{paths:model.asset.mappedPaths}:model.vectors;save(new Blob([vectorSVG(vectors,clean.width,clean.height,Number($('vectorWidth').value))],{type:'image/svg+xml'}),'prodalam-vectores.svg');};$('downloadRender').onclick=async()=>{try{save(await blobFromCanvas(model.render),'prodalam-render-cenital.png');}catch(e){message(e.message,true);}};
function attachTexture(){
  const {planMesh,model:current}=bridge.context();if(!model.render||!planMesh||textureModel===current||bridge.snapshot().imageSha256!==model.processedHash)return;
  const texture=new THREE.CanvasTexture(model.render);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  planMesh.material.map?.dispose();planMesh.material.map=texture;planMesh.material.needsUpdate=true;textureModel=current;
}
$('advance3d').onclick=()=>{if(!model.processed||bridge.snapshot().imageSha256!==model.processedHash){message('El plano cambió. Vuelve a procesarlo para sincronizar el modelo.',true);return;}attachTexture();setStep(3);};
const toolbar=document.createElement('div');toolbar.className='three-measure-tools';toolbar.innerHTML='<button id="threeRuler" aria-pressed="false">↔ Medir en 3D</button><button id="threeDimensions" aria-pressed="false">⌗ Cotas</button><output id="threeDistance">Medición sobre el plano horizontal · m</output>';$('viewer').append(toolbar);
$('threeDimensions').onclick=()=>{$('dimensionToggle').checked=!$('dimensionToggle').checked;$('threeDimensions').setAttribute('aria-pressed',String($('dimensionToggle').checked));refreshThree();};
$('threeRuler').onclick=()=>{model.threeRuler=!model.threeRuler;model.points=[];$('threeRuler').setAttribute('aria-pressed',String(model.threeRuler));const {controls,renderer}=bridge.context();if(controls)controls.enabled=!model.threeRuler;if(renderer)renderer.domElement.style.cursor=model.threeRuler?'crosshair':'';$('threeDistance').textContent=model.threeRuler?'Marca dos puntos · Proyección en el plano horizontal':'Medición sobre el plano horizontal · m';};
const {renderer:initialRenderer}=bridge.context();
initialRenderer?.domElement.addEventListener('pointerdown',e=>{
  if(!model.threeRuler||bridge.snapshot().view!=='3d')return;
  const {camera,renderer}=bridge.context(),s=bridge.snapshot(),rect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hit=new THREE.Vector3();if(!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),hit))return;
  const p=worldToPixel(hit.toArray(),s.result.width,s.result.height,s.metersPerPixel);if(p[0]<0||p[1]<0||p[0]>s.result.width||p[1]>s.result.height)return;
  model.points.push(p);if(model.points.length===2){const d=distance(...model.points,s.metersPerPixel);model.measurements.push(model.points.map(p=>[...p]));model.points=[];$('threeDistance').textContent=`${s.calibrated?'':'Provisional · '}${distanceLabel(d)} · en plano horizontal`;refreshThree();}
},true);
function disposeOverlay(){for(const child of [...extensionGroup.children]){child.geometry?.dispose();child.material?.map?.dispose();child.material?.dispose();extensionGroup.remove(child);}}
function refreshThree(){
  const {scene}=bridge.context(),s=bridge.snapshot();if(!scene||!s.result)return;disposeOverlay();if(!extensionGroup.parent)scene.add(extensionGroup);extensionGroup.visible=s.view==='3d';
  const same=model.processedHash===s.imageSha256,b=geometryBounds(bridge.architecture()),scale3=s.metersPerPixel;
  const draw=(a,b,text)=>{
    const points=[a,b].map(p=>new THREE.Vector3(...pixelToWorld(p,s.result.width,s.result.height,scale3)).setY(.12));
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x0086cb,depthTest:false,transparent:true,opacity:.95}));line.renderOrder=100;extensionGroup.add(line);
    const c=document.createElement('canvas');c.width=512;c.height=80;const ctx=c.getContext('2d');ctx.fillStyle='#ffffffed';ctx.fillRect(0,0,512,80);ctx.fillStyle='#005b9a';ctx.font='500 36px Arial';ctx.textAlign='center';ctx.fillText(text,256,53);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false}));sprite.position.copy(points[0]).add(points[1]).multiplyScalar(.5);sprite.position.y=.18;sprite.scale.set(Math.max(2,s.result.width*scale3*.17),Math.max(.32,s.result.width*scale3*.026),1);sprite.renderOrder=101;extensionGroup.add(sprite);
  };
  if($('dimensionToggle').checked&&b){draw([b.x0,b.y0-20],[b.x1,b.y0-20],`${s.calibrated?'':'≈ '}${distanceLabel(b.width*scale3)}`);draw([b.x1+20,b.y0],[b.x1+20,b.y1],`${s.calibrated?'':'≈ '}${distanceLabel(b.height*scale3)}`);}
  if(same)for(const m of model.measurements)draw(...m,`${s.calibrated?'':'≈ '}${distanceLabel(distance(...m,scale3))}`);
  $('threeDimensions').setAttribute('aria-pressed',String($('dimensionToggle').checked));
}
// Observe replacement of the existing model without intercepting its internal logic.
function observeViewer(){const {model:current}=bridge.context();const snap=bridge.snapshot();if(model.processed&&snap.imageSha256===model.processedHash&&snap.calibration!==lastCalibration){lastCalibration=snap.calibration;model.calibration=snap.calibration?{...snap.calibration,imageSha256:model.asset.identity}:null;updateMetrics();}
if(current!==last3DModel){last3DModel=current;attachTexture();refreshThree();}extensionGroup.visible=model.step===3&&bridge.snapshot().view==='3d';toolbar.hidden=bridge.snapshot().view!=='3d';frameId=requestAnimationFrame(observeViewer);}
observeViewer();
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frameId);disposeOverlay();topRenderer?.dispose();});
const sampleBlob=await (await fetch(SAMPLE.imageUrl)).blob();const sample={name:'plano.jpeg',kind:'image',file:new File([sampleBlob],'plano.jpeg',{type:'image/jpeg'}),sample:true,page:1};model.queue.push(sample);await selectAsset(sample);
