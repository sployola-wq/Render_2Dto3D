import * as THREE from './vendor/three.module.js';
import {exteriorFaces} from './exterior-finishes.js';

function cluster(faces,w,h){
  const groups=[];
  for(const f of faces){const b=f.bbox,g=groups.find(g=>Math.min(g[2],b[2])-Math.max(g[0],b[0])>-w*.008&&Math.max(0,b[1]-g[3],g[1]-b[3])<h*.02);if(g){g[0]=Math.min(g[0],b[0]);g[1]=Math.min(g[1],b[1]);g[2]=Math.max(g[2],b[2]);g[3]=Math.max(g[3],b[3]);}else groups.push([...b]);}
  return groups;
}
/** Infer a roof family from multiple sloping source planes. Dimensions and the
 * unobserved sides remain a proposal; no reference building is substituted. */
export function exteriorRoofEvidence(image){
  const w=image.width,h=image.height,faces=exteriorFaces(image),roofs=faces.filter(f=>f.role==='roof'),triangles=roofs.filter(f=>f.pixels.length/((f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]))<.42),pitched=triangles.length>=2&&roofs.some(f=>f.slope>.15)&&roofs.some(f=>f.slope<-.15)&&roofs.reduce((n,f)=>n+f.pixels.length,0)>w*h*.06;
  if(!pitched)return {kind:'flat',source:'no-confirmed-sloping-roof-planes',chimneys:[],dormers:[]};
  const bounds=[Math.min(...roofs.map(f=>f.bbox[0])),Math.min(...roofs.map(f=>f.bbox[1])),Math.max(...roofs.map(f=>f.bbox[2])),Math.max(...roofs.map(f=>f.bbox[3]))],bottom=bounds[3],middle=(bounds[1]+bottom)/2;
  const chimneyFaces=faces.filter(f=>f.role==='wall'&&f.bbox[1]<bottom*.6&&f.bbox[2]-f.bbox[0]<w*.06&&f.bbox[3]-f.bbox[1]<h*.12&&f.pixels.length>w*h*.0001),dormerFaces=faces.filter(f=>['wall','accent'].includes(f.role)&&f.bbox[1]<middle&&f.bbox[3]>middle&&f.bbox[2]-f.bbox[0]>w*.04&&f.bbox[2]-f.bbox[0]<w*.15&&f.pixels.length>w*h*.003);
  const summarize=groups=>groups.slice(0,4).map(b=>({bounds:b,u:Math.max(.15,Math.min(.85,((b[0]+b[2])/2-bounds[0])/(bounds[2]-bounds[0])))}));
  return {kind:'hipped',source:'drawing-sloping-roof-planes',bounds,planes:roofs.length,chimneys:summarize(cluster(chimneyFaces,w,h)),dormers:summarize(cluster(dormerFaces,w,h))};
}

export function addPitchedExteriorRoof(group,plan,{roofMaterial,wallMaterial,metalMaterial,glassMaterial}){
  const level=plan.levels.at(-1),x0=level.x0-.26,x1=level.x1+.26,z0=level.zBack-.28,z1=level.zFront+.28,base=level.y1+.17,rise=plan.roof.rise,peak=base+rise,mid=(z0+z1)/2,hip=Math.min((x1-x0)*.32,(z1-z0)*.5);let parts=0;
  const mesh=(geometry,material,name,position=[0,0,0],proposed=true)=>{const m=new THREE.Mesh(geometry,material);m.name=name;m.position.set(...position);m.castShadow=m.receiveShadow=true;m.userData.architecture={kind:name,proposed,source:plan.roof.source};group.add(m);parts++;return m;};
  const box=(size,position,material,name,proposed=false)=>mesh(new THREE.BoxGeometry(...size),material,name,position,proposed);
  const shell=(points,indices,name)=>{const g=new THREE.BufferGeometry(),positions=[],uv=[];for(const i of indices){const p=points[i];positions.push(...p);uv.push(p[0]/2,p[2]/2);}g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return mesh(g,roofMaterial,name);};
  shell([[x0,base,z1],[x1,base,z1],[x1,base,z0],[x0,base,z0],[x0+hip,peak,mid],[x1-hip,peak,mid]],[0,1,5,0,5,4,3,4,5,3,5,2,0,4,3,1,2,5],'hipped-roof');
  for(const z of[z0,z1])box([x1-x0,.13,.12],[(x0+x1)/2,base-.04,z],metalMaterial,'roof-fascia');
  for(const x of[x0,x1])box([.12,.13,z1-z0],[x,base-.04,mid],metalMaterial,'roof-fascia');
  for(const c of plan.roof.chimneys??[]){
    const x=x0+(x1-x0)*c.u,z=mid-(z1-z0)*.13,y=base+rise*.45,height=rise*.55+.65,shape=new THREE.Shape([new THREE.Vector2(-.20,-.24),new THREE.Vector2(.20,-.24),new THREE.Vector2(.20,.24),new THREE.Vector2(-.20,.24)]),hole=new THREE.Path([new THREE.Vector2(-.13,-.17),new THREE.Vector2(-.13,.17),new THREE.Vector2(.13,.17),new THREE.Vector2(.13,-.17)]);shape.holes.push(hole);
    const g=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false}),m=mesh(g,wallMaterial,'source-chimney',[x,y,z]);m.rotation.x=-Math.PI/2;
    box([.32,.02,.40],[x,y+height-.25,z],metalMaterial,'chimney-recess');
  }
  for(const d of plan.roof.dormers??[]){
    const width=Math.min(1.7,(x1-x0)*.22),x=x0+(x1-x0)*d.u,y=base+rise*.18,z=z1-.35,height=.90,depth=1.05,outline=new THREE.Shape([new THREE.Vector2(-width/2,0),new THREE.Vector2(width/2,0),new THREE.Vector2(width/2,height),new THREE.Vector2(0,height+.32),new THREE.Vector2(-width/2,height)]);
    for(let i=0;i<3;i++){const cx=-width*.29+i*width*.29,hw=width*.105,path=new THREE.Path([new THREE.Vector2(cx-hw,.18),new THREE.Vector2(cx-hw,.70),new THREE.Vector2(cx+hw,.70),new THREE.Vector2(cx+hw,.18)]);outline.holes.push(path);box([hw*2,.52,.025],[x+cx,y+.44,z-.07],glassMaterial,'dormer-glazing');for(const sign of[-1,1])box([.025,.55,.05],[x+cx+sign*hw,y+.44,z+.015],metalMaterial,'dormer-frame');}
    const g=new THREE.ExtrudeGeometry(outline,{depth:.12,bevelEnabled:false});g.translate(0,0,-.12);mesh(g,wallMaterial,'source-dormer',[x,y,z]);
    for(const sign of[-1,1])box([.12,height,depth],[x+sign*(width/2-.05),y+height/2,z-depth/2],wallMaterial,'dormer-side');
    shell([[x-width/2-.10,y+height,z+.10],[x,y+height+.34,z+.10],[x+width/2+.10,y+height,z+.10],[x-width/2-.10,y+height,z-depth],[x,y+height+.34,z-depth],[x+width/2+.10,y+height,z-depth]],[0,1,4,0,4,3,1,2,5,1,5,4],'dormer-roof');
  }
  return parts;
}
