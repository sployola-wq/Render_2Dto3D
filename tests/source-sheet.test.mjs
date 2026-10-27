import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sheetSurface,retainDrawingInk,SURFACE_MATERIALS} from '../dist/technical-sheet.js';
import {renderContext,sameRenderContext,ownsGeometry,PRESENTATION_REVISION} from '../dist/project-context.js';
import {canRestorePresentation} from '../dist/presentation-projects.js';
import {analyzeEngineeringDrawing} from '../dist/engineering-drawing.js';
import {extractDrawing} from '../dist/discipline-analysis.js';
import {drawingEvidence} from '../dist/drawing-routing.js';
import {companionProjection} from '../dist/discipline-render.js';
import {renderPrompt} from '../backend/cgi-service.mjs';
import * as THREE from '../dist/vendor/three.module.js';
const hash='a'.repeat(64),otherHash='b'.repeat(64);
const paper=(width=260,height=180)=>({width,height,data:new Uint8ClampedArray(width*height*4).fill(255)});
function region(im,x0,y0,x1,y1){const mask=new Uint8Array(im.width*im.height);for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)mask[y*im.width+x]=1;return {mask,bounds:{x0,y0,x1,y1,width:x1-x0,height:y1-y0}};}
const rgb=(im,x,y)=>[...im.data.subarray((y*im.width+x)*4,(y*im.width+x)*4+3)];
function line(im,a,b,color=[0,0,0]){const steps=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])*2);for(let i=0;i<=steps;i++){const x=Math.round(a[0]+(b[0]-a[0])*i/steps),y=Math.round(a[1]+(b[1]-a[1])*i/steps);if(x>=0&&y>=0&&x<im.width&&y<im.height)im.data.set([...color,255],(y*im.width+x)*4);}}
function ring(im,points){for(let i=0;i<points.length;i++)line(im,points[i],points[(i+1)%points.length]);}

