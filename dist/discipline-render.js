import {topPreviewCamera} from './render-cameras.js';
import {reflectionEnvironment} from './studio-materials.js';
import * as THREE from './vendor/three.module.js';
/** Procedural studio reflections, owned by this renderer, with no downloaded assets. */
export function studioEnvironment(renderer){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#a8b6c6');const materials=[],geometries=[];
  for(const [position,size,color]of [[[0,6,0],[10,1,8],'#ffffff'],[[-6,3,3],[1,7,9],'#fff7eb'],[[6,2,-2],[1,5,8],'#e4f0ff'],[[0,2,6],[8,5,1],'#d6e4f2'],[[0,-4,0],[12,1,12],'#d8d2c7']]){const geometry=new THREE.BoxGeometry(...size),material=new THREE.MeshBasicMaterial({color}),panel=new THREE.Mesh(geometry,material);panel.position.set(...position);scene.add(panel);materials.push(material);geometries.push(geometry);}
  const generator=new THREE.PMREMGenerator(renderer),target=generator.fromScene(scene,.035,.1,35);generator.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();return target;
}
/** World-space projection of the original analysis frame. Not a camera fit to the
 * object: preserving the complete frame keeps the comparison geometrically aligned. */
export function alignedProjection(project,result){
  const d=project.drawing,outline=result.group?.userData?.sourceVolume?.masses?.[0]?.sourceOutline;
  const b=outline?{x0:Math.min(...outline.map(p=>p[0])),y0:Math.min(...outline.map(p=>p[1])),x1:Math.max(...outline.map(p=>p[0])),y1:Math.max(...outline.map(p=>p[1]))}:d.bounds;
  const mpp=outline?(project.calibration?d.bounds.width*result.metersPerPixel:project.params.widthMm/1000)/Math.max(1,b.x1-b.x0):result.metersPerPixel;
  let x=(d.width/2-(b.x0+b.x1)/2)*mpp,y=(b.y1-d.height/2)*mpp;
  if(d.compoundHousing){
    x=(d.width/2-d.compoundHousing.barrelCx)*mpp;
    y=result.group.position.y+((b.y0+b.y1)/2-d.height/2)*mpp;
  }else if(project.domain==='mechanical'&&project.params.operation==='revolve'){
    const horizontal=project.params.orientation==='horizontal',axis=project.axis??(horizontal?(b.y0+b.y1)/2:(b.x0+b.x1)/2),explicit=!!project.section||project.profiles?.some(p=>['cad','user-traced'].includes(p.source));
    const a=horizontal?b.x0:b.y0,z=horizontal?b.x1:b.y1,mid=explicit?(a+z)/2:(Math.ceil(a)+Math.floor(z)-1)/2;
    const lifted=explicit?result.group.position.y:result.size[1]/2;
    if(horizontal){x=(d.width/2-mid)*mpp;y=lifted+(axis-d.height/2)*mpp;}
    else{x=(d.width/2-axis)*mpp;y=lifted+(mid-d.height/2)*mpp;}
  }
  return {center:[x,y,0],width:d.width*mpp,height:d.height*mpp};
}
/** The other orthographic view occupies its original location on the same sheet. */
export function companionProjection(project,result){
  const d=project.drawing,b=d.bounds;
  if(d.compoundHousing?.companionBounds){
    const f=d.compoundHousing.companionBounds,ratio=b.width/Math.max(1,f.width),r=ratio*result.metersPerPixel;
    const center=[(d.width/2-(f.x0+f.x1)/2)*r,result.size?.[1]?result.size[1]/2:0,(d.height/2-(f.y0+f.y1)/2)*r];
    return {center,width:d.width*r,height:d.height*r,direction:[0,1,0],up:[0,0,-1]};
  }
  const e=d.extrusion,f=e?.companionBounds;if(!f)throw new Error('Falta la vista complementaria.');
  const horizontal=e.alignedAxis==='x',ratio=b[horizontal?'width':'height']/f[horizontal?'width':'height'],m=result.metersPerPixel,r=ratio*m;
  const center=horizontal?[(b.x0+(d.width/2-f.x0)*ratio-(b.x0+b.x1)/2)*m,0,(e.companionAcrossStart-d.height/2)*r]:[0,(b.y1-b.y0-(d.height/2-f.y0)*ratio)*m,(e.companionAcrossStart-d.width/2)*r];
  return {center,width:d.width*r,height:d.height*r,direction:horizontal?[0,-1,0]:[1,0,0],up:horizontal?[0,0,1]:[0,1,0]};
}
/** Fit every box corner, including depth, rather than using its largest side. */
export function fittedDistance(box,direction,fov,aspect,padding=1.10){const center=box.getCenter(new THREE.Vector3()),n=direction.clone().normalize(),right=new THREE.Vector3(0,1,0).cross(n).normalize(),up=n.clone().cross(right).normalize(),tv=Math.tan(fov*Math.PI/360);let distance=0;for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).sub(center),depth=p.dot(n);distance=Math.max(distance,Math.abs(p.dot(right))/(tv*aspect)+depth,Math.abs(p.dot(up))/tv+depth);}return Math.max(distance*padding,.01);}
export function createDisciplineRenderer(){
  let renderer,environment,skyEnvironment,skyImage;
  function init(){if(renderer)return;renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;environment=studioEnvironment(renderer);}
  return {render(project,result,{spatial=false,companion=false,top=false}={}){
    init();const p=alignedProjection(project,result),scene=new THREE.Scene();scene.background=new THREE.Color('#f5f7fa');if(result.environmentImage&&skyImage!==result.environmentImage){skyEnvironment?.dispose();skyEnvironment=reflectionEnvironment(renderer,result.environmentImage);skyImage=result.environmentImage;}scene.environment=result.environmentImage?skyEnvironment.texture:environment.texture;scene.environmentIntensity=project.domain==='exterior'?(result.environmentImage?.92:.72):.95;scene.add(new THREE.HemisphereLight(0xffffff,0x999288,project.proposal?.68:.75));const key=new THREE.DirectionalLight(0xfff6e8,project.proposal?1.85:1.95);key.position.set(-4,7,6);scene.add(key);const fill=new THREE.DirectionalLight(0xc8e0ff,.58);fill.position.set(5,2,4);scene.add(fill);const rim=new THREE.DirectionalLight(0xffebd2,.42);rim.position.set(4,5,-6);scene.add(rim);
    const radius=Math.max(...result.size,.01),center=new THREE.Vector3(...p.center);let camera,ground;
    if(top){camera=topPreviewCamera(new THREE.Box3().setFromObject(result.group),project.drawing.width/project.drawing.height);key.position.set(-radius,radius*3,radius*2);}
    else if(companion){const q=companionProjection(project,result),target=new THREE.Vector3(...q.center);camera=new THREE.OrthographicCamera(-q.width/2,q.width/2,q.height/2,-q.height/2,radius/1000,radius*30+1);camera.up.set(...q.up);camera.position.copy(target).addScaledVector(new THREE.Vector3(...q.direction),radius*8+1);camera.lookAt(target);}
    else if(spatial&&result.sourceProjection){const q=result.sourceProjection,aspect=project.drawing.width/project.drawing.height,height=Math.max(q.height,q.width/aspect)*1.04;camera=new THREE.OrthographicCamera(-height*aspect/2,height*aspect/2,height/2,-height/2,radius/1000,radius*100);camera.position.set(...q.center).addScaledVector(new THREE.Vector3(...q.direction),radius*8);camera.lookAt(new THREE.Vector3(...q.center));}
    else if(spatial){const bounds=new THREE.Box3().setFromObject(result.group),target=bounds.getCenter(new THREE.Vector3());camera=new THREE.PerspectiveCamera(35,project.drawing.width/project.drawing.height,radius/100,radius*100);const direction=new THREE.Vector3(1,.52,1.5).normalize();camera.position.copy(target).addScaledVector(direction,fittedDistance(bounds,direction,35,camera.aspect));camera.lookAt(target);key.position.set(-radius*1.6,radius*2.5,radius*2);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-radius*1.3,right:radius*1.3,top:radius*1.3,bottom:-radius*1.3,near:.001,far:radius*12});key.shadow.camera.updateProjectionMatrix();key.shadow.normalBias=radius*.0001;ground=new THREE.Mesh(new THREE.PlaneGeometry(radius*100,radius*100),new THREE.MeshStandardMaterial({color:0xe8eae8,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-radius*.003;ground.receiveShadow=true;scene.add(ground);}
    else{camera=new THREE.OrthographicCamera(-p.width/2,p.width/2,p.height/2,-p.height/2,radius/1000,radius*30+1);camera.position.copy(center).add(new THREE.Vector3(0,0,radius*8+1));camera.lookAt(center);}camera.updateMatrixWorld();
    if(project.domain==='mechanical'||project.domain==='exterior'&&!spatial){
      // Directional shadows reveal roof overhangs, window sills, doors and machined cavities.
      const target=new THREE.Box3().setFromObject(result.group).getCenter(new THREE.Vector3());
      key.position.copy(target).add(new THREE.Vector3(-radius*1.4,radius*2.4,radius*2.8));key.target.position.copy(target);scene.add(key.target);
      key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-radius*1.3,right:radius*1.3,top:radius*1.3,bottom:-radius*1.3,near:radius*.01,far:radius*12});key.shadow.camera.updateProjectionMatrix();key.shadow.normalBias=radius*.00015;key.shadow.bias=-.00005;
    }
    const parent=result.group.parent;scene.add(result.group);const f=Math.min(3,2560/Math.max(project.drawing.width,project.drawing.height));renderer.setSize(Math.round(project.drawing.width*f),Math.round(project.drawing.height*f),false);
    try{renderer.render(scene,camera);const canvas=document.createElement('canvas');canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;canvas.getContext('2d').drawImage(renderer.domElement,0,0);return canvas;}finally{result.group.removeFromParent();if(parent)parent.add(result.group);ground?.geometry.dispose();ground?.material.dispose();key.shadow.map?.dispose();key.dispose?.();fill.dispose?.();rim.dispose?.();}
  },dispose(){skyEnvironment?.dispose();environment?.dispose();renderer?.dispose();renderer?.forceContextLoss();renderer=null;environment=null;}};
}
