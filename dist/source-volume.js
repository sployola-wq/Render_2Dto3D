import * as THREE from './vendor/three.module.js';
import {architecturalPalette} from './exterior-finishes.js';
import {SURFACE_MATERIALS} from './technical-sheet.js';
import {validateClosedProfile} from './discipline-analysis.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export function convexOutline(points){
  const p=[...new Map(points.map(p=>[p.join(','),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);if(p.length<3)return [];
  const half=items=>{const out=[];for(const q of items){while(out.length>1&&cross(out.at(-2),out.at(-1),q)<=0)out.pop();out.push(q);}return out;};
  return [...half(p).slice(0,-1),...half([...p].reverse()).slice(0,-1)];
}
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0))/2;
const inside=(p,ring)=>ring.every((a,i)=>cross(a,ring[(i+1)%ring.length],p)>=-4);
const boxOf=ring=>[Math.min(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1])),Math.max(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[1]))];
const separation=(a,b)=>Math.hypot(Math.max(0,a[0]-b[2],b[0]-a[2]),Math.max(0,a[1]-b[3],b[1]-a[3]));
function elevationOutline(faces){
  const hull=convexOutline(faces.flatMap(f=>f.outer));if(hull.length<3)return hull;
  const [x0,y0,x1,y1]=boxOf(hull),bw=Math.round(x1-x0),bh=y1-y0;if(bw<20||bh<20)return hull;
  const cols=new Float64Array(bw+1).fill(Infinity);let covered=0;
  for(const f of faces)for(let i=0;i<f.outer.length;i++){
    const a=f.outer[i],b=f.outer[(i+1)%f.outer.length],lo=Math.max(0,Math.ceil(Math.min(a[0],b[0])-x0)),hi=Math.min(bw,Math.floor(Math.max(a[0],b[0])-x0));
    for(let x=lo;x<=hi;x++){const px=x0+x,py=Math.abs(b[0]-a[0])<1e-6?Math.min(a[1],b[1]):a[1]+(b[1]-a[1])*(px-a[0])/(b[0]-a[0]);cols[x]=Math.min(cols[x],py);}
  }
  for(let i=0;i<=bw;i++)if(Number.isFinite(cols[i]))covered++;
  if(covered<(bw+1)*.85)return hull;
  for(let i=1;i<=bw;i++)if(!Number.isFinite(cols[i]))cols[i]=cols[i-1];
  for(let i=bw-1;i>=0;i--)if(!Number.isFinite(cols[i]))cols[i]=cols[i+1];
  let columnArea=0;for(let i=0;i<=bw;i++)columnArea+=Math.max(0,y1-cols[i]);
  if(area(hull)-columnArea<bw*bh*.02)return hull;
  let stepIdx=-1,maxJump=0;
  for(let i=Math.round(bw*.15);i<=Math.round(bw*.85);i++){const jump=Math.abs(cols[Math.min(bw,i+5)]-cols[Math.max(0,i-5)]);if(jump>maxJump){maxJump=jump;stepIdx=i;}}
  if(stepIdx<0||maxJump<bh*.18)return hull;
  const leftMean=cols.subarray(0,stepIdx-2).reduce((s,v)=>s+v,0)/Math.max(1,stepIdx-2),rightMean=cols.subarray(stepIdx+3).reduce((s,v)=>s+v,0)/Math.max(1,bw-stepIdx-2);
  if(Math.abs(leftMean-rightMean)<bh*.18)return hull;
  const stepX=Math.round(x0+stepIdx);
  if(leftMean>rightMean){
    const wingY=Math.round(median([...cols.subarray(0,stepIdx-2)])),mainFaces=faces.filter(f=>boxOf(f.outer)[2]>stepX+6),mainHull=convexOutline(mainFaces.flatMap(f=>f.outer));
    const upper=mainHull.filter(p=>p[0]>=stepX-2&&p[1]<=wingY-4).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const topChain=[];for(const p of upper){while(topChain.length>1&&cross(topChain.at(-2),topChain.at(-1),p)<=0)topChain.pop();topChain.push(p);}
    while(topChain.length>2&&topChain.at(-1)[1]>topChain[0][1]+4)topChain.pop();
    if(topChain.length>=2&&topChain.at(-1)[0]<x1)topChain.push([x1,topChain.at(-1)[1]]);
    const candidate=[[x0,y1],[x0,wingY],[stepX,wingY],...topChain,[x1,y1]];
    return isSimple(candidate)?candidate:hull;
  }
  return hull;
}
function isSimple(ring){
  if(ring.length<3)return false;
  for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-4)return false;}
  return true;
}

/** Estimate a two-point camera from independent contour edges. The resulting
 * depth is a geometric proposal, never a recovered survey or a pasted image. */
