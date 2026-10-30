import {CATEGORY,bboxIou,wallMask} from './evaluation.js';
import {polygonsFromMask} from './architecture.js';

/** User corrections are replayable source-coordinate edits, separate from AI. */
export function applyPlanEdits(base,record){
  if(!base||record.sourceHash!==base.imageSha256||record.width!==base.width||record.height!==base.height)throw new Error('Las correcciones pertenecen a otro plano o encuadre.');
  if(!Array.isArray(record.edits)||record.edits.length>500)throw new Error('Máximo 500 correcciones por plano.');
  const data=structuredClone(base);let mask=null;
  for(const [index,edit]of record.edits.entries()){
    const b=edit.bbox;
    if(!Array.isArray(b)||b.length!==4||!b.every(Number.isFinite)||b[0]<0||b[1]<0||b[2]>base.width||b[3]>base.height||b[2]-b[0]<2||b[3]-b[1]<2)throw new Error('Delimita un rectángulo válido dentro del plano.');
    if(['add-object','replace-object','remove-object'].includes(edit.kind)){
      if(!Object.hasOwn(CATEGORY,edit.category))throw new Error('Tipo de elemento no válido.');
      data.objects=(data.objects??[]).filter(o=>!(bboxIou(o.bbox,b)>.5&&(edit.kind!=='remove-object'||o.category===edit.category)));
      if(edit.kind!=='remove-object')data.objects.push({id:'user-object-'+index,category:edit.category,bbox:[...b],confidence:1,source:'user-correction',reviewRequired:false});
    }else if(['add-wall','remove-wall'].includes(edit.kind)){
      mask??=wallMask(data);
      for(let y=Math.floor(b[1]);y<Math.ceil(b[3]);y++)for(let x=Math.floor(b[0]);x<Math.ceil(b[2]);x++)mask[y*base.width+x]=edit.kind==='add-wall'?1:0;
    }else throw new Error('Corrección no compatible.');
  }
  if(mask){data.wallPolygons=polygonsFromMask(mask,base.width,base.height,{epsilon:0,minArea:1});data.walls=[];}
  data.provenance={...data.provenance,userCorrections:record.edits.length};data.userCorrections=structuredClone(record);
  return data;
}

export function objectAt(data,point,confidence=.35){
  return (data.objects??[]).filter(o=>o.confidence>=confidence&&point[0]>=o.bbox[0]&&point[0]<=o.bbox[2]&&point[1]>=o.bbox[1]&&point[1]<=o.bbox[3]).sort((a,b)=>(a.bbox[2]-a.bbox[0])*(a.bbox[3]-a.bbox[1])-(b.bbox[2]-b.bbox[0])*(b.bbox[3]-b.bbox[1]))[0]??null;
}
