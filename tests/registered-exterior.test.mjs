import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import * as THREE from '../dist/vendor/three.module.js';
import {reconstructExterior,sourceProject} from '../dist/registered-exterior.js';
import {extractDrawing} from '../dist/discipline-analysis.js';
import {buildDisciplineModel} from '../dist/discipline-models.js';
function drawing(offset=0){
 const im={width:360,height:300,data:new Uint8ClampedArray(360*300*4).fill(255)},line=(a,b)=>{const n=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])*2);for(let i=0;i<=n;i++){const x=Math.round(a[0]+(b[0]-a[0])*i/n),y=Math.round(a[1]+(b[1]-a[1])*i/n);im.data.set([0,0,0,255],(y*360+x)*4);}},ring=p=>p.forEach((a,i)=>line(a,p[(i+1)%p.length]));
 ring([[20,195],[180,102],[340,195],[180,288]]);ring([[180,16],[290,80],[180,144],[70,80]]);ring([[70,80],[180,144],[180,244],[70,180]]);ring([[180,144],[290,80],[290,180],[180,244]]);
 ring([[100+offset,130],[125+offset,144],[125+offset,174],[100+offset,160]]);ring([[210,140],[235,125],[235,155],[210,170]]);return im;
}
const params={widthMm:12000,depthMm:6000,sectionMm:100,wallMm:5,boreMm:0,operation:'revolve',orientation:'horizontal',exteriorMode:'registered'};
function build(image,hash='source-a',surfaceCanvas=null){const d=extractDrawing(image),r=reconstructExterior(image,{sourceHash:hash});return {r,model:buildDisciplineModel({domain:'exterior',drawing:d,sourceHash:hash,sourceReconstruction:r,params},{surfaceCanvas})};}

test('every reconstructed facade, window and roof vertex projects to its original Step 2 pixel',()=>{
 for(const offset of[0,15]){const im=drawing(offset),r=reconstructExterior(im);assert.ok(r.axes.axonometric);for(const f of r.faces)for(let i=0;i<f.outer.length;i++){const p=sourceProject(f.world[i],r);assert.ok(Math.hypot(p[0]-f.outer[i][0],p[1]-f.outer[i][1])<1e-8);}}
});
test('source camera and UV coordinates retain every rendered triangle at its source location',()=>{
 const im=drawing(),canvas={width:720,height:600},{model}=build(im,'source-a',canvas),q=model.sourceProjection,c=new THREE.OrthographicCamera(-q.width/2,q.width/2,q.height/2,-q.height/2,.001,1000);c.position.set(...q.center).addScaledVector(new THREE.Vector3(...q.direction),100);c.lookAt(new THREE.Vector3(...q.center));c.updateMatrixWorld();let checked=0;
 model.group.traverse(mesh=>{if(!mesh.userData.sourceFace)return;assert.equal(mesh.material.map.image,canvas);const g=mesh.geometry;for(let i=0;i<g.attributes.position.count;i++){const p=new THREE.Vector3().fromBufferAttribute(g.attributes.position,i).project(c),x=(p.x+1)*im.width/2,y=(1-p.y)*im.height/2;assert.ok(Math.abs(x-g.attributes.sourcePixel.getX(i))<.001);assert.ok(Math.abs(y-g.attributes.sourcePixel.getY(i))<.001);assert.ok(Math.abs(g.attributes.uv.getX(i)*im.width-x)<.001);checked++;}});assert.ok(checked>30);model.dispose();
});
test('a different source changes the geometry and no conceptual doors, terrace or plant is added',()=>{
 const a=build(drawing()),b=build(drawing(15),'source-b');assert.notDeepEqual(a.r.faces.map(f=>f.bounds),b.r.faces.map(f=>f.bounds));assert.equal(b.model.group.userData.sourceRegistration.sourceHash,'source-b');assert.ok(b.model.group.children.every(m=>m.userData.sourceFace||m.name.startsWith('inferred-')));assert.equal(b.model.group.userData.architecturalProposal,undefined);assert.ok(b.model.size.every(v=>v>1));a.model.dispose();b.model.dispose();
});
test('a frontal elevation extrudes its own silhouette and keeps its real source openings',()=>{
 const f=readFileSync(new URL('./fixtures/facade.rgba.z',import.meta.url)),im={width:f.readUInt32LE(0),height:f.readUInt32LE(4),data:inflateSync(f.subarray(8))},{r,model}=build(im);assert.ok(r.axes.frontElevation);assert.ok(model.group.getObjectByName('inferred-elevation-depth'));assert.ok(model.size[2]>=6);for(const face of r.faces)assert.ok(sourceProject(face.world[0],r).every((v,k)=>Math.abs(v-face.outer[0][k])<1e-8));model.dispose();
});
test('registered mode refuses missing source geometry instead of returning a generic building',()=>{
 const im=drawing(),d=extractDrawing(im);assert.throws(()=>buildDisciplineModel({domain:'exterior',drawing:d,params}),/mismo marco/);assert.throws(()=>reconstructExterior({width:200,height:200,data:new Uint8ClampedArray(200*200*4).fill(255)}),/caras cerradas/);
});

test('adjacent source faces share identical 3D boundaries, including different window layouts',()=>{
 for(const offset of[0,15]){const r=reconstructExterior(drawing(offset)),points=new Map();let shared=0;for(const f of r.faces)for(let i=0;i<f.outer.length;i++){const key=f.outer[i].join(',');if(points.has(key)){shared++;assert.deepEqual(f.world[i],points.get(key));}else points.set(key,f.world[i]);}assert.ok(shared>12);assert.ok(r.maxBoundaryAdjustmentPixels<=1.05);}
});


test('a registered model rejects geometry from another source even when image dimensions match',()=>{
 const im=drawing(),d=extractDrawing(im),r=reconstructExterior(im,{sourceHash:'first'});assert.throws(()=>buildDisciplineModel({domain:'exterior',drawing:d,sourceHash:'second',sourceReconstruction:r,params}),/mismo marco/);
});
test('the source view fits both the full drawing and portrait viewports without cropping',async()=>{
 const {sourceFrustum}=await import('../dist/registered-exterior.js'),q={width:13,height:9};for(const aspect of[.5,1,1.5,2.6]){const f=sourceFrustum(q,aspect);assert.ok(f.width>=q.width);assert.ok(f.height>=q.height);assert.ok(Math.abs(f.width/f.height-aspect)<1e-10);}
});
