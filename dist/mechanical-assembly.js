import {drawingMask,morphology,connectedRegions,traceContour,validateClosedProfile} from './discipline-analysis.js';
import {boundsOf} from './technical-geometry.js';

const median=values=>{const a=values.filter(Number.isFinite).sort((a,b)=>a-b);return a.length?a[Math.floor(a.length/2)]:null;};
const runs=values=>{const out=[];for(let i=0;i<values.length;i++)if(values[i]){const a=i;while(values[i+1])i++;out.push([a,i+1]);}return out;};

/** Recover paired horizontal/vertical edges around an unhatched axial core.
 * This is an optional shaft interpretation; the original void analysis remains. */
export function shaftFromDrawing(image,drawing,{axis,orientation='horizontal'}={}){
  const horizontal=orientation==='horizontal',b=drawing.bounds,scale=Math.max(1,Math.min(image.width,image.height)/400),ink=drawingMask(image,{threshold:180,roi:drawing.roi}),start=Math.ceil(horizontal?b.x0:b.y0),end=Math.floor(horizontal?b.x1:b.y1),minRadius=Math.max(7*scale,(horizontal?b.height:b.width)*.02),maxRadius=(horizontal?b.height:b.width)*.29;
  axis??=horizontal?(b.y0+b.y1)/2:(b.x0+b.x1)/2;
  const hit=(a,r)=>{const x=Math.round(horizontal?a:r),y=Math.round(horizontal?r:a);return x>=0&&y>=0&&x<image.width&&y<image.height?ink[y*image.width+x]:0;};
  const support=(a,r)=>{let n=0;for(let k=-3;k<=3;k++)n+=Math.max(hit(a+k,r-1),hit(a+k,r),hit(a+k,r+1));return n/7;};
  const radii=[];
  for(let a=start;a<end;a++){
    let radius=null;
    for(let r=Math.ceil(minRadius);r<maxRadius;r++)if(support(a,axis-r)>.78){
      const partners=[];for(let q=Math.max(minRadius,r-4*scale);q<=r+4*scale;q++)if(support(a,axis+q)>.78)partners.push(q);
      if(partners.length){radius=(r+partners.sort((a,b)=>Math.abs(a-r)-Math.abs(b-r))[0])/2;break;}
    }
    radii.push(radius);
  }
  // Bridge short interruptions at contacts, never a long missing region.
  for(let i=0;i<radii.length;i++)if(radii[i]==null){const a=i;while(i<radii.length&&radii[i]==null)i++;if(a&&i<radii.length&&i-a<=12*scale)for(let k=a;k<i;k++)radii[k]=radii[a-1]+(radii[i]-radii[a-1])*(k-a+1)/(i-a+1);}
  const spans=runs(radii.map(Number.isFinite)).sort((a,b)=>(b[1]-b[0])-(a[1]-a[0])),span=spans[0];
  if(!span||span[1]-span[0]<(end-start)*.45)return null;
  const smooth=radii.map((r,i)=>r==null?null:median(radii.slice(Math.max(span[0],i-3),Math.min(span[1],i+4)))),plateaus=[],points=[];
  for(let i=span[0];i<span[1];i++){
    const radius=Math.round(smooth[i]/scale)*scale,last=plateaus.at(-1);
    if(last&&Math.abs(last.radius-radius)<scale*.75)last.to=start+i;
    else plateaus.push({from:start+i,to:start+i,radius});
  }
  for(const p of plateaus){points.push([p.from,p.radius]);if(p.to>p.from)points.push([p.to,p.radius]);}
  return {points,source:'paired-axial-boundaries',proposed:true,assumptions:['Núcleo interpretado como eje no seccionado a partir de límites emparejados.','Confirma esta convención; puedes desactivar el eje propuesto.']};
}

/** Partition an observed section at large envelope shoulders. Every partition
 * retains source coordinates, while component roles are explicitly proposed. */
