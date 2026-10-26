import * as THREE from './vendor/three.module.js';
/** Procedural studio reflections, owned by this renderer, with no downloaded assets. */
export function studioEnvironment(renderer){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#9aa4b0');const materials=[],geometries=[];
  for(const [position,size,color]of [[[0,5,0],[8,1,6],'#ffffff'],[[-5,1,2],[1,6,8],'#e9f2ff'],[[5,2,-2],[1,4,6],'#ffffff'],[[0,1,5],[6,4,1],'#c6d3e1']]){const geometry=new THREE.BoxGeometry(...size),material=new THREE.MeshBasicMaterial({color}),panel=new THREE.Mesh(geometry,material);panel.position.set(...position);scene.add(panel);materials.push(material);geometries.push(geometry);}
  const generator=new THREE.PMREMGenerator(renderer),target=generator.fromScene(scene,.04,.1,30);generator.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();return target;
}
/** World-space projection of the original analysis frame. Not a camera fit to the
 * object: preserving the complete frame keeps the comparison geometrically aligned. */
export function alignedProjection(project,result){
  const d=project.drawing,b=d.bounds,mpp=result.metersPerPixel;let x=(d.width/2-(b.x0+b.x1)/2)*mpp,y=(b.y1-d.height/2)*mpp;
  if(project.domain==='mechanical'&&project.params.operation==='revolve'){
    const horizontal=project.params.orientation==='horizontal',axis=project.axis??(horizontal?(b.y0+b.y1)/2:(b.x0+b.x1)/2),explicit=!!project.section||project.profiles?.some(p=>['cad','user-traced'].includes(p.source));
    const a=horizontal?b.x0:b.y0,z=horizontal?b.x1:b.y1,mid=explicit?(a+z)/2:(Math.ceil(a)+Math.floor(z)-1)/2;
    if(horizontal){x=(d.width/2-mid)*mpp;y=result.size[1]/2+(axis-d.height/2)*mpp;}
    else{x=(d.width/2-axis)*mpp;y=result.size[1]/2+(mid-d.height/2)*mpp;}
  }
  return {center:[x,y,0],width:d.width*mpp,height:d.height*mpp};
}
export function createDisciplineRenderer(){
  let renderer,environment;
  function init(){if(renderer)return;renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;environment=studioEnvironment(renderer);}
  return {render(project,result){
    init();const p=alignedProjection(project,result),scene=new THREE.Scene();scene.background=new THREE.Color('#f5f7fa');scene.environment=environment.texture;scene.environmentIntensity=project.domain==='exterior'?.35:.85;scene.add(new THREE.HemisphereLight(0xffffff,0x8a97a6,.7));const key=new THREE.DirectionalLight(0xfff5e6,1.8);key.position.set(-4,7,6);scene.add(key);const fill=new THREE.DirectionalLight(0xc4dcff,.5);fill.position.set(5,1,4);scene.add(fill);
    const radius=Math.max(...result.size,.01),center=new THREE.Vector3(...p.center),camera=new THREE.OrthographicCamera(-p.width/2,p.width/2,p.height/2,-p.height/2,radius/1000,radius*30+1);camera.position.copy(center).add(new THREE.Vector3(0,0,radius*8+1));camera.lookAt(center);camera.updateMatrixWorld();
    const parent=result.group.parent;scene.add(result.group);const f=Math.min(3,2560/Math.max(project.drawing.width,project.drawing.height));renderer.setSize(Math.round(project.drawing.width*f),Math.round(project.drawing.height*f),false);
    try{renderer.render(scene,camera);const canvas=document.createElement('canvas');canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;canvas.getContext('2d').drawImage(renderer.domElement,0,0);return canvas;}finally{result.group.removeFromParent();if(parent)parent.add(result.group);key.dispose?.();fill.dispose?.();}
  },dispose(){environment?.dispose();renderer?.dispose();renderer?.forceContextLoss();renderer=null;environment=null;}};
}
