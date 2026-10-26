import { REFERENCE_PROJECTS, createPresentationStore, canRestorePresentation } from './presentation-projects.js';
import { estimateReferenceRegistration, registrationFromBounds } from './reference-surfaces.js';
import { refineStructure } from './structure-evidence.js';
import { summarizeAnalysis } from './analysis-quality.js';
import * as THREE from 'three';
import { blueprintBridge as bridge } from './app.js?v=5';
import { createAppearanceLayer } from './appearance-3d.js';
import { fitImageSize, bindFileDrop, zoomView } from './workspace-ui.js';
import { enhanceBlueprintPixels, FINISH_PRESETS, createRenderRecord } from './blueprint-preprocess.js';
import { createCalibration, restoreCalibration } from './calibration.js';
import { SAMPLE } from './sample.js?v=4';
import { distance, polygonMetrics, geometryBounds, pointOnCanvas, pixelToWorld, worldToPixel, validSupportURL, vectorSVG, dxfPaths, boundsOf, isSimplePolygon, cadWallGeometry } from './technical-geometry.js';

const $=id=>document.getElementById(id), readStore=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},saveStore=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{message('El navegador no permite guardar las preferencias. Se aplican en esta sesión.');}};
const model={step:1,queue:[],asset:null,selection:0,version:0,processed:false,boundary:[],mode:null,points:[],measurements:[],calibration:null,bounds:null,vectors:null,render:null,compare:true,threeRuler:false,busy:false,view:{zoom:1,panX:0,panY:0},panEnabled:false,sourceOnly:false,presentation:null,renderRecord:null};
const original=$('originalCanvas'),render=$('renderCanvas'),overlay=$('measureCanvas');
const clean=document.createElement('canvas'),preview=document.createElement('canvas');
let cgiConfigured=false,cgiAbort=null;
let topRenderer,lastCalibration,lastWorkflowHash,extensionGroup=new THREE.Group(),last3DModel,textureModel,frameId;
extensionGroup.name='ProdalamV2TechnicalOverlay';
const appearance=createAppearanceLayer();
const presentationStore=createPresentationStore();
let appearanceApplied=false,appearanceImage=null,appearancePixels=null,appearanceTimer;
const appearanceOptions={mode:'ambient',reference:false,referenceTextures:true,environment:true,registration:{offsetX:0,offsetY:0,zoom:1}};
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
function setBusy(busy){
  model.busy=busy;
  $('boardStage').setAttribute('aria-busy',String(busy));
  for(const id of ['replacePlanFiles','newProjectButton','flowFiles','pdfPage','loadExample','chooseBoardFiles'])$(id).disabled=busy;
  for(const id of ['processVectors','vectorWidth','grayscale','invertContrast','flowCalibrate','rulerToggle','areaToggle','closeArea','clearMeasurements','dimensionToggle','measureUnit','resetBoard','paperCleanup','sourcePreview','boardZoomIn','boardZoomOut','boardPan','downloadClean'])$(id).disabled=busy||!model.asset;
  $('advance3d').disabled=busy||!model.processed;
  for(const id of ['finishPreset','finishPrompt','importCGI','renderSource','proceedStep2'])$(id).disabled=busy||!model.processed;
  $('generateCGI').disabled=busy||!model.processed||!cgiConfigured;
  $('vectorOverlay').disabled=busy||!model.processed;
  $('downloadVectors').disabled=busy||!model.vectors;
  for(const el of document.querySelectorAll('.flow-step'))el.disabled=busy||(['2','3'].includes(el.dataset.step)&&!model.processed);
  for(const el of $('fileQueue').querySelectorAll('button'))el.disabled=busy;
}
function fitBoard(){
  if(!model.asset||model.step===3)return;
  const stage=$('boardStage'),css=getComputedStyle(stage);
  const rect=stage.getBoundingClientRect();
  const width=Math.floor(rect.width-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight));
  const height=Math.floor(rect.height-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom));
  const fit=fitImageSize(clean.width,clean.height,width,height);
  if(!fit)return;
  $('boardFrame').style.width=`${fit.width}px`;
  $('boardFrame').style.height=`${fit.height}px`;
  applyBoardTransform();
}
new ResizeObserver(fitBoard).observe($('boardStage'));

