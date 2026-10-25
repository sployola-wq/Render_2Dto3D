import { wallMask, bboxIou } from './evaluation.js';
import { associateOpeningsDetailed } from './openings.js';

// Reconstruction uses only the selected source, with no cross-filling from a reference.
const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
const median = values => [...values].sort((a,b)=>a-b)[Math.floor(values.length/2)] ?? 0;
export const ringArea = ring => ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2;
const pointInRing = ([x,y],ring) => {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
};
function simplifyLine(points,epsilon) {
  if(points.length<=2)return points;
  const a=points[0],b=points.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
  let best=epsilon,index=-1;
  for(let i=1;i<points.length-1;i++) {
    const p=points[i],t=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;
    const d=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
    if(d>best){best=d;index=i;}
  }
  return index<0?[a,b]:[...simplifyLine(points.slice(0,index+1),epsilon).slice(0,-1),...simplifyLine(points.slice(index),epsilon)];
}
export function simplifyRing(ring,epsilon=1) {
  const points=ring.filter((p,i)=>!i||distance(p,ring[i-1])>.01);
  if(points.length<4)return points.map(p=>[...p]);
  let split=1;
  for(let i=2;i<points.length;i++)if(distance(points[0],points[i])>distance(points[0],points[split]))split=i;
  const out=[...simplifyLine(points.slice(0,split+1),epsilon).slice(0,-1),...simplifyLine([...points.slice(split),points[0]],epsilon).slice(0,-1)];
  return out.length>=3?out:points;
}
export function straightenRing(ring,tolerance) {
  const points=simplifyRing(ring,tolerance);
  // Only adjust edges already close to horizontal/vertical. Diagonals survive.
  const edges=points.map((p,i)=>{
    const q=points[(i+1)%points.length],dx=q[0]-p[0],dy=q[1]-p[1];
    if(Math.abs(dx)>=4 && Math.abs(dy)<=tolerance*1.5 && Math.abs(dy/dx)<.12)return {axis:'h',c:(p[1]+q[1])/2};
    if(Math.abs(dy)>=4 && Math.abs(dx)<=tolerance*1.5 && Math.abs(dx/dy)<.12)return {axis:'v',c:(p[0]+q[0])/2};
    return null;
  });
  return points.map((p,i)=>{
    const adjacent=[edges[(i+points.length-1)%points.length],edges[i]],q=[...p];
    for(const axis of ['h','v']){
      const constraints=adjacent.filter(e=>e?.axis===axis);
      if(constraints.length)q[axis==='h'?1:0]=constraints.reduce((s,e)=>s+e.c,0)/constraints.length;
    }
    return q.map(v=>Math.round(v*2)/2);
  });
}

/** Trace the union of occupied pixel cells, preserving internal courtyards/holes. */
export function polygonsFromMask(mask,width,height,{epsilon=.8,minArea=3}={}) {
  const edges=new Map(),stride=width+1;
  const add=(x,y,xx,yy,direction)=>{const key=y*stride+x;if(!edges.has(key))edges.set(key,[]);edges.get(key).push({end:yy*stride+xx,direction});};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(mask[y*width+x]) {
    if(!y||!mask[(y-1)*width+x])add(x,y,x+1,y,0);
    if(x===width-1||!mask[y*width+x+1])add(x+1,y,x+1,y+1,1);
    if(y===height-1||!mask[(y+1)*width+x])add(x+1,y+1,x,y+1,2);
    if(!x||!mask[y*width+x-1])add(x,y+1,x,y,3);
  }
  const rings=[];
  while(edges.size) {
    const start=edges.keys().next().value,ring=[];
    let current=start,previous=0,guard=0;
    do {
      ring.push([current%stride,Math.floor(current/stride)]);
      const choices=edges.get(current);if(!choices)break;
      // At a diagonal contact, follow the occupied cell on the right.
      const rank=d=>[1,0,3,2].indexOf((d-previous+4)%4);
      choices.sort((a,b)=>rank(a.direction)-rank(b.direction));
      const edge=choices.shift();if(!choices.length)edges.delete(current);
      previous=edge.direction;current=edge.end;
    }while(current!==start&&++guard<=width*height*4);
    if(current===start&&Math.abs(ringArea(ring))>=minArea)rings.push(simplifyRing(ring,epsilon));
  }
  const outer=rings.filter(r=>ringArea(r)>0).map((r,i)=>({id:`reconstructed-wall-${i+1}`,outer:r,holes:[]}));
  for(const hole of rings.filter(r=>ringArea(r)<0)) {
    const host=outer.filter(p=>pointInRing(hole[0],p.outer)).sort((a,b)=>Math.abs(ringArea(a.outer))-Math.abs(ringArea(b.outer)))[0];
    if(host)host.holes.push(hole);
  }
  return outer;
}
function maskOverlap(a,b) {
  let intersection=0,union=0;
  for(let i=0;i<a.length;i++){intersection+=!!(a[i]&&b[i]);union+=!!(a[i]||b[i]);}
  return union?intersection/union:1;
}

