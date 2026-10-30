import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import * as THREE from '../dist/vendor/three.module.js';
import {reconstructExterior} from '../dist/registered-exterior.js';
import {extractDrawing} from '../dist/discipline-analysis.js';
import {buildDisciplineModel,modelSTL} from '../dist/discipline-models.js';
import {EXTERIOR_DEFAULTS,restoreExteriorSettings} from '../dist/exterior-workflow.js';
const image=name=>{const b=readFileSync(new URL('./fixtures/'+name+'.rgba.z',import.meta.url));return {width:b.readUInt32LE(0),height:b.readUInt32LE(4),data:inflateSync(b.subarray(8))};};
const params={...EXTERIOR_DEFAULTS,widthMm:12000,depthMm:6000,facadeFloors:2,sectionMm:100,wallMm:5,boreMm:0,operation:'revolve',orientation:'horizontal'};
function build(im,overrides={},options={}){const project={domain:'exterior',sourceHash:'source-house',drawing:extractDrawing(im),sourceReconstruction:reconstructExterior(im,{sourceHash:'source-house'}),calibration:options.calibration,params:{...params,...overrides}};return buildDisciplineModel(project,options);}

test('unreliable perspective depth cannot silently become a different generic building',()=>{
  const im=image('perspective-house'),before=im.data.slice();assert.equal(params.exteriorMode,'volume');
  assert.throws(()=>build(im),/profundidad.*no se pudo reconstruir/);assert.deepEqual(im.data,before);
  assert.throws(()=>build(im,{depthMm:9000}),error=>error.code==='EXTERIOR_DEPTH_UNRESOLVED'&&error.review.sourceHash==='source-house');
});
test('a supplied Step 2 picture cannot become a facade texture in the building route',()=>{
  const canvas={width:1280,height:720},r=build(image('facade'),{}, {surfaceCanvas:canvas});
  r.group.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){assert.equal(m.map,null);assert.equal(m.bumpMap,null);assert.notEqual(m.map?.image,canvas);}assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));assert.ok(o.geometry.attributes.normal.array.every(Number.isFinite));});
  r.dispose();
});
test('observed windows are actual holes through their own thick wall with separate recessed glazing',()=>{
  const r=build(image('facade'));r.group.updateMatrixWorld(true);let checked=0;
  for(const wall of r.group.children.filter(o=>o.name==='source-building-wall'&&o.userData.sourceVolume.openings?.length)){
    const f=wall.userData.sourceVolume,n=new THREE.Vector3(...(f.outward??[0,0,1])).transformDirection(wall.matrixWorld);
    for(const h of f.openings){const u=typeof h.a==='number'?(h.a+h.b)/2:(h.a.x+h.z.x)/2,y=h.bottom!==undefined?(h.bottom+h.head)/2:(h.a.y+h.z.y)/2,point=new THREE.Vector3(f.axis==='x'?f.constant:u,y,f.axis==='x'?u:f.constant).applyMatrix4(wall.matrixWorld),ray=new THREE.Raycaster(point.clone().addScaledVector(n,.4),n.clone().negate(),0,.8);
      assert.equal(ray.intersectObject(wall).length,0,JSON.stringify(h));assert.ok(ray.intersectObjects(r.group.children.filter(o=>o.name==='source-building-window')).length>0);checked++;
    }
  }
  assert.ok(checked>=3);r.dispose();
});
test('a frontal elevation has full-depth side returns and a real rear wall without a pasted photograph',()=>{
  const r=build(image('facade'));assert.equal(r.sourceVolume.algorithm,'elevation-envelope-v1');assert.ok(r.group.getObjectByName('source-building-back'));assert.ok(r.group.getObjectByName('source-building-return'));assert.ok(r.size[2]>=6);assert.ok(r.sourceVolume.openings>5);assert.ok(r.group.children.every(o=>!o.material.map));
  assert.doesNotMatch(modelSTL(r.group),/NaN|Infinity/);r.dispose();
});
test('existing automatic registered settings migrate away from the 300 mm backing and preserve study values',()=>{
  const old={...params,exteriorMode:'registered',exteriorWorkflowVersion:4,depthMm:7200,buildingDepthMm:7200,reliefDepthMm:450,facadeScheme:'brick',widthMm:15000},copy=structuredClone(old),p=restoreExteriorSettings(old,old);
  assert.equal(p.exteriorMode,'volume');assert.equal(p.depthMm,7200);assert.equal(p.reliefDepthMm,450);assert.equal(p.widthMm,15000);assert.equal(p.facadeScheme,'brick');assert.deepEqual(old,copy);
  for(const mode of ['spatial','projection']){const explicit={...old,exteriorMode:mode};assert.equal(restoreExteriorSettings(explicit,explicit).exteriorMode,mode);}
});
test('changing the building depth changes solid walls and roofs, while source identity and the analysis remain intact',()=>{
  const im=image('facade'),before=im.data.slice(),a=build(im),b=build(im,{depthMm:9000});assert.ok(b.size[2]>a.size[2]+2.8);assert.equal(a.sourceVolume.sourceHash,b.sourceVolume.sourceHash);assert.deepEqual(im.data,before);a.dispose();b.dispose();
});
test('an explicit conceptual alternative stays separate from source reconstruction',()=>{
  const r=build(image('perspective-house'),{exteriorMode:'spatial'});assert.equal(r.sourceVolume,undefined);assert.ok(r.group.userData.architecturalProposal);r.dispose();
});
test('manual concave outlines and holes still control the physical envelope without being convexified or filled',()=>{
  const profile={source:'user-traced',outer:[[30,30],[160,30],[160,90],[100,90],[100,170],[30,170]],holes:[[[50,50],[70,50],[70,80],[50,80]]]},before=structuredClone(profile),drawing={width:200,height:200,bounds:{width:130,height:140},faces:[]},r=buildDisciplineModel({domain:'exterior',drawing,profiles:[profile],sourceReconstruction:{width:200,height:200,faces:[profile]},params:{...params,widthMm:6000}});
  r.group.updateMatrixWorld(true);const front=r.group.getObjectByName('source-building-wall'),at=(x,y)=>new THREE.Raycaster(new THREE.Vector3((x-95)*6/130,(170-y)*6/130,.5),new THREE.Vector3(0,0,-1),0,1).intersectObject(front);
  assert.equal(at(60,65).length,0);assert.equal(at(130,130).length,0);assert.ok(at(40,100).length>0);assert.deepEqual(profile,before);r.dispose();
});
test('calibrated width takes precedence over a stored provisional width and material changes preserve geometry',()=>{
  const im=image('facade'),d=extractDrawing(im),a=build(im,{}, {calibration:{metersPerPixel:6/d.bounds.width}});assert.ok(Math.abs(a.size[0]-6)<.01);
  const steel=build(im,{material:'steel'}),wood=build(im,{material:'wood'});assert.deepEqual(steel.size,wood.size);assert.notDeepEqual(steel.group.getObjectByName('source-building-wall').material.color,wood.group.getObjectByName('source-building-wall').material.color);a.dispose();steel.dispose();wood.dispose();
});

