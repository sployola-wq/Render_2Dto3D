import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {bboxIou,matchObjects,wallMask,evaluatePrediction} from '../dist/evaluation.js';
import {detectPlan} from '../dist/detector.js';

test('box overlap rejects disjoint boxes and measures partial overlap',()=>{
  assert.equal(bboxIou([0,0,10,10],[20,20,30,30]),0);
  assert.equal(bboxIou([0,0,10,10],[0,0,10,10]),1);
  assert.ok(Math.abs(bboxIou([0,0,10,10],[5,0,15,10])-1/3)<1e-9);
});
test('duplicate predictions cannot both match the same reference object',()=>{
  const predicted=[{id:'a',bbox:[0,0,10,10]},{id:'b',bbox:[0,0,10,10]}];
  const matched=matchObjects(predicted,[{id:'r',bbox:[0,0,10,10]}]);
  assert.equal(matched.matches.length,1);assert.equal(matched.falsePositiveIds.length,1);
});
test('mask preserves polygon holes',()=>{
  const mask=wallMask({width:10,height:10,wallPolygons:[{outer:[[0,0],[10,0],[10,10],[0,10]],holes:[[[3,3],[7,3],[7,7],[3,7]]]}]});
  assert.equal(mask[4*10+4],0);assert.equal(mask[1*10+1],1);assert.equal(mask.reduce((a,b)=>a+b,0),84);
});
test('different image hashes never produce comparison metrics',()=>{
  assert.equal(evaluatePrediction({imageSha256:'a',width:10,height:10},{imageSha256:'b',width:10,height:10}),null);
});
test('checked-in inference remains independent of manual reference and has measurable errors',()=>{
  const prediction=JSON.parse(readFileSync(new URL('../dist/data/archive/724x424/plano-prediction.json',import.meta.url)));
  const reference=JSON.parse(readFileSync(new URL('../dist/data/archive/724x424/plano-reference.json',import.meta.url)));
  const before=JSON.stringify(prediction);
  const raw=evaluatePrediction(prediction,reference,.35);
  assert.ok(raw.totals.tp>0);assert.ok(raw.totals.fp>0);assert.ok(raw.totals.fn>0);
  assert.equal(prediction.provenance.referenceUsedForInference,false);
  assert.equal(reference.provenance.usedForTraining,false);
  assert.equal(JSON.stringify(prediction),before);
  const data=gunzipSync(readFileSync(new URL('./fixtures/plano.rgba.gz',import.meta.url)));
  const geometry=detectPlan({width:724,height:424,data});
  const hybrid={...prediction,walls:geometry.walls};
  const compared=evaluatePrediction(hybrid,reference,.35);
  assert.ok(compared.wallIou>0 && compared.wallIou<1);
});
