import {drawingMask,connectedRegions} from './discipline-analysis.js';

/** Small, unhatched axial enclosures paired across the shaft are useful
 * fastener candidates. Their interpretation and head style remain proposals. */
export function detectMechanicalFeatures(image,drawing,{axis,orientation='horizontal',threshold=205}={}){
  const horizontal=orientation==='horizontal',ri=horizontal?1:0,ai=1-ri,b=drawing.bounds;
  axis??=horizontal?(b.y0+b.y1)/2:(b.x0+b.x1)/2;
  const axialSize=horizontal?b.width:b.height,pixelScale=Math.max(1,Math.min(image.width,image.height)/400);
  const ink=drawingMask(image,{threshold:Math.min(threshold,180),roi:drawing.roi});
  const candidates=[];
  for(const region of connectedRegions(ink,image.width,image.height,0)){
    if(region.edge)continue;
    const box=region.bbox,center=[(box[0]+box[2])/2,(box[1]+box[3])/2],length=box[ai+2]-box[ai],diameter=box[ri+2]-box[ri];
    const density=region.count/(length*diameter),radial=Math.abs(center[ri]-axis);
    if(length<10*pixelScale||length>axialSize*.16||diameter<3*pixelScale||diameter>14*pixelScale||length/diameter<2||length/diameter>9||density<.68||radial<diameter*2)continue;
    if(!drawing.mask[Math.floor(center[1])*image.width+Math.floor(center[0])])continue;
    candidates.push({center,length,diameter,bounds:box,density});
  }
  const fasteners=[];
  const used=new Set();
  for(let i=0;i<candidates.length;i++){
    if(used.has(i))continue;const a=candidates[i];
    const j=candidates.findIndex((c,j)=>j!==i&&!used.has(j)&&Math.abs(a.center[ai]-c.center[ai])<3*pixelScale&&Math.abs(a.center[ri]+c.center[ri]-2*axis)<6*pixelScale&&Math.abs(a.length-c.length)<4*pixelScale&&Math.abs(a.diameter-c.diameter)<3*pixelScale);
    if(j<0)continue;used.add(i);used.add(j);
    for(const c of[a,candidates[j]])fasteners.push({id:`fastener-${fasteners.length+1}`,kind:'axial-fastener',center:c.center,bounds:c.bounds,length:c.length,diameter:c.diameter,headSide:-1,source:'paired-axial-enclosure',proposed:true,evidence:'Recinto claro alargado con otro de tamaño similar al otro lado del eje.',assumptions:['Interpretado como tornillo axial; cabeza hexagonal y paso de rosca propuestos.','Su extremo de cabeza y su profundidad no se recuperan de esta única sección.']});
  }
  return {fasteners:fasteners.slice(0,24)};
}
