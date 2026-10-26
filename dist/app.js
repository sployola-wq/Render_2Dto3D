import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { CATEGORY, evaluatePrediction } from './evaluation.js';
import { buildComponents, buildArchitecturalOpenings } from './components.js?v=3';
import { reconstructArchitecture, buildWallLevels, prepareFurniture, openingHeights } from './architecture.js?v=5';
import { createCalibration, restoreCalibration } from './calibration.js';
import { SAMPLE } from './sample.js?v=4';
import { visualCases, auditRows, auditPanelHTML, drawOpeningAudit } from './opening-audit-view.js?v=5';

const $ = id => document.getElementById(id);
const state = { image: null, source: null, result: null, view: '3d', metersPerPixel: null, calibrated: false, points: [], calibrating: false, revision: 0, fileName: 'plano.jpeg', cameraMode: 'iso', fileToken: 0, prediction:null, reference:null, baseline:null, localEngine:false, inferenceAbort:null };
async function readJson(url) { try { const r=await fetch(url);return r.ok?await r.json():null; } catch { return null; } }
const [referenceFixture,predictionFixture,health,openingReviewFixture] = await Promise.all([readJson(SAMPLE.referenceUrl+'&review=5'),readJson(SAMPLE.predictionUrl),readJson('./api/health'),readJson('./data/openings-visual-review.json?v=5')]);
state.localEngine=health?.ready===true;
const workerJobs=new Map();
const pixelCanvas = document.createElement('canvas');
const pixelContext = pixelCanvas.getContext('2d', { willReadFrequently: true });
const canvas = $('planCanvas'), context = canvas.getContext('2d');
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let scene, camera, renderer, controls, model, wallsGroup, openingsGroup, planMesh, grid, componentsGroup;
let toastTimer,heightTimer;
const reconstructionCache=new Map();let wallLevelCache=null;
const isReconstructed=()=> $('modelMode').value==='reconstructed';
function architecture(mode=$('openingAssociation').value) {
  if(!state.result)return null;
  const cached=reconstructionCache.get(mode);
  if(cached?.source!==state.result||cached.confidence!==minConfidence()) {
    reconstructionCache.set(mode,{source:state.result,confidence:minConfidence(),data:reconstructArchitecture(state.result,{confidence:minConfidence(),openingMode:mode})});
  }
  return reconstructionCache.get(mode).data;
}
const geometryReviewCases=()=>visualCases(state.result,openingReviewFixture).filter(c=>c.geometryReview);
function updateOpeningCaseOptions() {
  const select=$('openingCase'),previous=select.value,cases=visualCases(state.result,openingReviewFixture);
  const objects=cases.length?cases.map(c=>state.result.objects.find(o=>o.id===c.objectId)):(state.result.objects??[]).filter(o=>['door','window'].includes(o.category));
  select.replaceChildren(new Option('Todos los casos','all'),...objects.map(o=>new Option(`${o.category==='door'?'Puerta':'Ventana'} ${o.id.replace('semantic-','')}`,o.id)));
  if(objects.some(o=>o.id===previous))select.value=previous;
}
function showOpeningCase(id='all') {
  if($('geometrySource').value!=='model'){$('geometrySource').value='model';syncResult();}
  $('openingAssociation').value='reviewed';syncResult();$('overlayMode').value='openingAudit';$('openingCase').value=id;setView('2d');
}
function wallLevels(data,height) {
  if(wallLevelCache?.source!==data||wallLevelCache.height!==height)wallLevelCache={source:data,height,levels:buildWallLevels(data,height)};
  return wallLevelCache.levels;
}