function setStep(step){
  if(model.busy||step>1&&!model.processed)return;
  if(document.body.classList.contains('desk-focus'))$('focusDesk').click();
  const previousStep=model.step;model.step=step;if(previousStep!==step)document.querySelector('.flow-sidebar').scrollTop=0;$('workflow').hidden=step===3;$('step3Host').hidden=step!==3;
  for(const el of document.querySelectorAll('.flow-step')){const selected=Number(el.dataset.step)===step;el.classList.toggle('active',selected);el.classList.toggle('done',Number(el.dataset.step)<step);if(selected)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');}
  if(step===3){bridge.show3D();refreshThree();syncAppearance(true);return;}
  appearance.restore();appearanceApplied=false;
  $('flowTitle').innerHTML=step===1?'Todo comienza<br>con un plano.':'Del trazo<br>al espacio.';
  $('flowDescription').textContent=step===1?'Prepara tu lámina, define una escala y transforma el trazo en espacio.':'Desliza la cortina para comprobar la alineación de la geometría sobre el plano.';
  $('boardEyebrow').textContent=step===1?'PASO 1 / MESA TÉCNICA':'PASO 2 / RENDER CENITAL';
  for(const id of ['preprocessControls','processVectors'])$(id).hidden=step!==1;
  for(const id of ['advance3d','backToPlan','comparatorControls','downloadRender','renderBadge'])$(id).hidden=step!==2;
  $('step2Controls').hidden=step!==2;$('fileQueue').hidden=step!==1||model.queue.length<2;$('replacePlanFiles').hidden=step!==1;
  $('proceedStep2').hidden=step!==1||!model.processed;
  $('extractionStatus').hidden=step!==1||!model.processed;
  $('downloadClean').hidden=step!==1;
  render.hidden=step!==2||model.sourceOnly;$('curtainLine').hidden=step!==2||!model.compare;
  drawBoard();applyCurtain();requestAnimationFrame(fitBoard);
}
for(const el of document.querySelectorAll('.flow-step'))el.onclick=()=>setStep(Number(el.dataset.step));
$('backToPlan').onclick=()=>setStep(1);$('resetBoard').onclick=()=>{model.view={zoom:1,panX:0,panY:0};fitBoard();message('Plano completo ajustado a la mesa, sin recortes.');};
function drawQueue(){
  $('fileQueue').hidden=model.queue.length<2||model.step!==1;
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
for(const id of ['boardStage'])bindFileDrop($(id),{onFiles:addFiles,isBusy:()=>model.busy});
// Prevent dropping files outside the desk from navigating away from this project.
for(const type of ['dragover','drop'])document.addEventListener(type,event=>{if(Array.from(event.dataTransfer?.types??[]).includes('Files'))event.preventDefault();});
$('chooseBoardFiles').onclick=()=>$('flowFiles').click();$('replacePlanFiles').onclick=()=>$('flowFiles').click();
$('newProjectButton').onclick=()=>{if(model.busy)return;if(model.queue.length)$('newProjectDialog').showModal();else resetProject();};
$('cancelNewProject').onclick=()=>$('newProjectDialog').close();
$('confirmNewProject').onclick=()=>{$('newProjectDialog').close();resetProject();};
function resetProject(){
  const oldAssets=model.queue,hashes=new Set(oldAssets.map(a=>a.identity).filter(Boolean));
  if(model.processedHash)hashes.add(model.processedHash);
  for(const hash of hashes)try{localStorage.removeItem(`prodalam.scale.${hash}`);localStorage.removeItem(`blueprint.scale.v1.${hash}`);}catch{}
  Object.assign(model,{step:1,queue:[],asset:null,source:null,selection:model.selection+1,version:model.version+1,processed:false,processedHash:null,boundary:[],mode:null,points:[],measurements:[],calibration:null,bounds:null,vectors:null,render:null,compare:true,threeRuler:false,busy:false,view:{zoom:1,panX:0,panY:0},panEnabled:false,sourceOnly:false,presentation:null,renderRecord:null});
  appearance.restore();appearanceApplied=false;appearanceImage=null;appearancePixels=null;resetAppearanceOptions();
  lastCalibration=null;textureModel=null;resetPresentation();$('paperCleanup').checked=false;$('vectorOverlay').checked=false;$('sourcePreview').value='prepared';$('boardPan').setAttribute('aria-pressed','false');
  disposeOverlay();
  topRenderer?.dispose();topRenderer?.forceContextLoss();topRenderer=null;
  const {controls,renderer}=bridge.context();if(controls)controls.enabled=true;if(renderer)renderer.domElement.style.cursor='';
  for(const id of ['grayscale','invertContrast','dimensionToggle'])$(id).checked=false;
  $('technicalGrid').checked=true;$('measureUnit').value='m';$('vectorWidth').value='1';$('vectorWidthValue').textContent='1,0 px';
  for(const id of ['rulerToggle','areaToggle','threeRuler','threeDimensions'])$(id).setAttribute('aria-pressed','false');
  $('closeArea').hidden=true;$('boardFrame').classList.remove('measuring');
  $('curtainRange').value='50';$('compareMode').classList.add('active');$('compareMode').setAttribute('aria-pressed','true');$('renderMode').classList.remove('active');$('renderMode').setAttribute('aria-pressed','false');$('sourceMode').classList.remove('active');$('sourceMode').setAttribute('aria-pressed','false');$('cgiFile').value='';
  $('flowFiles').value='';$('pdfPage').replaceChildren();$('pdfPageRow').hidden=true;
  $('boardFilename').textContent='Proyecto sin título';$('rulerResult').textContent='Carga un plano para comenzar a medir.';$('threeDistance').textContent='Medición sobre el plano horizontal · m';
  for(const canvas of [clean,preview,original,render,overlay]){canvas.width=1;canvas.height=1;}
  $('boardFrame').hidden=true;$('boardEmpty').hidden=false;$('boardStage').classList.add('is-empty');$('boardStage').classList.remove('dragging');
  drawQueue();setBusy(false);setStep(1);updateMetrics();
  message('Nuevo proyecto listo. Arrastra tus planos a la mesa o selecciona archivos.');
  for(const asset of oldAssets)asset.pdf?.destroy().catch(()=>{});
  $('chooseBoardFiles').focus({preventScroll:true});
}

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
    $('boardFrame').hidden=false;$('boardEmpty').hidden=true;$('boardStage').classList.remove('is-empty');
    resetPresentation();model.view={zoom:1,panX:0,panY:0};model.panEnabled=false;$('boardPan').setAttribute('aria-pressed','false');$('vectorOverlay').checked=false;$('sourcePreview').value='prepared';$('paperCleanup').checked=false;
    model.asset=asset;model.source=source;model.calibration=null;model.measurements=[];model.points=[];model.mode=null;model.vectors=null;model.bounds=null;model.render=null;model.boundary=[];model.processed=false;model.version++;
    $('grayscale').checked=false;$('invertContrast').checked=false;$('vectorWidth').value='1';$('vectorWidthValue').textContent='1,0 px';
    drawQueue();$('rulerResult').textContent='Selecciona la regla y marca dos puntos.';$('boardFilename').textContent=asset.name+(asset.kind==='pdf'?` · página ${asset.page}`:'');$('pdfPageRow').hidden=asset.kind!=='pdf';
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
  const filters=`grayscale(${$('grayscale').checked?1:0}) invert(${$('invertContrast').checked?1:0})`;
  ctx.filter=$('paperCleanup').checked?'none':filters;
  if(model.asset.kind==='dxf'){
    const c=document.createElement('canvas');c.width=sw;c.height=sh;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,sw,sh);x.lineWidth=Number($('vectorWidth').value);x.strokeStyle='#1c2933';for(const p of model.asset.mappedPaths){x.beginPath();p.points.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));if(p.closed)x.closePath();x.stroke();}ctx.drawImage(c,0,0,clean.width,clean.height);
  }else ctx.drawImage(model.source,0,0,clean.width,clean.height);
  ctx.filter='none';
  if($('paperCleanup').checked){const enhanced=enhanceBlueprintPixels(ctx.getImageData(0,0,clean.width,clean.height));ctx.putImageData(new ImageData(enhanced.data,enhanced.width,enhanced.height),0,0);if($('grayscale').checked||$('invertContrast').checked){const copy=document.createElement('canvas');copy.width=clean.width;copy.height=clean.height;copy.getContext('2d').drawImage(clean,0,0);ctx.filter=filters;ctx.drawImage(copy,0,0);ctx.filter='none';}}
  for(const c of [original,render,overlay,preview]){c.width=clean.width;c.height=clean.height;}
  $('boardFrame').style.aspectRatio=`${clean.width}/${clean.height}`;drawBoard();requestAnimationFrame(fitBoard);
}
function invalidate(){resetPresentation();$('vectorOverlay').checked=false;$('vectorOverlay').disabled=true;$('proceedStep2').hidden=true;$('extractionStatus').hidden=true;model.processed=false;model.render=null;model.vectors=null;model.bounds=null;model.version++;$('downloadVectors').disabled=true;document.querySelector('[data-step="2"]').disabled=true;document.querySelector('[data-step="3"]').disabled=true;prepareClean();updateMetrics();message('Preparación actualizada. Procesa de nuevo para sincronizar los Pasos 2 y 3.');setBusy(false);}
for(const id of ['grayscale','invertContrast','vectorWidth','paperCleanup'])$(id).oninput=()=>{$('vectorWidthValue').textContent=`${fmt(Number($('vectorWidth').value),1)} px`;invalidate();};
$('sourcePreview').onchange=drawBoard;$('vectorOverlay').onchange=drawBoard;
$('technicalGrid').onchange=drawBoard;$('dimensionToggle').onchange=()=>{drawOverlay();refreshThree();};$('measureUnit').onchange=()=>{drawOverlay();updateMetrics();refreshThree();};
function drawBoard(){
  const ctx=original.getContext('2d');ctx.clearRect(0,0,original.width,original.height);if(model.step===1&&$('sourcePreview').value==='original'&&model.source)ctx.drawImage(model.source,0,0,original.width,original.height);else ctx.drawImage(clean,0,0);
  if(model.vectors&&model.step===1&&$('vectorOverlay').checked){ctx.strokeStyle='#005b9a99';ctx.lineWidth=Number($('vectorWidth').value);const data=model.vectors;for(const p of data.wallPolygons??[])for(const ring of [p.outer,...(p.holes??[])]){ctx.beginPath();ring.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.stroke();}for(const w of data.walls??[]){ctx.beginPath();ctx.moveTo(w.axis==='h'?w.from:w.c,w.axis==='h'?w.c:w.from);ctx.lineTo(w.axis==='h'?w.to:w.c,w.axis==='h'?w.c:w.to);ctx.stroke();}}
  if(model.render)drawPresentation();drawOverlay();
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
  $('flowScaleStatus').textContent=!model.asset?'Carga un plano para definir su escala.':model.calibration?`Escala calibrada · ${fmt(s*1000,3)} mm / píxel`:'Sin calibrar · ancho de imagen supuesto de 24 m';
  const boundaryMetrics=model.boundary.length?polygonMetrics(model.boundary,s):null;
  const values=b?[distanceLabel(Math.max(b.width,b.height)*s),distanceLabel(Math.min(b.width,b.height)*s),`${fmt(boundaryMetrics?.perimeter??2*(b.width+b.height)*s)} m`,`${fmt(boundaryMetrics?.area??b.width*b.height*s*s)} m²`]:['—','—','—','—'];
  ['metricLength','metricWidth','metricPerimeter','metricArea'].forEach((id,i)=>$(id).textContent=(b&&provisional?'≈ ':'')+values[i]);
  $('metricNote').textContent=boundaryMetrics?`Superficie y perímetro del contorno definido por el usuario.${provisional?' Escala provisional: calibra una distancia.':''}`:b?`Envolvente rectangular de la estructura detectada; superficie y perímetro de esa envolvente, no superficie útil.${provisional?' Escala provisional: calibra una distancia conocida.':' Medidas según la calibración del usuario.'}`:'Procesa el plano para medir la envolvente de la estructura. La superficie útil requiere delimitar su contorno.';
  if(model.measurements.length){const m=model.measurements.at(-1);$('rulerResult').textContent=`${model.calibration?'':'Provisional · '}${distanceLabel(distance(...m,s))} · ${model.measurements.length} medición(es)`;}drawOverlay();
}
function tool(mode){model.panEnabled=false;$('boardPan').setAttribute('aria-pressed','false');applyBoardTransform();model.mode=model.mode===mode?null:mode;model.points=[];$('rulerToggle').setAttribute('aria-pressed',String(model.mode==='ruler'));$('areaToggle').setAttribute('aria-pressed',String(model.mode==='area'));$('closeArea').hidden=model.mode!=='area';$('boardFrame').classList.toggle('measuring',!!model.mode);message(model.mode==='area'?'Marca los vértices del perímetro en orden y pulsa Cerrar contorno. Evita cruces entre segmentos.':model.mode==='calibrate'?'Calibración: marca dos puntos separados al menos 10 píxeles y escribe su distancia real.':model.mode==='ruler'?'Regla: marca dos puntos. La distancia se calcula sobre el plano.':'Herramienta desactivada.');drawOverlay();}
$('areaToggle').onclick=()=>tool('area');$('closeArea').onclick=()=>{if(model.points.length<3){message('Marca al menos tres vértices para cerrar el contorno.',true);return;}if(!isSimplePolygon(model.points)){message('El contorno tiene cruces, puntos duplicados o superficie nula. Define un perímetro simple.',true);return;}model.boundary=model.points.map(p=>[...p]);model.points=[];model.mode=null;$('closeArea').hidden=true;$('areaToggle').setAttribute('aria-pressed','false');$('boardFrame').classList.remove('measuring');updateMetrics();refreshThree();message('Superficie y perímetro calculados sobre el contorno definido.');};
$('flowCalibrate').onclick=()=>tool('calibrate');$('rulerToggle').onclick=()=>tool('ruler');
$('clearMeasurements').onclick=()=>{model.measurements=[];model.boundary=[];model.points=[];updateMetrics();refreshThree();$('rulerResult').textContent='Selecciona la regla y marca dos puntos.';};
overlay.onclick=e=>{
  if(!model.asset||!model.mode||model.busy||model.panEnabled)return;const p=pointOnCanvas(e,overlay);model.points.push(p);drawOverlay();if(model.mode==='area')return;
  if(model.points.length===2){if(distance(...model.points)<10){model.points=[];message('Separa los puntos al menos 10 píxeles.',true);return;}
    if(model.mode==='calibrate'){$('flowDistanceDialog').showModal();$('flowDistance').focus();}else{model.measurements.push(model.points.map(p=>[...p]));model.points=[];updateMetrics();refreshThree();}}
};
$('flowDistanceForm').onsubmit=e=>{
  e.preventDefault();try{model.calibration=createCalibration({imageSha256:model.asset.identity,width:clean.width,height:clean.height,points:model.points,distanceMeters:Number($('flowDistance').value)});try{localStorage.setItem(`prodalam.scale.${model.asset.identity}`,JSON.stringify(model.calibration));}catch{}if(model.processed){applySharedScale();generateRender();}model.points=[];model.mode=null;$('boardFrame').classList.remove('measuring');$('flowDistanceDialog').close();updateMetrics();refreshThree();message('Escala aplicada al plano, al render y al modelo 3D.');}catch(error){message(error.message,true);}
};
const cancelScale=()=>{model.points=[];model.mode=null;$('flowDistanceDialog').close();$('boardFrame').classList.remove('measuring');drawOverlay();};$('cancelFlowDistance').onclick=cancelScale;$('flowDistanceDialog').addEventListener('cancel',cancelScale);
function applySharedScale(){if(model.calibration){const s=bridge.snapshot();bridge.applyCalibration({...model.calibration,imageSha256:s.imageSha256,width:s.result.width,height:s.result.height});}}
$('processVectors').onclick=async()=>{
  if(model.busy||!model.asset)return;setBusy(true);message('Extrayendo contornos y preparando el render cenital…');await nextPaint();
  try{
    const unchanged=model.asset.kind==='image'&&!$('grayscale').checked&&!$('invertContrast').checked&&!$('paperCleanup').checked;
    const blob=unchanged?model.asset.file:await blobFromCanvas(clean),url=URL.createObjectURL(blob),previousToken=bridge.snapshot().fileToken;
    try{await bridge.loadImage(url,model.asset.name,model.asset.sample&&unchanged);}finally{URL.revokeObjectURL(url);}
    if(model.asset.kind==='dxf')bridge.importVectorGeometry(cadWallGeometry(model.asset.mappedPaths,clean.width,clean.height,Math.max(2,Number($('vectorWidth').value))));
    let snap=bridge.snapshot();if(snap.prediction&&snap.rawPrediction?.provenance?.execution==='live'){const refined=refineStructure(snap.prediction,snap.baseline);if(refined!==snap.prediction){bridge.importAnalysis(refined);snap=bridge.snapshot();}}if(snap.fileToken===previousToken||!snap.result)throw new Error('El motor no devolvió una geometría válida.');
    model.vectors=structuredClone(bridge.architecture());model.bounds=geometryBounds(model.vectors);
    if(!model.bounds)throw new Error('No se detectó estructura en esta lámina. Revisa contraste y orientación antes de continuar.');
    if(!model.calibration&&snap.calibration)model.calibration={...snap.calibration,imageSha256:model.asset.identity};
    applySharedScale();generateRender();model.processed=true;model.processedHash=snap.imageSha256;
    await restoreProjectPresentation();
    $('downloadVectors').disabled=false;setBusy(false);setStep(1);updateMetrics();
    updateAnalysisQuality(snap);
    $('extractionStatus').textContent=`Paso 1 listo · ${model.vectors.wallPolygons?.length??0} regiones de muro. Puedes activar la capa vectorial para revisar y continuar al Paso 2.`;
    message(model.presentation?'Plano procesado. El diseño fotorrealista vinculado está conservado y listo para comparar en el Paso 2.':'Vectores extraídos. La lámina limpia está lista para el Paso 2. Activa la capa vectorial si quieres revisar los contornos.');
  }catch(error){message(error.message,true);}finally{setBusy(false);}
};
function updateAnalysisQuality(snapshot){
  const quality=summarizeAnalysis(snapshot,Number($('confidence').value));
  $('analysisQuality').hidden=false;$('analysisQuality').classList.toggle('is-limited',quality.limited);$('analysisQuality').textContent=quality.message;
  $('proceedStep2').innerHTML=quality.limited?'Continuar solo con estructura <span>→</span>':'Continuar al Paso 2 <span>→</span>';
}