test('a stepped architectural section with a pitched roof preserves its lower wing concavity, full roof height, and articulated side/rear facades',()=>{
  const im=image('es-coupe'),r=build(im);
  const outline=r.sourceVolume.masses[0].sourceOutline;
  assert.ok(outline.some(([x,y])=>x>=240&&x<=260&&y>=195&&y<=210),'preserves stepped terrace wing corner');
  assert.ok(outline.some(([x,y])=>y<=92),'preserves pitched roof ridge');
  assert.ok(r.size[1]>6.5,'reconstructs full pitched roof height above 6.5 m');
  assert.ok(r.group.children.filter(o=>o.name==='source-building-window').length>=18,'builds front, side, rear and Buhardilla windows');
  assert.ok(r.group.children.filter(o=>o.name==='source-building-door').length>=3,'builds ground-floor, upper-floor and terrace doors');
  assert.ok(r.group.getObjectByName('source-door-handle'),'builds 3D door handles on front doors');
  assert.ok(r.group.getObjectByName('source-roof-gutter'),'builds projecting roof eave gutters');
  assert.ok(r.group.getObjectByName('source-wing-parapet'),'builds solid masonry parapet wall on 3.49 m wing');
  assert.ok(r.group.getObjectByName('source-structural-pilaster'),'builds structural section pilasters');
  assert.ok(r.group.getObjectByName('source-dormer-body'),'builds attic dormer (Buhardilla)');
  assert.ok(r.group.getObjectByName('source-terrace-rail'),'builds walkable terrace railing on lower wing');
  assert.ok(r.group.getObjectByName('source-rear-pergola'),'builds rear courtyard pergola');
  assert.doesNotMatch(modelSTL(r.group),/NaN|Infinity/);
  r.dispose();
});