function toast(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 6000);
}
const minConfidence=()=>Number($('confidence').value);
const isManual=()=> $('geometrySource').value==='reference';
const pct=value=>value===null?'—':`${Math.round(value*100)} %`;
function visibleObjects(data=state.result, applyCategory=false) {
  const selection=$('categoryFilter').value;
  const manual=data?.provenance?.kind==='manual-reference';
  return (data?.objects??[]).filter(object=> {
    if(!manual && object.confidence<minConfidence())return false;
    if(object.category==='door' && !$('openingsVisible').checked)return false;
    if(object.category==='window' && !$('windowsVisible').checked)return false;
    if(!['door','window'].includes(object.category) && !$('furnitureVisible').checked)return false;
    if(!applyCategory || selection==='all')return true;
    return selection==='equipment'?!['door','window','bed','sofa','table','chair'].includes(object.category):object.category===selection;
  });
}
function syncResult(reset=false) {
  const selector=$('geometrySource');
  selector.querySelector('[value="reference"]').disabled=!state.reference;
  selector.querySelector('[value="model"]').disabled=!state.prediction;
  if(selector.value==='reference'&&!state.reference)selector.value=state.prediction?'model':'geometry';
  if(selector.value==='model'&&!state.prediction)selector.value='geometry';
  state.result=selector.value==='reference'?state.reference:selector.value==='geometry'?state.baseline:state.prediction;
  if(!state.result)return;
  $('openingAssociation').disabled=!isReconstructed();
  $('confidenceControl').hidden=selector.value!=='model';$('geometryControl').hidden=selector.value!=='geometry';
  const fallback=state.prediction?.provenance?.structureFallback==='geometry';
  selector.querySelector('[value="model"]').textContent=fallback?'Híbrido · muros geométricos + IA':'Predicción de IA';
  $('engineStatus').textContent=state.localEngine?(state.prediction?.provenance?.execution==='live'?'Análisis ejecutado en este equipo.':'Resultado guardado. Genera para ejecutar IA local.'):state.prediction?'Resultado de una ejecución local para este archivo.':'IA no disponible para esta imagen. Inicia el servicio Python local.';
  $('processingNote').textContent=state.localEngine?'Inferencia en este equipo; sin servicios externos.':'Las imágenes nuevas usan geometría sin el motor local.';
  $('summaryTitle').textContent=isManual()?'Referencia manual inicial':selector.value==='geometry'?'Detector geométrico anterior':fallback?'Levantamiento híbrido':'Predicción del modelo';
  $('summaryBadge').textContent=isManual()?'MANUAL':selector.value==='geometry'?'GEOMETRÍA':state.prediction?.provenance?.execution==='live'?'IA LOCAL':'ENSAYO IA';
  $('summarySubtitle').textContent=`${state.result.width} × ${state.result.height} px · ${state.calibrated?'Escala calibrada':'Escala provisional'}`;
  $('viewerLabel').classList.toggle('manual-source',isManual());
  $('overlayMode').querySelector('[value="reference"]').disabled=!state.reference;
  $('overlayMode').querySelector('[value="errors"]').disabled=!state.reference||!state.prediction;
  $('wallCount').textContent=state.result.wallPolygons?.length||state.result.walls?.length||0;
  $('wallCountLabel').textContent=state.result.wallPolygons?.length?'regiones de muro':'tramos de muro';
  $('openingCount').textContent=visibleObjects().length||(state.result.openings?.length??0);
  $('objectCountLabel').textContent=selector.value==='geometry'?'huecos candidatos':isManual()?'componentes anotados':'componentes propuestos';
  $('methodLabel').replaceChildren();
  $('methodLabel').append(document.createTextNode(isManual()?'Anotaciones manuales':selector.value==='geometry'?'Lectura geométrica':fallback?'Geometría + YOLOv8':'CubiCasa5K + YOLOv8'));
  const subtitle=document.createElement('small');subtitle.textContent=isManual()?'Inspección; no es una predicción':'Referencia separada de la inferencia';$('methodLabel').append(subtitle);
  $('statusText').textContent=isManual()?'Resultado esperado · Revisión inicial':'Detección lista · Compara en Evaluación';
  state.metrics=evaluatePrediction(state.prediction,state.reference,minConfidence());
  const reconstructed=architecture();
  state.reconstructionMetrics=evaluatePrediction({...state.result,walls:[],wallPolygons:reconstructed.wallPolygons},state.reference,minConfidence());
  const stats=reconstructed.stats;
  $('reconstructionStatus').textContent=`${stats.associatedOpenings} aberturas con soporte · ${stats.unmatchedOpenings} sin soporte · ${stats.rejectedOpeningFragments} fragmentos excluidos · ${geometryReviewCases().length} geometrías por revisar.`;
  updateOpeningCaseOptions();
  renderEvaluation();buildModel(reset);drawPlan();setView(state.view);updateExport();
}
function renderEvaluation() {
  const host=$('evaluationView'),m=state.metrics;
  if(!m){host.innerHTML='<div class="empty-evaluation"><strong>Sin referencia para esta imagen.</strong><p>La comparación se realiza únicamente cuando la huella del archivo coincide con el plano anotado. Carga plano.jpeg para revisar el ensayo.</p></div>';return;}
  const baseline=state.baseline?evaluatePrediction(state.baseline,state.reference,minConfidence()):null;
  const fallback=state.prediction.provenance.structureFallback==='geometry';
  const cleanMetrics=state.reconstructionMetrics,stats=architecture()?.stats;
  const transferred=state.reference?.provenance?.status==='transferred-initial-review';
  host.innerHTML=`<div class="evaluation-head"><div><span class="eyebrow">ENSAYO REPRODUCIBLE · 1 PLANO · ${state.result.width} × ${state.result.height} PX</span><h2>Lo que detecta. Lo que falta.</h2><p>Predicciones de IA frente a una referencia manual inicial.${transferred?` Anotaciones transferidas desde 724 × 424${state.reference.provenance.visualReview?', con revisión visual parcial del agente':''}; requieren validación independiente.`:''} Objetos emparejados por categoría y caja con IoU ≥ 0,50. Puntuación mínima: ${minConfidence().toFixed(2)}.</p></div><span class="evaluation-pill">${transferred?'REFERENCIA TRANSFERIDA · POR REVISAR':'REQUIERE REVISIÓN INDEPENDIENTE'}</span></div>
    <div class="metric-grid"><div class="metric-card"><span>MUROS · IoU DE MÁSCARA</span><strong>${pct(m.wallIou)}</strong><small>${fallback?'Se utiliza la geometría anterior. Segmentador probado: 0 regiones de muro.':'Superposición de áreas; no es exactitud constructiva.'}</small></div><div class="metric-card"><span>PRECISIÓN DE OBJETOS</span><strong>${pct(m.totals.precision)}</strong><small>${m.totals.tp} correctos de ${m.totals.tp+m.totals.fp} propuestos en las cinco clases evaluadas.</small></div><div class="metric-card"><span>COBERTURA DE OBJETOS</span><strong>${pct(m.totals.recall)}</strong><small>${m.totals.tp} encontrados de ${m.totals.tp+m.totals.fn} anotados en esas clases.</small></div></div>
    <div class="evaluation-table-wrap"><table class="evaluation-table"><thead><tr><th>Categoría</th><th>Referencia</th><th>Detectados</th><th>Correctos</th><th>Omitidos</th><th>Sobrantes</th><th>Precisión</th><th>Cobertura</th></tr></thead><tbody>${m.rows.map(r=>`<tr><td><i class="swatch" style="background:${CATEGORY[r.category].color}"></i>${CATEGORY[r.category].label}</td><td>${r.expected}</td><td>${r.predicted}</td><td class="number-good">${r.tp}</td><td class="number-missed">${r.fn}</td><td class="number-extra">${r.fp}</td><td>${pct(r.precision)}</td><td>${pct(r.recall)}</td></tr>`).join('')}</tbody></table></div>
    <p class="evaluation-caption"><strong>Alcance:</strong> cinco categorías evaluadas de un único plano. Sillas y equipamiento se muestran como propuestas auxiliares y no entran en estas métricas. La referencia fue anotada visualmente, sin entrenamiento con esta imagen.</p>
    <p class="evaluation-caption"><strong>Comparación estructural:</strong> geometría anterior ${pct(baseline?.wallIou??null)} de IoU.${fallback?' El segmentador no recuperó muros; el modo híbrido conserva explícitamente el detector anterior.':''} No se completan omisiones con las anotaciones manuales.</p>
    <div class="reconstruction-report"><strong>Reconstrucción de la fuente seleccionada</strong><p>${stats.originalVertices} → ${stats.cleanedVertices} vértices · ${stats.associatedOpenings} aberturas vinculadas; ${stats.unmatchedOpenings} sin soporte; ${geometryReviewCases().length} ventanas en revisión geométrica. Coincidencia de la huella limpia con la original: ${(stats.footprintIou*100).toFixed(1)} %.</p><p>IoU frente a la referencia: ${pct(cleanMetrics?.wallIou??null)} después de limpiar. Esta medida corresponde a la huella 2D, antes de reconstruir antepechos y dinteles. Las métricas de detección de arriba conservan la predicción original.</p><button id="compareReconstruction" class="outline-button">Comparar muros en 2D ↗</button></div>
    ${state.result===state.prediction?auditPanelHTML(state.result,architecture('legacy'),architecture('reviewed'),openingReviewFixture):''}
    <div class="evaluation-actions"><button id="showErrors" class="outline-button">Ver aciertos y errores ↗</button><button id="downloadMetrics" class="outline-button">↓ Descargar evaluación</button><button id="downloadReference" class="outline-button">↓ Referencia anotada</button></div>`;
  for(const button of host.querySelectorAll('[data-opening-case]'))button.onclick=()=>showOpeningCase(button.dataset.openingCase);
  if($('inspectOpenings'))$('inspectOpenings').onclick=()=>showOpeningCase();
  if($('downloadOpeningAudit'))$('downloadOpeningAudit').onclick=()=>download(new Blob([JSON.stringify({imageSha256:state.imageSha256,confidence:minConfidence(),before:architecture('legacy').stats,after:architecture('reviewed').stats,cases:auditRows(state.result,architecture('reviewed'),openingReviewFixture),independentReview:false},null,2)],{type:'application/json'}),'plano-auditoria-aberturas.json');
  $('showErrors').onclick=()=>{$('geometrySource').value='model';$('overlayMode').value='errors';state.view='2d';syncResult();};
  $('compareReconstruction').onclick=()=>{$('overlayMode').value='reconstructed';setView('2d');};
  $('downloadMetrics').onclick=()=>download(new Blob([JSON.stringify(m,null,2)],{type:'application/json'}),'plano-evaluacion.json');
  $('downloadReference').onclick=()=>download(new Blob([JSON.stringify(state.reference,null,2)],{type:'application/json'}),'plano-referencia-manual.json');
}
function updateExport() {
  $('exportJson').disabled = !state.result;
  $('exportPng').disabled = !state.result || state.view === 'evaluation' || (state.view === '3d' && !renderer);
}
function setView(view) {
  if (view !== '2d' && state.calibrating) cancelCalibration();
  state.view = view;
  $('windowsVisible').onchange=()=>syncResult();$('furnitureVisible').onchange=()=>syncResult();
document.querySelectorAll('.view-tab').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active));
  });
  $('threeView').hidden = view !== '3d'; $('planView').hidden = view !== '2d'; $('evaluationView').hidden = view !== 'evaluation';
  $('overlayControls').hidden=view!=='2d'||state.calibrating;$('viewerLabel').hidden=view==='evaluation';
  $('presentationControls').hidden=view!=='3d';
  const auditing=view==='2d'&&$('overlayMode').value==='openingAudit';
  $('openingCase').hidden=!auditing;$('categoryFilter').hidden=auditing;$('openingAuditNote').hidden=!auditing;
  $('viewer').classList.toggle('audit-view',auditing);
  const focusCase=visualCases(state.result,openingReviewFixture).find(c=>c.objectId===$('openingCase').value);
  $('openingAuditNote').textContent=focusCase?focusCase.note:'Naranja: propuesta de IA · Verde: reconstrucción con soporte · Azul: referencia. La asociación no valida la extensión del vano.';
  $('modelQualityNote').hidden=view!=='3d';
  $('cameraControls').hidden = view !== '3d'; $('modelSummary').hidden = view === 'evaluation';
  $('emptyState').hidden = view === 'evaluation' || !state.result || (state.result.walls?.length??0)+(state.result.wallPolygons?.length??0)>0;
  $('viewLabelText').textContent = view === '3d' ? (state.cameraMode === 'top' ? 'VISTA SUPERIOR' : 'VISTA AXONOMÉTRICA') : view === '2d' ? ($('overlayMode').value==='reconstructed'?'MUROS · ANTES Y DESPUÉS':isManual()||$('overlayMode').value==='reference'?'REFERENCIA MANUAL · INSPECCIÓN':$('overlayMode').value==='errors'?'COMPARACIÓN IA · CINCO CATEGORÍAS':'DETECCIÓN SOBRE EL ORIGINAL') : 'EVALUACIÓN';
  $('navigationHint').textContent = view === '3d' ? 'Arrastra para orbitar · Rueda para zoom' : $('overlayMode').value==='errors'?'Solo las cinco categorías evaluadas':'Propuestas y anotaciones se mantienen separadas';
  document.querySelector('.legend').innerHTML=view==='2d'&&$('overlayMode').value==='errors'?'<span><i class="swatch" style="background:#398064"></i> Correctos</span><span><i class="swatch" style="background:#c47470"></i> Omitidos</span><span><i class="swatch" style="background:#b38d43"></i> Sobrantes</span>':'<span><i class="swatch wall-swatch"></i> Muros</span><span><i class="swatch opening-swatch"></i> Puertas</span><span><i class="swatch window-swatch"></i> Ventanas</span><span><i class="swatch furniture-swatch"></i> Muebles</span>';
  document.querySelector('.legend').hidden = view === 'evaluation';
  if(view==='2d'&&$('overlayMode').value==='reconstructed')document.querySelector('.legend').innerHTML='<span><i class="swatch" style="background:#c48a45"></i>Original</span><span><i class="swatch" style="background:#398064"></i>Reconstrucción</span>';
  if(auditing){$('viewLabelText').textContent='AUDITORÍA DE ABERTURAS';document.querySelector('.legend').innerHTML='<span><i class="swatch" style="background:#cf8734"></i>Propuesta IA</span><span><i class="swatch" style="background:#1d8061"></i>Reconstrucción</span><span><i class="swatch" style="background:#567bac"></i>Referencia</span>';}
  if (view === '2d') drawPlan();
  if (view === '3d') resize();
  updateExport();
}

