import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drawingEvidence,routeNeedsSelection,assertInteriorRoute} from '../dist/drawing-routing.js';
import {classifyDrawingAsset} from '../dist/drawing-classification.js';
const hash='a'.repeat(64),visual=domain=>({imageSha256:hash,execution:'local',method:'clip-drawing-prompts-v1',domain,confident:true,margin:.7,scores:{[domain]:.9}});
test('a confident identity-bound visual decision selects each engine without requiring manual confirmation',()=>{
  for(const domain of ['interior','exterior','mechanical','structure']){const e=drawingEvidence(null,{asset:{identity:hash,classification:visual(domain)}});assert.equal(e.domain,domain);assert.equal(routeNeedsSelection('auto',e),false);}
});
test('ambiguous or foreign classifications never silently authorize an engine',()=>{
  for(const extra of [{margin:.03},{scores:{exterior:.2}},{domain:null},{imageSha256:'b'.repeat(64)}]){const e=drawingEvidence(null,{asset:{identity:hash,classification:{...visual('exterior'),...extra}}});assert.equal(routeNeedsSelection('auto',e),true);}
});
test('manual discipline and semantic interior checks still apply after automatic visual classification',()=>{
  const e=drawingEvidence(null,{asset:{identity:hash,classification:visual('exterior')}});assert.throws(()=>assertInteriorRoute({mode:'interior',evidence:e}),/fachada exterior/);
  assert.throws(()=>assertInteriorRoute({mode:'auto',evidence:{...e,domain:'interior'},snapshot:{result:{objects:[]}}}),/evidencia suficiente/);
});
test('classification is local, sends the original file and rejects a response for another file',async()=>{
  const file=new Blob(['bytes'],{type:'image/jpeg'}),asset={kind:'image',file,identity:hash};let request;
  const result=await classifyDrawingAsset(asset,null,{fetchImpl:async(url,init)=>{request={url,init};return {ok:true,json:async()=>visual('interior')};}});
  assert.equal(request.url,'./api/classify');assert.equal(request.init.body,file);assert.equal(result.domain,'interior');
  assert.equal(await classifyDrawingAsset(asset,null,{fetchImpl:async()=>({ok:true,json:async()=>({...visual('interior'),imageSha256:'wrong'})})}),null);
  assert.equal(await classifyDrawingAsset(asset,null,{fetchImpl:async()=>({ok:false})}),null);
});
test('a temporarily busy recognition worker does not turn a known image into an unknown discipline',async()=>{
  let calls=0;const result=await classifyDrawingAsset({kind:'image',identity:hash,file:new Blob(['bytes'])},null,{fetchImpl:async()=>++calls===1?{ok:false,status:503}:{ok:true,status:200,json:async()=>visual('exterior')}});
  assert.equal(calls,2);assert.equal(result.domain,'exterior');
});

 test('multiview decisions require agreement between the full sheet and its crop',()=>{
  for(const agreement of [0,1,2]){
    const e=drawingEvidence(null,{asset:{identity:hash,classification:{...visual('exterior'),method:'clip-drawing-multiview-v2',viewCount:2,viewAgreement:agreement}}});
    assert.equal(routeNeedsSelection('auto',e),agreement<2);
  }
 });
