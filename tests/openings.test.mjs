import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {associateOpeningsDetailed} from '../dist/openings.js';
import {reconstructArchitecture} from '../dist/architecture.js';
import {wallMask} from '../dist/evaluation.js';
import {visualCases} from '../dist/opening-audit-view.js';
const proposal=(id,category,bbox)=>({id,category,bbox,confidence:.9});
const run=(id,axis,c,from,to,thickness=4)=>({id,axis,c,from,to,thickness});

test('an L junction supplies a door jamb without inventing a parallel wall',()=>{
  const result=associateOpeningsDetailed([proposal('d','door',[20,28,40,32])],[run('side','v',18,5,50),run('wall','h',30,40,90)],{typicalWallThickness:4});
  assert.equal(result.openings.length,1);
  assert.equal(result.openings[0].from,20);assert.equal(result.openings[0].to,40);
  assert.deepEqual(new Set(result.openings[0].supports.map(s=>s.kind)),new Set(['corner','collinear']));
});
test('an opening inside a continuous wall remains pending without two independent supports',()=>{
  const result=associateOpeningsDetailed([proposal('d','door',[40,28,60,32])],[run('solid','h',30,5,95,6)]);
  assert.equal(result.openings.length,0);assert.deepEqual(result.unmatched,['d']);
});
test('a distant thick wall cannot pull an opening sideways',()=>{
  const result=associateOpeningsDetailed([proposal('d','door',[10,30,15,60])],[run('wardrobe','v',35,0,80,30),run('top','h',30,30,80,6),run('bottom','h',60,30,80,6)],{typicalWallThickness:6});
  assert.equal(result.openings.length,0);assert.deepEqual(result.unmatched,['d']);
});
test('adjacent window fragments merge across an empty gap, but retain a real solid pier',()=>{
  const objects=[proposal('a','window',[20,28,35,32]),proposal('b','window',[40,28,55,32])];
  const runs=[run('left','h',30,5,20),run('right','h',30,55,95)];
  const mask=wallMask({width:100,height:60,walls:runs});
  const joined=associateOpeningsDetailed(objects,runs,{mask,width:100,height:60});
  assert.equal(joined.openings.length,1);assert.deepEqual(new Set(joined.openings[0].objectIds),new Set(['a','b']));
  const withPier=[...runs,run('pier','h',30,35,40)];
  const separate=associateOpeningsDetailed(objects,withPier,{mask:wallMask({width:100,height:60,walls:withPier}),width:100,height:60});
  assert.equal(separate.openings.length,2);
  assert.ok(separate.openings.every(o=>o.to<=35||o.from>=40));
});
test('a tiny conflicting door fragment is excluded without changing a window category',()=>{
  const result=associateOpeningsDetailed([proposal('w','window',[20,28,50,32]),proposal('tiny','door',[25,29,28,31])],[run('left','h',30,5,20),run('right','h',30,50,95)]);
  assert.equal(result.openings.length,1);assert.equal(result.openings[0].category,'window');
  assert.deepEqual(result.openings[0].objectIds,['w']);assert.deepEqual(result.rejected,['tiny']);
});
test('two competing full-size categories remain pending instead of producing overlapping door and window bodies',()=>{
  const result=associateOpeningsDetailed([proposal('w','window',[20,28,50,32]),proposal('d','door',[20,28,50,32])],[run('left','h',30,5,20),run('right','h',30,50,95)]);
  assert.equal(result.openings.length,0);assert.deepEqual(new Set(result.unmatched),new Set(['w','d']));
  assert.ok(result.diagnostics.every(d=>d.reason==='category-conflict'));
});
test('the real audit accounts for every proposal and recovers original pending associations without reading the reference',()=>{
  const prediction=JSON.parse(readFileSync(new URL('../dist/data/plano-prediction.json',import.meta.url)));
  const before=JSON.stringify(prediction),legacy=reconstructArchitecture(prediction,{openingMode:'legacy'}),current=reconstructArchitecture(prediction);
  assert.equal(legacy.unmatchedOpeningIds.length,15);
  assert.ok(current.unmatchedOpeningIds.length<legacy.unmatchedOpeningIds.length);
  const expected=prediction.objects.filter(o=>['door','window'].includes(o.category)&&o.confidence>=.35).map(o=>o.id);
  assert.deepEqual(new Set(current.openingDiagnostics.map(d=>d.objectId)),new Set(expected));
  assert.equal(current.openingDiagnostics.length,expected.length);
  for(const opening of current.openings){
    assert.equal(opening.supports.length,2);assert.notEqual(opening.supports[0].runId,opening.supports[1].runId);
    assert.ok(opening.objectIds.every(id=>prediction.objects.find(o=>o.id===id).category===opening.category));
  }
  assert.equal(current.assumptions.referenceUsed,false);assert.equal(JSON.stringify(prediction),before);
  const review=JSON.parse(readFileSync(new URL('../dist/data/openings-visual-review.json',import.meta.url)));
  assert.equal(visualCases(prediction,review).length,15);
  assert.equal(visualCases({...prediction,imageSha256:'another-file'},review).length,0);
  assert.equal(visualCases({},null).length,0);
  const changed=structuredClone(prediction);changed.objects.find(o=>o.id===review.cases[0].objectId).bbox[0]+=10;
  assert.equal(visualCases(changed,review).length,14);
});