function initThree() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.domElement.setAttribute('aria-label', 'Modelo 3D generado sobre el plano. Arrastra para orbitar y usa la rueda para acercar.');
    $('threeView').appendChild(renderer.domElement);
    scene = new THREE.Scene(); scene.background=new THREE.Color('#edf0eb');
    camera = new THREE.OrthographicCamera(-20, 20, 15, -15, .1, 500);
    camera.position.set(22, 28, 30);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = .09;
    controls.minZoom = .3; controls.maxZoom = 12;
    controls.maxPolarAngle = Math.PI / 2 - .03; controls.minPolarAngle = .01;
    controls.target.set(0, .5, 0); controls.update();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa7b2a4, 1.7));
    const sunlight = new THREE.DirectionalLight(0xfffaee, 2.5);
    sunlight.position.set(-8, 20, 12); sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(2048, 2048);
    Object.assign(sunlight.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 70 });
    sunlight.shadow.normalBias = .03; sunlight.shadow.bias = -.0002; sunlight.shadow.radius = 3;
    scene.add(sunlight);
    const fill = new THREE.DirectionalLight(0xd9e8e1, .65); fill.position.set(10, 10, -10); scene.add(fill);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.ShadowMaterial({ opacity: .10 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -.055; ground.receiveShadow = true; scene.add(ground);
    grid = new THREE.GridHelper(100, 100, 0xc4d0bc, 0xd6dfce); grid.position.y = -.065;
    grid.material.transparent = true; grid.material.opacity = .2; grid.visible=false;scene.add(grid);
    new ResizeObserver(()=>{resize();if(model)fitCamera(state.cameraMode);}).observe($('threeView'));
    let previous = 0;
    renderer.setAnimationLoop(time => { controls.update((time - previous) / 1000); previous = time; renderer.render(scene, camera); });
  } catch (error) {
    renderer = null;
    toast('WebGL no está disponible. Puedes revisar la detección 2D y exportar sus datos.');
    setView('2d');
  }
}
function resize() {
  if (!renderer || !camera) return;
  const width = $('threeView').clientWidth, height = $('threeView').clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height);
  const aspect = width / height, size = 19;
  camera.left = -size * aspect / 2; camera.right = size * aspect / 2; camera.top = size / 2; camera.bottom = -size / 2;
  camera.updateProjectionMatrix();
}
function fitCamera(mode = 'iso') {
  if (!renderer || !state.result) return;
  state.cameraMode = mode;
  const box = new THREE.Box3().setFromObject(isReconstructed()?wallsGroup:model);
  if(isReconstructed()&&componentsGroup)box.expandByObject(componentsGroup);
  if(box.isEmpty())return;
  const center=box.getCenter(new THREE.Vector3());
  controls.target.copy(center);
  const factor = Math.max(state.result.width * state.metersPerPixel, state.result.height * state.metersPerPixel, 8);
  camera.far = Math.max(500, factor * 10);
  if (mode === 'top') camera.position.set(0, factor * 2, .001);
  else camera.position.set(factor * .8, factor * 1.05, factor * 1.15);
  camera.position.add(center);
  controls.update(); camera.zoom = 1; resize(); camera.updateMatrixWorld();
  let extentX = 0, extentY = 0;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = new THREE.Vector3(x, y, z).project(camera);
    extentX = Math.max(extentX, Math.abs(p.x)); extentY = Math.max(extentY, Math.abs(p.y));
  }
  camera.zoom = Math.min(8, Math.max(.3, .78 / Math.max(extentX, extentY, .1))); camera.updateProjectionMatrix();
  $('topButton').classList.toggle('selected', mode === 'top'); $('isoButton').classList.toggle('selected', mode !== 'top');
  if (state.view === '3d') $('viewLabelText').textContent = mode === 'top' ? 'VISTA SUPERIOR' : 'VISTA AXONOMÉTRICA';
}
function disposeModel() {
  if (!model) return;
  scene.remove(model);
  const materials = new Set();
  model.traverse(object => { object.geometry?.dispose(); if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m)); });
  for (const material of materials) { material.map?.dispose(); material.dispose(); }
}
function buildModel(reset = false) {
  if (!renderer || !state.result) return;
  disposeModel();
  const { width, height, walls=[], openings=[] } = state.result;
  const scale = state.metersPerPixel, worldWidth = width * scale, worldHeight = height * scale;
  const wallHeight = Number($('wallHeight').value);
  const clean=isReconstructed(),arch=architecture();
  model = new THREE.Group(); wallsGroup = new THREE.Group(); openingsGroup = new THREE.Group();
  model.add(wallsGroup, openingsGroup);
  const texture = new THREE.CanvasTexture(pixelCanvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  planMesh = new THREE.Mesh(new THREE.PlaneGeometry(worldWidth, worldHeight), new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0, side: THREE.DoubleSide,transparent:true,opacity:Number($('planOpacity').value),depthWrite:false }));
  planMesh.rotation.x = -Math.PI / 2; planMesh.receiveShadow = true; model.add(planMesh);
  if(clean&&arch.wallPolygons.length) {
    const points=arch.wallPolygons.flatMap(p=>p.outer),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
    const base=new THREE.Mesh(new THREE.BoxGeometry((x1-x0)*scale+.45,.12,(y1-y0)*scale+.45),new THREE.MeshStandardMaterial({color:'#f4f1e8',roughness:.96}));
    base.position.set(((x0+x1)/2-width/2)*scale,-.075,((y0+y1)/2-height/2)*scale);base.receiveShadow=true;model.add(base);
  }
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: clean?0xe2dfd3:0xe0e6d5, roughness: .9 });
  const capMaterial = new THREE.MeshStandardMaterial({ color: clean?0x8d9c87:0x577d66, roughness: .86 });
  const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x345240, transparent: true, opacity: .20 });
  const levels=clean?wallLevels(arch,wallHeight):[{bottom:0,top:wallHeight,wallPolygons:state.result.wallPolygons??[]}];
  for(const level of levels)for(const polygon of level.wallPolygons) {
    const path=points=>points.map(([x,y])=>new THREE.Vector2((x-width/2)*scale,(height/2-y)*scale));
    const shape=new THREE.Shape(path(polygon.outer));
    for(const hole of polygon.holes??[])shape.holes.push(new THREE.Path(path(hole)));
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:level.top-level.bottom,bevelEnabled:false,steps:1});
    const mesh=new THREE.Mesh(geometry,[capMaterial,bodyMaterial]);mesh.rotation.x=-Math.PI/2;
    mesh.position.y=.012+level.bottom;mesh.castShadow=true;mesh.receiveShadow=true;wallsGroup.add(mesh);
  }
  for (const wall of clean?[]:walls) {
    const length = (wall.to - wall.from) * scale, thickness = wall.thickness * scale;
    const geometry = new THREE.BoxGeometry(wall.axis === 'h' ? length : thickness, wallHeight, wall.axis === 'h' ? thickness : length);
    const mesh = new THREE.Mesh(geometry, [bodyMaterial, bodyMaterial, capMaterial, bodyMaterial, bodyMaterial, bodyMaterial]);
    const center = (wall.from + wall.to) / 2;
    mesh.position.set((wall.axis === 'h' ? center : wall.c) * scale - worldWidth / 2, wallHeight / 2 + .012, (wall.axis === 'h' ? wall.c : center) * scale - worldHeight / 2);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.wallId = wall.id;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), outlineMaterial); mesh.add(edges); wallsGroup.add(mesh);
  }
  const openingMaterial = new THREE.LineDashedMaterial({ color: 0xbf8647, dashSize: .12, gapSize: .07, depthTest: false });
  for (const opening of openings) {
    const map = u => new THREE.Vector3((opening.axis === 'h' ? u : opening.c) * scale - worldWidth / 2, .035, (opening.axis === 'h' ? opening.c : u) * scale - worldHeight / 2);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([map(opening.from), map(opening.to)]), openingMaterial);
    line.computeLineDistances(); line.renderOrder = 3; openingsGroup.add(line);
  }
  wallsGroup.visible = $('wallsVisible').checked; openingsGroup.visible = $('openingsVisible').checked; planMesh.visible = $('planVisible').checked;
  state.furnitureReport=clean?prepareFurniture(visibleObjects(),arch,{metersPerPixel:scale,calibrated:state.calibrated}):null;
  componentsGroup=buildComponents(clean?state.furnitureReport.objects:visibleObjects(),state.result.structuralRegions??[],width,height,scale,wallHeight);
  if(clean) {
    const displayedOpenings=arch.openings.filter(o=>o.category==='door'?$('openingsVisible').checked:$('windowsVisible').checked);
    componentsGroup.add(buildArchitecturalOpenings(displayedOpenings,width,height,scale,wallHeight));
    $('modelQualityNote').textContent=`${displayedOpenings.length} aberturas con soporte · ${arch.unmatchedOpeningIds.length} sin soporte · ${geometryReviewCases().length} en revisión geométrica · ${arch.rejectedOpeningIds.length} fragmentos excluidos`;
  } else $('modelQualityNote').textContent='Contornos y componentes originales para comparar.';
  model.add(componentsGroup);
  scene.add(model);
  if (reset) fitCamera(state.cameraMode);
}
function drawPlan() {
  if(!state.image)return;
  if($('overlayMode').value==='openingAudit'&&state.result&&!state.calibrating){drawOpeningAudit({canvas,source:pixelCanvas,data:state.result,reference:state.reference,architecture:architecture(),review:openingReviewFixture,focus:$('openingCase').value});return;}
  const {width,height}=pixelCanvas;canvas.width=width;canvas.height=height;
  context.fillStyle='#fff';context.fillRect(0,0,width,height);
  if($('planVisible').checked)context.drawImage(pixelCanvas,0,0);
  const mode=$('overlayMode').value;
  const dataset=mode==='reference'?state.reference:mode==='reconstructed'?{...state.result,walls:[],wallPolygons:architecture()?.wallPolygons??[],openings:architecture()?.openings??[]}:state.result;
  if(dataset && $('wallsVisible').checked) {
    context.fillStyle=mode==='reference'?'#b58a4d66':'#4b987f66';context.strokeStyle=mode==='reference'?'#b58a4d':'#36745dbf';context.lineWidth=.8;
    for(const wall of dataset.walls??[]) {
      const x=wall.axis==='h'?wall.from:wall.c-wall.thickness/2,y=wall.axis==='h'?wall.c-wall.thickness/2:wall.from;
      const w=wall.axis==='h'?wall.to-wall.from:wall.thickness,h=wall.axis==='h'?wall.thickness:wall.to-wall.from;
      context.fillRect(x,y,w,h);context.strokeRect(x,y,w,h);
    }
    for(const polygon of dataset.wallPolygons??[]) {
      context.beginPath();
      for(const ring of [polygon.outer,...(polygon.holes??[])]) {ring.forEach(([x,y],i)=>i?context.lineTo(x,y):context.moveTo(x,y));context.closePath();}
      context.fill('evenodd');context.stroke();
    }
    if(mode==='reconstructed') {
      context.strokeStyle='#c48a45';context.lineWidth=.7;context.setLineDash([3,2]);
      for(const polygon of state.result.wallPolygons??[]) {
        context.beginPath();for(const ring of [polygon.outer,...(polygon.holes??[])]){ring.forEach(([x,y],i)=>i?context.lineTo(x,y):context.moveTo(x,y));context.closePath();}context.stroke();
      }
      context.setLineDash([]);
    }
  }
  if(dataset && $('openingsVisible').checked) {
    context.strokeStyle='#cc8d40';context.lineWidth=2;context.setLineDash([4,3]);
    for(const o of dataset.openings??[]) {context.beginPath();context.moveTo(o.axis==='h'?o.from:o.c,o.axis==='h'?o.c:o.from);context.lineTo(o.axis==='h'?o.to:o.c,o.axis==='h'?o.c:o.to);context.stroke();}
    context.setLineDash([]);
  }
  const drawObject=(object,color,dashed,label)=>{
    const [x0,y0,x1,y1]=object.bbox;context.strokeStyle=color;context.fillStyle=color+'15';context.lineWidth=1.3;
    context.setLineDash(dashed?[4,3]:[]);context.fillRect(x0,y0,x1-x0,y1-y0);context.strokeRect(x0,y0,x1-x0,y1-y0);context.setLineDash([]);
    if(label){const text=label;context.font='9px sans-serif';const tw=context.measureText(text).width;const ty=Math.max(10,y0-2);context.fillStyle='#fffffff2';context.fillRect(Math.min(x0,width-tw-5),ty-9,tw+4,11);context.fillStyle=color;context.fillText(text,Math.min(x0+2,width-tw-3),ty);}
  };
  if(mode==='errors'&&state.metrics) {
    const good=new Set(state.metrics.rows.flatMap(r=>r.matches.map(m=>m.predictionId)));
    const extra=new Set(state.metrics.rows.flatMap(r=>r.falsePositiveIds));
    const missing=new Set(state.metrics.rows.flatMap(r=>r.falseNegativeIds));
    for(const object of visibleObjects(state.prediction,true)) {
      if(good.has(object.id))drawObject(object,'#398064',false,`${CATEGORY[object.category]?.label??object.category} ✓`);
      else if(extra.has(object.id))drawObject(object,'#b38d43',false,`${CATEGORY[object.category]?.label??object.category} +`);
    }
    for(const object of visibleObjects(state.reference,true))if(missing.has(object.id))drawObject(object,'#c47470',true,`${CATEGORY[object.category]?.label??object.category} omitido`);
  } else if(mode!=='reconstructed') {
    for(const object of visibleObjects(dataset,true)) {
      const category=CATEGORY[object.category];
      const score=object.confidence===undefined?' · manual':` ${(object.confidence*100).toFixed(0)}`;
      const needsReview=architecture()?.unmatchedOpeningIds.includes(object.id)||architecture()?.rejectedOpeningIds.includes(object.id)||geometryReviewCases().some(c=>c.objectId===object.id)||state.furnitureReport?.rejected.some(o=>o.id===object.id);
      drawObject(object,category?.color??'#7d8a78',mode==='reference'||needsReview,(category?.label??object.category)+score+(needsReview?' · revisar':''));
    }
  }
  if(state.calibration&&!state.calibrating) {
    const [a,b]=state.calibration.points;context.beginPath();context.strokeStyle='#194e43';context.lineWidth=1.5;context.moveTo(...a);context.lineTo(...b);context.stroke();
    for(const p of [a,b]){context.beginPath();context.arc(...p,3,0,Math.PI*2);context.fillStyle='#194e43';context.fill();}
    const text=`${state.calibration.distanceMeters.toLocaleString('es-CL')} m`;
    context.font='bold 11px sans-serif';const tw=context.measureText(text).width,x=Math.max(tw/2+5,Math.min(width-tw/2-5,(a[0]+b[0])/2)),y=Math.max(16,Math.min(height-5,(a[1]+b[1])/2-7));
    context.fillStyle='#fffffff2';context.fillRect(x-tw/2-4,y-12,tw+8,17);context.fillStyle='#194e43';context.fillText(text,x-tw/2,y);
  }
  if(state.points.length) {
    context.strokeStyle='#d57b34';context.lineWidth=1.5;
    if(state.points.length===2){context.beginPath();context.moveTo(...state.points[0]);context.lineTo(...state.points[1]);context.stroke();}
    for(const [index,p]of state.points.entries()){context.beginPath();context.fillStyle='#fff';context.arc(p[0],p[1],5,0,Math.PI*2);context.fill();context.stroke();context.font='bold 11px sans-serif';context.fillStyle='#b96927';context.fillText(String(index+1),p[0]+8,p[1]-8);}
  }
}
async function loadImage(url, name, isSample = false) {
  const token = ++state.fileToken;
  $('analyzeButton').disabled = true;
  try {
    const image = new Image(); image.src = url;
    const [response]=await Promise.all([fetch(url),image.decode()]);
    const bytes=await response.arrayBuffer();
    const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
    if (token !== state.fileToken) return;
    if (image.naturalWidth < 64 || image.naturalHeight < 64) throw new Error('Usa una imagen de al menos 64 × 64 píxeles.');
    const factor = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
    pixelCanvas.width = Math.round(image.naturalWidth * factor); pixelCanvas.height = Math.round(image.naturalHeight * factor);
    pixelContext.fillStyle = '#fff'; pixelContext.fillRect(0, 0, pixelCanvas.width, pixelCanvas.height);
    pixelContext.drawImage(image, 0, 0, pixelCanvas.width, pixelCanvas.height);
    state.image = image; state.fileName = name; state.calibrated = false; state.metersPerPixel = 24 / pixelCanvas.width;
    state.source = { name, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, analysisWidth: pixelCanvas.width, analysisHeight: pixelCanvas.height };
    state.imageBytes=bytes;state.imageMime=response.headers.get('Content-Type')?.split(';')[0]??'image/jpeg';state.imageSha256=sha;
    state.calibration=null;state.scalePersisted=false;
    try {state.calibration=restoreCalibration(localStorage.getItem(`blueprint.scale.v1.${sha}`),{imageSha256:sha,width:pixelCanvas.width,height:pixelCanvas.height});}catch{}
    if(state.calibration){state.metersPerPixel=state.calibration.metersPerPixel;state.calibrated=true;state.scalePersisted=true;}
    state.reference=referenceFixture?.imageSha256===sha?referenceFixture:null;state.rawPrediction=predictionFixture?.imageSha256===sha?structuredClone(predictionFixture):null;state.prediction=null;state.baseline=null;
    $('geometrySource').value='model';$('overlayMode').value='categories';
    state.points = []; state.result = null; cancelCalibration();
    $('sourceThumb').src = pixelCanvas.toDataURL('image/jpeg', .8);
    $('fileName').textContent = name; $('fileMeta').textContent = `${image.naturalWidth} × ${image.naturalHeight} px${isSample ? ' · Ejemplo incluido' : ''}`;
    $('sampleButton').hidden = isSample;
    updateScale(); drawPlan(); await analyze({fresh:false});
  } catch (error) { if (token === state.fileToken) toast(error.message || 'No se pudo abrir esta imagen.'); }
  finally { if (token === state.fileToken && $('busy').hidden) $('analyzeButton').disabled = false; }
}
async function analyze({fresh=true}={}) {
  if(!state.image)return;
  const id=++state.revision;state.inferenceAbort?.abort();state.inferenceAbort=new AbortController();
  $('busy').hidden=false;$('analyzeButton').disabled=true;$('geometrySource').disabled=true;
  $('exportJson').disabled=true;$('exportPng').disabled=true;$('statusText').textContent='Analizando la imagen…';
  const image=pixelContext.getImageData(0,0,pixelCanvas.width,pixelCanvas.height);
  const geometry=new Promise((resolve,reject)=>workerJobs.set(id,{resolve,reject}));
  worker.postMessage({id,image:{width:image.width,height:image.height,data:image.data},options:{threshold:Number($('threshold').value)}},[image.data.buffer]);
  const neural=(async()=>{
    if(state.localEngine && (fresh||!state.rawPrediction)) {
      const response=await fetch('./api/analyze',{method:'POST',headers:{'Content-Type':state.imageMime},body:state.imageBytes,signal:state.inferenceAbort.signal});
      const result=await response.json();if(!response.ok)throw new Error(result.error??'Falló la inferencia local.');
      if(id!==state.revision)return null;
      if(result.imageSha256!==state.imageSha256)throw new Error('La predicción no corresponde al archivo cargado.');
      result.provenance.execution='live';return result;
    }
    return state.rawPrediction;
  })();
  const [geometricResult,neuralResult]=await Promise.allSettled([geometry,neural]);
  if(id!==state.revision)return;
  try {
    if(geometricResult.status==='fulfilled')state.baseline={...geometricResult.value,imageSha256:state.imageSha256,objects:[],provenance:{kind:'geometric-detector'}};
    else throw geometricResult.reason;
    if(neuralResult.status==='fulfilled')state.rawPrediction=neuralResult.value;
    else if(neuralResult.reason.name!=='AbortError')toast(`No se pudo actualizar la IA: ${neuralResult.reason.message}`);
    state.prediction=state.rawPrediction?structuredClone(state.rawPrediction):null;
    if(state.prediction && !(state.prediction.wallPolygons?.length)) {
      state.prediction.walls=structuredClone(state.baseline.walls);state.prediction.openings=structuredClone(state.baseline.openings);
      state.prediction.provenance.structureFallback='geometry';state.prediction.provenance.structureFallbackReason='El segmentador produjo cero regiones de muro en esta imagen.';
    }
    syncResult(true);
  } catch(error){toast(error.message);$('statusText').textContent='No se pudo analizar el plano.';}
  finally{$('busy').hidden=true;$('analyzeButton').disabled=false;$('geometrySource').disabled=false;updateExport();}
}
worker.onmessage=({data})=>{const job=workerJobs.get(data.id);if(!job)return;workerJobs.delete(data.id);data.error?job.reject(new Error(data.error)):job.resolve(data.result);};
worker.onerror=()=>{for(const job of workerJobs.values())job.reject(new Error('No se pudo ejecutar el detector geométrico.'));workerJobs.clear();};

