import * as THREE from './vendor/three.module.js';
import {isSimplePolygon} from './technical-geometry.js';

// Average adjacent side normals within a crease angle; keep end caps and sharp
// engineering corners crisp. Raster stair steps must not become machined ribs.
export function smoothExtrusionSides(geometry){
  const positions=geometry.attributes.position,normals=geometry.attributes.normal,buckets=new Map(),key=i=>[positions.getX(i),positions.getY(i),positions.getZ(i)].map(n=>Math.round(n*1e7)).join(',');
  for(let i=0;i<positions.count;i++){if(Math.abs(normals.getZ(i))>.5)continue;const k=key(i),list=buckets.get(k)??[];list.push(i);buckets.set(k,list);}
  const original=normals.array.slice(),crease=Math.cos(Math.PI/5);
  for(const indices of buckets.values())for(const i of indices){const n=new THREE.Vector3().fromArray(original,i*3),sum=new THREE.Vector3();for(const j of indices){const candidate=new THREE.Vector3().fromArray(original,j*3);if(n.dot(candidate)>=crease)sum.add(candidate);}sum.normalize();normals.setXYZ(i,sum.x,sum.y,sum.z);}
  normals.needsUpdate=true;return geometry;
}
/** Derive shading from a locally smoothed strip centre line. Tiny scan-induced
 * width changes must not look like fabricated ribs. Mesh positions stay intact. */
export function rasterSurfaceNormals(geometry,d,mpp,horizontal=false){
  if(!d.mask)return geometry;
  const b=d.bounds,along=horizontal?'x':'y',start=Math.floor(b[along+'0']),end=Math.ceil(b[along+'1']),centres=[];
  for(let v=start;v<end;v++){const span=rowSpan(d,v,horizontal);if(!span)return geometry;centres.push((span[0]+span[1])/2);}
  const radius=Math.max(4,Math.round(centres.length*.023)),smooth=centres.map((_,i)=>{let sum=0,weight=0;for(let j=-radius;j<=radius;j++){const k=Math.max(0,Math.min(centres.length-1,i+j)),w=radius+1-Math.abs(j);sum+=centres[k]*w;weight+=w;}return sum/weight;}),positions=geometry.attributes.position,normals=geometry.attributes.normal;
  for(let i=0;i<positions.count;i++){if(Math.abs(normals.getZ(i))>.5)continue;const v=horizontal?positions.getX(i)/mpp+(b.x0+b.x1)/2:b.y1-positions.getY(i)/mpp,index=Math.max(0,Math.min(smooth.length-1,Math.round(v-start))),lo=Math.max(0,index-3),hi=Math.min(smooth.length-1,index+3),slope=(smooth[hi]-smooth[lo])/Math.max(1,hi-lo),normal=new THREE.Vector3(horizontal?slope:1,horizontal?1:slope,0).normalize(),original=new THREE.Vector3(normals.getX(i),normals.getY(i),0);if(Math.abs(normal.dot(original))<.5)continue;if(normal.dot(original)<0)normal.negate();normals.setXYZ(i,normal.x,normal.y,0);}
  normals.needsUpdate=true;return geometry;
}
function rowSpan(d,v,horizontal){const across=horizontal?'y':'x';let lo=Infinity,hi=-1;for(let u=Math.floor(d.bounds[across+'0']);u<d.bounds[across+'1'];u++)if(d.mask[horizontal?u*d.width+v:v*d.width+u]){lo=Math.min(lo,u);hi=u+1;}return hi>lo?[lo,hi]:null;}
function clipped(ring,y0,y1,axis=1){
  let out=ring;for(const [level,above]of[[y0,true],[y1,false]]){const input=out;out=[];for(let i=0;i<input.length;i++){const a=input[i],b=input[(i+1)%input.length],ina=above?a[axis]>=level:a[axis]<=level,inb=above?b[axis]>=level:b[axis]<=level;if(ina)out.push(a);if(ina!==inb){const t=(level-a[axis])/(b[axis]-a[axis]);out.push(a.map((n,i)=>i===axis?level:n+(b[i]-n)*t));}}}
  return out.filter((p,i)=>Math.hypot(p[0]-out[(i+out.length-1)%out.length][0],p[1]-out[(i+out.length-1)%out.length][1])>1e-6);
}

/** Drill only circles that correspond to a straight, closed tab in the section.
 * Curved or ambiguous intersections keep the original unperforated profile. */
