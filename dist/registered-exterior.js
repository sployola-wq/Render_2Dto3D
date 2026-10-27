import * as THREE from './vendor/three.module.js';
import {exteriorFaces} from './exterior-finishes.js';
import {drawingMask,connectedRegions,traceContour} from './discipline-analysis.js';

const median=a=>{a.sort((x,y)=>x-y);return a[Math.floor(a.length/2)];};
function regionProfile(pixels,w){
  let x0=Infinity,y0=Infinity,x1=0,y1=0;for(const i of pixels){const x=i%w,y=Math.floor(i/w);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}const bw=x1-x0,bh=y1-y0,mask=new Uint8Array(bw*bh);
  for(const i of pixels)mask[(Math.floor(i/w)-y0)*bw+i%w-x0]=1;
  const convert=ring=>ring.map(([x,y])=>[x+x0,y+y0]),outer=convert(traceContour(mask,bw,bh,1.2)),holes=[];
  for(const r of connectedRegions(mask,bw,bh,0))if(!r.edge&&r.count>=4){const m=new Uint8Array(mask.length);for(const i of r.pixels)m[i]=1;const p=traceContour(m,bw,bh,1.0);if(p.length>=3)holes.push(convert(p));}
  return {outer,holes,bounds:[x0,y0,x1,y1]};
}
export function sourceAxes(profiles){
  const positive=[],negative=[];
  for(const p of profiles)for(let i=0;i<p.outer.length;i++){const a=p.outer[i],b=p.outer[(i+1)%p.outer.length],dx=b[0]-a[0],dy=b[1]-a[1],s=dy/dx;if(Math.abs(dx)<20||Math.abs(s)<.18||Math.abs(s)>1.1)continue;const target=s>0?positive:negative;for(let j=0;j<Math.min(2000,Math.max(1,Math.floor((dx*dx+dy*dy)/500)));j++)target.push(Math.abs(s));}
  const axonometric=positive.length>8&&negative.length>8,mx=axonometric?median(positive):.577350269,mz=axonometric?median(negative):.577350269,se=Math.min(.85,Math.sqrt(mx*mz)),yaw=Math.atan(Math.sqrt(mx/mz)),ce=Math.sqrt(1-se*se),sy=Math.sin(yaw),cy=Math.cos(yaw);
  return {axonometric,mx,mz,se,ce,sy,cy,kx:sy*ce/se,kz:cy*ce/se,direction:[ce*sy,se,ce*cy]};
}
function leastSquares(rows,n){
  const rhs=new Float64Array(n),diag=new Float64Array(n).fill(1e-5);
  for(const {terms,value,weight}of rows)for(const [i,a]of terms){rhs[i]+=weight*a*value;diag[i]+=weight*a*a;}
  const multiply=x=>{const out=Float64Array.from(x,v=>v*1e-5);for(const r of rows){let v=0;for(const[i,a]of r.terms)v+=a*x[i];for(const[i,a]of r.terms)out[i]+=r.weight*a*v;}return out;};
  const x=new Float64Array(n),r=new Float64Array(rhs),z=Float64Array.from(r,(v,i)=>v/diag[i]),p=new Float64Array(z);let rz=r.reduce((s,v,i)=>s+v*z[i],0);
  for(let iteration=0;iteration<Math.min(1000,n*4+40)&&rz>1e-17;iteration++){const ap=multiply(p),den=p.reduce((s,v,i)=>s+v*ap[i],0);if(Math.abs(den)<1e-25)break;const alpha=rz/den;for(let i=0;i<n;i++){x[i]+=alpha*p[i];r[i]-=alpha*ap[i];z[i]=r[i]/diag[i];}const next=r.reduce((s,v,i)=>s+v*z[i],0),beta=next/rz;for(let i=0;i<n;i++)p[i]=z[i]+beta*p[i];rz=next;}
  return x;
}
/** Lift every source face along its viewing ray. The source projection is an
 * invariant: no window, stair, roof edge or finish can move in the reference view. */