function updateScale() {
  $('scaleTitle').textContent = state.calibrated ? 'Escala calibrada' : 'Escala provisional';
  $('scaleDescription').textContent = state.calibrated ? `${(state.metersPerPixel * 100).toLocaleString('es-CL', { maximumFractionDigits: 2 })} cm por píxel de análisis` : 'Ancho de imagen supuesto: 24 m';
  $('scaleWarning').textContent=state.calibrated?(state.scalePersisted?'Medida guardada en este navegador para esta imagen.':'Medida aplicada solo en esta sesión; el navegador no permitió guardarla.'):'Calibra con una cota del plano. Las proporciones métricas son provisionales.';
  $('clearScale').hidden=!state.calibrated;
  if (state.result) $('summarySubtitle').textContent = `${state.result.width} × ${state.result.height} px · ${state.calibrated ? 'Escala calibrada' : 'Escala provisional'}`;
}
function cancelCalibration() {
  state.calibrating = false; state.points = [];
  $('calibrationBanner').hidden = true; $('overlayControls').hidden=state.view!=='2d';$('planView').classList.remove('calibrating'); drawPlan();
}
function startCalibration() {
  if (!state.image) return;
  if($('overlayMode').value==='openingAudit')$('overlayMode').value='categories';
  setView('2d'); state.calibrating = true; state.points = [];
  $('overlayControls').hidden=true;
  $('calibrationHint').textContent = 'Marca el primer punto de una distancia conocida.';
  $('calibrationBanner').hidden = false; $('planView').classList.add('calibrating'); drawPlan();
}
canvas.addEventListener('click', event => {
  if (!state.calibrating || state.points.length >= 2) return;
  const rect = canvas.getBoundingClientRect();
  // object-fit: contain can letterbox the canvas within its CSS box.
  const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
  const left = rect.left + (rect.width - canvas.width * scale) / 2;
  const top = rect.top + (rect.height - canvas.height * scale) / 2;
  const x = (event.clientX - left) / scale, y = (event.clientY - top) / scale;
  if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) return;
  if (state.points.length && Math.hypot(x - state.points[0][0], y - state.points[0][1]) < 10) { toast('Separa los puntos al menos 10 píxeles para calibrar.'); return; }
  state.points.push([x, y]); drawPlan();
  $('calibrationHint').textContent = 'Marca el segundo punto de la misma distancia.';
  if (state.points.length === 2) { $('calibrationDialog').showModal(); $('realDistance').focus(); $('realDistance').select(); }
});
$('calibrationForm').addEventListener('submit', event => {
  event.preventDefault();
  const distance = Number($('realDistance').value);
  if (!Number.isFinite(distance) || distance <= 0 || state.points.length !== 2) return;
  try {
    state.calibration=createCalibration({imageSha256:state.imageSha256,width:pixelCanvas.width,height:pixelCanvas.height,points:state.points,distanceMeters:distance});
    state.metersPerPixel=state.calibration.metersPerPixel;state.calibrated=true;
    state.scalePersisted=false;
    try{localStorage.setItem(`blueprint.scale.v1.${state.imageSha256}`,JSON.stringify(state.calibration));state.scalePersisted=true;}catch{}
    $('calibrationDialog').close();cancelCalibration();updateScale();buildModel(true);toast('Escala aplicada. La cota queda visible en 2D.');
  }catch(error){toast(error.message);}
});
$('calibrationDialog').addEventListener('cancel', cancelCalibration);
$('cancelDistance').onclick = () => { $('calibrationDialog').close(); cancelCalibration(); };
$('cancelCalibration').onclick = cancelCalibration; $('calibrateButton').onclick = startCalibration;
$('clearScale').onclick=()=>{try{localStorage.removeItem(`blueprint.scale.v1.${state.imageSha256}`);}catch{}state.calibration=null;state.calibrated=false;state.metersPerPixel=24/pixelCanvas.width;updateScale();buildModel(true);drawPlan();};

