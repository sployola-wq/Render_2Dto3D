import * as THREE from './vendor/three.module.js';
/** Orthographic view along the vertical axis, with one scale for all storeys. */
export function topPreviewCamera(box,aspect){
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),height=Math.max(size.z,size.x/aspect,.01)*1.12,radius=Math.max(size.x,size.y,size.z,.01);
  const camera=new THREE.OrthographicCamera(-height*aspect/2,height*aspect/2,height/2,-height/2,.001,radius*20+1);
  camera.up.set(0,0,-1);camera.position.copy(center).add(new THREE.Vector3(0,radius*5+1,0));camera.lookAt(center);camera.updateProjectionMatrix();camera.updateMatrixWorld();return camera;
}
/** Fit every box corner inside the perspective preview, including tall walls. */
export function spatialPreviewCamera(box,aspect){
  const camera=new THREE.PerspectiveCamera(38,aspect,.01,1000),center=box.getCenter(new THREE.Vector3()),direction=new THREE.Vector3(1,1.15,1.15).normalize(),right=new THREE.Vector3(0,1,0).cross(direction).normalize(),up=direction.clone().cross(right),tan=Math.tan(camera.fov*Math.PI/360);
  let distance=0;
  for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).sub(center);distance=Math.max(distance,p.dot(direction)+Math.abs(p.dot(up))/tan,p.dot(direction)+Math.abs(p.dot(right))/(tan*aspect));}
  camera.position.copy(center).addScaledVector(direction,Math.max(1,distance)*1.08);camera.lookAt(center);camera.far=Math.max(1000,distance*10);camera.updateProjectionMatrix();camera.updateMatrixWorld();return camera;
}
