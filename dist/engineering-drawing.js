import {morphology,connectedRegions,traceContour,validateClosedProfile} from './discipline-analysis.js';
import {boundsOf} from './technical-geometry.js';

/** Keep geometry strokes apart from coloured dimensions and centre lines.
 * The original image and its coordinates are never modified. */
export function engineeringInk(image,{threshold=248,channel='neutral',roi=null}={}){
  const {width:w,height:h,data}=image;if(!Number.isInteger(w)||!Number.isInteger(h)||w<2||h<2||w*h>2200000||data.length!==w*h*4)throw new Error('Marco de análisis no válido.');const ink=new Uint8Array(w*h);let coloured=0,total=0;
  const box=roi??[0,0,w,h];
  for(let y=Math.max(0,Math.floor(box[1]));y<Math.min(h,Math.ceil(box[3]));y++)for(let x=Math.max(0,Math.floor(box[0]));x<Math.min(w,Math.ceil(box[2]));x++){
    const i=y*w+x,k=i*4,r=data[k],g=data[k+1],b=data[k+2],hi=Math.max(r,g,b),lo=Math.min(r,g,b),l=.299*r+.587*g+.114*b;
    if(data[k+3]<100||l>threshold)continue;total++;
    const chromatic=hi-lo>28&&hi-lo>hi*.16;if(chromatic)coloured++;
    ink[i]=channel==='all'||!chromatic||hi<45?1:0;
  }
  return {ink,colouredFraction:coloured/Math.max(1,total)};
}
export function profileFromRegion(region,closed,w,h){
  const mask=new Uint8Array(w*h);for(const i of region.pixels)mask[i]=1;
  const outer=traceContour(mask,w,h,1.1),bounds=boundsOf(outer),holes=[],safe=morphology(mask,w,h,false,3);
  for(const hole of connectedRegions(closed,w,h,0)){
    if(hole.edge||hole.count<10||hole.count>region.count*.18)continue;
    const [x0,y0,x1,y1]=hole.bbox,pad=Math.max(2,Math.min(bounds.width,bounds.height)*.035);
    if(x0<bounds.x0+pad||x1>bounds.x1-pad||y0<bounds.y0+pad||y1>bounds.y1-pad)continue;
    if(!mask[Math.floor((y0+y1)/2)*w+Math.floor((x0+x1)/2)])continue;
    if(hole.pixels.some(i=>!safe[i]))continue;
    const m=new Uint8Array(w*h);for(const i of hole.pixels)m[i]=1;const ring=traceContour(m,w,h,.5);if(ring.length>=3)holes.push(ring);
  }
  const profile={outer,holes,source:'engineering-contour'};validateClosedProfile(profile);
  return {profile,mask,bounds};
}
// Restore short colour interruptions of an otherwise neutral contour. Restrict
// output to existing strokes; never draw bridges across blank paper.
export function restoreStrokes(image,pre,roi,threshold=248){
  const {width:w,height:h}=image,all=engineeringInk(image,{channel:'all',roi,threshold}).ink,out=new Uint8Array(w*h),distance=new Uint8Array(w*h),queue=new Int32Array(w*h),limit=Math.max(6,Math.round(Math.max(w,h)*.022));let head=0,tail=0;
  const seeds=morphology(morphology(pre,w,h,true),w,h,false);
  for(const r of connectedRegions(seeds,w,h)){const[x0,y0,x1,y1]=r.bbox;if(Math.min(x1-x0,y1-y0)<5||Math.max(x1-x0,y1-y0)<Math.max(30,Math.max(w,h)*.05))continue;for(const i of r.pixels)out[i]=1;}
  const near=new Uint8Array(out);for(let i=0;i<out.length;i++)if(out[i])queue[tail++]=i;
  while(head<tail){const i=queue[head++];if(distance[i]>=limit)continue;const x=i%w,y=Math.floor(i/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;const j=i+dy*w+dx;if(!near[j]){near[j]=1;if(all[j])out[j]=1;distance[j]=distance[i]+1;queue[tail++]=j;}}}
  return out;
}
function colourCircles(image,view){
  const b=view.bounds,w=image.width,h=image.height,data=image.data,maxRadius=Math.min(40,Math.min(b.width,b.height)*.24),found=[];
  if(maxRadius<4)return found;
  const coloured=new Uint8Array(w*h);
  for(let y=Math.ceil(b.y0);y<Math.floor(b.y1);y++)for(let x=Math.ceil(b.x0);x<Math.floor(b.x1);x++){const i=y*w+x,k=i*4,hi=Math.max(data[k],data[k+1],data[k+2]),lo=Math.min(data[k],data[k+1],data[k+2]);coloured[i]=hi-lo>20&&lo<235||.299*data[k]+.587*data[k+1]+.114*data[k+2]<210?1:0;}
  const step=1,angles=Array.from({length:32},(_,i)=>[Math.cos(i*Math.PI/16),Math.sin(i*Math.PI/16)]);
  const hit=(x,y)=>{x=Math.round(x);y=Math.round(y);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(coloured[(y+dy)*w+x+dx])return 1;return 0;};
  const candidates=[];
  for(let r=6;r<=maxRadius;r++)for(let cy=Math.ceil(b.y0+r+2);cy<b.y1-r-2;cy+=step)for(let cx=Math.ceil(b.x0+r+2);cx<b.x1-r-2;cx+=step){
    let hits=0,tested=0;for(const [dx,dy]of angles){hits+=hit(cx+r*dx,cy+r*dy);if(++tested-hits>4)break;}if(hits<28)continue;
    // A filled disk or a cross is not a circular outline.
    let inside=0;for(const[dx,dy]of angles)inside+=hit(cx+r*.55*dx,cy+r*.55*dy);
    const score=hits*r/(r+3)-inside*.05;
    if(inside>20||score<20)continue;candidates.push({center:[cx,cy],radius:r,score,source:'observed-circular-outline'});
  }
  candidates.sort((a,b)=>b.score-a.score);
  for(const c of candidates)if(!found.some(a=>Math.hypot(a.center[0]-c.center[0],a.center[1]-c.center[1])<a.radius+c.radius)){found.push(c);if(found.length>=16)break;}
  return found;
}