test('the complete technical sheet retains every original black stroke and coloured annotation',()=>{
 const im=paper(),views=[region(im,30,30,80,150),region(im,170,30,180,150)];line(im,[10,10],[240,10]);line(im,[15,20],[15,165],[0,170,195]);line(im,[40,70],[70,70]);
 const result=retainDrawingInk(sheetSurface(im,{domain:'mechanical',views}),im);assert.equal(result.width,im.width);assert.equal(result.height,im.height);
 for(let i=0;i<im.data.length;i+=4)if(im.data[i]===0&&im.data[i+1]===0&&im.data[i+2]===0)assert.deepEqual([...result.data.subarray(i,i+3)],[0,0,0]);
 assert.equal(rgb(result,15,50)[0],0);assert.ok(rgb(result,15,50)[2]>rgb(result,15,50)[1]);assert.ok(rgb(result,55,90)[0]<230);assert.ok(rgb(result,175,90)[0]<230);
});
test('material surfaces move with their own drawing and never retain a previous project silhouette',()=>{
 const im=paper(),left=sheetSurface(im,{views:[region(im,20,30,60,140)]}),right=sheetSurface(im,{views:[region(im,190,30,230,140)]});assert.ok(rgb(left,40,90)[0]<230);assert.ok(rgb(right,40,90)[0]>245);assert.ok(rgb(right,210,90)[0]<230);assert.ok(rgb(left,210,90)[0]>245);
});
test('a blank construction sheet remains blank and glass/roof proposals follow source contours',()=>{
 const blank=paper(),empty=retainDrawingInk(sheetSurface(blank,{domain:'exterior'}),blank);assert.ok(empty.data.every((v,i)=>i%4===3?v===255:v>=249));
 const a=paper();ring(a,[[40,40],[200,40],[200,130],[40,130]]);const painted=retainDrawingInk(sheetSurface(a,{domain:'exterior'}),a);assert.ok(rgb(painted,100,80)[0]<240);assert.ok(rgb(painted,10,80)[0]>245);assert.deepEqual(rgb(painted,40,70),[0,0,0]);
});
test('the selected material changes the finish without changing source positions or the input image',()=>{
 const im=paper(),copy=im.data.slice(),views=[region(im,40,30,210,150)],steel=sheetSurface(im,{material:'steel',views}),brass=sheetSurface(im,{material:'brass',views}),polymer=sheetSurface(im,{material:'polymer',views});assert.notDeepEqual(rgb(steel,100,90),rgb(brass,100,90));assert.ok(rgb(brass,100,90)[0]>rgb(brass,100,90)[2]);assert.ok(SURFACE_MATERIALS.polymer.metalness===0);assert.ok(rgb(polymer,100,90)[0]<rgb(steel,100,90)[0]);assert.deepEqual(im.data,copy);
});
test('repeated corner badges do not classify a construction as mechanical orthographic views',()=>{
 const im=paper(700,460);ring(im,[[100,250],[350,105],[600,250],[350,400]]);ring(im,[[180,220],[350,125],[520,220],[350,315]]);line(im,[180,220],[180,330]);line(im,[520,220],[520,330]);line(im,[350,315],[350,400]);
 ring(im,[[10,20],[90,20],[90,100],[10,100]]);ring(im,[[610,20],[640,20],[640,30],[620,30],[620,90],[640,90],[640,100],[610,100]]);
 const engineering=analyzeEngineeringDrawing(im);assert.equal(engineering.multiView,false);assert.equal(engineering.mechanicalEvidence?.strong,false);assert.equal(drawingEvidence(extractDrawing(im),{engineering}).domain,'exterior');
});
test('asynchronous image results are rejected after a file, domain, frame, revision or selection change',()=>{
 const model={asset:{identity:hash},selection:4,version:12,processedHash:hash},scope=renderContext(model,'mechanical',635,750);assert.ok(sameRenderContext(scope,renderContext(model,'mechanical',635,750)));
 for(const [key,value]of Object.entries({identity:otherHash,selection:5,version:13,processedHash:otherHash,domain:'exterior',width:750,height:635}))assert.equal(sameRenderContext(scope,{...scope,[key]:value}),false,key);
});
test('reusing extracted geometry requires both the exact source identity and its frame',()=>{
 const project={sourceHash:hash,drawing:{width:635,height:750}};assert.ok(ownsGeometry(project,{identity:hash},635,750));assert.equal(ownsGeometry(project,{identity:otherHash},635,750),false);assert.equal(ownsGeometry(project,{identity:hash},750,635),false);
});
test('automatic presentation restoration rejects legacy bundled artwork, different sources and domains',()=>{
 const saved={assetIdentity:hash,width:635,height:750,domain:'mechanical',kind:'generated',renderRevision:PRESENTATION_REVISION,blob:new Blob(['png'])},options={domain:'mechanical',revision:PRESENTATION_REVISION};assert.ok(canRestorePresentation(saved,hash,635,750,options));assert.ok(canRestorePresentation({...saved,kind:'imported',renderRevision:undefined},hash,635,750,options));assert.equal(canRestorePresentation({...saved,renderRevision:undefined},hash,635,750,options),false);assert.equal(canRestorePresentation({...saved,kind:'linked'},hash,635,750,options),false);assert.equal(canRestorePresentation(saved,otherHash,635,750,options),false);assert.equal(canRestorePresentation(saved,hash,635,750,{...options,domain:'exterior'}),false);
});
for(const axis of['x','y'])test('the complementary view projects its own landmarks into their original sheet coordinates: '+axis,()=>{
 const horizontal=axis==='x',b=horizontal?{x0:600,x1:1000,y0:100,y1:200,width:400,height:100}:{x0:600,x1:750,y0:100,y1:500,width:150,height:400},f=horizontal?{x0:100,x1:500,y0:300,y1:450,width:400,height:150}:{x0:100,x1:200,y0:200,y1:600,width:100,height:400},drawing={width:1200,height:800,bounds:b,extrusion:{alignedAxis:axis,companionBounds:f,companionAcrossStart:horizontal?300:100}},project={drawing},result={metersPerPixel:.001},q=companionProjection(project,result),camera=new THREE.OrthographicCamera(-q.width/2,q.width/2,q.height/2,-q.height/2,.001,100),center=new THREE.Vector3(...q.center);camera.up.set(...q.up);camera.position.copy(center).addScaledVector(new THREE.Vector3(...q.direction),10);camera.lookAt(center);camera.updateMatrixWorld();
 const world=horizontal?new THREE.Vector3((680-800)*.001,0,-60*.001):new THREE.Vector3(0,(500-180)*.001,-50*.001),ndc=world.project(camera),pixel=[(ndc.x+1)*drawing.width/2,(1-ndc.y)*drawing.height/2],expected=horizontal?[180,360]:[150,280];assert.ok(Math.abs(pixel[0]-expected[0])<1e-6);assert.ok(Math.abs(pixel[1]-expected[1])<1e-6);
});
test('photorealistic prompts preserve all mechanical views, annotations, source perspective and chosen material',()=>{
 const mechanical=renderPrompt({domain:'mechanical',material:'polymer'}),building=renderPrompt({domain:'exterior'});assert.match(mechanical,/COMPLETE|ALL orthographic/);assert.match(mechanical,/Retain existing dimension lines/);assert.match(mechanical,/polymer/);assert.match(building,/EXISTING projection/);assert.match(building,/Never substitute a generic house/);assert.doesNotMatch(mechanical,/warm oak|parquet/);
});

