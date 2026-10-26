import {wallMask} from './evaluation.js';
/** Add missing long wall bands supported by the same image's geometric detector.
 * Keep neural contours (including diagonals) and every raw proposal for review.
 */
export function refineStructure(neural,baseline){
  if(!neural||!baseline||!/^[a-f0-9]{64}$/.test(neural.imageSha256??'')||neural.imageSha256!==baseline.imageSha256||neural.width!==baseline.width||neural.height!==baseline.height)return neural;
  const {width,height}=neural,mask=wallMask(neural),extra=[],radius=Math.max(5,width*.012),openings=(neural.objects??[]).filter(o=>['door','window'].includes(o.category)&&o.confidence>=.35);
  const near=([x,y])=>{for(let b=Math.max(0,Math.floor(y-radius));b<Math.min(height,y+radius);b++)for(let a=Math.max(0,Math.floor(x-radius));a<Math.min(width,x+radius);a++)if(mask[b*width+a])return true;return false;};
  for(const wall of baseline.walls??[]){
    const length=wall.to-wall.from;if(length<Math.max(24,width*.045))continue;
    const point=u=>wall.axis==='h'?[u,wall.c]:[wall.c,u],endSupport=Number(near(point(wall.from)))+Number(near(point(wall.to)));
    if(endSupport<2&&!(endSupport===1&&length>=width*.08))continue;
    let covered=0,total=0;for(let u=wall.from;u<=wall.to;u++){const [x,y]=point(u);covered+=mask[Math.floor(y)*width+Math.floor(x)]??0;total++;}if(covered/total>.98)continue;
    let segments=[[wall.from,wall.to]];
    for(const o of openings){const b=o.bbox,c0=wall.axis==='h'?b[1]:b[0],c1=wall.axis==='h'?b[3]:b[2];if(wall.c<c0-wall.thickness||wall.c>c1+wall.thickness)continue;const a=wall.axis==='h'?b[0]:b[1],z=wall.axis==='h'?b[2]:b[3];segments=segments.flatMap(([f,t])=>z<f||a>t?[[f,t]]:[[f,Math.min(t,a)],[Math.max(f,z),t]].filter(([x,y])=>y-x>=3));}
    for(const [from,to]of segments){const t=wall.thickness/2,x0=wall.axis==='h'?from:wall.c-t,x1=wall.axis==='h'?to:wall.c+t,y0=wall.axis==='h'?wall.c-t:from,y1=wall.axis==='h'?wall.c+t:to;extra.push({id:`image-band-${extra.length+1}`,outer:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],holes:[],source:'same-image-geometric-evidence',reviewRequired:true});}
  }
  if(!extra.length)return neural;
  return {...neural,wallPolygons:[...(neural.wallPolygons??[]),...extra],provenance:{...neural.provenance,structureRefinement:'Neural contours + missing bands from the same image; semantic opening intervals protected.',addedImageBands:extra.length}};
}