function upload(file) {
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast('Selecciona una imagen JPEG, PNG o WEBP.'); return; }
  if (file.size > 20 * 1024 * 1024) { toast('La imagen supera el límite de 20 MB.'); return; }
  const url = URL.createObjectURL(file);
  loadImage(url, file.name).finally(() => URL.revokeObjectURL(url));
}
$('fileInput').onchange = event => { upload(event.target.files[0]); event.target.value = ''; };
$('dropZone').onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); $('fileInput').click(); } };
for (const target of [$('dropZone'), $('viewer')]) {
  target.addEventListener('dragover', event => { event.preventDefault(); $('dropZone').classList.add('drag-over'); });
  target.addEventListener('dragleave', () => $('dropZone').classList.remove('drag-over'));
  target.addEventListener('drop', event => { event.preventDefault(); $('dropZone').classList.remove('drag-over'); upload(event.dataTransfer.files[0]); });
}
$('sampleButton').onclick = () => loadImage(SAMPLE.imageUrl, 'plano.jpeg', true);
$('analyzeButton').onclick = ()=>analyze({fresh:true});
$('geometrySource').onchange=()=>{$('overlayMode').value='categories';syncResult(true);};
$('modelMode').onchange=()=>syncResult(true);
$('openingAssociation').onchange=()=>syncResult(true);
$('openingCase').onchange=()=>setView('2d');
$('planOpacity').oninput=()=>{$('opacityValue').textContent=`${Math.round(Number($('planOpacity').value)*100)} %`;if(planMesh)planMesh.material.opacity=Number($('planOpacity').value);};
$('gridVisible').onchange=()=>{if(grid)grid.visible=$('gridVisible').checked;};
$('confidence').oninput=()=>{$('confidenceValue').textContent=Number($('confidence').value).toLocaleString('es-CL',{minimumFractionDigits:2});syncResult();};
$('overlayMode').onchange=()=>{if($('overlayMode').value==='errors'&&state.prediction){$('geometrySource').value='model';syncResult();}else setView('2d');};
$('categoryFilter').onchange=drawPlan;
$('wallHeight').oninput = () => { $('heightValue').textContent = `${Number($('wallHeight').value).toLocaleString('es-CL', { minimumFractionDigits: 2 })} m`; clearTimeout(heightTimer);heightTimer=setTimeout(()=>buildModel(),120); };
$('wallHeight').onchange = () => {clearTimeout(heightTimer);buildModel();};
$('threshold').oninput = () => { $('thresholdValue').textContent = $('threshold').value; $('statusText').textContent = 'Parámetros cambiados · Vuelve a generar'; };
for (const [id, group] of [['wallsVisible', () => wallsGroup], ['openingsVisible', () => openingsGroup], ['planVisible', () => planMesh]]) {
  $(id).onchange = () => syncResult();
}
document.querySelectorAll('.view-tab').forEach(button => button.onclick = () => setView(button.dataset.view));
document.querySelector('.view-tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault(); const tabs = [...document.querySelectorAll('.view-tab')], current = tabs.indexOf(document.activeElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus(); setView(tabs[next].dataset.view);
});
$('isoButton').onclick = () => fitCamera('iso'); $('topButton').onclick = () => fitCamera('top'); $('resetButton').onclick = () => fitCamera(state.cameraMode);
$('zoomIn').onclick = () => { if (camera) { camera.zoom = Math.min(12, camera.zoom * 1.2); camera.updateProjectionMatrix(); } };
$('zoomOut').onclick = () => { if (camera) { camera.zoom = Math.max(.3, camera.zoom / 1.2); camera.updateProjectionMatrix(); } };
$('helpButton').onclick = () => $('helpDialog').showModal(); $('closeHelp').onclick = () => $('helpDialog').close();
document.addEventListener('keydown', event => { if (event.key === 'Escape' && state.calibrating) cancelCalibration(); });
function download(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 3000);
}
$('exportJson').onclick = () => {
  if (!state.result) return;
  const wallHeightMeters=Number($('wallHeight').value);
  const reconstruction=isReconstructed()?{...architecture(),openings:architecture().openings.map(o=>{
    const heights=openingHeights(o.category,wallHeightMeters);
    return {...o,bottomMeters:heights.bottom,topMeters:heights.top};
  })}:null;
  const result = {
    version:3,geometrySource:$('geometrySource').value,modelMode:$('modelMode').value,openingAssociation:$('openingAssociation').value,openingVisualReview:auditRows(state.result,architecture(),openingReviewFixture),
    reconstruction,furniturePlacement:state.furnitureReport,reconstructionEvaluation:state.reconstructionMetrics,
    overlayMode:$('overlayMode').value,confidenceThreshold:minConfidence(),evaluation:state.metrics,
    rawNeuralPrediction:state.rawPrediction,manualReference:state.reference,
    assumptions:{doorHeightMeters:2.1,windowSillMeters:.9,windowHeightMeters:1.2,
      furniture:'Catalogue heights; orientation from nearby wall when supported, otherwise assumed.',
      openingHeights:'Catalogue assumptions clamped to wall height; actual values included per opening.'},
    source:state.source,units:{detection:'analysis-pixels',reconstruction:'analysis-pixels',furniturePlacement:'analysis-pixels',scene:'meters',openingHeights:'meters',rotation:'radians'},
    scale:{metersPerAnalysisPixel:state.metersPerPixel,calibrated:state.calibrated,measurement:state.calibration,
      assumption:state.calibrated?null:'Full image width assumed to be 24 meters'},
    wallHeightMeters,parameters:state.result.parameters,detection:state.result,
  };
  download(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }), `${state.fileName.replace(/\.[^.]+$/, '')}-levantamiento.json`);
};
$('exportPng').onclick = () => {
  if (state.view === 'evaluation') { toast('La captura corresponde al levantamiento o a la detección. Selecciona una de esas vistas.'); return; }
  const output = document.createElement('canvas');
  const source = state.view === '2d' ? canvas : renderer?.domElement;
  if (!source) return;
  if (state.view === '3d') renderer.render(scene, camera);
  const captionSource=isManual()||(state.view==='2d'&&$('overlayMode').value==='reference')?'Referencia manual':state.view==='2d'&&$('overlayMode').value==='openingAudit'?`Auditoría de aberturas · ${$('openingCase').value}`:state.view==='2d'&&$('overlayMode').value==='errors'?'Comparación IA y referencia':state.view==='3d'&&isReconstructed()?'Reconstrucción depurada':'Predicción original';
  const caption=`Blueprint Builder · ${captionSource} · ${state.calibrated?'Escala calibrada':'Escala provisional'} · Altura configurada: ${$('wallHeight').value} m`;
  output.width=source.width;const ctx=output.getContext('2d');ctx.font='11px sans-serif';
  const lines=[];let current='';for(const word of caption.split(' ')){if(ctx.measureText(current+' '+word).width>source.width-28&&current){lines.push(current);current=word;}else current+=(current?' ':'')+word;}lines.push(current);
  output.height=source.height+20+lines.length*15;
  ctx.fillStyle='#eef2e8';ctx.fillRect(0,0,output.width,output.height);ctx.drawImage(source,0,0);ctx.fillStyle='#48634e';ctx.font='11px sans-serif';lines.forEach((line,i)=>ctx.fillText(line,14,source.height+18+i*15));
  output.toBlob(blob => { if (blob) download(blob, `blueprint-${state.view}.png`); });
};

