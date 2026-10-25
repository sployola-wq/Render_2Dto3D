import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {SAMPLE} from '../dist/sample.js';
import {reconstructArchitecture} from '../dist/architecture.js';
import {evaluatePrediction} from '../dist/evaluation.js';
const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));

test('current sample, pixels, prediction and transferred annotations refer to the actual replacement file',()=>{
  const sha=createHash('sha256').update(readFileSync(new URL('../dist/assets/plano.jpeg',import.meta.url))).digest('hex');
  const metadata=json('./fixtures/plano-current.json'),prediction=json('../dist/data/plano-prediction.json'),reference=json('../dist/data/plano-reference.json');
  for(const data of [SAMPLE,metadata,prediction,reference])assert.equal(data.imageSha256,sha);
  assert.equal(prediction.width,metadata.width);assert.equal(prediction.height,metadata.height);
  assert.equal(reference.width,prediction.width);assert.equal(reference.height,prediction.height);
  assert.equal(gunzipSync(readFileSync(new URL('./fixtures/plano-current.rgba.gz',import.meta.url))).length,prediction.width*prediction.height*4);
  assert.equal(reference.provenance.status,'transferred-initial-review');
  assert.ok(reference.provenance.registration.inliers>=20);
  assert.ok(reference.provenance.registration.medianErrorPixels<2.5);
  assert.notEqual(reference.imageSha256,reference.provenance.transferredFrom.imageSha256);
  assert.equal(prediction.provenance.referenceUsedForInference,false);
  const old=json('../dist/data/archive/724x424/plano-reference.json');
  assert.equal(evaluatePrediction(prediction,old),null);
  const shift=reference.provenance.registration,oldBox=old.objects[0].bbox,newBox=reference.objects[0].bbox;
  assert.ok(Math.abs(newBox[0]-(oldBox[0]*shift.scaleX+shift.translateX))<.001);
});
test('high-resolution reconstruction adapts its tolerance without consulting annotations',()=>{
  const prediction=json('../dist/data/plano-prediction.json'),before=JSON.stringify(prediction),result=reconstructArchitecture(prediction);
  assert.ok(result.stats.footprintIou>=.9);
  assert.ok(result.stats.cleanedVertices<result.stats.originalVertices);
  assert.equal(result.assumptions.referenceUsed,false);
  assert.equal(JSON.stringify(prediction),before);
});
