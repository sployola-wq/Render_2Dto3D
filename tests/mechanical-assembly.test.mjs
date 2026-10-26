import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import * as THREE from '../dist/vendor/three.module.js';
import {extractDrawing} from '../dist/discipline-analysis.js';
import {extractMechanicalSection} from '../dist/mechanical-section.js';
import {extractMechanicalAssembly,setAssemblyExploded} from '../dist/mechanical-assembly.js';
import {buildDisciplineModel,modelSTL} from '../dist/discipline-models.js';
import {alignedProjection} from '../dist/discipline-render.js';
const bytes=readFileSync(new URL('./fixtures/mechanical.rgba.z',import.meta.url)),image={width:bytes.readUInt32LE(0),height:bytes.readUInt32LE(4),data:inflateSync(bytes.subarray(8))},drawing=extractDrawing(image),section=extractMechanicalSection(image,drawing),assembly=extractMechanicalAssembly(image,drawing,section),params={widthMm:500,depthMm:30,sectionMm:100,wallMm:5,boreMm:0,orientation:'horizontal',operation:'revolve',representation:'assembly',core:'void',details:true};
const project=(extra={})=>({domain:'mechanical',drawing,section,assembly,params:{...params},...extra});
test('v3 partitions the actual section into source-aligned flanges, housing, cover and lock without mutating its raw analysis',()=>{
  assert.deepEqual(assembly.components.map(c=>c.id),['inlet-flange','housing','end-cover','outlet-flange','axial-lock']);
  assert.equal(assembly.components[0].from,drawing.bounds.x0);assert.equal(assembly.components.at(-1).to,drawing.bounds.x1);
  for(let i=1;i<assembly.components.length;i++)assert.equal(assembly.components[i-1].to,assembly.components[i].from);
  assert.equal(section.materialMask[195*image.width+200],0);assert.ok(assembly.profiles.length>section.profiles.length);assert.ok(assembly.components.every(c=>c.proposed));
  assert.ok(assembly.shaft.points.length>8);assert.ok(assembly.shaft.points.every(([x,r],i,a)=>Number.isFinite(x)&&r>0&&(!i||x>=a[i-1][0])));
});
test('the optional unsectioned shaft changes the central void while the component section and its frame remain intact',()=>{
  const p=project(),on=buildDisciplineModel(p),off=buildDisciplineModel({...p,params:{...params,assemblyShaft:false}}),x=(200-(drawing.bounds.x0+drawing.bounds.x1)/2)*on.metersPerPixel;
  for(const [r,enabled]of[[on,true],[off,false]]){
    r.group.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(x,r.group.position.y+5*r.metersPerPixel,2),new THREE.Vector3(0,0,-1)),hits=ray.intersectObject(r.group,true);
    assert.equal(hits.some(h=>h.object.name==='machined-stepped-shaft'),enabled);assert.equal(r.group.userData.mechanicalAssembly.shaftEnabled,enabled);
    const camera=alignedProjection(p,r),axisY=drawing.height/2-(r.group.position.y-camera.center[1])/r.metersPerPixel;assert.ok(Math.abs(axisY-section.axis)<1e-8);
  }
  assert.equal(on.group.children.filter(c=>c.userData.assemblyComponent).length,6);on.dispose();off.dispose();
});
test('component meshes have distinct materials and remain finite at a measured scale',()=>{
  const r=buildDisciplineModel(project({calibration:{metersPerPixel:.001}})),parts=r.group.children.filter(c=>c.userData.assemblyComponent),housing=parts.find(c=>c.userData.role==='housing'),flange=parts.find(c=>c.userData.role==='flange');
  assert.notEqual(housing.children[0].material.color.getHex(),flange.children[0].material.color.getHex());assert.equal(r.metersPerPixel,.001);
  r.group.traverse(o=>{if(o.isMesh)assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));});r.dispose();
});
test('exploded presentation restores exactly and STL always exports the canonical assembled pose',()=>{
  const r=buildDisciplineModel(project()),baseline=modelSTL(r.group),home=r.group.children.filter(c=>c.userData.assemblyComponent).map(c=>c.position.toArray());
  setAssemblyExploded(r.group,1);assert.equal(r.group.userData.mechanicalAssembly.explosionFactor,1);assert.ok(r.group.children.some(c=>c.userData.assemblyComponent&&c.position.length()>0));
  assert.equal(modelSTL(r.group),baseline);assert.equal(r.group.userData.mechanicalAssembly.explosionFactor,1);
  setAssemblyExploded(r.group,0);assert.deepEqual(r.group.children.filter(c=>c.userData.assemblyComponent).map(c=>c.position.toArray()),home);r.dispose();
});
test('a rotated section builds components and a finite shaft along the vertical drawing axis',()=>{
  const w=image.height,h=image.width,data=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)data.set(image.data.subarray((y*image.width+x)*4,(y*image.width+x+1)*4),(x*w+image.height-1-y)*4);
  const im={width:w,height:h,data},d=extractDrawing(im),s=extractMechanicalSection(im,d,{orientation:'vertical'}),a=extractMechanicalAssembly(im,d,s),r=buildDisciplineModel({domain:'mechanical',drawing:d,section:s,assembly:a,params:{...params,orientation:'vertical'}});
  assert.ok(a.components.length>=3);assert.ok(a.shaft);assert.ok(r.size.every(n=>Number.isFinite(n)&&n>0));setAssemblyExploded(r.group,1);assert.ok(r.group.children.some(c=>c.userData.assemblyComponent&&Math.abs(c.position.y)>0));r.dispose();
});