// In monochrome CAD a dimension rectangle may enclose more paper than the
// actual part. Recover an isolated thin material face only when a second view
// independently confirms it: two aligned circles, persistent parallel edges,
// and matching end caps. Never turn every enclosed dimension cell into metal.
function dimensionSeparatedPair(image,closed,roi){
  const {width:w,height:h}=image,box=roi??[0,0,w,h],faces=connectedRegions(closed,w,h,0);
  for(const face of faces){
    const [x0,y0,x1,y1]=face.bbox,bw=x1-x0,bh=y1-y0,along=bh>=bw?1:0,across=1-along,extent=along?bh:bw;
    if(face.edge||face.count<80||Math.min(bw,bh)<8||extent<Math.max(w,h)*.25||face.count/(bw*bh)>.22)continue;
    const mask=new Uint8Array(w*h);for(const i of face.pixels)mask[i]=1;const body=morphology(mask,w,h,true),outer=traceContour(body,w,h,1),bounds=boundsOf(outer);
    try{validateClosedProfile({outer,holes:[]});}catch{continue;}
    const limits=along?[bounds.y0,bounds.y1]:[bounds.x0,bounds.x1],cross=along?[bounds.x0,bounds.x1]:[bounds.y0,bounds.y1];
    let min=Infinity,max=-Infinity,valid=true;const centers=[];
    for(let v=Math.ceil(limits[0])+2;v<limits[1]-2;v++){
      let runs=0,inside=false,lo=Infinity,hi=-1;
      for(let u=Math.floor(cross[0]);u<cross[1];u++){const hit=body[along?v*w+u:u*w+v];if(hit){if(!inside)runs++;lo=Math.min(lo,u);hi=u;}inside=!!hit;}
      if(runs!==1||hi-lo>(cross[1]-cross[0])*.5){valid=false;break;}min=Math.min(min,(lo+hi)/2);max=Math.max(max,(lo+hi)/2);centers.push((lo+hi)/2);
    }
    if(!valid||max-min<(cross[1]-cross[0])*.25||Math.max(...centers.map((c,i)=>Math.abs(c-centers[0]-(centers.at(-1)-centers[0])*i/(centers.length-1))))<(cross[1]-cross[0])*.12)continue;
    for(const range of [[box[across],cross[0]-5],[cross[1]+5,box[across+2]]]){
      if(range[1]-range[0]<20)continue;
      const search=along?{x0:range[0],x1:range[1],y0:limits[0]-4,y1:limits[1]+4}:{x0:limits[0]-4,x1:limits[1]+4,y0:range[0],y1:range[1]};
      search.x0=Math.max(0,search.x0);search.y0=Math.max(0,search.y0);search.x1=Math.min(w,search.x1);search.y1=Math.min(h,search.y1);search.width=search.x1-search.x0;search.height=search.y1-search.y0;
      // Search circles inside plausible capped strips, not across a whole page.
      // This also keeps large architectural sheets out of the expensive Hough scan.
      const sampleInk=(u,v)=>along?closed[Math.round(v)*w+Math.round(u)]:closed[Math.round(u)*w+Math.round(v)],columns=[];
      for(let u=Math.ceil(range[0]);u<range[1];u++){
        let hits=0,n=0;for(let v=Math.ceil(limits[0]+extent*.06);v<limits[1]-extent*.06;v++){hits+=!!sampleInk(u,v);n++;}
        if(hits/n>.86){if(columns.length&&u-columns.at(-1).at(-1)<=2)columns.at(-1).push(u);else columns.push([u]);}
      }
      let circles=[];
      scan:for(let i=0;i<columns.length;i++)for(let j=i+1;j<Math.min(columns.length,i+5);j++){
        const left=columns[i].at(-1),right=columns[j][0],span=right-left;if(span<16||span>extent*.5)continue;
        const capped=target=>{for(let v=Math.max(1,Math.floor(target-extent*.035));v<Math.min(along?h-1:w-1,target+extent*.035);v++){let hits=0;for(let u=left;u<=right;u++)hits+=!!sampleInk(u,v);if(hits/(span+1)>.88)return true;}return false;};
        if(!capped(limits[0])||!capped(limits[1]))continue;
        const b=along?{...search,x0:left-1,x1:right+2,width:span+3}:{...search,y0:left-1,y1:right+2,height:span+3},found=colourCircles(image,{bounds:b});
        if(found.some(a=>found.some(b=>a!==b&&Math.abs(a.center[along]-b.center[along])>extent*.5&&Math.abs(a.center[across]-b.center[across])<Math.max(a.radius,b.radius)*.4))){circles=found;break scan;}
      }
      for(const a of circles)for(const b of circles){
        if(a===b||Math.abs(a.center[along]-b.center[along])<extent*.5||Math.abs(a.center[across]-b.center[across])>Math.max(a.radius,b.radius)*.4)continue;
        const center=(a.center[across]+b.center[across])/2,radius=Math.max(a.radius,b.radius),sample=(u,v)=>along?closed[Math.round(v)*w+Math.round(u)]:closed[Math.round(u)*w+Math.round(v)];
        const edge=direction=>{for(let u=Math.round(center)+direction*Math.ceil(radius+4);u>range[0]&&u<range[1];u+=direction){let hits=0,n=0;for(let v=Math.ceil(limits[0]+extent*.06);v<limits[1]-extent*.06;v++){hits+=!!sample(u,v);n++;}if(hits/n>.86)return u;}return null;};
        const left=edge(-1),right=edge(1);if(left==null||right==null||right-left<radius*2.5||right-left>extent*.5)continue;
        const cap=target=>{let best=null;for(let v=Math.max(1,Math.floor(target-extent*.035));v<Math.min(along?h-1:w-1,target+extent*.035);v++){let hits=0;for(let u=left;u<=right;u++)hits+=!!sample(u,v);if(hits/(right-left+1)>.88&&(best==null||Math.abs(v-target)<Math.abs(best-target)))best=v;}return best;};
        const start=cap(limits[0]),end=cap(limits[1]);if(start==null||end==null)continue;
        const rect=along?[left,start,right+1,end+1]:[start,left,end+1,right+1],frontMask=new Uint8Array(w*h);
        for(let y=rect[1];y<rect[3];y++)for(let x=rect[0];x<rect[2];x++)frontMask[y*w+x]=1;
        const ring=[[rect[0],rect[1]],[rect[2],rect[1]],[rect[2],rect[3]],[rect[0],rect[3]]],frontBounds=boundsOf(ring),area=(rect[2]-rect[0])*(rect[3]-rect[1]),bodyArea=body.reduce((sum,n)=>sum+n,0);
        const side={id:'view-2',profile:{outer,holes:[],source:'dimension-separated-contour'},mask:body,bounds,fill:bodyArea/(bounds.width*bounds.height),area:bodyArea,enclosed:face.count,inkDensity:.15,circles:[]};
        const front={id:'view-1',profile:{outer:ring,holes:[],source:'confirmed-orthographic-outline'},mask:frontMask,bounds:frontBounds,fill:1,area,enclosed:area,inkDensity:.1,circles:circles.filter(c=>Math.abs(c.center[across]-center)<radius*.5)};
        return [front,side];
      }
    }
  }
  return null;
}