function generateRender(){
  appearance.restore();appearanceApplied=false;
  const ctx=bridge.context(),{scene,model:sourceModel}=ctx,s=bridge.snapshot();if(!sourceModel)throw new Error('El visor WebGL no está disponible para generar el render.');
  if(!topRenderer){topRenderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});topRenderer.setPixelRatio(1);topRenderer.shadowMap.enabled=true;topRenderer.shadowMap.type=THREE.PCFSoftShadowMap;topRenderer.outputColorSpace=THREE.SRGBColorSpace;topRenderer.toneMapping=THREE.ACESFilmicToneMapping;}
  const topAppearance=createAppearanceLayer();
  try{
    topAppearance.apply(ctx,{snapshot:s,architecture:bridge.architecture(),preset:$('finishPreset').value});
    const topScene=new THREE.Scene();topScene.background=new THREE.Color('#eeede9');
    for(const child of scene.children)if(child.isLight)topScene.add(child.clone());
    topScene.add(sourceModel.clone(true),topAppearance.group.clone(true));
    const w=s.result.width*s.metersPerPixel,h=s.result.height*s.metersPerPixel,camera=new THREE.OrthographicCamera(-w/2,w/2,h/2,-h/2,.1,1000);camera.position.set(0,100,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);camera.updateMatrixWorld();
    const renderScale=Math.min(2,2048/Math.max(clean.width,clean.height));topRenderer.toneMappingExposure=.92;topRenderer.setSize(Math.round(clean.width*renderScale),Math.round(clean.height*renderScale),false);topRenderer.render(topScene,camera);
    model.render=document.createElement('canvas');model.render.width=topRenderer.domElement.width;model.render.height=topRenderer.domElement.height;model.render.getContext('2d').drawImage(topRenderer.domElement,0,0);
    model.renderRecord=createRenderRecord({sourceHash:s.imageSha256,width:clean.width,height:clean.height,kind:'technical',nativeWidth:model.render.width,nativeHeight:model.render.height});
  }finally{topAppearance.restore();}
  drawBoard();if(model.step===3){textureModel=null;attachTexture();syncAppearance(true);}
}

