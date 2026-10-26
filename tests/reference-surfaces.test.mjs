import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {REFERENCE_PROJECTS,presentationKey,canRestorePresentation} from '../dist/presentation-projects.js';
import {createRenderRecord} from '../dist/blueprint-preprocess.js';
import {floorZones,eligiblePresentation} from '../dist/appearance-mapping.js';
import {surfacePatch,estimateReferenceRegistration,exteriorReferencePixels,cropReference,textileSample,registrationFromBounds} from '../dist/reference-surfaces.js';
const pixels=(w,h,color)=>({width:w,height:h,data:Uint8ClampedArray.from(Array.from({length:w*h},()=>[...color,255]).flat())});
const rect=(x0,y0,x1,y1)=>({outer:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],holes:[]});
const architecture={width:100,height:80,wallPolygons:[rect(10,10,90,14),rect(10,66,90,70),rect(10,10,14,70),rect(86,10,90,70)],openings:[]};
test('the approved reference is paired only to the two exact supplied plan identities and never claims geometric validation',()=>{
  assert.equal(Object.keys(REFERENCE_PROJECTS).length,2);assert.equal(REFERENCE_PROJECTS['b'.repeat(64)],undefined);
  const hash=Object.keys(REFERENCE_PROJECTS)[0],record=createRenderRecord({sourceHash:hash,width:100,height:80,kind:'linked',nativeWidth:2752,nativeHeight:1536});
  assert.equal(record.geometryValidated,false);assert.equal(eligiblePresentation(record,hash,100,80),true);assert.equal(eligiblePresentation(record,'b'.repeat(64),100,80),false);
});
test('saved designs cannot leak to a different asset or raster page; native blobs survive metadata checks',()=>{
  const identity='a'.repeat(64),blob=new Blob(['design'],{type:'image/png'}),saved={assetIdentity:identity,width:100,height:80,blob};
  assert.equal(canRestorePresentation(saved,identity,100,80),true);assert.equal(canRestorePresentation(saved,'b'.repeat(64),100,80),false);assert.equal(canRestorePresentation(saved,identity,80,100),false);assert.equal(canRestorePresentation({...saved,blob:null},identity,100,80),false);
  assert.notEqual(presentationKey(identity,100,80),presentationKey(identity,80,100));assert.throws(()=>presentationKey('../other',100,80));
});
test('automatic registration uses supported dark neutral walls and ignores dark green foliage and isolated outliers',()=>{
  const image=pixels(200,160,[15,55,12]);
  for(let y=30;y<130;y++)for(let x=20;x<140;x++)if(x<24||x>=136||y<34||y>=126){const i=(y*200+x)*4;image.data.set([45,44,43,255],i);}
  image.data.set([0,0,0,255],0);
  const result=estimateReferenceRegistration(image,{width:100,height:80},{x0:20,x1:80,y0:15,y1:65,width:60,height:50});
  assert.ok(Math.abs(result.zoom-1)<.001);assert.ok(Math.abs(result.offsetX-10)<.001);assert.ok(Math.abs(result.offsetY)<.001);
});
test('floor texture extraction rejects furniture coverage, grass and baked dark shadows without changing geometry',()=>{
  const zoning=floorZones(architecture),id=zoning.zones.find(z=>z.interior).id,before=JSON.stringify(architecture),source=pixels(100,80,[180,138,92]);
  assert.ok(surfacePatch(source,architecture,zoning,id,[],'wood'));
  assert.equal(surfacePatch(source,architecture,zoning,id,[{bbox:[0,0,100,80]}],'wood'),null);
  for(const c of [[45,120,35],[35,35,35]])assert.equal(surfacePatch(pixels(100,80,c),architecture,zoning,id,[],'wood'),null);
  assert.ok(surfacePatch(pixels(100,80,[210,210,215]),architecture,zoning,id,[],'tile'));assert.equal(JSON.stringify(architecture),before);
});
test('reference landscape remains outside every structural wall and interior floor',()=>{
  const z=floorZones(architecture),out=exteriorReferencePixels(pixels(100,80,[85,120,50]),architecture,z);
  assert.ok(out.count>0);for(let i=0;i<z.labels.length;i++)if(z.labels[i]===-2||z.zones[z.labels[i]]?.interior)assert.equal(out.data[i*4+3],0);
});
test('native texture crops preserve source resolution and reject empty or out-of-frame rectangles',()=>{
  let drawn;const native={width:1000,height:800},factory=(width,height)=>({width,height,getContext:()=>({drawImage(...args){drawn=args;}})});
  const crop=cropReference(native,architecture,[20,20,40,30],{},factory,256);assert.equal(crop.width,200);assert.equal(crop.height,100);assert.equal(drawn[0],native);assert.deepEqual(drawn.slice(1,5),[200,200,200,100]);
  assert.equal(cropReference(native,architecture,[-5,0,10,20],{},factory),null);
});

test('approved design pixels and original plan bytes match the explicit manifest, independently of the recognition pipeline',()=>{
  const path=new URL('../dist/assets/presentation/reference-v23.png',import.meta.url),bytes=readFileSync(path);assert.equal(createHash('sha256').update(bytes).digest('hex'),'881b59749fe4043a63095e58c2eae4b2e4f7ca6219987386bb7149b2026efb8d');assert.equal(bytes.readUInt32BE(16),2752);assert.equal(bytes.readUInt32BE(20),1536);
  const plan=readFileSync(new URL('../dist/assets/plano.jpeg',import.meta.url)),hash=createHash('sha256').update(plan).digest('hex');assert.ok(REFERENCE_PROJECTS[hash]);
  const r=registrationFromBounds({width:2752,height:1536},{width:724,height:424},{x0:16,x1:678,y0:32,y1:407,width:662,height:375},REFERENCE_PROJECTS[hash].imageBounds);assert.ok(r.zoom>1&&r.zoom<1.1);assert.ok(Math.abs(r.offsetX)<2&&Math.abs(r.offsetY)<2);
});
test('textile crops reject grass, wood and hard shadows while preserving neutral bedding',()=>{
  const object={bbox:[20,20,40,50]};for(const c of [[45,120,35],[180,130,80],[30,30,30]])assert.equal(textileSample(pixels(100,80,c),architecture,object).usable,false);
  const accepted=textileSample(pixels(100,80,[180,185,195]),architecture,object);assert.equal(accepted.usable,true);assert.equal(accepted.color,'#b4b9c3');
});