export function extractMechanicalAssembly(image,drawing,section){
  const horizontal=section.orientation==='horizontal',b=drawing.bounds,axis=section.axis,scale=Math.max(1,Math.min(image.width,image.height)/400),start=Math.ceil(horizontal?b.x0:b.y0),end=Math.floor(horizontal?b.x1:b.y1),length=end-start,w=image.width,h=image.height;
  const radius=[];
  for(let a=start;a<end;a++){let r=0;for(let v=Math.floor(horizontal?b.y0:b.x0);v<axis;v++)if(drawing.mask[horizontal?v*w+a:a*w+v])r=Math.max(r,axis-v);radius.push(r);}
  const smoothed=radius.map((_,i)=>median(radius.slice(Math.max(0,i-2),i+3))),peak=Math.max(...smoothed),lobes=runs(smoothed.map(r=>r>peak*.58)).filter(([a,z])=>z-a>Math.max(5*scale,length*.012));
  let intervals=[{id:'housing',label:'Carcasa',role:'housing',from:start,to:end}];
  if(lobes.length>=2){
    const leftEnd=start+lobes[0][1],last=lobes.at(-1);let ra=last[0],rz=last[1];
    while(ra>0&&smoothed[ra-1]>peak*.2)ra--;
    while(rz<smoothed.length&&smoothed[rz]>peak*.2)rz++;
    const rightStart=start+ra,rightEnd=start+rz;
    let cover=rightStart,best=peak*.065;
    const search=lobes.length>2?lobes.at(-2)[1]+3:Math.round((leftEnd-start+ra)/2);
    for(let i=search;i<ra-5*scale;i++){const drop=median(smoothed.slice(i-3,i))-median(smoothed.slice(i,i+3));if(drop>best){best=drop;cover=start+i;}}
    intervals=[{id:'inlet-flange',label:'Brida de entrada',role:'flange',from:start,to:leftEnd},{id:'housing',label:'Carcasa central',role:'housing',from:leftEnd,to:cover},{id:'end-cover',label:'Tapa y alojamiento',role:'cover',from:cover,to:rightStart},{id:'outlet-flange',label:'Brida de salida',role:'flange',from:rightStart,to:rightEnd},{id:'axial-lock',label:'Cierre axial',role:'lock',from:rightEnd,to:end}].filter(c=>c.to-c.from>3*scale);
  }
  const clean=morphology(morphology(section.materialMask,w,h,true),w,h,false);
  // Remove tiny hatch pits without filling the large cavities of the section.
  for(const hole of connectedRegions(clean,w,h,0))if(!hole.edge&&hole.count<60*scale*scale)for(const i of hole.pixels)clean[i]=1;
  const profiles=[],components=[];
  for(const component of intervals){
    const mask=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=horizontal?x:y;if(a>=component.from&&a<component.to&&(horizontal?y:x)<axis)mask[y*w+x]=clean[y*w+x];}
    let count=0;
    for(const region of connectedRegions(mask,w,h).filter(r=>r.count>55*scale*scale)){
      const isolated=new Uint8Array(w*h);for(const i of region.pixels)isolated[i]=1;
      const outer=traceContour(isolated,w,h,1.25*scale),holes=[];
      for(const hole of connectedRegions(isolated,w,h,0).filter(r=>!r.edge&&r.count>60*scale*scale)){const m=new Uint8Array(w*h);for(const i of hole.pixels)m[i]=1;const ring=traceContour(m,w,h,scale);if(ring.length>=3)holes.push(ring);}
      const profile={outer,holes,source:'assembly-section',componentId:component.id,role:component.role,label:component.label,bounds:boundsOf(outer)};
      try{validateClosedProfile(profile);profiles.push(profile);count++;}catch{/* Fall back below if no valid partition survives. */}
    }
    if(count)components.push({...component,proposed:true,source:'section-envelope-shoulders',profileCount:count});
  }
  if(!profiles.length){profiles.push(...section.profiles.map(p=>({...p,componentId:'housing',role:'housing',label:'Carcasa'})));components.push(intervals[0]);}
  return {...section,profiles,components,shaft:shaftFromDrawing(image,drawing,{axis,orientation:section.orientation}),algorithm:'source-components-v3',proposed:true,assumptions:[...section.assumptions.map(a=>a.startsWith('Espacios blancos')?'Las cavidades de carcasa se conservan; el núcleo admite una interpretación opcional como eje.':a),'Separación por cambios de envolvente; funciones de carcasa, bridas y tapa propuestas por revisar.']};
}

/** Only the viewer pose moves. Exports and plan comparisons use factor zero. */
export function setAssemblyExploded(group,factor){
  const assembly=group.userData.mechanicalAssembly;if(!assembly)return;
  factor=Math.max(0,Math.min(1,Number(factor)||0));assembly.explosionFactor=factor;
  const parts=group.children.filter(o=>o.userData.assemblyComponent).sort((a,b)=>a.userData.sourceFrom-b.userData.sourceFrom);
  parts.forEach((part,i)=>{const home=part.userData.assembledPosition??[0,0,0];part.position.set(...home);part.position[assembly.orientation==='horizontal'?'x':'y']+=(i-(parts.length-1)/2)*assembly.spacing*factor*(assembly.orientation==='horizontal'?1:-1);});group.updateMatrixWorld(true);
}
