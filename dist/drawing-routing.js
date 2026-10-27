import { DISCIPLINES, suggestDiscipline } from './discipline-analysis.js';
/** Routing is resolved before any residential inference. Legacy default 'interior'
 * records are not evidence that the user identified a floor plan. */
export function drawingEvidence(drawing,{asset=null,engineering=null}={}){
  const structuralLayers=asset?.kind==='dxf'?(asset.mappedPaths??[]).filter(p=>/estructura|structur|(?:^|[^a-z])(?:acero|steel|vigas?|beams?|columnas?|columns?|porticos?|truss)(?:$|[^a-z])/i.test((p.layer??'').normalize('NFD').replace(/[\u0300-\u036f]/g,''))):[];
  if(structuralLayers.length>=2)return {domain:'structure',preferredLayer:new Set(structuralLayers.map(p=>p.layer)).size===1?structuralLayers[0].layer:'__all__',confidence:'strong',reason:'Capas CAD de estructura identificadas: se utilizarán ejes y secciones de barras, sin habitaciones ni mobiliario.'};
  if(engineering?.multiView)return {domain:'mechanical',confidence:'strong',reason:'Vistas ortográficas compatibles: se separarán las cotas y se modelará la sección seleccionada por extrusión.'};
  const suggestion=suggestDiscipline(drawing),b=drawing.bounds,w=drawing.width,h=drawing.height,cx=Math.round((b.x0+b.x1)/2);let both=0,total=0;
  for(let y=Math.ceil(b.y0);y<Math.floor(b.y1);y++)for(let x=Math.ceil(b.x0);x<Math.floor(b.x1);x++){const other=2*cx-x;if(other<0||other>=w)continue;const a=drawing.mask[y*w+x],c=drawing.mask[y*w+other];if(a||c){total++;if(a&&c)both++;}}
  const verticalSymmetry=total?both/total:0;
  if(Math.max(suggestion.symmetry,verticalSymmetry)>.83&&suggestion.density>.15)return {...suggestion,domain:'mechanical',orientation:verticalSymmetry>suggestion.symmetry?'vertical':'horizontal',confidence:'strong',reason:'Corte con simetría axial y trazado denso: se utilizará geometría mecánica, sin habitaciones ni mobiliario.'};
  if(suggestion.domain==='exterior')return {...suggestion,confidence:'indicative',reason:'Dibujo exterior o en perspectiva: se conservará la proyección original y se propondrán materiales.'};
  return {...suggestion,domain:'interior',confidence:'candidate',reason:'Planta candidata. Se comprobará la evidencia de recintos y aberturas antes de habilitar el modelo residencial.'};
}
export function restoreRoutingMode(last){if(last?.schema===3&&(last.mode==='auto'||Object.hasOwn(DISCIPLINES,last.mode)))return last.mode;return last?.domain&&last.domain!=='interior'&&Object.hasOwn(DISCIPLINES,last.domain)?last.domain:'auto';}
export function resolveDrawingRoute(mode,evidence){if(mode==='auto')return evidence?.domain??'interior';if(!Object.hasOwn(DISCIPLINES,mode))throw new Error('Tipo de lámina no compatible.');return mode;}
export function hasInteriorEvidence(snapshot){const data=snapshot?.result??snapshot,objects=(data?.objects??[]).filter(o=>(o.confidence??0)>=.35),openings=objects.filter(o=>['door','window'].includes(o.category)).length,furniture=objects.filter(o=>['bed','sofa','sink','toilet','bathtub','table','chair'].includes(o.category)).length,wet=(data?.finishRegions??[]).some(r=>r.confidence>=.7&&['kitchen','bathroom'].includes(r.category));return openings>=3&&(furniture>=2||wet);}
export function assertInteriorRoute({mode,evidence,forceInterior=false,snapshot=null}){
  if(resolveDrawingRoute(mode,evidence)!=='interior')throw new Error('Esta lámina necesita su motor especializado; no puede procesarse como vivienda.');
  if(evidence?.domain&&evidence.domain!=='interior'&&!forceInterior)throw new Error('La lámina parece de '+(evidence.domain==='mechanical'?'ingeniería mecánica':'fachada exterior')+'. Usa Automático o confirma explícitamente que es una planta.');
  if(snapshot&&!forceInterior&&!hasInteriorEvidence(snapshot))throw new Error('No hay evidencia suficiente de una planta interior. Selecciona el tipo de proyecto; no se generarán habitaciones ni muebles para esta lámina.');
  return true;
}
