import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyPlanEdits,objectAt} from '../dist/plan-edits.js';
import {wallMask} from '../dist/evaluation.js';
import {prepareFurniture} from '../dist/architecture.js';
const base={imageSha256:'source',width:100,height:80,objects:[{id:'a',category:'table',bbox:[20,20,40,40],confidence:.8}],walls:[],wallPolygons:[{outer:[[5,5],[95,5],[95,10],[5,10]],holes:[]}],provenance:{kind:'neural-inference'}};
const record=edits=>({sourceHash:'source',width:100,height:80,edits});
test('edits preserve the raw inference and source placement while correcting a category',()=>{
  const before=structuredClone(base),r=applyPlanEdits(base,record([{kind:'replace-object',category:'sink',bbox:[20,20,40,40]}]));
  assert.deepEqual(base,before);assert.equal(r.objects.length,1);assert.equal(r.objects[0].category,'sink');assert.deepEqual(r.objects[0].bbox,base.objects[0].bbox);assert.equal(r.objects[0].source,'user-correction');
  assert.equal(applyPlanEdits(base,record([])).objects[0].category,'table');
});
test('corrections cannot migrate to another source or accept non-finite/out-of-frame boxes',()=>{
  assert.throws(()=>applyPlanEdits(base,{...record([]),sourceHash:'another'}),/otro plano/);
  for(const bbox of [[0,0,Infinity,30],[-1,0,30,30],[0,0,101,20],[10,10,11,11]])assert.throws(()=>applyPlanEdits(base,record([{kind:'add-object',category:'chair',bbox}])));
});
test('wall removal preserves all occupied pixels outside the explicitly edited rectangle',()=>{
  const before=wallMask(base),after=wallMask(applyPlanEdits(base,record([{kind:'remove-wall',bbox:[40,0,50,15]}])));
  for(let y=0;y<80;y++)for(let x=0;x<100;x++)assert.equal(after[y*100+x],x>=40&&x<50&&y<15?0:before[y*100+x]);
  assert.deepEqual(wallMask(applyPlanEdits(base,record([]))),before);
});
test('adding, selecting and removing an omitted object is deterministic and reversible',()=>{
  const edit={kind:'add-object',category:'bed',bbox:[50,30,75,65]},added=applyPlanEdits(base,record([edit]));
  assert.equal(objectAt(added,[60,40]).category,'bed');assert.equal(objectAt(added,[99,79]),null);
  const removed=applyPlanEdits(base,record([edit,{...edit,kind:'remove-object'}]));assert.equal(removed.objects.length,1);
});
test('a deliberate user correction is visible even when it conflicts with a detected wall, with an explicit warning',()=>{
  const architecture={width:100,height:80,wallPolygons:base.wallPolygons,runs:[]},object={id:'user',category:'chair',bbox:[20,5,30,10],confidence:1,source:'user-correction'};
  const r=prepareFurniture([object],architecture,{metersPerPixel:.02});assert.equal(r.objects.length,1);assert.equal(r.warnings[0].reason,'wall-overlap');assert.deepEqual(r.objects[0].bbox,object.bbox);
});
