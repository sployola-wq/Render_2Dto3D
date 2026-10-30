import { DISCIPLINES, suggestDiscipline } from './discipline-analysis.js';
import {drawingSignals} from './drawing-signals.js';
/** Routing is resolved before any residential inference. Legacy default 'interior'
 * records are not evidence that the user identified a floor plan. */
export function drawingEvidence(drawing,{asset=null,engineering=null,image=null}={}){
  const structuralLayers=asset?.kind==='dxf'?(asset.mappedPaths??[]).filter(p=>/estructura|structur|(?:^|[^a-z])(?:acero|steel|vigas?|beams?|columnas?|columns?|porticos?|truss)(?:$|[^a-z])/i.test((p.layer??'').normalize('NFD').replace(/[\u0300-\u036f]/g,''))):[];
  if(structuralLayers.length>=2)return {domain:'structure',preferredLayer:new Set(structuralLayers.map(p=>p.layer)).size===1?structuralLayers[0].layer:'__all__',confidence:'strong',reason:'Capas CAD de estructura identificadas: se utilizarán ejes y secciones de barras, sin habitaciones ni mobiliario.'};
  const visual=asset?.classification;
  if(visual&&visual.imageSha256===asset.identity&&visual.execution==='local'&&['clip-drawing-prompts-v1','clip-drawing-multiview-v2'].includes(visual.method)){
    const domain=Object.hasOwn(DISCIPLINES,visual.domain)?visual.domain:null,score=visual.scores?.[domain];
    if(domain&&Number.isFinite(score)&&score>=.58&&Number.isFinite(visual.margin)&&visual.margin>=.20&&visual.confident===true&&(visual.method!=='clip-drawing-multiview-v2'||visual.viewCount>=2&&visual.viewAgreement>=Math.ceil(visual.viewCount*.75)))return {domain,orientation:domain==='mechanical'?(engineering?.recommendedOrientation??((engineering?.views?.find(v=>v.id===engineering.selectedId)?.bounds??drawing?.bounds)?.height>(engineering?.views?.find(v=>v.id===engineering.selectedId)?.bounds??drawing?.bounds)?.width?'vertical':'horizontal')):undefined,confidence:'visual',requiresConfirmation:false,visual,reason:'Reconocimiento visual local: '+DISCIPLINES[domain]+'. Se seleccionó su motor automáticamente; puedes cambiarlo si corresponde.'};
    return {domain,confidence:'uncertain',requiresConfirmation:!!domain,requiresSelection:!domain,visual,reason:'El reconocimiento visual no separa suficientemente los tipos de lámina. Confirma el tipo antes de procesar.'};
  }
  const signals=image?drawingSignals(image):null;
  if(signals?.perspective)return {domain:'exterior',confidence:'indicative',requiresConfirmation:true,signals:{...signals,normalized:undefined},reason:'Se observan verticales y aristas en perspectiva. Puede ser una fachada o una pieza isométrica: confirma el tipo antes de generar geometría.'};
  if(signals?.elevationOrSection)return {domain:'exterior',confidence:'indicative',requiresConfirmation:true,signals:{...signals,normalized:undefined},reason:'Se observan cubierta inclinada, muros verticales y línea de tierra propios de un alzado o corte arquitectónico: confirma Exterior antes de generar geometría.'};
  if(engineering?.multiView&&engineering.mechanicalEvidence?.strong!==false)return {domain:'mechanical',orientation:engineering.recommendedOrientation??'horizontal',confidence:'strong',reason:'Vistas ortográficas compatibles: se separarán las cotas y se modelará la sección seleccionada.'};
  if(!drawing)return {domain:null,confidence:'uncertain',requiresSelection:true,reason:'No se ha identificado una disciplina con evidencia suficiente. Elige el tipo de proyecto; no se procesará como planta por defecto.'};
  const suggestion=suggestDiscipline(drawing),b=drawing.bounds,w=drawing.width,h=drawing.height,cx=Math.round((b.x0+b.x1)/2);let both=0,total=0;
  for(let y=Math.ceil(b.y0);y<Math.floor(b.y1);y++)for(let x=Math.ceil(b.x0);x<Math.floor(b.x1);x++){const other=2*cx-x;if(other<0||other>=w)continue;const a=drawing.mask[y*w+x],c=drawing.mask[y*w+other];if(a||c){total++;if(a&&c)both++;}}
  const verticalSymmetry=total?both/total:0;
  if(Math.max(suggestion.symmetry,verticalSymmetry)>.9&&suggestion.density>.15)return {...suggestion,domain:'mechanical',orientation:verticalSymmetry>suggestion.symmetry?'vertical':'horizontal',confidence:'candidate',requiresConfirmation:true,reason:'Se observa simetría axial. También puede aparecer en fachadas y plantas simétricas: confirma Ingeniería si la lámina representa una pieza.'};
  const rectilinear=signals&&signals.diagonalFraction<.12&&signals.vertical>=3&&signals.horizontal>=3;
  if(rectilinear&&drawing.faces.length>=6&&(drawing.tones?.lightGray??0)<.1&&(drawing.tones?.dark??0)>.008)return {...suggestion,domain:'interior',confidence:'candidate',requiresConfirmation:true,reason:'Recintos y trazos ortogonales candidatos a planta. Confirma Interior; después se verificarán aberturas y equipamiento antes del modelo residencial.'};
  if(suggestion.domain==='exterior')return {...suggestion,confidence:'indicative',requiresConfirmation:true,reason:'Posible alzado o dibujo exterior. La baja densidad de trazos no basta para distinguirlo de un plano mecánico: confirma el tipo antes de procesar.'};
  return {...suggestion,domain:null,confidence:'uncertain',requiresSelection:true,reason:'Las señales no distinguen con seguridad una planta, fachada o pieza. Selecciona el tipo de proyecto antes de procesar.'};
}
export function routeNeedsSelection(mode,evidence){return mode==='auto'&&(!evidence||!evidence.domain||evidence.requiresSelection||evidence.requiresConfirmation);}
export function restoreRoutingMode(last){if((last?.schema===3||last?.schema===4)&&(last.mode==='auto'||Object.hasOwn(DISCIPLINES,last.mode)))return last.mode;return last?.domain&&last.domain!=='interior'&&Object.hasOwn(DISCIPLINES,last.domain)?last.domain:'auto';}
export function resolveDrawingRoute(mode,evidence){if(mode==='auto')return evidence?.domain??'interior';if(!Object.hasOwn(DISCIPLINES,mode))throw new Error('Tipo de lámina no compatible.');return mode;}
export function hasInteriorEvidence(snapshot){const data=snapshot?.result??snapshot,objects=(data?.objects??[]).filter(o=>(o.confidence??0)>=.35),openings=objects.filter(o=>['door','window'].includes(o.category)).length,furniture=objects.filter(o=>['bed','sofa','sink','toilet','bathtub','table','chair'].includes(o.category)).length,wet=(data?.finishRegions??[]).some(r=>r.confidence>=.7&&['kitchen','bathroom'].includes(r.category));return openings>=3&&(furniture>=2||wet);}
/** Wall extraction and equipment recognition are different capabilities. A
 * confirmed floor plan with a connected wall network remains usable when the
 * optional semantic engine is unavailable. It is labelled structure-only. */
