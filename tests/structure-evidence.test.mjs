import {test} from 'node:test';
import assert from 'node:assert/strict';
import {refineStructure} from '../dist/structure-evidence.js';
import {wallMask} from '../dist/evaluation.js';
const rect=(a,b,c,d)=>({outer:[[a,b],[c,b],[c,d],[a,d]],holes:[]});
const fixture=()=>({width:100,height:80,imageSha256:'a'.repeat(64),wallPolygons:[rect(10,8,90,12),rect(10,68,90,72)],objects:[{category:'door',bbox:[47,35,53,46],confidence:.9}],provenance:{kind:'neural-inference'}});
test('same-image missing wall evidence preserves the semantic door passage and the original prediction',()=>{
 const neural=fixture(),before=JSON.stringify(neural),baseline={width:100,height:80,imageSha256:neural.imageSha256,walls:[{axis:'v',c:50,from:10,to:70,thickness:4}]};const fused=refineStructure(neural,baseline),mask=wallMask(fused);
 assert.ok(fused.wallPolygons.length>neural.wallPolygons.length);assert.equal(mask[25*100+50],1);assert.equal(mask[40*100+50],0);assert.equal(mask[55*100+50],1);assert.equal(JSON.stringify(neural),before);assert.deepEqual(fused.objects,neural.objects);
});
test('detached short bands and geometry from a different file are not promoted to walls',()=>{
 const neural=fixture(),baseline={width:100,height:80,imageSha256:neural.imageSha256,walls:[{axis:'h',c:40,from:30,to:60,thickness:4}]};assert.equal(refineStructure(neural,baseline),neural);baseline.imageSha256='b'.repeat(64);assert.equal(refineStructure(neural,baseline),neural);
});