test('manual face finishes apply only to the selected source face',()=>{
 const im=paper(),part=region(im,40,30,210,150),face={pixels:Int32Array.from([80*im.width+100]),bbox:[99,79,102,82]},drawing={...part,width:im.width,height:im.height,faces:[face]},base=sheetSurface(im,{drawing}),painted=sheetSurface(im,{drawing,faceOverrides:{0:'wood'}});assert.notDeepEqual(rgb(base,100,80),rgb(painted,100,80));assert.deepEqual(rgb(base,110,80),rgb(painted,110,80));
});
test('raster shading smooths scan ripples without changing geometry or end cap normals',async()=>{
 const {rasterSurfaceNormals}=await import('../dist/mechanical-extrusion.js'),im=paper(160,160),mask=new Uint8Array(im.width*im.height),left=[],right=[];
 for(let y=20;y<130;y++){const lo=60+y%2,hi=lo+8;for(let x=lo;x<hi;x++)mask[y*im.width+x]=1;left.push([lo,y]);right.push([hi,y]);}
 const b={x0:60,x1:69,y0:20,y1:130,width:9,height:110},mpp=.001,points=[...left,...right.reverse()].map(([x,y])=>new THREE.Vector2((x-64.5)*mpp,(130-y)*mpp)),g=new THREE.ExtrudeGeometry(new THREE.Shape(points),{depth:.02,bevelEnabled:false}),position=g.attributes.position.array.slice(),normal=g.attributes.normal.array.slice();rasterSurfaceNormals(g,{width:160,height:160,mask,bounds:b},mpp);assert.deepEqual(g.attributes.position.array,position);let checked=0;
 for(let i=0;i<g.attributes.position.count;i++){const y=g.attributes.position.getY(i);if(Math.abs(normal[i*3+2])>.5)assert.equal(g.attributes.normal.getZ(i),normal[i*3+2]);else if(y>.02&&y<.09&&Math.abs(normal[i*3])>.5){assert.ok(Math.abs(g.attributes.normal.getX(i))>.98);checked++;}}
 assert.ok(checked>100);g.dispose();
});

test('facade palettes texture only original faces and preserve every original ink pixel',async()=>{
 const {exteriorFaces}=await import('../dist/exterior-finishes.js'),im=paper(600,420);
 ring(im,[[90,135],[280,25],[510,110],[300,230]]);ring(im,[[90,150],[300,245],[300,380],[90,285]]);ring(im,[[315,245],[510,130],[510,280],[315,390]]);
 for(const [x,y]of[[340,245],[400,210],[460,175]]){ring(im,[[x-4,y-2],[x+26,y-20],[x+26,y+17],[x-4,y+35]]);ring(im,[[x,y],[x+22,y-13],[x+22,y+14],[x,y+27]]);}
 const copy=im.data.slice(),warm=retainDrawingInk(sheetSurface(im,{domain:'exterior',facadeScheme:'warm'}),im),brick=retainDrawingInk(sheetSurface(im,{domain:'exterior',facadeScheme:'brick'}),im),mineral=retainDrawingInk(sheetSurface(im,{domain:'exterior',facadeScheme:'mineral'}),im),faces=exteriorFaces(im);
 assert.ok(faces.some(f=>f.role==='roof'));assert.ok(faces.some(f=>f.role==='glass'));assert.notDeepEqual(rgb(warm,200,230),rgb(brick,200,230));assert.notDeepEqual(rgb(warm,200,230),rgb(mineral,200,230));assert.ok(rgb(warm,200,230)[0]>rgb(warm,200,230)[2]);assert.ok(rgb(warm,180,115)[0]<125);assert.deepEqual(rgb(warm,20,200),[249,250,251]);assert.deepEqual(im.data,copy);
 for(let i=0;i<im.data.length;i+=4)if(im.data[i]===0)assert.equal(warm.data[i]+warm.data[i+1]+warm.data[i+2],0);
});

test('architectural material courses follow the source plane rather than a generic texture rectangle',async()=>{
 const {exteriorPixel}=await import('../dist/exterior-finishes.js'),part={bbox:[0,0,500,400],role:'roof',slope:.5};
 const a=exteriorPixel(part,100,110,10),b=exteriorPixel(part,118,119,10),across=exteriorPixel(part,100,114,10);assert.ok(a.every((v,i)=>Math.abs(v-b[i])<5));assert.notDeepEqual(a,across);
});