export function perspectiveFrame(faces,w,h){
  const edges=[];
  for(const f of faces)for(let i=0;i<f.ring.length;i++){
    const a=f.ring[i],b=f.ring[(i+1)%f.ring.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
    if(length<w*.035||Math.abs(dx)<Math.abs(dy)*.3||Math.abs(dy/dx)<.045)continue;
    const A=dy/length,B=-dx/length;edges.push({a,b,length,A,B,C:-(A*a[0]+B*a[1])});
  }
  const candidates=[];
  for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
    const a=edges[i],b=edges[j],d=a.A*b.B-b.A*a.B;if(Math.abs(d)<.04)continue;
    const x=(a.B*b.C-b.B*a.C)/d,y=(b.A*a.C-a.A*b.C)/d;
    if(x<-w||x>2*w||x>w*.42&&x<w*.58||y<0||y>h)continue;
    let score=0,support=0;for(const e of edges){const distance=Math.abs(e.A*x+e.B*y+e.C);if(distance<9){score+=e.length/(1+distance*distance/16);support++;}}
    if(support>=4)candidates.push({point:[x,y],score,support});
  }
  candidates.sort((a,b)=>b.score-a.score);const left=candidates.find(c=>c.point[0]<w*.42),right=candidates.find(c=>c.point[0]>w*.58);
  if(!left||!right||Math.abs(left.point[1]-right.point[1])>h*.12)return null;
  const cx=w/2,cy=h/2,f2=-(left.point[0]-cx)*(right.point[0]-cx)-(left.point[1]-cy)*(right.point[1]-cy);if(f2<w*w*.025)return null;
  const focal=Math.sqrt(f2),ray=p=>new THREE.Vector3((p[0]-cx)/focal,-(p[1]-cy)/focal,-1),xAxis=ray(right.point).normalize(),zAxis=ray(left.point).normalize(),up=xAxis.clone().cross(zAxis).normalize();
  const direction=p=>{const r=ray(p);return new THREE.Vector3(-r.dot(xAxis),r.dot(up),-r.dot(zAxis));};
  return {left:left.point,right:right.point,focal,horizon:(left.point[1]+right.point[1])/2,direction,eye:new THREE.Vector3(0,1.5,0)};
}
function planeFamily(ring,frame){
  const costs=[0,0];let support=0;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
    if(length<12||Math.abs(dx)<Math.abs(dy)*.3||Math.abs(dy/dx)<.025)continue;
    for(const [j,vp] of [frame.left,frame.right].entries())costs[j]+=Math.abs(dx*(vp[1]-a[1])-dy*(vp[0]-a[0]))/Math.max(1,Math.hypot(vp[0]-a[0],vp[1]-a[1]));support+=length;
  }
  return support?costs[0]<costs[1]?'x':'z':null;
}
export function sourcePlanes(registration,levels){
  const {width:w,height:h}=registration,faces=registration.faces.filter(f=>(f.area??area(f.outer))>w*h*.0007).map(f=>({...f,ring:convexOutline(f.outer)})).filter(f=>f.ring.length>=3),frame=perspectiveFrame(faces,w,h);
  if(!frame)return {faces,frame:null,planes:[]};
  const candidates=faces.filter(f=>{
    const b=boxOf(f.ring),vertical=f.ring.flatMap((a,i)=>{const q=f.ring[(i+1)%f.ring.length];return Math.abs(q[0]-a[0])<Math.abs(q[1]-a[1])*.28&&Math.abs(q[1]-a[1])>(b[3]-b[1])*.22?[(a[0]+q[0])/2]:[];});f.hasVertical=vertical.length>0;
    return b[3]-b[1]>h*.06&&vertical.length>=2&&Math.max(...vertical)-Math.min(...vertical)>(b[2]-b[0])*.4;
  });
  if(!candidates.length)return {faces,frame:null,planes:[]};
  const all=boxOf(candidates.flatMap(f=>f.ring)),split=all[1]+(all[3]-all[1])*.58;
  for(const f of faces){f.bounds=boxOf(f.ring);const cy=(f.bounds[1]+f.bounds[3])/2;f.level=levels===2?(cy<split?1:0):clamp(Math.floor((all[3]-cy)/(all[3]-all[1])*levels),0,levels-1);f.axis=planeFamily(f.ring,frame);}
  // A window enclosed by a larger facade belongs to that facade plane. Its
  // pixels will become an opening and independent glazing, not a photo patch.
  const roots=candidates.filter(f=>!candidates.some(g=>g!==f&&area(g.ring)>area(f.ring)*1.35&&inside([(f.bounds[0]+f.bounds[2])/2,(f.bounds[1]+f.bounds[3])/2],g.ring)));
  const planes=roots.filter(f=>f.axis).map(f=>({axis:f.axis,level:f.level,members:[f],ring:f.ring,bounds:f.bounds}));
  let changed=true;
  while(changed){changed=false;outer:for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++){
    const a=planes[i],b=planes[j];if(a.axis!==b.axis||a.level!==b.level||separation(a.bounds,b.bounds)>w*.016)continue;
    a.members.push(...b.members);a.ring=convexOutline([...a.ring,...b.ring]);a.bounds=boxOf(a.ring);planes.splice(j,1);changed=true;break outer;
  }}
  for(const f of faces){if(roots.includes(f))continue;const center=[(f.bounds[0]+f.bounds[2])/2,(f.bounds[1]+f.bounds[3])/2],owner=planes.filter(p=>p.level===f.level&&(inside(center,p.ring)||f.hasVertical&&f.axis===p.axis&&separation(p.bounds,f.bounds)<w*.008)).sort((a,b)=>area(a.ring)-area(b.ring))[0];if(owner){owner.members.push(f);owner.ring=convexOutline([...owner.ring,...f.ring]);owner.bounds=boxOf(owner.ring);}}
  return {faces,frame,planes};
}
function perspectiveMasses(registration,levels){
  const {faces,frame,planes}=sourcePlanes(registration,levels);if(!frame)return null;
  const pairs=[];for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++){
    const a=planes[i],b=planes[j];if(a.axis===b.axis||a.level!==b.level)continue;
    const sides=p=>p.ring.flatMap((u,i)=>{const v=p.ring[(i+1)%p.ring.length],dy=v[1]-u[1];return Math.abs(dy)>registration.height*.07&&Math.abs((v[0]-u[0])/dy)<.3?[{u,v,slope:(v[0]-u[0])/dy}]:[];});
    let joint=null;
    for(const x of sides(a))for(const z of sides(b)){
      const top=Math.max(Math.min(x.u[1],x.v[1]),Math.min(z.u[1],z.v[1])),bottom=Math.min(Math.max(x.u[1],x.v[1]),Math.max(z.u[1],z.v[1])),overlap=bottom-top,difference=Math.abs(x.slope-z.slope);if(overlap<registration.height*.07||difference>.15)continue;
      const mid=(top+bottom)/2,xx=x.u[0]+(mid-x.u[1])*x.slope,zz=z.u[0]+(mid-z.u[1])*z.slope,gap=Math.abs(xx-zz);if(gap>registration.width*.027)continue;
      const anchor=Math.min(Math.max(x.u[1],x.v[1],z.u[1],z.v[1]),bottom+registration.height*.08),score=overlap*Math.pow(area(a.ring)+area(b.ring),.2)/(1+gap*gap/100+difference*50),corner=[(x.u[0]+(anchor-x.u[1])*x.slope+z.u[0]+(anchor-z.u[1])*z.slope)/2,anchor];if(!joint||score>joint.score)joint={a,b,corner,score};
    }
    if(joint)pairs.push(joint);
  }
  pairs.sort((a,b)=>b.score-a.score);const used=new Set(),masses=[];
  for(const {a,b,corner} of pairs){
    if(used.has(a)||used.has(b))continue;const base=a.level*3,ray=frame.direction(corner),distance=(base-frame.eye.y)/ray.y;if(!(distance>0&&distance<120))continue;
    const joint=frame.eye.clone().addScaledVector(ray,distance),project=(p,plane)=>{const r=frame.direction(p),t=(joint[plane.axis]-frame.eye[plane.axis])/r[plane.axis];return t>0&&t<120?frame.eye.clone().addScaledVector(r,t):null;};
    const pa=a.ring.map(p=>project(p,a)),pb=b.ring.map(p=>project(p,b));if([...pa,...pb].some(p=>!p))continue;
    const xPlane=a.axis==='x'?a:b,zPlane=a.axis==='z'?a:b,xPoints=a.axis==='x'?pa:pb,zPoints=a.axis==='z'?pa:pb,xs=zPoints.map(p=>p.x),zs=xPoints.map(p=>p.z),x0=median(xs)<joint.x?Math.min(...xs):joint.x,x1=median(xs)<joint.x?joint.x:Math.max(...xs),z0=median(zs)<joint.z?Math.min(...zs):joint.z,z1=median(zs)<joint.z?joint.z:Math.max(...zs),tops=[...pa,...pb].map(p=>p.y).filter(y=>y>base+1.5&&y<base+7);
    if(x1-x0<.6||z1-z0<.6||x1-x0>35||z1-z0>35||!tops.length)continue;
    const top=clamp(median(tops),base+2.4,base+4.2),openings=[];
    for(const plane of [xPlane,zPlane])for(const f of plane.members){
      const ratio=area(f.ring)/area(plane.ring),center=[(f.bounds[0]+f.bounds[2])/2,(f.bounds[1]+f.bounds[3])/2];
      if(ratio<.035||ratio>.75||!inside(center,plane.ring)||f.bounds[3]-f.bounds[1]<registration.height*.045)continue;
      const points=f.ring.map(p=>project(p,plane));if(points.some(p=>!p))continue;const across=plane.axis==='x'?'z':'x',lo=Math.min(...points.map(p=>p[across])),hi=Math.max(...points.map(p=>p[across])),bottom=Math.min(...points.map(p=>p.y)),head=Math.max(...points.map(p=>p.y));
      if(hi-lo>.25&&head-bottom>.4)openings.push({axis:plane.axis,constant:joint[plane.axis],lo,hi,bottom,head,sourceFace:f.id,sourceBounds:f.bounds,proposed:true});
    }
    masses.push({x0,x1,z0,z1,base,top,level:a.level,openings,sourceFaces:[...a.members,...b.members].map(f=>f.id)});used.add(a);used.add(b);
  }
  if(!masses.length)return null;
  // If ground contours were interrupted by dimensions or pencil shading, the
  // supported upper masses still define a restrained ground envelope.
  if(!masses.some(m=>m.level===0)){
    const ground={x0:Math.min(...masses.map(m=>m.x0)),x1:Math.max(...masses.map(m=>m.x1)),z0:Math.min(...masses.map(m=>m.z0)),z1:Math.max(...masses.map(m=>m.z1)),base:0,top:3,level:0,openings:[],sourceFaces:[],inferred:true};
    for(const f of faces.filter(f=>f.level===0&&f.role==='glass'&&f.axis)){
      const axis=f.axis,across=axis==='x'?'z':'x',constant=ground[axis+'1'],points=f.ring.map(p=>{const ray=frame.direction(p),t=(constant-frame.eye[axis])/ray[axis];return frame.eye.clone().addScaledVector(ray,t);});
      const lo=Math.min(...points.map(p=>p[across])),hi=Math.max(...points.map(p=>p[across])),bottom=Math.min(...points.map(p=>p.y)),head=Math.max(...points.map(p=>p.y));
      if(points.every(p=>p.toArray().every(Number.isFinite))&&hi-lo>.3&&head-bottom>.4)ground.openings.push({axis,constant,lo,hi,bottom,head,sourceFace:f.id,sourceBounds:f.bounds,proposed:true});
    }
    masses.push(ground);
  }
  for(let level=0;level<levels;level++)if(!masses.some(m=>m.level===level)){
    const nearest=[...masses].sort((a,b)=>Math.abs(a.level-level)-Math.abs(b.level-level))[0];
    masses.push({...nearest,base:level*3,top:(level+1)*3,level,openings:[],sourceFaces:[],inferred:true});
  }
  return {masses,frame:{left:frame.left,right:frame.right,focal:frame.focal},sourceFaceCount:faces.length};
}