function applyCurtain(){const value=Number($('curtainRange').value);$('curtainValue').textContent=`${value} %`;$('curtainLine').style.left=`${value}%`;render.style.clipPath=model.compare?`inset(0 0 0 ${value}%)`:'none';render.hidden=model.step!==2||model.sourceOnly;$('curtainLine').hidden=model.step!==2||!model.compare;$('originalBadge').hidden=model.step===2&&!model.compare&&!model.sourceOnly;}
$('curtainRange').oninput=applyCurtain;
let comparePointer=null;
const updateCompareFromPointer=event=>{const rect=$('boardFrame').getBoundingClientRect();$('curtainRange').value=Math.max(0,Math.min(100,(event.clientX-rect.left)/rect.width*100));applyCurtain();};
$('boardFrame').addEventListener('pointerdown',event=>{if(model.step!==2||!model.compare||model.mode||model.panEnabled||event.button!==0||event.target.closest('.curtain-line'))return;event.preventDefault();comparePointer=event.pointerId;$('boardFrame').setPointerCapture(event.pointerId);updateCompareFromPointer(event);});
$('boardFrame').addEventListener('pointermove',event=>{if(comparePointer===event.pointerId)updateCompareFromPointer(event);});
for(const type of ['pointerup','pointercancel'])$('boardFrame').addEventListener(type,event=>{if(comparePointer!==event.pointerId)return;comparePointer=null;if($('boardFrame').hasPointerCapture(event.pointerId))$('boardFrame').releasePointerCapture(event.pointerId);});
for(const [id,mode] of [['compareMode','compare'],['renderMode','render'],['sourceMode','source']])$(id).onclick=()=>{model.compare=mode==='compare';model.sourceOnly=mode==='source';for(const [other,value] of [['compareMode','compare'],['renderMode','render'],['sourceMode','source']]){$(other).classList.toggle('active',mode===value);$(other).setAttribute('aria-pressed',String(mode===value));}applyCurtain();};
$('curtainLine').onpointerdown=e=>{if(model.mode||model.panEnabled)return;e.preventDefault();$('curtainLine').setPointerCapture(e.pointerId);};$('curtainLine').onpointermove=e=>{if(!$('curtainLine').hasPointerCapture(e.pointerId))return;const rect=$('boardFrame').getBoundingClientRect();$('curtainRange').value=Math.max(0,Math.min(100,(e.clientX-rect.left)/rect.width*100));applyCurtain();};$('curtainLine').onpointerup=e=>{if($('curtainLine').hasPointerCapture(e.pointerId))$('curtainLine').releasePointerCapture(e.pointerId);};
$('downloadVectors').onclick=()=>{const vectors=model.asset.kind==='dxf'?{paths:model.asset.mappedPaths}:model.vectors;save(new Blob([vectorSVG(vectors,clean.width,clean.height,Number($('vectorWidth').value))],{type:'image/svg+xml'}),'prodalam-vectores.svg');};$('downloadRender').onclick=async()=>{try{save(await blobFromCanvas($('renderSource').value==='presentation'&&model.presentation?model.presentation.canvas:model.render),'prodalam-render-cenital.png');}catch(e){message(e.message,true);}};
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
function applyBoardTransform(){
  $('boardFrame').style.transform=`translate(${model.view.panX}px, ${model.view.panY}px) scale(${model.view.zoom})`;
  $('boardZoomValue').textContent=`${Math.round(model.view.zoom*100)} %`;
  $('boardStage').classList.toggle('panning-mode',model.panEnabled);
}
function changeZoom(zoom,anchor=[0,0]){if(!model.asset||model.busy)return;model.view=zoomView(model.view,zoom,anchor);applyBoardTransform();}
$('focusDesk').onclick=()=>{const expanded=document.body.classList.toggle('desk-focus');$('focusDesk').setAttribute('aria-pressed',String(expanded));$('focusDesk').textContent=expanded?'↙ Volver a la mesa':'⛶ Ampliar mesa';requestAnimationFrame(fitBoard);};
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('desk-focus'))$('focusDesk').click();});
$('boardZoomIn').onclick=()=>changeZoom(model.view.zoom*1.25);
$('boardZoomOut').onclick=()=>changeZoom(model.view.zoom/1.25);
$('boardPan').onclick=()=>{model.panEnabled=!model.panEnabled;model.mode=null;model.points=[];$('boardPan').setAttribute('aria-pressed',String(model.panEnabled));$('rulerToggle').setAttribute('aria-pressed','false');$('areaToggle').setAttribute('aria-pressed','false');$('closeArea').hidden=true;applyBoardTransform();drawOverlay();};
let panGesture=null;
$('boardStage').addEventListener('pointerdown',event=>{
  if(!model.asset||model.busy||!model.panEnabled&&event.button!==1)return;
  event.preventDefault();event.stopPropagation();$('boardStage').setPointerCapture(event.pointerId);
  panGesture={id:event.pointerId,x:event.clientX,y:event.clientY,panX:model.view.panX,panY:model.view.panY};
},true);
$('boardStage').addEventListener('pointermove',event=>{if(!panGesture||panGesture.id!==event.pointerId)return;model.view.panX=panGesture.panX+event.clientX-panGesture.x;model.view.panY=panGesture.panY+event.clientY-panGesture.y;applyBoardTransform();});
for(const type of ['pointerup','pointercancel'])$('boardStage').addEventListener(type,event=>{if(panGesture?.id!==event.pointerId)return;if($('boardStage').hasPointerCapture(event.pointerId))$('boardStage').releasePointerCapture(event.pointerId);panGesture=null;});
$('boardStage').addEventListener('wheel',event=>{if(!model.asset||model.busy)return;event.preventDefault();const rect=$('boardStage').getBoundingClientRect();changeZoom(model.view.zoom*Math.exp(-Math.max(-100,Math.min(100,event.deltaY))*.003),[event.clientX-(rect.left+rect.width/2),event.clientY-(rect.top+rect.height/2)]);},{passive:false});

