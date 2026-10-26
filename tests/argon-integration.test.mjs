import test from 'node:test';
import assert from 'node:assert/strict';
import {enhanceBlueprintPixels,createRenderRecord} from '../dist/blueprint-preprocess.js';
import {zoomView} from '../dist/workspace-ui.js';
import {generateCGI,renderPrompt,outputSize,validateRenderRequest} from '../backend/cgi-service.mjs';

function image(values,width,height){const data=new Uint8ClampedArray(width*height*4);values.forEach((v,i)=>{data.set([v,v,v,255],i*4);});return {data,width,height};}
const sourceHash='a'.repeat(64);
function body(){const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(1280,16);png.writeUInt32BE(749,20);return {sourceHash,width:1280,height:749,imageDataUrl:`data:image/png;base64,${png.toString('base64')}`,preset:'oak',stylePrompt:'Roble natural.'};}

test('paper cleanup preserves image size and source bytes, and never invents lines on blank paper',()=>{
  const source=image(Array(81).fill(210),9,9),copy=source.data.slice();
  const clean=enhanceBlueprintPixels(source);assert.equal(clean.width,9);assert.equal(clean.height,9);assert.deepEqual(source.data,copy);assert.ok(clean.data.every(v=>v===255));
});
test('cleanup normalizes dark CAD paper without shifting structural strokes',()=>{
  const pixels=Array(81).fill(10);for(let y=0;y<9;y++)pixels[y*9+4]=245;
  const clean=enhanceBlueprintPixels(image(pixels,9,9));assert.equal(clean.backgroundNormalized,true);
  for(let y=0;y<9;y++){assert.ok(clean.data[(y*9+4)*4]<50);assert.equal(clean.data[(y*9)*4],255);}
});
test('zoom keeps the cursor anchor stationary and clamps navigation magnification',()=>{
  const view={zoom:2,panX:30,panY:-10},anchor=[200,100],next=zoomView(view,3,anchor);
  assert.equal((anchor[0]-next.panX)/next.zoom,(anchor[0]-view.panX)/view.zoom);
  assert.equal((anchor[1]-next.panY)/next.zoom,(anchor[1]-view.panY)/view.zoom);
  assert.equal(zoomView(view,20).zoom,5);assert.equal(zoomView(view,.1).zoom,1);
});
test('a generated presentation never claims geometric validation and retains its source identity',()=>{
  const record=createRenderRecord({sourceHash,width:1280,height:749,nativeWidth:1536,nativeHeight:896,kind:'generated',provider:'OpenAI'});
  assert.equal(record.geometryValidated,false);assert.equal(record.sourceHash,sourceHash);assert.equal(record.nativeWidth,1536);
  assert.throws(()=>createRenderRecord({width:1,height:1,kind:'generated'}));
});
test('CGI validates the actual PNG frame and confines output to supported aspect ratios',()=>{
  const input=body();assert.match(validateRenderRequest(input).prompt,/Preserve the complete image framing/);
  assert.equal(outputSize(1280,749),'1536x896');assert.throws(()=>outputSize(1400,64),/proporciones/);
  input.width=100;assert.throws(()=>validateRenderRequest(input),/dimensiones/);
  assert.throws(()=>renderPrompt({stylePrompt:'x'.repeat(2001)}));
});
test('missing OpenAI credentials fail explicitly before any provider request',async()=>{
  let called=false;await assert.rejects(generateCGI(body(),{apiKey:'',fetchImpl:()=>{called=true;}}),error=>error.code==='NOT_CONFIGURED');assert.equal(called,false);
});
test('the CGI edit request sends the clean image to the official endpoint and preserves result provenance',async()=>{
  let request;
  const result=await generateCGI(body(),{apiKey:'test-credential',fetchImpl:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({data:[{b64_json:'iVBORexample'}]})};}});
  assert.equal(request.url,'https://api.openai.com/v1/images/edits');const payload=JSON.parse(request.options.body);
  assert.deepEqual(payload.images,[{image_url:body().imageDataUrl}]);assert.equal(payload.n,1);assert.equal(result.geometryValidated,false);assert.equal(result.sourceHash,sourceHash);
});
test('rate limits and missing provider images leave explicit errors instead of false completion',async()=>{
  await assert.rejects(generateCGI(body(),{apiKey:'test',fetchImpl:async()=>({ok:false,status:429})}),error=>error.status===429&&error.code==='RATE_LIMIT');
  await assert.rejects(generateCGI(body(),{apiKey:'test',fetchImpl:async()=>({ok:true,json:async()=>({data:[]})})}),error=>error.code==='NO_IMAGE');
});