/** Full-depth physical envelope with independent materials and real openings.
 * This route never creates a CanvasTexture, source-photo mesh or thin backing. */
export function addSourceVolume(project,group,mpp,{own}){
  const r=project.sourceReconstruction;if(!r||r.sourceHash&&project.sourceHash&&r.sourceHash!==project.sourceHash||r.width!==project.drawing.width||r.height!==project.drawing.height)throw new Error('El volumen y la lámina no comparten el mismo origen.');
  const p=project.params,W=project.calibration?project.drawing.bounds.width*mpp:p.widthMm/1000,D=p.depthMm/1000;if(W<1||D<.5)throw new Error('Revisa la escala: el edificio necesita al menos 1 m de ancho y 0,5 m de profundidad.');
  const palette=architecturalPalette(p.facadeScheme),chosen=p.material&&p.material!=='auto'?SURFACE_MATERIALS[p.material]:null,wall=own(new THREE.MeshStandardMaterial({color:chosen?new THREE.Color().setRGB(...chosen.color.map(v=>v/255),THREE.SRGBColorSpace):palette.wall,metalness:chosen?.metalness??0,roughness:chosen?.roughness??.76,side:THREE.DoubleSide})),roof=own(new THREE.MeshStandardMaterial({color:palette.roof,roughness:.52,metalness:.18,side:THREE.DoubleSide})),frame=own(new THREE.MeshStandardMaterial({color:palette.metal,metalness:.68,roughness:.26})),glass=own(new THREE.MeshPhysicalMaterial({color:'#7eaec4',roughness:.08,metalness:.16,clearcoat:1,clearcoatRoughness:.06,reflectivity:.92,transparent:true,opacity:.68,side:THREE.DoubleSide,depthWrite:false})),floor=own(new THREE.MeshStandardMaterial({color:'#cbc5b9',roughness:.82}));
  let parts=0;const mesh=(geometry,material,name,data={})=>{const o=new THREE.Mesh(geometry,material);o.name=name;o.userData.sourceVolume=data;o.castShadow=material!==glass;o.receiveShadow=true;group.add(o);parts++;return o;};
  const box=(w,h,d,x,y,z,mat,name,data)=>{const o=mesh(new THREE.BoxGeometry(w,h,d),mat,name,data);o.position.set(x,y,z);return o;};
  const manual=(project.profiles??[]).filter(p=>['user-traced','cad'].includes(p.source));for(const profile of manual)validateClosedProfile(profile);
  const analysis=manual.length?null:perspectiveMasses(r,Math.round(p.facadeFloors??2));
  let openingCount=0,masses=[];
  if(analysis){
    masses=analysis.masses;const minX=Math.min(...masses.map(m=>m.x0)),maxX=Math.max(...masses.map(m=>m.x1)),minZ=Math.min(...masses.map(m=>m.z0)),maxZ=Math.max(...masses.map(m=>m.z1)),sx=D/(maxX-minX),sz=W/(maxZ-minZ);
    for(const m of masses){m.x0=(m.x0-(minX+maxX)/2)*sx;m.x1=(m.x1-(minX+maxX)/2)*sx;m.z0=(m.z0-(minZ+maxZ)/2)*sz;m.z1=(m.z1-(minZ+maxZ)/2)*sz;
      for(const o of m.openings){const s=o.axis==='x'?sz:sx,offset=o.axis==='x'?(minZ+maxZ)/2:(minX+maxX)/2;o.lo=(o.lo-offset)*s;o.hi=(o.hi-offset)*s;o.constant=(o.constant-(o.axis==='x'?(minX+maxX)/2:(minZ+maxZ)/2))*(o.axis==='x'?sx:sz);}
      for(const [axis,constant] of [['x',m.x0],['x',m.x1],['z',m.z0],['z',m.z1]]){
        const across=axis==='x'?'z':'x',lo=m[across+'0'],hi=m[across+'1'],height=m.top-m.base,shape=new THREE.Shape([new THREE.Vector2(lo,m.base),new THREE.Vector2(hi,m.base),new THREE.Vector2(hi,m.top),new THREE.Vector2(lo,m.top)]),holes=[];
        for(const o of m.openings.filter(o=>o.axis===axis&&Math.abs(o.constant-constant)<.2)){
          const a=clamp(o.lo,lo+.12,hi-.22),b=clamp(o.hi,a+.1,hi-.12),bottom=clamp(o.bottom,m.base+.1,m.top-.6),head=clamp(o.head,bottom+.25,m.top-.12);
          if(b-a<.25||head-bottom<.4||holes.some(h=>a<h.b+.04&&b>h.a-.04&&bottom<h.head+.04&&head>h.bottom-.04))continue;
          const path=new THREE.Path([new THREE.Vector2(a,bottom),new THREE.Vector2(a,head),new THREE.Vector2(b,head),new THREE.Vector2(b,bottom)]);shape.holes.push(path);holes.push({a,b,bottom,head,sourceFace:o.sourceFace});
        }
        const T=.18,g=new THREE.ExtrudeGeometry(shape,{depth:T,bevelEnabled:false}),visible=Math.abs(constant-(axis==='x'?m.x1:m.z1))<.01,sign=visible?-1:1;
        // local (u,y,depth) is mapped onto the actual orthogonal facade plane.
        const positions=g.attributes.position;for(let i=0;i<positions.count;i++){const u=positions.getX(i),y=positions.getY(i),z=constant+sign*positions.getZ(i);positions.setXYZ(i,axis==='x'?z:u,y,axis==='x'?u:z);}g.computeVertexNormals();
        mesh(g,wall,'source-building-wall',{axis,constant,level:m.level,openings:holes,sourceFaces:m.sourceFaces,outward:axis==='x'?[-sign,0,0]:[0,0,-sign],proposed:m.inferred??false});
        for(const h of holes){openingCount++;const width=h.b-h.a,height=h.head-h.bottom,u=(h.a+h.b)/2,y=(h.bottom+h.head)/2,inset=constant+sign*.10,data={sourceFace:h.sourceFace,level:m.level,proposed:true};
          const pane=axis==='x'?box(.025,height,width,inset,y,u,glass,'source-building-window',data):box(width,height,.025,u,y,inset,glass,'source-building-window',data);pane.castShadow=false;
          for(const edge of [h.a,h.b])axis==='x'?box(.12,height+.08,.045,constant,y,edge,frame,'source-window-jamb',data):box(.045,height+.08,.12,edge,y,constant,frame,'source-window-jamb',data);
          for(const yy of [h.bottom,h.head])axis==='x'?box(.12,.045,width+.08,constant,yy,u,frame,'source-window-head',data):box(width+.08,.045,.12,u,yy,constant,frame,'source-window-head',data);
        }
      }
      box(m.x1-m.x0+.12,.16,m.z1-m.z0+.12,(m.x0+m.x1)/2,m.top+.04,(m.z0+m.z1)/2,roof,'source-building-roof',{level:m.level,proposed:true});
      box(m.x1-m.x0,.14,m.z1-m.z0,(m.x0+m.x1)/2,m.base+.03,(m.z0+m.z1)/2,floor,'source-building-floor',{level:m.level,proposed:true});
    }
  }else{
    // A frontal elevation or section supplies its own outline. Build its front wall,
    // articulated rear and side elevations, roof slopes, dormer/terraces and openings.
    const timber=own(new THREE.MeshStandardMaterial({color:palette.wood??'#9e6f43',roughness:.54,side:THREE.DoubleSide}));
    const doorMat=own(new THREE.MeshStandardMaterial({color:'#697077',roughness:.44,metalness:.18,side:THREE.DoubleSide}));
    const handleMat=own(new THREE.MeshStandardMaterial({color:'#d6dce0',metalness:.88,roughness:.2}));
    const trimMat=own(new THREE.MeshStandardMaterial({color:'#dfd9ce',roughness:.72,side:THREE.DoubleSide}));
    const faces=r.faces.filter(f=>(f.area??area(f.outer))>r.width*r.height*.001),outlines=manual.length?manual.map(p=>p.outer):[elevationOutline(faces)],outline=outlines[0];if(outlines.some(p=>p.length<3))throw new Error('Delimita un contorno de fachada para construir el volumen.');
    const b=boxOf(outlines.flat()),s=W/(b[2]-b[0]),H=(b[3]-b[1])*s,point=([x,y])=>new THREE.Vector2((x-(b[0]+b[2])/2)*s,(b[3]-y)*s),shapes=outlines.map(ring=>new THREE.Shape(ring.map(point))),shape=shapes[0],holes=[];
    for(let i=0;i<manual.length;i++)for(const ring of manual[i].holes??[]){shapes[i].holes.push(new THREE.Path(ring.map(point)));openingCount++;}
    const pointInPoly=([px,py],ring)=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],q=ring[j];if((a[1]>py)!==(q[1]>py)&&px<(q[0]-a[0])*(py-a[1])/(q[1]-a[1])+a[0])hit=!hit;}return hit;};
    const tinted=(r.faces??[]).filter(f=>f.role==='glass'&&f.tintedGlass).map(f=>({bbox:f.bounds,glass:true}));
    for(const f of manual.length?[]:tinted.length?tinted:(project.drawing.faces??[])){if(!f.glass)continue;const [x0,y0,x1,y1]=f.bbox,center=[(x0+x1)/2,(y0+y1)/2];if(!pointInPoly(center,outline)||x1-x0<r.width*.012||y1-y0<r.height*.03)continue;const a=point([x0+1,y1-1]),z=point([x1-1,y0+1]);if(z.x-a.x<.2||z.y-a.y<.3||holes.some(h=>a.x<h.z.x&&z.x>h.a.x&&a.y<h.z.y&&z.y>h.a.y))continue;shape.holes.push(new THREE.Path([a,new THREE.Vector2(a.x,z.y),z,new THREE.Vector2(z.x,a.y)]));holes.push({a,z});}
    // Check if outline has a stepped lower wing on the left: [x0,y1],[x0,wingY],[stepX,wingY],...
    const hasStep=!manual.length&&outline.length>=6&&Math.abs(outline[1][1]-outline[2][1])<2&&outline[2][0]-outline[1][0]>(b[2]-b[0])*.15&&outline[1][1]-b[1]>(b[3]-b[1])*.22;
    const stepPt=hasStep?point(outline[2]):null,wingX1=stepPt?stepPt.x:-W/2,wingH=stepPt?stepPt.y:0;
    const mainW=W/2-wingX1,wingW=wingX1+W/2;
    const mainRingPts=hasStep?outline.slice(2).map(point):[];
    const eaveY=hasStep?Math.max(wingH+.8,Math.min(...mainRingPts.filter(q=>q.y>wingH+.4).map(q=>q.y))):H*.75;
    if(hasStep&&tinted.length){
      // 1. Coherent ground-floor window on the lower wing front
      const wx0=-W/2+wingW*.26,wx1=-W/2+wingW*.74,wy0=clamp(wingH*.30,.52,wingH*.45),wy1=clamp(wingH*.78,wy0+.55,wingH-.30);
      if(wx1-wx0>.35&&wy1-wy0>.4&&!holes.some(h=>h.a.x<wx1&&h.z.x>wx0)){
        const a=new THREE.Vector2(wx0,wy0),z=new THREE.Vector2(wx1,wy1);
        shape.holes.push(new THREE.Path([a,new THREE.Vector2(a.x,z.y),z,new THREE.Vector2(z.x,a.y)]));holes.push({a,z});
      }
      // 2. Centered Buhardilla (attic) window under the 60% gable ridge
      const bx0=wingX1+mainW*.37,bx1=wingX1+mainW*.63,by0=eaveY+(H-eaveY)*.20,by1=eaveY+(H-eaveY)*.58;
      if(bx1-bx0>.35&&by1-by0>.35&&!holes.some(h=>h.a.x<bx1&&h.z.x>bx0&&h.a.y<by1&&h.z.y>by0)){
        const a=new THREE.Vector2(bx0,by0),z=new THREE.Vector2(bx1,by1);
        shape.holes.push(new THREE.Path([a,new THREE.Vector2(a.x,z.y),z,new THREE.Vector2(z.x,a.y)]));holes.push({a,z});
      }
    }
    const isConvex=outline.every((a,i)=>cross(a,outline[(i+1)%outline.length],outline[(i+2)%outline.length])>=-1e-5)||outline.every((a,i)=>cross(a,outline[(i+1)%outline.length],outline[(i+2)%outline.length])<=1e-5);
    const front=manual.length||!isConvex?new THREE.ExtrudeGeometry(shapes,{depth:.18,bevelEnabled:false}):perforatedFacade(outline.map(point),holes);front.translate(0,0,-.18);mesh(front,wall,'source-building-wall',{axis:'z',constant:0,openings:holes,proposed:false});
    const addZWindow=(ax,ay,zx,zy,zPlane,outSign,countIt=true)=>{
      const w=zx-ax,h=zy-ay,cx=(ax+zx)/2,cy=(ay+zy)/2,zGlass=zPlane-outSign*.085,zFrame=zPlane-outSign*.045;
      if(countIt)openingCount++;
      box(w,h,.025,cx,cy,zGlass,glass,'source-building-window',{proposed:true});
      if(!manual.length){
        const maxSpan=Math.max(.2,W-Math.abs(cx)*2-.02);
        for(const ex of [ax,zx])if(Math.abs(ex)<=W/2-.03)box(.05,h+.08,.14,ex,cy,zFrame,frame,'source-window-jamb',{proposed:true});
        for(const ey of [ay,zy])box(Math.min(w+.08,maxSpan),.05,.14,cx,ey,zFrame,frame,'source-window-head',{proposed:true});
        if(ay>.35)box(Math.min(w+.12,maxSpan),.055,.17,cx,ay-.028,zPlane-outSign*.025,trimMat,'source-window-sill',{proposed:true});
        // Inner casement/sliding mullions matching architectural drawing proportions
        if(w>=1.15){
          for(const t of [-w/6,w/6])box(.035,h,.09,cx+t,cy,zFrame,frame,'source-window-mullion',{proposed:true});
        }else if(w>=.68){
          box(.035,h,.09,cx,cy,zFrame,frame,'source-window-mullion',{proposed:true});
        }
        if(h>=1.35)box(Math.min(w,maxSpan),.03,0.08,cx,ay+h*.62,zFrame,frame,'source-window-transom',{proposed:true});
      }
    };
    const addFrontDoor=(cx,y0,dw,dh,zSurface=0,outSign=1)=>{
      const cy=y0+dh/2,zLeaf=zSurface+outSign*.018,zFrame=zSurface+outSign*.028;
      openingCount++;
      // Door leaf (warm slate/timber matching CORTE AA section doors)
      box(dw,dh,.036,cx,cy,zLeaf,doorMat,'source-building-door',{proposed:true});
      // Perimeter 3D door casing (jambs, head & stone threshold)
      box(.055,dh+.055,.065,cx-dw/2-.02,cy,zFrame,frame,'source-door-jamb',{proposed:true});
      box(.055,dh+.055,.065,cx+dw/2+.02,cy,zFrame,frame,'source-door-jamb',{proposed:true});
      box(dw+.11,.06,.07,cx,y0+dh+.025,zFrame,frame,'source-door-head',{proposed:true});
      box(dw+.14,.045,.10,cx,y0+.02,zSurface+outSign*.035,trimMat,'source-door-threshold',{proposed:true});
      // Architectural horizontal panel reveals & brushed steel lever handle
      for(const py of [y0+dh*.25,y0+dh*.50,y0+dh*.75])box(dw-.08,.016,.042,cx,py,zLeaf+outSign*.004,frame,'source-door-panel',{proposed:true});
      box(.11,.024,.045,cx+dw*.30,y0+dh*.48,zSurface+outSign*.045,handleMat,'source-door-handle',{proposed:true});
    };
    const addXWall=(xConst,inwardSign,zFront,zBack,y0,y1,winSpecs=[],name='source-building-return')=>{
      const spanZ=zFront-zBack,height=y1-y0;if(spanZ<.25||height<.25)return;
      const s2=new THREE.Shape([new THREE.Vector2(zBack,y0),new THREE.Vector2(zFront,y0),new THREE.Vector2(zFront,y1),new THREE.Vector2(zBack,y1)]);
      const accepted=[];
      for(const q of winSpecs){
        const z0=clamp(q.z-q.w/2,zBack+.22,zFront-.22),z1=clamp(q.z+q.w/2,z0+.2,zFront-.22),wy0=clamp(q.y0,y0+.15,y1-.35),wy1=clamp(q.y1,wy0+.25,y1-.18);
        if(z1-z0<.28||wy1-wy0<.35||accepted.some(o=>z0<o.z1+.08&&z1>o.z0-.08&&wy0<o.wy1+.08&&wy1>o.wy0-.08))continue;
        s2.holes.push(new THREE.Path([new THREE.Vector2(z0,wy0),new THREE.Vector2(z0,wy1),new THREE.Vector2(z1,wy1),new THREE.Vector2(z1,wy0)]));
        accepted.push({z0,z1,wy0,wy1,door:!!q.door});
      }
      const T=.18,g=new THREE.ExtrudeGeometry(s2,{depth:T,bevelEnabled:false}),pos=g.attributes.position;
      for(let i=0;i<pos.count;i++){const u=pos.getX(i),y=pos.getY(i),x=xConst+inwardSign*pos.getZ(i);pos.setXYZ(i,x,y,u);}
      g.computeVertexNormals();mesh(g,wall,name,{proposed:true});
      for(const o of accepted){
        const w=o.z1-o.z0,h=o.wy1-o.wy0,cz=(o.z0+o.z1)/2,cy=(o.wy0+o.wy1)/2,xGlass=xConst+inwardSign*.085,xFrame=xConst+inwardSign*.045;
        openingCount++;
        box(.025,h,w,xGlass,cy,cz,o.door?timber:glass,o.door?'source-building-door':'source-building-window',{proposed:true});
        if(o.door)box(.03,h*.55,w*.68,xConst+inwardSign*.07,cy+h*.12,cz,glass,'source-building-window',{proposed:true});
        for(const ez of [o.z0,o.z1])box(.14,h+.08,.05,xFrame,cy,ez,frame,'source-window-jamb',{proposed:true});
        for(const ey of [o.wy0,o.wy1])box(.14,.05,w+.08,xFrame,ey,cz,frame,'source-window-head',{proposed:true});
        if(!o.door&&w>=.72)box(.09,h,.035,xFrame,cy,cz,frame,'source-window-mullion',{proposed:true});
        if(!o.door&&o.wy0>.3)box(.16,.055,w+.10,xConst+inwardSign*.03,o.wy0-.028,cz,trimMat,'source-window-sill',{proposed:true});
      }
    };
    for(const h of holes)addZWindow(h.a.x,h.a.y,h.z.x,h.z.y,0,1,true);
    if(manual.length){
      const backShape=outlines.map(ring=>new THREE.Shape(ring.map(point))),back=new THREE.ExtrudeGeometry(backShape,{depth:.18,bevelEnabled:false});back.translate(0,0,-D);mesh(back,wall,'source-building-back',{proposed:true});
      for(const outline of outlines)for(let i=0;i<outline.length;i++){const a=point(outline[i]),b=point(outline[(i+1)%outline.length]),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([a.x,a.y,0,b.x,b.y,0,b.x,b.y,-D,a.x,a.y,0,b.x,b.y,-D,a.x,a.y,-D],3));g.computeVertexNormals();const isRoof=Math.min(a.y,b.y)>.25&&(Math.abs(a.y-b.y)<.2||Math.abs(a.x-b.x)>Math.abs(a.y-b.y)*.45);mesh(g,isRoof?roof:wall,'source-building-return',{proposed:true});}
    }else if(hasStep){
      // Articulated stepped 3D building: main 2-story + attic body [wingX1..W/2, 0..-D]
      // and setback 1-story wing [-W/2..wingX1, 0..-wingD] with walkable roof terrace and rear courtyard.
      const wingD=D*.76,floor1Y=wingH*.91;
      // 1. Main body rear wall at z = -D with coherent openings on ground, first and attic levels
      const mainBackRing=[new THREE.Vector2(wingX1,0),new THREE.Vector2(wingX1,wingH),...mainRingPts];
      const mainBackShape=new THREE.Shape(mainBackRing),rearHoles=[];
      const rearSpecs=[
        {x0:wingX1+mainW*.14,x1:wingX1+mainW*.42,y0:floor1Y*.20,y1:floor1Y*.72},
        {x0:wingX1+mainW*.54,x1:wingX1+mainW*.86,y0:floor1Y*.05,y1:floor1Y*.80},
        {x0:wingX1+mainW*.14,x1:wingX1+mainW*.42,y0:floor1Y+(eaveY-floor1Y)*.22,y1:floor1Y+(eaveY-floor1Y)*.72},
        {x0:wingX1+mainW*.56,x1:wingX1+mainW*.84,y0:floor1Y+(eaveY-floor1Y)*.22,y1:floor1Y+(eaveY-floor1Y)*.72},
        {x0:wingX1+mainW*.37,x1:wingX1+mainW*.63,y0:eaveY+(H-eaveY)*.20,y1:eaveY+(H-eaveY)*.58}
      ];
      for(const q of rearSpecs)if(q.x1-q.x0>.35&&q.y1-q.y0>.35){
        mainBackShape.holes.push(new THREE.Path([new THREE.Vector2(q.x0,q.y0),new THREE.Vector2(q.x0,q.y1),new THREE.Vector2(q.x1,q.y1),new THREE.Vector2(q.x1,q.y0)]));
        rearHoles.push(q);
      }
      const mainBack=new THREE.ExtrudeGeometry(mainBackShape,{depth:.18,bevelEnabled:false});mainBack.translate(0,0,-D);mesh(mainBack,wall,'source-building-back',{proposed:true});
      for(const q of rearHoles)addZWindow(q.x0,q.y0,q.x1,q.y1,-D,-1,true);
      // 2. Wing rear wall at z = -wingD with ground-floor rear window
      const wingBackShape=new THREE.Shape([new THREE.Vector2(-W/2,0),new THREE.Vector2(-W/2,wingH),new THREE.Vector2(wingX1,wingH),new THREE.Vector2(wingX1,0)]);
      const wx0=-W/2+wingW*.24,wx1=-W/2+wingW*.76,wy0=wingH*.28,wy1=wingH*.74;
      if(wx1-wx0>.35&&wy1-wy0>.35){
        wingBackShape.holes.push(new THREE.Path([new THREE.Vector2(wx0,wy0),new THREE.Vector2(wx0,wy1),new THREE.Vector2(wx1,wy1),new THREE.Vector2(wx1,wy0)]));
      }
      const wingBack=new THREE.ExtrudeGeometry(wingBackShape,{depth:.18,bevelEnabled:false});wingBack.translate(0,0,-wingD);mesh(wingBack,wall,'source-building-back',{proposed:true});
      if(wx1-wx0>.35&&wy1-wy0>.35)addZWindow(wx0,wy0,wx1,wy1,-wingD,-1,true);
      // 3. Side walls with framed windows & terrace access door
      const rightTopY=mainRingPts.at(-2)?.y??eaveY;
      addXWall(W/2,-1,0,-D,0,rightTopY,[
        {z:-D*.28,w:D*.20,y0:floor1Y*.20,y1:floor1Y*.70},
        {z:-D*.72,w:D*.20,y0:floor1Y*.20,y1:floor1Y*.70},
        {z:-D*.28,w:D*.20,y0:floor1Y+(rightTopY-floor1Y)*.22,y1:floor1Y+(rightTopY-floor1Y)*.72},
        {z:-D*.72,w:D*.20,y0:floor1Y+(rightTopY-floor1Y)*.22,y1:floor1Y+(rightTopY-floor1Y)*.72}
      ]);
      addXWall(-W/2,1,0,-wingD,0,wingH,[
        {z:-wingD*.30,w:wingD*.24,y0:wingH*.28,y1:wingH*.74},
        {z:-wingD*.72,w:wingD*.24,y0:wingH*.28,y1:wingH*.74}
      ]);
      addXWall(wingX1,1,0,-D,wingH,eaveY,[
        {z:-wingD*.38,w:Math.min(1.0,wingD*.28),y0:wingH+.08,y1:Math.min(eaveY-.22,wingH+1.85),door:true},
        {z:-D*.78,w:Math.min(1.1,D*.22),y0:wingH+(eaveY-wingH)*.28,y1:wingH+(eaveY-wingH)*.74}
      ]);
      addXWall(wingX1,-1,-wingD,-D,0,wingH,[
        {z:-(wingD+D)/2,w:(D-wingD)*.48,y0:wingH*.26,y1:wingH*.74}
      ]);
      // 4. Clean 60% pitched roof slabs with front & rear eave overhangs (aleros), standing seams, gutters & Buhardilla
      const roofOverhang=.18,roofDepth=D+roofOverhang*2;
      for(let i=0;i<mainRingPts.length-1;i++){
        const a=mainRingPts[i],q=mainRingPts[i+1];if(Math.abs(a.x-q.x)<.08||Math.min(a.y,q.y)<eaveY-.1)continue;
        const sRoof=new THREE.Shape([new THREE.Vector2(a.x,a.y+.03),new THREE.Vector2(q.x,q.y+.03),new THREE.Vector2(q.x,q.y-.19),new THREE.Vector2(a.x,a.y-.19)]);
        const gRoof=new THREE.ExtrudeGeometry(sRoof,{depth:roofDepth,bevelEnabled:false});gRoof.translate(0,0,-D-roofOverhang);
        mesh(gRoof,roof,'source-building-return',{proposed:true});
        // Standing-seam architectural ribs along roof slopes
        const sRib=new THREE.Shape([new THREE.Vector2(a.x,a.y+.055),new THREE.Vector2(q.x,q.y+.055),new THREE.Vector2(q.x,q.y+.025),new THREE.Vector2(a.x,a.y+.025)]);
        for(let rz=-.08;rz>=-D+.08;rz-=D/8){
          const gRib=new THREE.ExtrudeGeometry(sRib,{depth:.035,bevelEnabled:false});gRib.translate(0,0,rz);
          mesh(gRib,frame,'source-roof-seam',{proposed:true});
        }
      }
      // Projecting roof eave gutters (canaletas 6.08 m) & rainwater downspouts
      for(const gx of [wingX1+.04,W/2-.04]){
        box(.11,.09,roofDepth,gx,eaveY-.04,-D/2,frame,'source-roof-gutter',{proposed:true});
        box(.045,eaveY-.08,.045,gx+(gx<0?.06:-.06),(eaveY-.08)/2,-.04,frame,'source-downspout',{proposed:true});
      }
      // Buhardilla (attic) architectural surround & skylight dormer on the roof
      const dormerX0=wingX1+mainW*.35,dormerX1=wingX1+mainW*.65,dormerY0=eaveY+(H-eaveY)*.16,dormerY1=eaveY+(H-eaveY)*.62;
      box(dormerX1-dormerX0+.12,.09,.24,(dormerX0+dormerX1)/2,dormerY1+.04,-.06,trimMat,'source-dormer-body',{proposed:true});
      box(dormerX1-dormerX0+.20,.06,.30,(dormerX0+dormerX1)/2,dormerY1+.10,-.04,roof,'source-dormer-roof',{proposed:true});
      // Ridge cap beam & sleek architectural flue chimney
      box(mainW*.22,.08,roofDepth,wingX1+mainW*.50,H+.02,-D/2,frame,'source-ridge-cap',{proposed:true});
      box(Math.min(.52,mainW*.07),.48,Math.min(.52,D*.09),wingX1+mainW*.62,H+.12,-D*.45,trimMat,'source-roof-chimney',{proposed:true});
      // 5. Structural slab bands (0.00 plinth, 3.10 m first floor, 6.08 m attic floor) & section pilasters
      box(W,.12,D+.06,0,.06,-D/2,floor,'source-foundation-plinth',{proposed:true});
      for(const bandY of [floor1Y,eaveY])if(bandY>.4&&bandY<H-.3){
        box(mainW+.04,.09,.09,wingX1+mainW/2,bandY,.02,trimMat,'source-storey-band',{proposed:true});
        box(mainW+.04,.09,.09,wingX1+mainW/2,bandY,-D-.02,trimMat,'source-storey-band',{proposed:true});
        box(.10,.09,D+.06,W/2-.03,bandY,-D/2,trimMat,'source-storey-band',{proposed:true});
      }
      // Vertical structural pilasters matching the section walls/columns in CORTE AA
      for(const px of [wingX1+.04,wingX1+mainW*.33,wingX1+mainW*.66,W/2-.04]){
        box(.08,eaveY,.05,px,eaveY/2,.015,trimMat,'source-structural-pilaster',{proposed:true});
      }
      // 6. Walkable roof terrace on the lower wing (3.49 m slab, left masonry parapet acroterio & glass railing)
      box(wingW,.16,wingD,(-W/2+wingX1)/2,wingH-.06,-wingD/2,trimMat,'source-building-floor',{proposed:true});
      // Left outer solid masonry parapet wall (3.49 m in CORTE AA)
      box(.16,.38,wingD,-W/2+.08,wingH+.19,-wingD/2,wall,'source-wing-parapet',{proposed:true});
      box(.20,.05,wingD+.04,-W/2+.10,wingH+.40,-wingD/2,trimMat,'source-wing-coping',{proposed:true});
      const railH=.88,railY=wingH+railH/2;
      box(wingW,.045,.045,(-W/2+wingX1)/2,wingH+railH,-.05,frame,'source-terrace-rail',{proposed:true});
      box(wingW,.045,.045,(-W/2+wingX1)/2,wingH+railH,-wingD+.05,frame,'source-terrace-rail',{proposed:true});
      box(.045,.045,wingD-.10,-W/2+.06,wingH+railH,-wingD/2,frame,'source-terrace-rail',{proposed:true});
      box(wingW-.12,railH-.12,.018,(-W/2+wingX1)/2,railY,-.05,glass,'source-terrace-glass',{proposed:true});
      box(wingW-.12,railH-.12,.018,(-W/2+wingX1)/2,railY,-wingD+.05,glass,'source-terrace-glass',{proposed:true});
      box(.018,railH-.12,wingD-.16,-W/2+.06,railY,-wingD/2,glass,'source-terrace-glass',{proposed:true});
      for(const px of [-W/2+.06,(-W/2+wingX1)/2,wingX1-.06])for(const pz of [-.05,-wingD+.05])box(.05,railH,.05,px,railY,pz,frame,'source-terrace-post',{proposed:true});
      // 7. Rear L-corner courtyard terrace, low garden wall (SN=ST 0.37) and timber pergola
      const courtD=D-wingD,courtZ=-(wingD+D)/2;
      box(wingW,.12,courtD,(-W/2+wingX1)/2,.06,courtZ,floor,'source-rear-terrace',{proposed:true});
      for(let z=-wingD-.14;z>-D+.12;z-=.18)box(wingW-.16,.03,.11,(-W/2+wingX1)/2,.135,z,timber,'source-rear-deck',{proposed:true});
      box(.14,.75,courtD,-W/2+.07,.375,courtZ,wall,'source-courtyard-wall',{proposed:true});
      box(wingW,.75,.14,(-W/2+wingX1)/2,.375,-D+.07,wall,'source-courtyard-wall',{proposed:true});
      const pergY=wingH*.86;
      box(.08,pergY,.08,-W/2+.22,pergY/2,-D+.22,frame,'source-rear-pergola',{proposed:true});
      box(wingW-.24,.10,.08,(-W/2+wingX1)/2,pergY,-D+.22,timber,'source-rear-pergola',{proposed:true});
      for(let x=-W/2+.28;x<=wingX1-.15;x+=.48)box(.06,.11,courtD-.16,x,pergY+.05,courtZ,timber,'source-rear-pergola',{proposed:true});
      // 8. Interior floor slabs & visible 3D front doors from CORTE AA (ground floor & first floor)
      box(W,.12,wingD,0,.06,-wingD/2,floor,'source-building-floor',{proposed:true});
      box(mainW,.12,D-wingD,wingX1+mainW/2,.06,courtZ,floor,'source-building-floor',{proposed:true});
      box(mainW-.12,.14,D-.24,wingX1+mainW/2,floor1Y,-D/2,floor,'source-building-floor',{proposed:true});
      box(mainW-.12,.14,D-.24,wingX1+mainW/2,eaveY,-D/2,floor,'source-building-floor',{proposed:true});
      addFrontDoor(wingX1+mainW*.223,.10,.76,1.72,0,1);
      addFrontDoor(wingX1+mainW*.489,floor1Y+.04,.72,1.68,0,1);
    }else{
      // Non-stepped frontal elevation: perforated rear wall, perforated side walls, floor slabs and roof
      const backShape=outlines.map(ring=>new THREE.Shape(ring.map(point))),rearHoles=[];
      const midY=H*.48;
      for(const q of [
        {x0:-W*.34,x1:-W*.12,y0:H*.14,y1:H*.38},
        {x0:W*.12,x1:W*.36,y0:H*.08,y1:H*.40},
        {x0:-W*.34,x1:-W*.12,y0:H*.56,y1:H*.80},
        {x0:W*.12,x1:W*.34,y0:H*.56,y1:H*.80}
      ])if(q.x1-q.x0>.35&&q.y1-q.y0>.35){
        backShape[0].holes.push(new THREE.Path([new THREE.Vector2(q.x0,q.y0),new THREE.Vector2(q.x0,q.y1),new THREE.Vector2(q.x1,q.y1),new THREE.Vector2(q.x1,q.y0)]));
        rearHoles.push(q);
      }
      const back=new THREE.ExtrudeGeometry(backShape,{depth:.18,bevelEnabled:false});back.translate(0,0,-D);mesh(back,wall,'source-building-back',{proposed:true});
      for(const q of rearHoles)addZWindow(q.x0,q.y0,q.x1,q.y1,-D,-1,true);
      for(const outline of outlines)for(let i=0;i<outline.length;i++){
        const a=point(outline[i]),q=point(outline[(i+1)%outline.length]);
        const isVerticalSide=Math.abs(a.x-q.x)<.12&&Math.abs(a.y-q.y)>H*.35&&Math.abs(Math.abs(a.x)-W/2)<W*.12;
        if(isVerticalSide){
          const xConst=a.x>0?W/2:-W/2,inward=a.x>0?-1:1,yLo=Math.min(a.y,q.y),yHi=Math.max(a.y,q.y);
          addXWall(xConst,inward,0,-D,yLo,yHi,[
            {z:-D*.30,w:D*.22,y0:yLo+(yHi-yLo)*.16,y1:yLo+(yHi-yLo)*.42},
            {z:-D*.70,w:D*.22,y0:yLo+(yHi-yLo)*.16,y1:yLo+(yHi-yLo)*.42},
            {z:-D*.50,w:D*.26,y0:yLo+(yHi-yLo)*.58,y1:yLo+(yHi-yLo)*.82}
          ]);
        }else{
          const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([a.x,a.y,0,q.x,q.y,0,q.x,q.y,-D,a.x,a.y,0,q.x,q.y,-D,a.x,a.y,-D],3));g.computeVertexNormals();
          const isRoof=Math.min(a.y,q.y)>.25&&(Math.abs(a.y-q.y)<.2||Math.abs(a.x-q.x)>Math.abs(a.y-q.y)*.45);
          mesh(g,isRoof?roof:wall,'source-building-return',{proposed:true});
        }
      }
      box(W-.12,.14,D-.24,0,midY,-D/2,floor,'source-building-floor',{proposed:true});
    }
    masses=[{width:W,depth:D,sourceOutline:outline}];
  }
  if(analysis)group.rotation.y=-Math.PI/2;
  group.userData.sourceVolume={algorithm:analysis?'perspective-facade-masses-v1':'elevation-envelope-v1',sourceHash:project.sourceHash,sourceFrame:[r.width,r.height],masses,openings:openingCount,vanishingPoints:analysis?.frame??null,coordinateSpace:'model-local-meters',rotationY:group.rotation.y,photoProjection:false,proposed:true};
  return {parts,assumptions:['Edificio con muros, cubierta, ventanas y caras posteriores de geometría independiente.','Volúmenes y aberturas orientados por la lámina; profundidad, escala y zonas ocultas son una propuesta editable.','Los materiales no contienen la fotografía de la fachada. Revisa las medidas antes de usar el modelo.']};
}

