import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import * as THREE from '../dist/vendor/three.module.js';
import {extractDrawing} from '../dist/discipline-analysis.js';
import {extractMechanicalSection} from '../dist/mechanical-section.js';
import {detectMechanicalFeatures} from '../dist/mechanical-features.js';
import {buildDisciplineModel,modelSTL} from '../dist/discipline-models.js';
import {alignedProjection} from '../dist/discipline-render.js';

const bytes=readFileSync(new URL('./fixtures/mechanical.rgba.z',import.meta.url)),image={width:bytes.readUInt32LE(0),height:bytes.readUInt32LE(4),data:inflateSync(bytes.subarray(8))};
const drawing=extractDrawing(image),section=extractMechanicalSection(image,drawing),params={widthMm:500,depthMm:30,sectionMm:100,wallMm:5,boreMm:0,orientation:'horizontal',operation:'revolve',representation:'section',core:'void'};
const project=(overrides={})=>({domain:'mechanical',drawing,section,params:{...params},...overrides});
const meshes=(result,name)=>{const found=[];result.group.traverse(o=>{if(o.name===name)found.push(o);});return found;};
function transformedImage(scale=1,rotate=false){
  const width=(rotate?image.height:image.width)*scale,height=(rotate?image.width:image.height)*scale,data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)for(let sy=0;sy<scale;sy++)for(let sx=0;sx<scale;sx++){
    const nx=(rotate?image.height-1-y:x)*scale+sx,ny=(rotate?x:y)*scale+sy;data.set(image.data.subarray((y*image.width+x)*4,(y*image.width+x+1)*4),(ny*width+nx)*4);
  }
  return {width,height,data};
}

test('the mechanical fixture yields exactly two paired screw candidates, excluding hatching and the central slot',()=>{
  const f=section.features.fasteners;assert.equal(f.length,2);
  assert.deepEqual(f.map(f=>f.center),[[320.5,129],[320.5,273]]);
  assert.ok(f.every(f=>f.proposed&&f.source==='paired-axial-enclosure'&&f.assumptions.length));
  assert.ok(f.every(f=>f.center[0]>300&&f.diameter===6&&f.length===17));
});
test('screw evidence follows rotated and higher resolution drawings rather than fixed sample coordinates',()=>{
  for(const [scale,rotate]of[[2,false],[1,true]]){
    const im=transformedImage(scale,rotate),d=extractDrawing(im),orientation=rotate?'vertical':'horizontal',f=detectMechanicalFeatures(im,d,{orientation}).fasteners;
    assert.equal(f.length,2);assert.ok(f.every(f=>Math.abs(f.length-17*scale)<=1&&Math.abs(f.diameter-6*scale)<=1));
  }
});
test('one isolated axial enclosure cannot silently acquire a mirrored fastener',()=>{
  const data=new Uint8ClampedArray(image.data);
  for(let y=265;y<281;y++)for(let x=298;x<337;x++)data.set([255,255,255,255],(y*image.width+x)*4);
  const features=detectMechanicalFeatures({...image,data},drawing,{axis:section.axis});assert.equal(features.fasteners.length,0);
});
test('the enhanced model contains real helical threads, hollow heads and a proposed rear bearing assembly',()=>{
  const r=buildDisciplineModel(project());
  assert.equal(meshes(r,'helical-thread').length,2);assert.ok(meshes(r,'helical-thread').every(o=>o.geometry.userData.kind==='helical-v-thread'&&o.geometry.userData.rootRadius<o.geometry.userData.crestRadius));
  assert.equal(meshes(r,'recessed-hex-head').length,2);assert.ok(meshes(r,'recessed-hex-head').every(o=>o.geometry.parameters.shapes.holes.length===1));
  assert.equal(meshes(r,'proposed-rear-rolling-element').length,5);assert.equal(meshes(r,'bearing-inner-race').length,1);
  const meta=r.group.userData.mechanicalDetails;assert.equal(meta.fasteners.length,2);assert.equal(meta.bearings.length,1);assert.equal(meta.fasteners[0].threadStandard,null);assert.equal(meta.bearings[0].observedElements,2);assert.equal(meta.bearings[0].proposedRearElements,5);
  r.group.traverse(o=>{if(o.isMesh)assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));});r.dispose();
});
test('disabling proposed detail preserves the observed circles and original section profiles',()=>{
  const before=JSON.stringify(section.profiles),r=buildDisciplineModel(project({params:{...params,details:false}}));
  assert.equal(meshes(r,'helical-thread').length,0);assert.equal(meshes(r,'proposed-bearing-assembly').length,0);
  assert.equal(r.group.children.filter(o=>o.userData.observedCircularFeature).length,section.balls.length);
  assert.equal(r.group.userData.mechanicalDetails.enabled,false);assert.equal(JSON.stringify(section.profiles),before);r.dispose();
});
test('detail meshes are included in the STL, use the calibrated scale, and preserve source centers in the frontal projection',()=>{
  const p=project({calibration:{metersPerPixel:.001}}),r=buildDisciplineModel(p),base=buildDisciplineModel({...p,params:{...params,details:false}}),data=modelSTL(r.group),plain=modelSTL(base.group);
  assert.ok(data.length>plain.length);assert.ok(!/NaN|Infinity/.test(data));
  const f=r.group.userData.mechanicalDetails.fasteners[0];assert.equal(f.diameterMm,6);assert.equal(f.lengthMm,17);
  const projection=alignedProjection(p,r);r.group.updateMatrixWorld(true);
  for(const assembly of meshes(r,'proposed-threaded-fastener')){
    const point=assembly.getWorldPosition(new THREE.Vector3()),source=section.features.fasteners.find(f=>f.id===assembly.userData.sourceFeature);
    assert.ok(Math.abs(drawing.width/2+(point.x-projection.center[0])/r.metersPerPixel-source.center[0])<1e-8);
    assert.ok(Math.abs(drawing.height/2-(point.y-projection.center[1])/r.metersPerPixel-source.center[1])<1e-8);
  }
  r.dispose();base.dispose();
});