// Thin cross-sections identify local wall axes without reading the plan symbols.
export function wallRuns(mask,width,height,{minimumLength}={}) {
  const maxThickness=Math.max(10,Math.min(width,height)*.045),minLength=minimumLength??Math.max(9,Math.min(width,height)*.025),runs=[];
  for(const axis of ['h','v']) {
    const along=axis==='h'?width:height,across=axis==='h'?height:width;
    let active=[];const finished=[];
    for(let u=0;u<along;u++) {
      const sections=[];
      for(let v=0;v<across;) {
        const at=c=>axis==='h'?mask[c*width+u]:mask[u*width+c];
        if(!at(v)){v++;continue;}
        const from=v;while(v<across&&at(v))v++;
        if(v-from<=maxThickness)sections.push({c:(from+v)/2,thickness:v-from});
      }
      const used=new Set();
      for(const section of sections) {
        const match=active.filter(r=>!used.has(r)&&u-r.to<=2&&Math.abs(r.c-section.c)<=1.6&&Math.abs(median(r.widths)-section.thickness)<=Math.max(3,section.thickness*.65)).sort((a,b)=>Math.abs(a.c-section.c)-Math.abs(b.c-section.c))[0];
        if(match){match.to=u+1;match.centers.push(section.c);match.widths.push(section.thickness);match.c=median(match.centers);used.add(match);}
        else {const r={axis,c:section.c,from:u,to:u+1,centers:[section.c],widths:[section.thickness]};active.push(r);used.add(r);}
      }
      const stale=active.filter(r=>u-r.to>2);finished.push(...stale);active=active.filter(r=>u-r.to<=2);
    }
    finished.push(...active);
    for(const r of finished)if(r.to-r.from>=minLength)runs.push({id:`axis-${runs.length+1}`,axis,c:median(r.centers),from:r.from,to:r.to,thickness:Math.max(1,median(r.widths))});
  }
  return runs;
}
export function associateOpeningsLegacy(objects,runs) {
  const openings=[],unmatched=[];
  for(const object of objects.filter(o=>['door','window'].includes(o.category)).sort((a,b)=>b.confidence-a.confidence)) {
    const [x0,y0,x1,y1]=object.bbox,cx=(x0+x1)/2,cy=(y0+y1)/2,w=x1-x0,h=y1-y0;
    const candidates=[];
    for(const run of runs) {
      const from=run.axis==='h'?x0:y0,to=run.axis==='h'?x1:y1,center=run.axis==='h'?cy:cx,short=run.axis==='h'?h:w;
      if((run.axis==='h'?w:h)<short*.8)continue;
      const offset=Math.abs(run.c-center),gap=Math.max(run.from-to,from-run.to,0);
      if(offset>Math.max(run.thickness*1.5,short/2+1)||gap>Math.max(5,run.thickness*2))continue;
      const centerDistance=Math.max(run.from-(from+to)/2,(from+to)/2-run.to,0);
      candidates.push({run,from,to,score:offset*3+centerDistance+gap*2});
    }
    candidates.sort((a,b)=>a.score-b.score);
    const best=candidates[0];
    if(!best){unmatched.push(object.id);continue;}
    const {run,from,to}=best;
    const aligned=runs.filter(r=>r.axis===run.axis&&Math.abs(r.c-run.c)<=Math.max(2,run.thickness/2)&&r.to>=from-run.thickness*2&&r.from<=to+run.thickness*2);
    // Require support at both jambs, or an existing continuous wall under the box.
    const tolerance=Math.max(3,run.thickness*1.5);
    const left=aligned.some(r=>r.from<=from+tolerance&&r.to>=from-tolerance);
    const right=aligned.some(r=>r.from<=to+tolerance&&r.to>=to-tolerance);
    if(!left||!right){unmatched.push(object.id);continue;}
    const opening={id:`opening-${object.id}`,objectIds:[object.id],category:object.category,axis:run.axis,c:run.c,from,to,thickness:median(aligned.map(r=>r.thickness)),confidence:object.confidence,wallId:run.id,reviewRequired:true};
    const duplicate=openings.find(o=>o.axis===opening.axis&&Math.abs(o.c-opening.c)<=Math.max(o.thickness,opening.thickness)&&Math.min(o.to,to)-Math.max(o.from,from)>Math.min(o.to-o.from,to-from)*.55);
    if(duplicate){duplicate.objectIds.push(object.id);continue;}
    openings.push(opening);
  }
  return {openings,unmatched};
}
export function reconstructArchitecture(data,{confidence=.35,openingMode='reviewed'}={}) {
  const {width,height}=data,originalMask=wallMask(data),epsilon=Math.max(.6,Math.min(width,height)/530);
  const source=data.wallPolygons?.length?data.wallPolygons:polygonsFromMask(originalMask,width,height);
  const minArea=Math.max(5,width*height*.000025),nearOpening=polygon=>(data.objects??[]).some(o=>['door','window'].includes(o.category)&&polygon.outer.some(([x,y])=>x>=o.bbox[0]-3&&x<=o.bbox[2]+3&&y>=o.bbox[1]-3&&y<=o.bbox[3]+3));
  let cleaned=structuredClone(source),candidate=originalMask,guarded=false,appliedTolerance=0;
  const eligible=source.filter(p=>Math.abs(ringArea(p.outer))>=minArea||nearOpening(p));
  // Higher resolution can expose thinner structures: reduce tolerance until the
  // original footprint passes the same guard, without consulting the reference.
  for(const tolerance of [...new Set([epsilon,epsilon*.75,epsilon*.5,.45])]) {
    const proposed=eligible.map(p=>({...p,outer:straightenRing(p.outer,tolerance),holes:(p.holes??[]).map(r=>straightenRing(r,tolerance))}));
    const proposedMask=wallMask({width,height,wallPolygons:proposed});
    if(maskOverlap(originalMask,proposedMask)>=.9){cleaned=proposed;candidate=proposedMask;appliedTolerance=tolerance;break;}
    guarded=true;
  }
  // Trace the union after snapping so touching wall bodies share one footprint.
  const vertices=polys=>polys.reduce((n,p)=>n+p.outer.length+(p.holes??[]).reduce((s,r)=>s+r.length,0),0);
  const union=polygonsFromMask(candidate,width,height,{epsilon:.8,minArea:2});
  if(union.length<=cleaned.length&&vertices(union)<vertices(cleaned)&&maskOverlap(originalMask,wallMask({width,height,wallPolygons:union}))>=.9)cleaned=union;
  const finalMask=wallMask({width,height,wallPolygons:cleaned});
  if(maskOverlap(originalMask,finalMask)<.88){cleaned=structuredClone(source);guarded=true;}
  const runs=wallRuns(wallMask({width,height,wallPolygons:cleaned}),width,height);
  const associationMask=wallMask({width,height,wallPolygons:cleaned});
  const typicalWallThickness=median(runs.filter(r=>r.thickness>=2).map(r=>r.thickness))||4;
  const shortRuns=wallRuns(associationMask,width,height,{minimumLength:Math.max(6,typicalWallThickness)}).filter(r=>!runs.some(long=>long.axis===r.axis&&Math.abs(long.c-r.c)<.5&&long.from<=r.from&&long.to>=r.to)).map(r=>({...r,id:`short-${r.id}`}));
  const openingSupportRuns=[...runs,...shortRuns];
  const objects=(data.objects??[]).filter(o=>data.provenance?.kind==='manual-reference'||o.confidence>=confidence);
  const association=openingMode==='legacy'?associateOpeningsLegacy(objects,runs):associateOpeningsDetailed(objects,openingSupportRuns,{mask:associationMask,width,height,typicalWallThickness});
  const {openings,unmatched}=association;
  return {version:2,width,height,imageSha256:data.imageSha256,wallPolygons:cleaned,runs,openingSupportRuns,openings,unmatchedOpeningIds:unmatched,rejectedOpeningIds:association.rejected??[],openingDiagnostics:association.diagnostics??[],openingMode,
    stats:{originalRegions:source.length,cleanedRegions:cleaned.length,originalVertices:vertices(source),cleanedVertices:vertices(cleaned),footprintIou:maskOverlap(originalMask,wallMask({width,height,wallPolygons:cleaned})),associatedOpenings:openings.length,unmatchedOpenings:unmatched.length,rejectedOpeningFragments:association.rejected?.length??0,mergedOpeningProposals:openings.reduce((n,o)=>n+o.objectIds.length-1,0),conservativeFallback:guarded,appliedTolerancePixels:appliedTolerance},
    coordinateSpace:'analysis-pixels',assumptions:{geometry:'Conservative contour simplification and near-axis alignment; diagonal walls retained.',openings:'Wall association is heuristic; heights are catalogue assumptions clamped to wall height.',referenceUsed:data.provenance?.kind==='manual-reference'}};
}
const openingBox=o=>o.axis==='h'?[o.from,o.c-o.thickness/2,o.to,o.c+o.thickness/2]:[o.c-o.thickness/2,o.from,o.c+o.thickness/2,o.to];
function paintBox(mask,width,height,bbox,value) {
  const [x0,y0,x1,y1]=bbox;
  for(let y=Math.max(0,Math.floor(y0));y<Math.min(height,Math.ceil(y1));y++)for(let x=Math.max(0,Math.floor(x0));x<Math.min(width,Math.ceil(x1));x++)mask[y*width+x]=value;
}
export function openingHeights(category,wallHeight) {
  const sill=category==='window'?Math.min(.9,Math.max(0,wallHeight-.8)):0;
  return {bottom:sill,top:Math.min(wallHeight-.08,sill+(category==='window'?1.2:2.1))};
}
/** Real solid wall slices: doors have a lintel, windows a sill and lintel. */
export function buildWallLevels(architecture,wallHeight) {
  const {width,height,openings}=architecture,base=wallMask(architecture);
  const apertures=openings.map(o=>({...o,...openingHeights(o.category,wallHeight),bbox:openingBox(o)}));
  for(const o of apertures)paintBox(base,width,height,openingBox(o.supportSpan?{...o,from:o.supportSpan.from,to:o.supportSpan.to}:o),1);
  const heights=[...new Set([0,wallHeight,...apertures.flatMap(o=>[o.bottom,o.top])])].sort((a,b)=>a-b),levels=[];
  for(let i=0;i<heights.length-1;i++) {
    const bottom=heights[i],top=heights[i+1],mid=(bottom+top)/2,mask=base.slice();
    for(const o of apertures)if(mid>=o.bottom&&mid<o.top)paintBox(mask,width,height,o.bbox,0);
    levels.push({bottom,top,wallPolygons:polygonsFromMask(mask,width,height,{epsilon:.8,minArea:2})});
  }
  return levels;
}
export function prepareFurniture(objects,architecture,{metersPerPixel,calibrated=false}={}) {
  const mask=wallMask(architecture),kept=[],rejected=[];
  for(const object of objects.filter(o=>!['door','window'].includes(o.category)).sort((a,b)=>b.confidence-a.confidence)) {
    const [x0,y0,x1,y1]=object.bbox,w=x1-x0,d=y1-y0,cx=(x0+x1)/2,cy=(y0+y1)/2;
    let reason=null,occupied=0,total=0;
    for(let y=Math.max(0,Math.ceil(y0));y<Math.min(architecture.height,y1);y++)for(let x=Math.max(0,Math.ceil(x0));x<Math.min(architecture.width,x1);x++){occupied+=mask[y*architecture.width+x];total++;}
    if(kept.some(o=>o.category===object.category&&bboxIou(o.bbox,object.bbox)>.55))reason='duplicate';
    else if(total&&occupied/total>.35)reason='wall-overlap';
    else if(w<=0||d<=0||(calibrated&&(Math.max(w,d)*metersPerPixel>6||Math.min(w,d)*metersPerPixel<.12)))reason='implausible-size';
    if(reason){rejected.push({id:object.id,reason});continue;}
    const sides=[];
    for(const run of architecture.runs) {
      const from=run.axis==='h'?x0:y0,to=run.axis==='h'?x1:y1;
      if(Math.min(to,run.to)-Math.max(from,run.from)<(to-from)*.3)continue;
      const center=run.axis==='h'?cy:cx,half=run.axis==='h'?d/2:w/2,gap=Math.abs(center-run.c)-half-run.thickness/2;
      if(gap< -2||gap>Math.max(8,Math.min(w,d)*.5))continue;
      sides.push({side:run.axis==='h'?(run.c<cy?'top':'bottom'):(run.c<cx?'left':'right'),gap});
    }
    sides.sort((a,b)=>a.gap-b.gap);
    let side=sides[0]?.side;
    const directional=['bed','sofa','wardrobe','cupboard','sink','desk','refrigerator'].includes(object.category);
    if(!directional)side=null;
    const fallback=object.category==='bed'?(w>d?'left':'top'):(w>=d?'top':'left');
    const back=side??fallback,rotation={top:0,bottom:Math.PI,left:Math.PI/2,right:-Math.PI/2}[back];
    const rotated=Math.abs(Math.sin(rotation))>.5;
    kept.push({...object,placement:{widthPixels:rotated?d:w,depthPixels:rotated?w:d,rotation,orientationSource:side?'nearby-wall':'catalogue-assumption'}});
  }
  return {objects:kept,rejected};
}
