import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import * as THREE from '../dist/vendor/three.module.js';
import {extractDrawing} from '../dist/discipline-analysis.js';
import {reconstructExterior} from '../dist/registered-exterior.js';
import {buildDisciplineModel,modelSTL} from '../dist/discipline-models.js';
import {EXTERIOR_DEFAULTS} from '../dist/exterior-workflow.js';
const image=name=>{const b=readFileSync(new URL('./fixtures/'+name+'.rgba.z',import.meta.url));return {width:b.readUInt32LE(0),height:b.readUInt32LE(4),data:inflateSync(b.subarray(8))};};
function build(name,overrides={}){const im=image(name),e=JSON.parse(readFileSync(new URL('./fixtures/'+name+'-envelope.json',import.meta.url))),project={domain:'exterior',sourceHash:'observed',drawing:extractDrawing(im),sourceReconstruction:reconstructExterior(im),exteriorEnvelope:{...e,sourceHash:'observed'},params:{...EXTERIOR_DEFAULTS,exteriorMode:'spatial',widthMm:12000,depthMm:6000,sectionMm:100,wallMm:5,boreMm:0,operation:'revolve',orientation:'horizontal',...overrides}};return {result:buildDisciplineModel(project),project};}
test('a perspective drawing produces regular walls and storeys with an explicit architectural proposal',()=>{
  for(const name of['house-gabled','perspective-house']){const {result:r}=build(name);assert.equal(r.sourceVolume.algorithm,'source-architectural-massing-v2');assert.equal(r.sourceVolume.geometryProposed,true);assert.equal(r.sourceVolume.hiddenGeometryProposed,true);assert.equal(r.sourceVolume.floors,2);assert.ok(r.group.getObjectByName('architectural-foundation'));assert.ok(r.group.getObjectByName('architectural-wall'));assert.ok(r.size[1]<12);assert.doesNotMatch(modelSTL(r.group),/NaN|Infinity/);r.dispose();}
});
test('the building is independent geometry, without the former photograph wrapping or silhouette height field',()=>{
  const {result:r}=build('house-gabled');assert.equal(r.sourceProjection,undefined);assert.equal(r.group.getObjectByName('observed-profile-roof'),undefined);
  r.group.traverse(o=>{if(o.isMesh){assert.equal(o.material.map,null);assert.equal(o.geometry.attributes.sourcePixel,undefined);}});r.dispose();
});
test('gable evidence creates two truly planar main roof slopes and a cross gable; flat evidence stays flat',()=>{
  const {result:a}=build('house-gabled'),{result:b}=build('perspective-house');assert.equal(a.sourceVolume.roofKind,'gable');assert.equal(b.sourceVolume.roofKind,'flat');
  for(const name of['architectural-roof-front-slope','architectural-roof-back-slope']){const g=a.group.getObjectByName(name).geometry,n=g.attributes.normal;assert.equal(g.attributes.position.count,36);assert.ok(n.getY(0)>.5&&n.getY(0)<1);for(let i=1;i<6;i++)assert.ok(new THREE.Vector3().fromBufferAttribute(n,i).distanceTo(new THREE.Vector3().fromBufferAttribute(n,0))<1e-5);}
  assert.ok(a.group.getObjectByName('source-front-gable'));assert.ok(b.group.getObjectByName('architectural-flat-roof')||b.group.getObjectByName('source-module-flat-roof'));a.dispose();b.dispose();
});
test('window proposals are actual holes with recessed glazing and source boxes for review',()=>{
  const {result:r}=build('house-gabled');r.group.updateMatrixWorld(true);let count=0;
  for(const record of r.sourceVolume.openingRecords){const node=r.group.getObjectByProperty('uuid',record.panelId),origin=node.localToWorld(new THREE.Vector3(record.x,record.y+record.h/2,.3)),direction=new THREE.Vector3(0,0,-1).transformDirection(node.matrixWorld),ray=new THREE.Raycaster(origin,direction,0,.6);assert.equal(ray.intersectObjects(node.children.filter(o=>o.geometry?.type==='ExtrudeGeometry')).length,0);assert.ok(ray.intersectObjects(node.children.filter(o=>o.uuid===record.paneId)).length>0);assert.equal(record.source.length,4);count++;}
  assert.ok(count>=4);r.dispose();
});
test('changing depth preserves horizontal foundations and finite, bounded, regular roof geometry',()=>{
  for(const depthMm of[3000,9000]){const {result:r}=build('house-gabled',{depthMm});r.group.updateMatrixWorld(true);const foundation=new THREE.Box3().setFromObject(r.group.getObjectByName('architectural-foundation'));assert.ok(Math.abs(foundation.min.y)<1e-6);assert.ok(Math.abs(foundation.getSize(new THREE.Vector3()).z-depthMm/1000)<1e-5);r.group.traverse(o=>{if(o.isMesh){assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));assert.ok(o.geometry.attributes.normal.array.every(Number.isFinite));}});r.dispose();}
});

test('the modern facade keeps its separated upper volumes and a solid garage door',()=>{
  const {result:r}=build('perspective-house');assert.equal(r.sourceVolume.levels.at(-1).modules?.length,2);assert.equal(r.group.children.filter(o=>o.name==='source-module-flat-roof').length,2);const garage=r.sourceVolume.openingRecords.find(o=>o.kind==='garage');assert.ok(garage);assert.ok(r.sourceVolume.openingRecords.some(o=>o.kind==='door'&&o.axis==='front'));assert.ok(r.sourceVolume.openingRecords.some(o=>o.kind==='window'&&o.axis==='right'&&o.nodePosition[1]<1));const leaf=r.group.getObjectByProperty('uuid',garage.paneId);assert.equal(leaf.material.isMeshPhysicalMaterial,undefined);assert.ok(r.group.getObjectByName('garage-door-rib'));r.dispose();
});
test('the cross gable joins the main roof plane at both eave and ridge instead of leaving floating triangular edges',()=>{
  const {result:r}=build('house-gabled'),main=r.group.getObjectByName('architectural-roof-front-slope').geometry.attributes.position,cross=r.group.getObjectByName('source-cross-gable-roof-left').geometry.attributes.position;
  const y=z=>main.getY(0)+(main.getY(2)-main.getY(0))*(z-main.getZ(0))/(main.getZ(2)-main.getZ(0));
  for(const i of[2,5])assert.ok(Math.abs(cross.getY(i)-y(cross.getZ(i)))<2e-6);r.dispose();
});

test('intermediate slabs stay inside the walls and cannot flicker over the facade after orbiting',()=>{
  const {result:r}=build('house-gabled');r.group.updateMatrixWorld(true);const floors=r.group.children.filter(o=>o.name==='architectural-floor');assert.equal(floors.length,r.sourceVolume.floors-1);for(const floor of floors){const b=new THREE.Box3().setFromObject(floor);assert.ok(b.max.x<r.sourceVolume.width/2-.20);assert.ok(b.min.z>-r.sourceVolume.depth+.20);}r.dispose();
});