export function addEngineeringExtrusion(project,group,mpp,body){
  const d=project.drawing,e=d.extrusion,b=d.bounds,horizontal=e.alignedAxis==='x',along=horizontal?'x':'y',depth=e.widthPixels*mpp,point=([x,y])=>[(x-(b.x0+b.x1)/2)*mpp,(b.y1-y)*mpp],tabs=[];
  if(!d.profiles[0].holes.length)for(const hole of e.holes??[]){
    const y=Math.round(hole[along]),span=rowSpan(d,y,horizontal),r=hole.radiusPixels;if(!span||span[1]-span[0]>Math.max(20,b[horizontal?'height':'width']*.22)||hole.zPixels-r<=0||hole.zPixels+r>=e.widthPixels)continue;
    const matches=yy=>{const a=rowSpan(d,yy,horizontal);return a&&Math.abs(a[0]-span[0])<=1&&Math.abs(a[1]-span[1])<=1;};let y0=y,y1=y+1;
    while(y0>b[along+'0']&&matches(y0-1))y0--;while(y1<b[along+'1']&&matches(y1))y1++;
    if(y-y0<r+2||y1-y<r+2)continue;
    y0=y-Math.ceil(r)-3;y1=y+Math.ceil(r)+3;
    let tab=tabs.find(t=>t.y1>=y0&&t.y0<=y1&&Math.abs(t.lo-span[0])<=1&&Math.abs(t.hi-span[1])<=1);if(!tab){tab={y0,y1,lo:span[0],hi:span[1],holes:[]};tabs.push(tab);}else{tab.y0=Math.min(tab.y0,y0);tab.y1=Math.max(tab.y1,y1);}tab.holes.push(hole);
  }
  tabs.sort((a,b)=>a.y0-b.y0);
  const intervals=[];let from=b[along+'0'];for(const t of tabs){if(t.y0>from)intervals.push([from,t.y0]);from=t.y1;}if(from<b[along+'1'])intervals.push([from,b[along+'1']]);
  let rings=intervals.map(([lo,hi])=>clipped(d.profiles[0].outer,lo,hi,horizontal?0:1));
  if(rings.some(r=>r.length<3||!isSimplePolygon(r))){tabs.length=0;rings=[d.profiles[0].outer];}
  const add=(shape,length,rasterBody=false)=>{let geometry=smoothExtrusionSides(new THREE.ExtrudeGeometry(shape,{depth:length,bevelEnabled:false,curveSegments:48}));if(rasterBody&&project.params.smoothCurves!==false&&d.profiles[0]?.contourTreatment==='smoothed-image')geometry=rasterSurfaceNormals(geometry,d,mpp,horizontal);const mesh=new THREE.Mesh(geometry,body);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
  for(const ring of rings){const shape=new THREE.Shape(ring.map(p=>new THREE.Vector2(...point(p))));if(!tabs.length)for(const h of d.profiles[0].holes)shape.holes.push(new THREE.Path(h.map(p=>new THREE.Vector2(...point(p)))));add(shape,depth,true).position.z=-depth;}
  for(const t of tabs){
    const tabPoint=(v,z)=>horizontal?[(v-(b.x0+b.x1)/2)*mpp,z*mpp]:[z*mpp,(b.y1-v)*mpp];
    const shape=new THREE.Shape([[t.y0,0],[t.y0,e.widthPixels],[t.y1,e.widthPixels],[t.y1,0]].map(([v,z])=>new THREE.Vector2(...tabPoint(v,z))));
    for(const h of t.holes){const path=new THREE.Path(),[x,y]=tabPoint(h[along],h.zPixels);path.absarc(x,y,h.radiusPixels*mpp,0,Math.PI*2,true);shape.holes.push(path);}
    const mesh=add(shape,(t.hi-t.lo)*mpp);if(horizontal){mesh.rotation.x=-Math.PI/2;mesh.position.y=(b.y1-t.hi)*mpp;}else{mesh.rotation.y=Math.PI/2;mesh.position.x=(t.lo-(b.x0+b.x1)/2)*mpp;}
  }
  group.userData.engineeringExtrusion={source:e.source,depthMeters:depth,proposed:true,holes:tabs.flatMap(t=>t.holes)};
  return {parts:1,assumptions:['Sección extruida; ancho proporcional a la vista complementaria. Revisa que ambas vistas usen la misma escala.',`${group.userData.engineeringExtrusion.holes.length} taladros propuestos desde círculos de la otra vista; verifica sus cotas y correspondencia.`]};
}