/** Distinct closed views are extracted before choosing a modelling operation.
 * A sparse CAD section is not evidence for an axial, hatched assembly. */
export function analyzeEngineeringDrawing(image,{roi=null,channel='neutral',threshold=248,detectHoles=true}={}){
  const {width:w,height:h}=image,pre=engineeringInk(image,{roi,channel,threshold}),restored=channel==='neutral'?restoreStrokes(image,pre.ink,roi,threshold):pre.ink,closed=morphology(morphology(restored,w,h,true),w,h,false),neutralClosed=morphology(morphology(pre.ink,w,h,true),w,h,false);let filled=new Uint8Array(closed);
  for(const r of connectedRegions(closed,w,h,0))if(!r.edge)for(const i of r.pixels)filled[i]=1;
  const cleaned=morphology(morphology(filled,w,h,false,2),w,h,true,2),fragile=connectedRegions(filled,w,h).filter(r=>r.count>35&&r.pixels.reduce((sum,i)=>sum+cleaned[i],0)<r.count*.65);
  if(fragile.length){const fine=morphology(morphology(filled,w,h,false),w,h,true);for(const r of fragile)for(const i of r.pixels)cleaned[i]=fine[i];}filled=cleaned;
  const views=[];
  for(const region of connectedRegions(filled,w,h).sort((a,b)=>b.count-a.count)){
    const [x0,y0,x1,y1]=region.bbox,bw=x1-x0,bh=y1-y0;
    if(region.edge||x0<=2||y0<=2||x1>=w-2||y1>=h-2||Math.min(bw,bh)<4||Math.max(bw,bh)<Math.max(40,Math.max(roi?roi[2]-roi[0]:w,roi?roi[3]-roi[1]:h)*.08)||region.count<35)continue;
    let enclosed=0;for(const i of region.pixels)if(!closed[i])enclosed++;
    if(enclosed<Math.max(12,region.count*.035))continue;
    try{
      const geometry=profileFromRegion(region,neutralClosed,w,h),fill=region.count/(bw*bh),view={...geometry,id:`view-${views.length+1}`,fill,area:region.count,enclosed,inkDensity:1-enclosed/region.count,circles:[]};
      views.push(view);
    }catch{/* An invalid contour is not a usable model view. */}
    if(views.length>=12)break;
  }
  if(channel==='all'||pre.colouredFraction<.04){const pair=dimensionSeparatedPair(image,pre.ink,roi)??dimensionSeparatedPair(image,closed,roi);if(pair)views.splice(0,views.length,...pair);}
  const main=views[0];if(!main&&channel==='neutral'&&pre.colouredFraction>.7)return analyzeEngineeringDrawing(image,{roi,channel:'all',threshold,detectHoles});if(!main)return {views:[],selectedId:null,recommendedOperation:null,colouredFraction:pre.colouredFraction};
  let selected=main,companion=null,alignedAxis='y',bestScore=0;
  for(const a of views)for(const b of views)for(const [axis,dimension]of[['y','height'],['x','width']]){const extent=a.bounds[dimension],difference=Math.abs(extent-b.bounds[dimension])/Math.max(extent,b.bounds[dimension]),score=extent*(1-difference);if(a!==b&&a.fill<.4&&b.fill>.65&&extent>60&&difference<.12&&score>bestScore){selected=a;companion=b;alignedAxis=axis;bestScore=score;}}
  let totalInk=0,pairInk=0,x0=w,y0=h,x1=0,y1=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pre.ink[y*w+x]){totalInk++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);if([selected,companion].some(v=>v&&x>=v.bounds.x0&&x<v.bounds.x1&&y>=v.bounds.y0&&y<v.bounds.y1))pairInk++;}
  const inkSupport=pairInk/Math.max(1,totalInk),extentSupport=selected.bounds[alignedAxis==='x'?'width':'height']/Math.max(1,alignedAxis==='x'?x1-x0:y1-y0),dimensionSeparated=selected.profile.source==='dimension-separated-contour'&&companion?.profile.source==='confirmed-orthographic-outline',mechanicalEvidence={inkSupport,extentSupport,dimensionSeparated,strong:!!companion&&inkSupport>=(dimensionSeparated?.25:.35)&&extentSupport>=.5};
  const multiView=views.length>=2&&mechanicalEvidence.strong,colouredCAD=pre.colouredFraction>.12;
  if(!multiView){selected=main;companion=null;}
  if(detectHoles&&companion)companion.circles=colourCircles(image,companion);
  const sparse=selected.inkDensity<.25||selected.fill<.4;
  return {views,channel,alignedAxis,mechanicalEvidence,selectedId:selected.id,companionId:companion?.id??null,recommendedOperation:multiView||sparse?'extrude':'revolve',colouredFraction:pre.colouredFraction,multiView,colouredCAD,source:'closed-engineering-views'};
}
export function smoothThinRasterProfile(image,view,axis='y'){
  if(view.fill>=.35||view.profile.holes.length)return null;
  const horizontal=axis==='x',along=horizontal?'x':'y',across=horizontal?'y':'x',b=view.bounds,spans=[];
  for(let v=b[along+'0'];v<b[along+'1'];v++){let lo=Infinity,hi=-1,runs=0,inside=false;for(let u=b[across+'0'];u<b[across+'1'];u++){const hit=view.mask[horizontal?u*image.width+v:v*image.width+u];if(hit){if(!inside)runs++;lo=Math.min(lo,u);hi=u+1;}inside=!!hit;}if(runs!==1||hi-lo>b[horizontal?'height':'width']*.6)return null;spans.push([lo,hi]);}
  const left=[],right=[],last=spans.length-1;
  for(let i=0;i<=last;i++){const pair=spans[i].map((value,side)=>{if(i<4||i>last-4)return value;let sum=0;for(let j=-4;j<=4;j++)sum+=spans[i+j][side]*(5-Math.abs(j));return value+Math.max(-1.25,Math.min(1.25,sum/25-value));});const v=i===0?b[along+'0']:i===last?b[along+'1']:b[along+'0']+i+.5;left.push(horizontal?[v,pair[0]]:[pair[0],v]);right.push(horizontal?[v,pair[1]]:[pair[1],v]);}
  const candidate={...view.profile,outer:[...left,...right.reverse()],contourTreatment:'smoothed-image',maxBoundaryAdjustmentPixels:1.25};
  try{validateClosedProfile(candidate);return candidate;}catch{return null;}
}
export function drawingFromEngineeringView(image,analysis,id,{holes=false,smooth=true}={}){
  const view=analysis.views.find(v=>v.id===id)??analysis.views.find(v=>v.id===analysis.selectedId);if(!view)throw new Error('No hay una vista mecánica cerrada utilizable. Selecciona una región o traza el perfil.');
  const ink=engineeringInk(image,{channel:analysis.channel??'neutral'}).ink;
  const treated=smooth?smoothThinRasterProfile(image,view,analysis.multiView?analysis.alignedAxis:view.bounds.height>=view.bounds.width?'y':'x'):null;
  let profile={...(treated??view.profile),holes:[...view.profile.holes]};const proposedHoles=[];
  if(holes)for(const circle of view.circles){const ring=Array.from({length:64},(_,i)=>[circle.center[0]+circle.radius*Math.cos(i*Math.PI/32),circle.center[1]+circle.radius*Math.sin(i*Math.PI/32)]),candidate={...profile,holes:[...profile.holes,ring]};try{validateClosedProfile(candidate);profile=candidate;proposedHoles.push(circle);}catch{/* Existing holes and ambiguous circles keep their original interpretation. */}}
  return {width:image.width,height:image.height,ink,mask:view.mask,outline:profile.outer,profiles:[profile],proposedHoles,bounds:view.bounds,faces:[],roi:[view.bounds.x0,view.bounds.y0,view.bounds.x1,view.bounds.y1],tones:{dark:0,lightGray:0},engineeringView:view.id};
}