function resetPresentation(){
  model.presentation=null;model.renderRecord=null;model.sourceOnly=false;$('analysisQuality').hidden=true;
  $('renderSource').value='technical';$('renderSource').querySelector('[value="presentation"]').disabled=true;
  updatePresentationLabel();
}
function drawPresentation(){
  const selected=$('renderSource').value==='presentation'?model.presentation?.canvas:null;
  const source=selected??model.render;if(!source)return;const density=Math.min(3,3072/Math.max(clean.width,clean.height)),width=Math.round(clean.width*density),height=Math.round(clean.height*density);if(render.width!==width||render.height!==height){render.width=width;render.height=height;}const target=render.getContext('2d');render.setAttribute('aria-label',selected?'Diseño fotorrealista vinculado al plano':'Render cenital local');
  target.clearRect(0,0,render.width,render.height);target.fillStyle='#f5f4ef';target.fillRect(0,0,render.width,render.height);
  const size=fitImageSize(source.width,source.height,render.width,render.height);
  target.drawImage(source,(render.width-size.width)/2,(render.height-size.height)/2,size.width,size.height);
}
function updatePresentationLabel(){
  const p=$('renderSource').value==='presentation'?model.presentation:null;
  $('renderBadge').textContent=p?(p.record.kind==='linked'?'DISEÑO VINCULADO · v2.3':p.record.kind==='generated'?'OPENAI · POR REVISAR':'RENDER IMPORTADO · POR REVISAR'):'RENDER LOCAL · PASO 2';
  $('renderProvenance').textContent=p?`${p.record.kind==='linked'?'Referencia aprobada de v2.3':p.record.kind==='generated'?'Generado con OpenAI':'Imagen importada'} · ${p.record.nativeWidth} × ${p.record.nativeHeight} px. Diseño vinculado al plano; revisa su correspondencia con la cortina.`:'Render local de los elementos reconocidos, con acabados de catálogo. La generación fotorrealista es una función distinta.';
}
async function installPresentation(image,kind,details={},persist=true){
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);
  const record=createRenderRecord({sourceHash:model.processedHash,width:clean.width,height:clean.height,nativeWidth:canvas.width,nativeHeight:canvas.height,kind,...details});record.designName=details.designName??null;record.imageBounds=details.imageBounds??null;
  const sample=document.createElement('canvas'),fit=fitImageSize(canvas.width,canvas.height,768,768);sample.width=Math.round(fit.width);sample.height=Math.round(fit.height);sample.getContext('2d').drawImage(canvas,0,0,sample.width,sample.height);
  appearanceOptions.registration=details.registration??(record.imageBounds?registrationFromBounds(canvas,{width:clean.width,height:clean.height},model.bounds,record.imageBounds):estimateReferenceRegistration(sample.getContext('2d').getImageData(0,0,sample.width,sample.height),{width:clean.width,height:clean.height},model.bounds));updateAlignmentInputs();
  model.presentation={canvas,record};$('renderSource').querySelector('[value="presentation"]').disabled=false;$('renderSource').value='presentation';drawPresentation();updatePresentationLabel();
  if(persist)try{await presentationStore.put(model.asset.identity,clean.width,clean.height,{blob:await blobFromCanvas(canvas),kind,designName:record.designName,imageBounds:record.imageBounds,provider:record.provider,model:record.model,registration:appearanceOptions.registration});}catch{$('renderProvenance').textContent+=' Disponible en esta sesión; el navegador no permitió guardarlo.';}
}
async function restoreProjectPresentation(){
  const identity=model.asset.identity,version=model.version,width=clean.width,height=clean.height;
  let saved;try{saved=await presentationStore.get(identity,width,height);}catch{}
  if(canRestorePresentation(saved,identity,width,height)){
    try{const image=await decodeImage(saved.blob);if(model.version===version&&model.asset.identity===identity){await installPresentation(image,saved.kind,{designName:saved.designName,provider:saved.provider,model:saved.model,imageBounds:saved.imageBounds??(saved.kind==='linked'?REFERENCE_PROJECTS[identity]?.imageBounds:null),registration:saved.kind==='linked'&&!saved.imageBounds?undefined:saved.registration},saved.kind==='linked'&&!saved.imageBounds);return true;}}catch{}
  }
  const linked=REFERENCE_PROJECTS[identity];if(!linked)return false;
  try{const response=await fetch(linked.url);if(!response.ok)return false;const image=await decodeImage(await response.blob());if(model.version!==version||model.asset.identity!==identity)return false;await installPresentation(image,'linked',{designName:linked.name,imageBounds:linked.imageBounds});return true;}catch{return false;}
}
$('renderSource').onchange=()=>{drawPresentation();updatePresentationLabel();};
$('finishPrompt').value=FINISH_PRESETS.oak.prompt;
$('finishPreset').onchange=()=>{$('finishPrompt').value=FINISH_PRESETS[$('finishPreset').value].prompt;if(model.processed){generateRender();drawPresentation();}};
async function checkCGIStatus(){
  try{const response=await fetch('./api/cgi/status');const status=await response.json();cgiConfigured=response.ok&&status.ready===true;$('cgiStatus').textContent=cgiConfigured?`OpenAI disponible · ${status.model}`:'OpenAI sin configurar · agrega tu clave API en .env y reinicia el servidor. Puedes usar el render técnico o importar una imagen.';}catch{cgiConfigured=false;$('cgiStatus').textContent='Generación IA no disponible en este servidor. Usa el render local o importa un render existente.';}
  setBusy(model.busy);
}
$('generateCGI').onclick=async()=>{
  if(model.busy||!model.processed||!cgiConfigured)return;
  const hash=model.processedHash,version=model.version;setBusy(true);cgiAbort=new AbortController();$('renderBusy').hidden=false;$('cancelCGI').hidden=false;
  message('Generando una presentación fotorrealista con OpenAI. El render actual se conserva durante la espera.');
  try{
    const response=await fetch('./api/cgi/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sourceHash:hash,width:clean.width,height:clean.height,imageDataUrl:clean.toDataURL('image/png'),preset:$('finishPreset').value,stylePrompt:$('finishPrompt').value}),signal:cgiAbort.signal});
    const data=await response.json();if(!response.ok)throw new Error(data.error??'No se pudo generar la imagen.');
    if(model.version!==version||model.processedHash!==hash||data.sourceHash!==hash)throw new Error('La respuesta corresponde a otra versión del plano. No se ha aplicado.');
    if(typeof data.imageDataUrl!=='string'||!data.imageDataUrl.startsWith('data:image/png;base64,'))throw new Error('El proveedor no devolvió una imagen compatible.');
    const image=new Image();image.src=data.imageDataUrl;await image.decode();
    await installPresentation(image,'generated',{provider:data.provider,model:data.model});message('Presentación OpenAI recibida. Usa la cortina para revisar las proporciones; la geometría técnica permanece vinculada al Paso 1.');
  }catch(error){message(error.name==='AbortError'?'Generación cancelada. Se conserva el render anterior.':error.message,error.name!=='AbortError');}
  finally{cgiAbort=null;$('renderBusy').hidden=true;$('cancelCGI').hidden=true;setBusy(false);}
};
$('cancelCGI').onclick=()=>cgiAbort?.abort();
$('importCGI').onclick=()=>{if(model.processed&&!model.busy)$('cgiFile').click();};
$('cgiFile').onchange=async event=>{
  const file=event.target.files[0];event.target.value='';if(!file||!model.processed||model.busy)return;
  if(file.size>20*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){message('Importa un render PNG, JPG o WEBP de hasta 20 MB.',true);return;}
  setBusy(true);
  try{const image=await decodeImage(file);await installPresentation(image,'imported');message('Render importado para comparación visual. No se afirma que sus muros coincidan con el plano; compruébalo con la cortina.');}
  catch(error){message(error.message,true);}finally{setBusy(false);}
};

// Presentation adapter: no changes to the existing reconstruction or furniture builders.
const appearancePanel=document.createElement('section');appearancePanel.className='three-appearance-panel';appearancePanel.setAttribute('aria-labelledby','appearanceTitle');
appearancePanel.innerHTML=`<div class="appearance-heading"><span class="eyebrow">CONTINUIDAD VISUAL · PASOS 2 → 3</span><h2 id="appearanceTitle">El mismo espacio.<br>Un nuevo acabado.</h2></div>
<div class="appearance-modes" role="group" aria-label="Acabado del modelo"><button id="ambientMode" aria-pressed="true">✦ Ambientado</button><button id="technicalMode" aria-pressed="false">◇ Técnico</button></div>
<p id="appearanceStatus" role="status">Materiales preparados para el modelo.</p><div id="appearanceSwatches" class="appearance-swatches" aria-label="Paleta de materiales"></div>
<p class="appearance-note">Texturas del diseño 2D sobre el modelo reconocido. La ubicación y la huella se conservan; formas y alturas del mobiliario son de catálogo.</p>
<label class="appearance-check"><input id="referenceTextures" type="checkbox" checked> Texturas y materiales del diseño 2D</label><label class="appearance-check"><input id="referenceEnvironment" type="checkbox" checked> Entorno exterior de la referencia</label>
<label class="appearance-check"><input id="appearanceReference" type="checkbox"> Superponer plano de referencia</label>
<details id="appearanceRegistration"><summary>Ajustar correspondencia del render</summary><p>Desplaza su encuadre para tomar colores del mismo recinto. El encuadre automático se puede corregir aquí. Estos ajustes solo afectan al acabado.</p>
<label for="appearanceOffsetX">Horizontal <output id="appearanceXValue">0 %</output></label><input id="appearanceOffsetX" type="range" min="-20" max="20" step=".5" value="0">
<label for="appearanceOffsetY">Vertical <output id="appearanceYValue">0 %</output></label><input id="appearanceOffsetY" type="range" min="-20" max="20" step=".5" value="0">
<label for="appearanceScale">Escala del render <output id="appearanceScaleValue">100 %</output></label><input id="appearanceScale" type="range" min=".7" max="1.4" step=".01" value="1"><button id="resetAppearanceAlignment" class="flow-text">Alinear automáticamente</button></details>`;
$('step3Host').querySelector('.source-section').before(appearancePanel);
const appearanceBadge=document.createElement('div');appearanceBadge.className='appearance-view-badge';appearanceBadge.hidden=true;appearanceBadge.textContent='✦ ACABADOS DEL PASO 2';$('viewer').append(appearanceBadge);
function resetAppearanceOptions(){appearanceOptions.mode='ambient';appearanceOptions.reference=false;appearanceOptions.referenceTextures=true;appearanceOptions.environment=true;$('referenceTextures').checked=true;$('referenceEnvironment').checked=true;appearanceOptions.registration={offsetX:0,offsetY:0,zoom:1};$('appearanceReference').checked=false;resetAlignmentInputs();}
function updateAlignmentInputs(){const r=appearanceOptions.registration;for(const [id,value]of [['appearanceOffsetX',r.offsetX],['appearanceOffsetY',r.offsetY],['appearanceScale',r.zoom]])$(id).value=value;$('appearanceXValue').value=`${fmt(r.offsetX,1)} %`;$('appearanceYValue').value=`${fmt(r.offsetY,1)} %`;$('appearanceScaleValue').value=`${Math.round(r.zoom*100)} %`;}
function resetAlignmentInputs(){appearanceOptions.registration={offsetX:0,offsetY:0,zoom:1};updateAlignmentInputs();}
function syncAppearance(force=false){
  if(model.step!==3){if(appearanceApplied){appearance.restore();appearanceApplied=false;}appearanceBadge.hidden=true;return;}
  if(!force)return;
  const ambient=appearanceOptions.mode==='ambient';for(const [id,selected]of [['ambientMode',ambient],['technicalMode',!ambient]])$(id).setAttribute('aria-pressed',String(selected));
  $('appearanceReference').disabled=!ambient;for(const id of ['referenceTextures','referenceEnvironment'])$(id).disabled=!ambient||!model.presentation;$('appearanceRegistration').hidden=!ambient||!model.presentation;
  appearanceBadge.hidden=!ambient;appearancePanel.classList.toggle('is-technical',!ambient);
  if(!ambient){appearance.restore();appearanceApplied=false;$('appearanceStatus').textContent='Vista técnica original · geometría y materiales del levantamiento.';$('appearanceSwatches').replaceChildren();return;}
  try{
    const ctx=bridge.context(),snapshot=bridge.snapshot();
    if(model.presentation?.canvas!==appearanceImage){appearanceImage=model.presentation?.canvas;appearancePixels=null;if(appearanceImage){const sample=document.createElement('canvas'),fit=fitImageSize(appearanceImage.width,appearanceImage.height,768,768);sample.width=Math.round(fit.width);sample.height=Math.round(fit.height);sample.getContext('2d').drawImage(appearanceImage,0,0,sample.width,sample.height);appearancePixels=sample.getContext('2d').getImageData(0,0,sample.width,sample.height);}}
    const result=appearance.apply(ctx,{snapshot,architecture:bridge.architecture(),presentation:model.presentation,imageData:appearancePixels,preset:$('finishPreset').value,registration:appearanceOptions.registration,reference:appearanceOptions.reference,referenceTextures:appearanceOptions.referenceTextures,environment:appearanceOptions.environment});
    appearanceApplied=!!result;if(!result){appearanceBadge.hidden=true;return;}
    $('appearanceStatus').textContent=`${result.source==='presentation'?'Diseño del Paso 2 · '+result.textureRooms+' pisos con textura recuperada':'Estilo '+FINISH_PRESETS[$('finishPreset').value].label} · ${result.furniture} muebles ambientados.`;
    appearanceBadge.textContent=result.source==='presentation'?'✦ ACABADOS DEL PASO 2':'✦ '+FINISH_PRESETS[$('finishPreset').value].label.toUpperCase();
    $('appearanceSwatches').replaceChildren(...[['wood','Madera'],['fabric','Textil base'],['wall','Muros'],['stone','Piedra']].map(([key,label])=>{const chip=document.createElement('span');chip.title=label;chip.setAttribute('aria-label',label+' '+result.palette[key]);const dot=document.createElement('i');dot.style.background=result.palette[key];chip.append(dot,document.createTextNode(label));return chip;}));
  }catch(error){appearance.restore();appearanceApplied=false;appearanceBadge.hidden=true;$('appearanceStatus').textContent='No se pudo aplicar el acabado. Se conserva la vista técnica. '+error.message;}
}
$('ambientMode').onclick=()=>{appearanceOptions.mode='ambient';syncAppearance(true);};$('technicalMode').onclick=()=>{appearanceOptions.mode='technical';syncAppearance(true);};
$('referenceTextures').onchange=()=>{appearanceOptions.referenceTextures=$('referenceTextures').checked;syncAppearance(true);};$('referenceEnvironment').onchange=()=>{appearanceOptions.environment=$('referenceEnvironment').checked;syncAppearance(true);};
$('appearanceReference').onchange=()=>{appearanceOptions.reference=$('appearanceReference').checked;syncAppearance(true);};
for(const [id,key,output,multiplier]of [['appearanceOffsetX','offsetX','appearanceXValue',1],['appearanceOffsetY','offsetY','appearanceYValue',1],['appearanceScale','zoom','appearanceScaleValue',100]])$(id).oninput=()=>{appearanceOptions.registration[key]=Number($(id).value);$(output).value=`${Math.round(Number($(id).value)*multiplier*10)/10} %`;clearTimeout(appearanceTimer);appearanceTimer=setTimeout(()=>{syncAppearance(true);persistRegistration();},150);};
$('resetAppearanceAlignment').onclick=()=>{appearanceOptions.registration=model.presentation?.record.imageBounds?registrationFromBounds(model.presentation.canvas,{width:clean.width,height:clean.height},model.bounds,model.presentation.record.imageBounds):appearancePixels?estimateReferenceRegistration(appearancePixels,{width:clean.width,height:clean.height},model.bounds):{offsetX:0,offsetY:0,zoom:1};updateAlignmentInputs();syncAppearance(true);persistRegistration();};
async function persistRegistration(){if(!model.presentation||!model.asset)return;try{const saved=await presentationStore.get(model.asset.identity,clean.width,clean.height);if(saved)await presentationStore.put(model.asset.identity,clean.width,clean.height,{...saved,registration:{...appearanceOptions.registration}});}catch{}}
$('tab3d').addEventListener('click',()=>{appearanceBadge.hidden=appearanceOptions.mode!=='ambient';});for(const id of ['tab2d','tabEval'])$(id).addEventListener('click',()=>appearanceBadge.hidden=true);

// Observe replacement of the existing model without intercepting its internal logic.
function observeViewer(){const {model:current}=bridge.context();const snap=bridge.snapshot();if(model.processed&&snap.imageSha256===model.processedHash&&snap.calibration!==lastCalibration){lastCalibration=snap.calibration;model.calibration=snap.calibration?{...snap.calibration,imageSha256:model.asset.identity}:null;updateMetrics();}
if(current!==last3DModel){last3DModel=current;attachTexture();refreshThree();syncAppearance(true);}extensionGroup.visible=model.step===3&&bridge.snapshot().view==='3d';toolbar.hidden=bridge.snapshot().view!=='3d';frameId=requestAnimationFrame(observeViewer);}
observeViewer();
window.addEventListener('pagehide',()=>{appearance.restore();cancelAnimationFrame(frameId);disposeOverlay();topRenderer?.dispose();});
async function loadSample(){
  if(model.busy)return;
  setBusy(true);
  try{const sampleBlob=await (await fetch(SAMPLE.imageUrl)).blob();const sample={name:'plano.jpeg',kind:'image',file:new File([sampleBlob],'plano.jpeg',{type:'image/jpeg'}),sample:true,page:1};model.queue.push(sample);setBusy(false);await selectAsset(sample);}
  catch(error){setBusy(false);message(`No se pudo cargar el ejemplo: ${error.message}`,true);}
}
$('loadExample').onclick=loadSample;
$('proceedStep2').onclick=()=>{setStep(2);updatePresentationLabel();};
$('downloadClean').onclick=async()=>{if(model.asset)save(await blobFromCanvas(clean),'prodalam-plano-limpio.png');};
checkCGIStatus();
resetProject();
