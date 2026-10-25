import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wallMask,evaluatePrediction} from '../dist/evaluation.js';
import {reconstructArchitecture,buildWallLevels,prepareFurniture,polygonsFromMask,straightenRing,openingHeights} from '../dist/architecture.js';
import {createCalibration,restoreCalibration} from '../dist/calibration.js';

const rectangle=(x0,y0,x1,y1)=>({outer:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],holes:[]});
const wallFixture=category=>({width:100,height:60,imageSha256:'a'.repeat(64),wallPolygons:[rectangle(5,25,40,31),rectangle(52,25,95,31)],objects:[{id:'aperture',category,bbox:[40,24,52,32],confidence:.9}]});
const maskAt=(level,x,y)=>wallMask({width:100,height:60,wallPolygons:level.wallPolygons})[y*100+x];

test('contour union preserves courtyards and diagonal contacts without filling voids',()=>{
  const data={width:30,height:30,wallPolygons:[{...rectangle(2,2,20,20),holes:[[[6,6],[16,6],[16,16],[6,16]]]},rectangle(20,20,25,25)]};
  const original=wallMask(data),polygons=polygonsFromMask(original,30,30,{epsilon:0,minArea:1});
  assert.deepEqual(wallMask({...data,wallPolygons:polygons}),original);
  assert.equal(polygons.reduce((s,p)=>s+p.holes.length,0),1);
});
test('alignment preserves an intentional diagonal wall',()=>{
  const ring=[[5,5],[9,5],[35,31],[31,31]];
  assert.deepEqual(straightenRing(ring,.8),ring);
});
test('doors have an empty passage and a solid lintel',()=>{
  const architecture=reconstructArchitecture(wallFixture('door'));
  assert.equal(architecture.openings.length,1);
  const levels=buildWallLevels(architecture,2.7);
  assert.equal(maskAt(levels.find(l=>l.bottom===0),46,28),0);
  assert.equal(maskAt(levels.find(l=>l.bottom>=2.1),46,28),1);
  assert.equal(maskAt(levels[0],20,28),1);
});
test('windows retain a sill, an actual void and a lintel',()=>{
  const architecture=reconstructArchitecture(wallFixture('window')),levels=buildWallLevels(architecture,2.7);
  assert.equal(maskAt(levels.find(l=>l.bottom===0),46,28),1);
  assert.equal(maskAt(levels.find(l=>l.bottom===.9),46,28),0);
  assert.equal(maskAt(levels.find(l=>l.top===2.7),46,28),1);
  const low=openingHeights('window',1);assert.ok(low.bottom>=0&&low.top>low.bottom&&low.top<1);
});
test('unsupported openings remain explicit review items, not free-standing 3D parts',()=>{
  const data=wallFixture('door');data.objects.push({id:'unsupported',category:'window',bbox:[30,2,44,5],confidence:.99});
  const architecture=reconstructArchitecture(data);
  assert.deepEqual(architecture.unmatchedOpeningIds,['unsupported']);
  assert.equal(architecture.openings.length,1);
  const manual=wallFixture('door');manual.provenance={kind:'manual-reference'};delete manual.objects[0].confidence;
  assert.equal(reconstructArchitecture(manual).openings.length,1);
  assert.equal(reconstructArchitecture(manual).assumptions.referenceUsed,true);
});
test('furniture keeps its footprint, uses a nearby supporting wall, and rejects duplicates and wall collisions',()=>{
  const data=wallFixture('window'),architecture=reconstructArchitecture(data);
  const objects=[{id:'sofa',category:'sofa',bbox:[10,33,30,44],confidence:.9},{id:'duplicate',category:'sofa',bbox:[10,33,30,44],confidence:.8},{id:'collision',category:'table',bbox:[10,25,20,31],confidence:.9}];
  const result=prepareFurniture(objects,architecture,{metersPerPixel:.03});
  assert.equal(result.objects.length,1);assert.equal(result.objects[0].placement.orientationSource,'nearby-wall');
  assert.deepEqual(result.objects[0].bbox,objects[0].bbox);
  assert.deepEqual(new Set(result.rejected.map(o=>o.reason)),new Set(['duplicate','wall-overlap']));
});
test('real prediction is simplified without changing inference, and retains at least 90 percent footprint IoU',()=>{
  const prediction=JSON.parse(readFileSync(new URL('../dist/data/archive/724x424/plano-prediction.json',import.meta.url))),before=JSON.stringify(prediction);
  const reference=JSON.parse(readFileSync(new URL('../dist/data/archive/724x424/plano-reference.json',import.meta.url)));
  const raw=evaluatePrediction(prediction,reference),architecture=reconstructArchitecture(prediction);
  assert.ok(architecture.stats.cleanedVertices<architecture.stats.originalVertices*.9);
  assert.ok(architecture.stats.footprintIou>=.9);
  assert.ok(architecture.openings.length>0&&architecture.unmatchedOpeningIds.length>0);
  assert.equal(architecture.assumptions.referenceUsed,false);
  assert.equal(JSON.stringify(prediction),before);
  assert.deepEqual(evaluatePrediction(prediction,reference),raw);
});
test('measured scale survives a round trip only for the same image and coordinates',()=>{
  const identity={imageSha256:'a'.repeat(64),width:100,height:60};
  const calibration=createCalibration({...identity,points:[[10,20],[90,20]],distanceMeters:4});
  assert.equal(calibration.metersPerPixel,.05);
  assert.deepEqual(restoreCalibration(JSON.stringify({...calibration,metersPerPixel:999}),identity),calibration);
  assert.equal(restoreCalibration(JSON.stringify(calibration),{...identity,imageSha256:'b'.repeat(64)}),null);
  assert.equal(restoreCalibration(JSON.stringify(calibration),{...identity,width:200}),null);
  assert.throws(()=>createCalibration({...identity,points:[[0,0],[1,1]],distanceMeters:4}));
  assert.equal(restoreCalibration('invalid',identity),null);
});
