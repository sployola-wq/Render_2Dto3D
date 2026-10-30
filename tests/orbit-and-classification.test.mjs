import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync,gunzipSync} from 'node:zlib';
import * as THREE from '../dist/vendor/three.module.js';
import {extractDrawing} from '../dist/discipline-analysis.js';
import {drawingEvidence,routeNeedsSelection,assertInteriorRoute} from '../dist/drawing-routing.js';
import {analyzeEngineeringDrawing} from '../dist/engineering-drawing.js';
import {reconstructExterior,registrationQuality,sourceProject} from '../dist/registered-exterior.js';
import {buildDisciplineModel,modelSTL} from '../dist/discipline-models.js';
const raster=name=>{const b=readFileSync(new URL('./fixtures/'+name+'.rgba.z',import.meta.url));return {width:b.readUInt32LE(0),height:b.readUInt32LE(4),data:inflateSync(b.subarray(8))};};
const params={widthMm:12000,depthMm:6000,reliefDepthMm:300,sectionMm:100,wallMm:5,boreMm:0,operation:'revolve',orientation:'horizontal',exteriorMode:'registered'};
const evidence=image=>drawingEvidence(extractDrawing(image),{image,engineering:analyzeEngineeringDrawing(image)});

test('the reported perspective house suggests exterior instead of silently routing to rooms',()=>{
  const im=raster('perspective-house'),before=im.data.slice(),e=evidence(im);
  assert.equal(e.domain,'exterior');assert.equal(e.signals.perspective,true);assert.equal(routeNeedsSelection('auto',e),true);assert.equal(routeNeedsSelection('exterior',e),false);assert.deepEqual(im.data,before);
});
test('paper shade and reduced resolution preserve the perspective suggestion',()=>{
  const original=raster('perspective-house');
  for(const factor of [.5,.75]){
    const im={width:Math.round(original.width*factor),height:Math.round(original.height*factor)};im.data=new Uint8ClampedArray(im.width*im.height*4);
    for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){const i=(Math.floor(y/factor)*original.width+Math.floor(x/factor))*4,j=(y*im.width+x)*4;for(let k=0;k<3;k++)im.data[j+k]=original.data[i+k]*.8+35;im.data[j+3]=255;}
    assert.equal(evidence(im).domain,'exterior');
  }
});
test('the existing real floor plan is a plant candidate rather than a sparse exterior',()=>{
  const im={width:1280,height:749,data:gunzipSync(readFileSync(new URL('./fixtures/plano-current.rgba.gz',import.meta.url)))},e=evidence(im);
  assert.equal(e.domain,'interior');assert.equal(e.requiresConfirmation,true);
  const snapshot=JSON.parse(readFileSync(new URL('../dist/data/plano-prediction.json',import.meta.url)));
  assert.equal(assertInteriorRoute({mode:'interior',evidence:e,snapshot}),true);
});
test('symmetry alone cannot authorize a mechanical reconstruction and uncertain input cannot default to rooms',()=>{
  const e=evidence(raster('mechanical'));assert.equal(e.domain,'mechanical');assert.equal(routeNeedsSelection('auto',e),true);assert.equal(routeNeedsSelection('mechanical',e),false);
  const unknown=drawingEvidence(null,{image:{width:200,height:200,data:new Uint8ClampedArray(200*200*4).fill(255)}});
  assert.equal(unknown.domain,null);assert.equal(routeNeedsSelection('auto',unknown),true);assert.throws(()=>assertInteriorRoute({mode:'auto',evidence:unknown}),/Confirma/);
});
test('the reported twisted house becomes a closed, source-aligned relief with explicit unresolved depth',()=>{
  const im=raster('perspective-house'),r=reconstructExterior(im,{sourceHash:'reported-house'});
  assert.equal(r.representation,'relief');assert.equal(r.quality.fallback,true);assert.equal(r.quality.rejected.valid,false);assert.ok(r.quality.rejected.maxWarp>.03);assert.equal(registrationQuality(r).valid,true);
  for(const f of r.faces)for(let i=0;i<f.outer.length;i++)assert.ok(Math.hypot(...sourceProject(f.world[i],r).map((v,k)=>v-f.outer[i][k]))<1e-7);
  const project={domain:'exterior',drawing:extractDrawing(im),sourceHash:'reported-house',sourceReconstruction:r,params},model=buildDisciplineModel(project);
  assert.ok(Math.abs(model.size[2]-.301)<.001);assert.match(model.assumptions.join(' '),/relieve cerrado/);assert.equal(model.group.userData.sourceRegistration.representation,'relief');
  model.group.updateMatrixWorld(true);const body=model.group.getObjectByName('inferred-elevation-depth'),bounds=new THREE.Box3().setFromObject(body),center=bounds.getCenter(new THREE.Vector3());
  // Both sides of the actual backing are intersectable; no zero-thickness
  // photograph is being presented as a solid when the camera is turned.
  const position=body.geometry.attributes.position,front=new THREE.Vector3();let found=false;
  for(let i=0;i<position.count;i+=3){const triangle=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(position,i+k).applyMatrix4(body.matrixWorld));if(triangle.every(p=>Math.abs(p.z-bounds.max.z)<1e-6)&&new THREE.Triangle(...triangle).getArea()>1e-8){front.copy(triangle[0]).add(triangle[1]).add(triangle[2]).divideScalar(3);found=true;break;}}
  assert.ok(found);
  for(const sign of [-1,1])assert.ok(new THREE.Raycaster(new THREE.Vector3(front.x,front.y,center.z+sign*10),new THREE.Vector3(0,0,-sign)).intersectObject(body).length>0);
  const stl=modelSTL(model.group);assert.doesNotMatch(stl,/NaN|Infinity/);assert.match(stl,/facet normal/);model.dispose();
});
test('depth spikes that preserve the original photograph are rejected before model export',()=>{
  const r={scale:100,width:100,height:100,axes:{frontElevation:true},faces:[{outer:[[0,0],[100,0],[100,100],[0,100]],holes:[],world:[[0,0,0],[1,0,0],[1,1,4],[0,1,0]],holesWorld:[]}]};
  assert.equal(registrationQuality(r).valid,false);
  assert.throws(()=>buildDisciplineModel({domain:'exterior',drawing:{width:100,height:100,bounds:{width:100,height:100}},sourceReconstruction:r,params}),/no es estable/);
});
test('coherent axonometric faces retain their spatial reconstruction',()=>{
  const im={width:360,height:300,data:new Uint8ClampedArray(360*300*4).fill(255)},line=(a,b)=>{const n=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])*2);for(let i=0;i<=n;i++){const x=Math.round(a[0]+(b[0]-a[0])*i/n),y=Math.round(a[1]+(b[1]-a[1])*i/n);im.data.set([0,0,0,255],(y*360+x)*4);}},ring=p=>p.forEach((a,i)=>line(a,p[(i+1)%p.length]));
  ring([[180,16],[290,80],[180,144],[70,80]]);ring([[70,80],[180,144],[180,244],[70,180]]);ring([[180,144],[290,80],[290,180],[180,244]]);
  const r=reconstructExterior(im);assert.equal(r.axes.axonometric,true);assert.equal(r.quality.valid,true);assert.notEqual(r.representation,'relief');
});
