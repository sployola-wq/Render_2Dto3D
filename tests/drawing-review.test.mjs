import {test} from 'node:test';
import assert from 'node:assert/strict';
import {geometryReview} from '../dist/drawing-review.js';
import {assertExteriorReconstruction} from '../dist/exterior-quality.js';
test('a silhouette cannot authorize a generic substitute building when depth recovery failed',()=>{
  const project={domain:'exterior',sourceHash:'source',params:{exteriorMode:'volume'},drawing:{width:100,height:80},exteriorEnvelope:{algorithm:'observed-silhouette-fold-v1',sourceHash:'source',width:100,height:80,top:[[1,1],[90,1]],bottom:[[1,70],[90,70]],corner:60,bounds:[1,1,90,70]},sourceReconstruction:{representation:'relief',quality:{valid:true,fallback:true},faces:[]}};
  let error;try{assertExteriorReconstruction(project);}catch(e){error=e;}
  assert.equal(error.code,'EXTERIOR_DEPTH_UNRESOLVED');
  const r=geometryReview(error.review,'source',100,80);assert.equal(r.geometryReady,false);assert.equal(r.geometryValidated,false);
  project.params.exteriorMode='spatial';assert.doesNotThrow(()=>assertExteriorReconstruction(project));
});
test('partial review is identity-bound and cannot contain invalid or foreign-frame geometry',()=>{
  const review={sourceHash:'a',domain:'exterior',faces:[{outer:[[10,10],[20,10],[20,20]]},{outer:[[0,0],[Infinity,0],[0,2]]}],openings:[{bounds:[1,1,10,20]},{bounds:[20,10,10,20]}]};
  const r=geometryReview(review,'a',100,80);assert.equal(r.faces.length,1);assert.equal(r.openings.length,1);assert.throws(()=>geometryReview(review,'b',100,80));
});