export function reconstructExterior(image,{roi=null,sourceHash=null}={}){
  const w=image.width,h=image.height,S=Math.max(w,h),raw=exteriorFaces(image).filter(f=>!roi||f.bbox[0]>=roi[0]&&f.bbox[2]<=roi[2]&&f.bbox[1]>=roi[1]&&f.bbox[3]<=roi[3]);
  if(!raw.length)throw new Error('No se encontraron caras cerradas del edificio. Delimita la fachada o revisa el contraste.');
  const labels=new Int32Array(w*h).fill(-1),ink=drawingMask(image,{threshold:180});raw.forEach((f,id)=>{for(const i of f.pixels)labels[i]=id;});
  // Assign drafting strokes to their neighbouring face, retaining the actual
  // source outline instead of inventing regular window bays or a house template.
  let frontier=[];for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(labels[i]>=0&&[i-1,i+1,i-w,i+w].some(j=>labels[j]<0&&ink[j]))frontier.push(i);}
  for(let distance=0;distance<5&&frontier.length;distance++){const next=[];for(const i of frontier){const x=i%w;for(const j of[i-w,i+w,...(x?[i-1]:[]),...(x<w-1?[i+1]:[])])if(j>=0&&j<labels.length&&labels[j]<0&&ink[j]){labels[j]=labels[i];next.push(j);}}frontier=next;}
  const pixels=raw.map(()=>[]);for(let i=0;i<labels.length;i++)if(labels[i]>=0)pixels[labels[i]].push(i);
  const faces=raw.map((f,id)=>({...regionProfile(pixels[id],w),id,role:f.role,slope:f.slope,area:pixels[id].length})).filter(f=>f.outer.length>=3),axes=sourceAxes(faces),byId=new Map(faces.map(f=>[f.id,f]));
  if(!axes.axonometric){
    axes.frontElevation=true;axes.direction=[0,0,1];const point=([x,y])=>[(x-w/2)/S,(h/2-y)/S,0];
    for(const f of faces){f.type='front';f.world=f.outer.map(point);f.holesWorld=f.holes.map(r=>r.map(point));}
    return {sourceHash,width:w,height:h,scale:S,axes,faces,algorithm:'source-elevation-extrusion-v1'};
  }
  const screen=([x,y])=>[(x-w/2)/S,(y-h/2)/S],q=point=>{const[x,y]=screen(point);return [axes.cy*x+axes.sy/axes.se*y,-axes.sy*x+axes.cy/axes.se*y];};let count=0;
  for(const f of faces){let vertical=0,pos=0,neg=0;for(let i=0;i<f.outer.length;i++){const a=f.outer[i],b=f.outer[(i+1)%f.outer.length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(Math.abs(dx)<Math.abs(dy)*.12)vertical+=len;else if(Math.abs(dy/dx-axes.mx)<.12)pos+=len;else if(Math.abs(dy/dx+axes.mz)<.12)neg+=len;}
    f.type=f.role==='ground'?'ground':f.role==='roof'?'free':vertical<Math.min(pos,neg)*.5&&pos>5&&neg>5?'horizontal':Math.abs(f.slope-axes.mx)<Math.abs(f.slope+axes.mz)?'z':'x';
    f.variable=count;count+=f.type==='free'?3:1;
  }
  const expression=(f,point)=>{const [x,y]=screen(point),[qx,qz]=q(point);return f.type==='free'?{terms:[[f.variable,x],[f.variable+1,y],[f.variable+2,1]],known:0}:f.type==='x'?{terms:[[f.variable,1/axes.kx]],known:-qx/axes.kx}:f.type==='z'?{terms:[[f.variable,1/axes.kz]],known:-qz/axes.kz}:{terms:[[f.variable,1]],known:0};};
  const rows=[];for(let y=0;y<h-1;y++)for(let x=0;x<w-1;x++){const i=y*w+x,a=byId.get(labels[i]);if(!a)continue;for(const j of[i+1,i+w]){const b=byId.get(labels[j]);if(!b||a.id===b.id)continue;const point=j===i+1?[x+1,y+.5]:[x+.5,y+1];if((x+y)%3)continue;const ea=expression(a,point),eb=expression(b,point);rows.push({terms:[...ea.terms,...eb.terms.map(([i,v])=>[i,-v])],value:eb.known-ea.known,weight:1});}}
  for(const f of faces){if(f.type==='ground')rows.push({terms:[[f.variable,1]],value:0,weight:200});if(f.type==='free')for(let k=0;k<2;k++)rows.push({terms:[[f.variable+k,1]],value:0,weight:.0002});}
  const inside=(p,ring)=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
  for(const f of faces){
    if(!['x','z'].includes(f.type))continue;
    const center=[(f.bounds[0]+f.bounds[2])/2,(f.bounds[1]+f.bounds[3])/2],host=faces.filter(h=>h!==f&&h.type===f.type&&h.area>f.area*2&&inside(center,h.outer)).sort((a,b)=>b.area-a.area)[0];
    if(host)rows.push({terms:[[f.variable,1],[host.variable,-1]],value:0,weight:100000});
  }
  for(const f of faces)if(f.type==='free'){
    // Eaves parallel to a source ground axis are horizontal in 3D. This
    // prevents a single roof plane from twisting relative to its own facade.
    for(let i=0;i<f.outer.length;i++){const a=f.outer[i],b=f.outer[(i+1)%f.outer.length],dx=b[0]-a[0],dy=b[1]-a[1];if(Math.hypot(dx,dy)<40||Math.abs(dx)<1)continue;const slope=dy/dx;if(Math.min(Math.abs(slope-axes.mx),Math.abs(slope+axes.mz))>.045)continue;rows.push({terms:[[f.variable,dx/S],[f.variable+1,dy/S]],value:0,weight:100000});}
  }
  const solution=leastSquares(rows,count),height=(face,point)=>{const e=expression(face,point);return e.known+e.terms.reduce((s,[i,a])=>s+a*solution[i],0);};
  // Form a conforming surface: neighbouring faces share the same boundary
  // vertices and heights. This closes scan seams without changing the drawing.
  const vertices=[],grid=new Map(),bucket=(x,y)=>Math.floor(x/4)+','+Math.floor(y/4);
  const vertex=p=>{let best=null,distance=1.05;const gx=Math.floor(p[0]/4),gy=Math.floor(p[1]/4);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const v of grid.get((gx+dx)+','+(gy+dy))??[]){const d=Math.hypot(v.point[0]-p[0],v.point[1]-p[1]);if(d<distance){best=v;distance=d;}}if(best)return best;const v={id:vertices.length,point:[...p],faces:new Set()};vertices.push(v);const key=bucket(...p);if(!grid.has(key))grid.set(key,[]);grid.get(key).push(v);return v;};
  for(const f of faces){f.rings=[f.outer,...f.holes].map(r=>{const ring=r.map(vertex).filter((v,i,a)=>!i||v!==a[i-1]);if(ring.at(-1)===ring[0])ring.pop();return ring;});for(const ring of f.rings)for(const v of ring)v.faces.add(f.id);}
  for(const f of faces)f.rings=f.rings.map(ring=>{
    const result=[];for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b.point[0]-a.point[0],dy=b.point[1]-a.point[1],length=dx*dx+dy*dy,extra=[];result.push(a);if(length<4)continue;
      const x0=Math.floor((Math.min(a.point[0],b.point[0])-1)/4),x1=Math.floor((Math.max(a.point[0],b.point[0])+1)/4),y0=Math.floor((Math.min(a.point[1],b.point[1])-1)/4),y1=Math.floor((Math.max(a.point[1],b.point[1])+1)/4);
      for(let gx=x0;gx<=x1;gx++)for(let gy=y0;gy<=y1;gy++)for(const v of grid.get(gx+','+gy)??[]){if(v===a||v===b)continue;const t=((v.point[0]-a.point[0])*dx+(v.point[1]-a.point[1])*dy)/length;if(t<=.001||t>=.999)continue;if(Math.hypot(v.point[0]-a.point[0]-t*dx,v.point[1]-a.point[1]-t*dy)<.8)extra.push({v,t});}
      extra.sort((a,b)=>a.t-b.t);for(const e of extra)if(result.at(-1)!==e.v){result.push(e.v);e.v.faces.add(f.id);}
    }return result;
  });
  for(const v of vertices){let sum=0,total=0;for(const id of v.faces){const f=byId.get(id),weight=f.type==='ground'?100:Math.max(1,Math.sqrt(f.area)/20);sum+=height(f,v.point)*weight;total+=weight;}const y=sum/total,[x,z]=q(v.point);v.world=[x+axes.kx*y,y,z+axes.kz*y];}
  for(const f of faces){f.outer=f.rings[0].map(v=>v.point);f.holes=f.rings.slice(1).filter(r=>r.length>=3).map(r=>r.map(v=>v.point));f.world=f.rings[0].map(v=>v.world);f.holesWorld=f.rings.slice(1).filter(r=>r.length>=3).map(r=>r.map(v=>v.world));delete f.rings;}

  return {sourceHash,width:w,height:h,scale:S,axes,faces,solution,algorithm:'source-face-ray-lifting-v2',maxBoundaryAdjustmentPixels:1.05};
}
export function sourceProject(point,registration){
  const a=registration.axes,[x,y,z]=point,scale=registration.scale;if(a.frontElevation)return[x*scale+registration.width/2,-y*scale+registration.height/2];
  return [(a.cy*x-a.sy*z)*scale+registration.width/2,(a.se*a.sy*x-a.ce*y+a.se*a.cy*z)*scale+registration.height/2];
}
export function addRegisteredExterior(project,group,mpp,{surfaceCanvas,own,textures}){
  const r=project.sourceReconstruction;if(!r||r.width!==project.drawing.width||r.height!==project.drawing.height||r.sourceHash&&project.sourceHash&&r.sourceHash!==project.sourceHash)throw new Error('El modelo y el Paso 2 no comparten el mismo marco de origen.');
  const scale=r.scale*mpp,texture=surfaceCanvas?new THREE.CanvasTexture(surfaceCanvas):null;if(texture){texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;textures.add(texture);}
  const visible=own(new THREE.MeshBasicMaterial({map:texture,color:0xffffff,side:THREE.DoubleSide,toneMapped:false}));let parts=0;
  for(const f of r.faces){const rings=[f.outer,...f.holes],points=rings.flat(),world=[f.world,...f.holesWorld].flat(),triangles=THREE.ShapeUtils.triangulateShape(f.outer.map(p=>new THREE.Vector2(...p)),f.holes.map(r=>r.map(p=>new THREE.Vector2(...p)))),positions=[],uv=[],source=[];
    for(const tri of triangles)for(const i of tri){positions.push(...world[i].map(v=>v*scale));uv.push(points[i][0]/r.width,1-points[i][1]/r.height);source.push(...points[i]);}
    if(!positions.length)continue;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('sourcePixel',new THREE.Float32BufferAttribute(source,2));g.computeVertexNormals();const mesh=new THREE.Mesh(g,visible);mesh.name='source-face-'+f.id;mesh.userData.sourceFace={id:f.id,role:f.role,type:f.type,bounds:f.bounds};mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);parts++;
  }
  if(r.axes.frontElevation){
    const material=own(new THREE.MeshStandardMaterial({color:'#cfc9bc',roughness:.88,side:THREE.DoubleSide}));
    for(const profile of project.drawing.profiles??[]){const shape=new THREE.Shape(profile.outer.map(([x,y])=>new THREE.Vector2((x-r.width/2)*mpp,(r.height/2-y)*mpp))),g=new THREE.ExtrudeGeometry(shape,{depth:project.params.depthMm/1000,bevelEnabled:false});g.translate(0,0,-project.params.depthMm/1000-.001);const mesh=new THREE.Mesh(g,material);mesh.name='inferred-elevation-depth';mesh.userData.proposed=true;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);parts++;}
  }
  group.userData.sourceRegistration={algorithm:r.algorithm,width:r.width,height:r.height,sourceHash:project.sourceHash,faces:r.faces.map(f=>({id:f.id,bounds:f.bounds,role:f.role,type:f.type})),axes:r.axes,scale:r.scale,metersPerPixel:mpp};
  group.userData.sourceProjection={center:[0,0,0],direction:r.axes.direction,width:r.width*mpp,height:r.height*mpp};
  return {parts,assumptions:['Geometría y acabados registrados al mismo Paso 2: se conservan contornos, aberturas y su posición.','Profundidad aproximada a partir de caras visibles; no se agregan ventanas, accesos ni terrazas de otra propuesta.','Las caras ocultas y el interior no pueden recuperarse de una sola imagen.']};
}

export function sourceFrustum(projection,aspect,padding=1.07){const height=Math.max(projection.height,projection.width/aspect)*padding;return {width:height*aspect,height};}