export function hasInteriorStructure(snapshot,evidence){
  if(evidence?.domain!=='interior'||evidence.signals?.perspective||evidence.signals?.elevationOrSection)return false;
  const neural=snapshot?.result??snapshot,polygons=neural?.wallPolygons??[];
  // CubiCasa emits polygons, not axis-aligned wall segments. Empty apartments
  // must not fail simply because there is no furniture or door symbol.
  if(evidence.confidence==='visual'&&polygons.length>=3&&neural.width>0&&neural.height>0){
    const points=polygons.flatMap(p=>p.outer??[]).filter(p=>p.length===2&&p.every(Number.isFinite));
    const polygonArea=ring=>Math.abs(ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p[0]*q[1]-q[0]*p[1];},0))/2;
    const area=polygons.reduce((s,p)=>s+Math.max(0,polygonArea(p.outer??[])-(p.holes??[]).reduce((n,h)=>n+polygonArea(h),0)),0);
    if(points.length>=12&&area>neural.width*neural.height*.004&&area<neural.width*neural.height*.4&&Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]))>neural.width*.3&&Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]))>neural.height*.3)return true;
  }
  const d=snapshot?.result??snapshot,walls=(d?.walls??[]).filter(w=>['h','v'].includes(w.axis)&&[w.c,w.from,w.to,w.thickness].every(Number.isFinite)&&w.to-w.from>=Math.max(d.width,d.height)*.025),h=walls.filter(w=>w.axis==='h'),v=walls.filter(w=>w.axis==='v');
  if(h.length<3||v.length<3||walls.length<8)return false;
  const junctions=[];for(const a of h)for(const b of v){const pad=Math.max(a.thickness,b.thickness)*1.5;if(b.c>=a.from-pad&&b.c<=a.to+pad&&a.c>=b.from-pad&&a.c<=b.to+pad&&!junctions.some(p=>Math.hypot(p[0]-b.c,p[1]-a.c)<pad))junctions.push([b.c,a.c]);}
  return junctions.length>=4&&Math.max(...junctions.map(p=>p[0]))-Math.min(...junctions.map(p=>p[0]))>d.width*.25&&Math.max(...junctions.map(p=>p[1]))-Math.min(...junctions.map(p=>p[1]))>d.height*.25;
}
export function assertInteriorRoute({mode,evidence,forceInterior=false,snapshot=null}){
  if(resolveDrawingRoute(mode,evidence)!=='interior')throw new Error('Esta lámina necesita su motor especializado; no puede procesarse como vivienda.');
  if(routeNeedsSelection(mode,evidence))throw new Error('Confirma el tipo de proyecto antes de procesar esta lámina.');
  if(evidence?.domain&&evidence.domain!=='interior'&&!forceInterior)throw new Error('La lámina parece de '+(evidence.domain==='mechanical'?'ingeniería mecánica':'fachada exterior')+'. Usa Automático o confirma explícitamente que es una planta.');
  if(snapshot&&!forceInterior&&!hasInteriorEvidence(snapshot)&&!hasInteriorStructure(snapshot,evidence))throw new Error('No hay evidencia suficiente de muros conectados ni detecciones de aberturas para reconstruir esta lámina. Revisa la escala, el contraste o el tipo de proyecto.');
  return true;
}
