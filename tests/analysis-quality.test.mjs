import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizeAnalysis} from '../dist/analysis-quality.js';
test('a wall-only result is explicitly limited, even when extraction succeeds',()=>{
  const q=summarizeAnalysis({result:{wallPolygons:[{}],objects:[],provenance:{kind:'geometric-detector'}}});assert.equal(q.limited,true);assert.equal(q.live,false);assert.match(q.message,/Solo estructura/);
});
test('live recognition is distinguished from the saved example and counts reviewed confidence only',()=>{
  const snapshot={result:{objects:[{category:'bed',confidence:.8},{category:'door',confidence:.7},{category:'chair',confidence:.2}],provenance:{kind:'neural-inference'}},rawPrediction:{provenance:{execution:'live'}}};
  const q=summarizeAnalysis(snapshot);assert.deepEqual([q.furniture,q.openings,q.live,q.limited],[1,1,true,false]);snapshot.rawPrediction.provenance.execution='saved';assert.equal(summarizeAnalysis(snapshot).live,false);
});