// Split at opening boundaries before triangulation. A single triangulation of
// many scanned holes can silently bridge an opening; individual cells cannot.
function perforatedFacade(outline,holes){
  const xs=[...new Set([...outline.map(p=>p.x),...holes.flatMap(h=>[h.a.x,h.z.x])])].sort((a,b)=>a-b),ys=[...new Set([...outline.map(p=>p.y),...holes.flatMap(h=>[h.a.y,h.z.y])])].sort((a,b)=>a-b),positions=[];
  const clip=(ring,axis,bound,sign)=>{const out=[];for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],ain=sign*(a[axis]-bound)>=-1e-9,bin=sign*(b[axis]-bound)>=-1e-9;if(ain)out.push(a);if(ain!==bin){const t=(bound-a[axis])/(b[axis]-a[axis]);out.push(new THREE.Vector2(a.x+t*(b.x-a.x),a.y+t*(b.y-a.y)));}}return out;};
  for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){
    const x=(xs[i-1]+xs[i])/2,y=(ys[j-1]+ys[j])/2;if(holes.some(h=>x>h.a.x&&x<h.z.x&&y>h.a.y&&y<h.z.y))continue;
    let ring=outline;for(const [axis,bound,sign]of[['x',xs[i-1],1],['x',xs[i],-1],['y',ys[j-1],1],['y',ys[j],-1]])ring=clip(ring,axis,bound,sign);if(ring.length<3)continue;
    const geometry=new THREE.ExtrudeGeometry(new THREE.Shape(ring),{depth:.18,bevelEnabled:false});positions.push(...geometry.attributes.position.array);geometry.dispose();
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}
