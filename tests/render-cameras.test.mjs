import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {spatialPreviewCamera} from '../dist/render-cameras.js';
test('the interior perspective preview fits the same complete model in portrait, landscape and narrow desks',()=>{
  const box=new THREE.Box3(new THREE.Vector3(-12,0,-10),new THREE.Vector3(12,5,10));
  for(const aspect of [.45,1,1.8,3]){const camera=spatialPreviewCamera(box,aspect);for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).project(camera);assert.ok(Math.abs(p.x)<=1&&Math.abs(p.y)<=1);assert.ok(p.z>-1&&p.z<1);}}
});

test('cenital projection fits the full footprint and does not change XY when height changes',async()=>{
  const {topPreviewCamera}=await import('../dist/render-cameras.js');
  for(const aspect of[.45,1,1.8,3]){const box=new THREE.Box3(new THREE.Vector3(-6,0,-9),new THREE.Vector3(6,8,0)),camera=topPreviewCamera(box,aspect);assert.equal(camera.isOrthographicCamera,true);for(const x of[-6,6])for(const z of[-9,0]){const a=new THREE.Vector3(x,0,z).project(camera),b=new THREE.Vector3(x,8,z).project(camera);assert.ok(Math.abs(a.x)<1&&Math.abs(a.y)<1);assert.ok(Math.abs(a.x-b.x)<1e-8&&Math.abs(a.y-b.y)<1e-8);}}
});