/** A companion orthographic view supplies an explicit relative extrusion width.
 * It does not supply a physical scale or certify that a circle is a drilled hole. */
export function engineeringExtrusion(image,analysis,viewId){
  if(!analysis.multiView||viewId!==analysis.selectedId)return null;
  const side=analysis.views.find(v=>v.id===viewId),front=analysis.views.find(v=>v.id===analysis.companionId),w=image.width,rows=[],horizontal=analysis.alignedAxis==='x',along=horizontal?'x':'y',across=horizontal?'y':'x',dimension=horizontal?'width':'height';
  for(let v=Math.ceil(front.bounds[along+'0'])+2;v<front.bounds[along+'1']-2;v++){let lo=Infinity,hi=-1;for(let u=Math.floor(front.bounds[across+'0']);u<front.bounds[across+'1'];u++)if(front.mask[horizontal?u*w+v:v*w+u]){lo=Math.min(lo,u);hi=u+1;}if(hi>lo)rows.push([lo,hi]);}
  if(!rows.length)return null;
  const median=a=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)],left=median(rows.map(r=>r[0])),right=median(rows.map(r=>r[1])),ratio=side.bounds[dimension]/front.bounds[dimension];
  if(!(right>left))return null;
  return {source:'companion-orthographic-view',alignedAxis:analysis.alignedAxis,widthPixels:(right-left)*ratio,companionId:front.id,companionBounds:front.bounds,companionAcrossStart:left,proposed:true,holes:front.circles.map(c=>({[along]:side.bounds[along+'0']+(c.center[horizontal?0:1]-front.bounds[along+'0'])*ratio,zPixels:(c.center[horizontal?1:0]-left)*ratio,radiusPixels:c.radius*ratio,source:c.source,proposed:true}))};
}

export function engineeringCADPaths(paths,layer='__all__'){
  if(layer!=='__all__')return paths.filter(p=>p.layer===layer);
  const auxiliary=/(?:^|[^a-z])(?:dims?|dimensions?|cotas?|text(?:o)?|annotations?|defpoints|cent(?:er|re)(?:lines?)?|ejes?|hatch|aux(?:iliar)?)(?:$|[^a-z])/i;
  const geometry=paths.filter(p=>!auxiliary.test((p.layer??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')));
  return geometry.some(p=>p.closed)?geometry:paths;
}