initThree();
await loadImage(SAMPLE.imageUrl, 'plano.jpeg', true);

// Additive public adapter for the v2 workflow. Existing viewer implementation stays intact.
export const blueprintBridge = Object.freeze({
  loadImage,
  importVectorGeometry: geometry => {
    state.baseline = { ...geometry, imageSha256: state.imageSha256 };
    state.prediction = null; state.reference = null;
    $('geometrySource').value = 'geometry'; syncResult(true);
  },
  importAnalysis: prediction => {
    if(prediction.imageSha256!==state.imageSha256||prediction.width!==pixelCanvas.width||prediction.height!==pixelCanvas.height)throw new Error('El análisis no corresponde a la lámina activa.');
    state.prediction=structuredClone(prediction);
    $('geometrySource').value='model';syncResult();
  },
  snapshot: () => ({ ...state, image: undefined, imageBytes: undefined }),
  context: () => ({ scene, camera, renderer, controls, model, planMesh, pixelCanvas }),
  architecture,
  show3D: () => { setView('3d'); resize(); fitCamera(state.cameraMode); },
  applyCalibration: calibration => {
    state.calibration = createCalibration(calibration);
    state.metersPerPixel = state.calibration.metersPerPixel; state.calibrated = true;
    try { localStorage.setItem(`blueprint.scale.v1.${state.imageSha256}`, JSON.stringify(state.calibration)); state.scalePersisted = true; } catch {}
    updateScale(); buildModel(true); drawPlan();
  }
});
