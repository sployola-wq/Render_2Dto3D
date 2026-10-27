import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {analyzeEngineeringDrawing,drawingFromEngineeringView,engineeringExtrusion,engineeringInk,engineeringCADPaths} from '../dist/engineering-drawing.js';
import {drawingEvidence} from '../dist/drawing-routing.js';
import {extractDrawing} from '../dist/discipline-analysis.js';
import {buildDisciplineModel,modelSTL} from '../dist/discipline-models.js';
import * as THREE from '../dist/vendor/three.module.js';

function sheet({scale=1,offset=0,bow=64,greyHoles=false,hatchBand=false}={}){
  const width=Math.ceil((420+offset)*scale),height=Math.ceil(320*scale),data=new Uint8ClampedArray(width*height*4).fill(255),gray=[92,92,92],cyan=[0,150,175];
  const dot=(x,y,color,r=.7)=>{x=(x+offset)*scale;y*=scale;r*=scale;for(let yy=Math.floor(y-r);yy<=y+r;yy++)for(let xx=Math.floor(x-r);xx<=x+r;xx++)if(xx>=0&&yy>=0&&xx<width&&yy<height&&Math.hypot(xx-x,yy-y)<=r+.3)data.set([...color,255],(yy*width+xx)*4);};
  const line=(a,b,color=gray)=>{const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*scale*2);for(let i=0;i<=n;i++)dot(a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n,color);};
  const ring=(pts,color=gray)=>pts.forEach((p,i)=>line(p,pts[(i+1)%pts.length],color));
  ring([[55,30],[105,30],[105,250],[55,250]]);
  const inner=Array.from({length:111},(_,i)=>{const y=30+i*2;return [225+(y>70&&y<210?bow*Math.sin((y-70)/140*Math.PI):0),y];});
  ring([...inner,...inner.map(([x,y])=>[x+8,y]).reverse()]);
  line([80,23],[80,258],cyan);line([35,30],[35,250],cyan);line([30,30],[53,30],cyan);line([30,250],[53,250],cyan);
  for(const cy of[50,230])ring(Array.from({length:96},(_,i)=>[80+9*Math.cos(i*Math.PI/48),cy+9*Math.sin(i*Math.PI/48)]),greyHoles?gray:cyan);
  if(hatchBand){line([55,144],[105,144]);line([55,156],[105,156]);for(let x=55;x<105;x+=.25)dot(x,150+3*Math.sin(x*.7),gray);}
  return {width,height,data};
}
const params={widthMm:500,depthMm:30,sectionMm:100,wallMm:5,boreMm:0,operation:'extrude',orientation:'horizontal'};
const model=image=>{const analysis=analyzeEngineeringDrawing(image),d=drawingFromEngineeringView(image,analysis);d.extrusion=engineeringExtrusion(image,analysis,d.engineeringView);return {analysis,d,built:buildDisciplineModel({domain:'mechanical',params,drawing:d,profiles:d.profiles})};};

test('separates a curved section, front view and coloured dimensions on an unfamiliar drawing',()=>{
  const image=sheet(),{analysis,d,built}=model(image);
  assert.equal(analysis.multiView,true);assert.equal(analysis.recommendedOperation,'extrude');assert.equal(drawingEvidence(extractDrawing(image),{engineering:analysis}).domain,'mechanical');
  assert.ok(d.bounds.x0>220&&d.bounds.x1<305);assert.ok(d.bounds.height>215);assert.ok(d.profiles[0].outer.some(([x])=>x>280));
  assert.ok(Math.abs(d.extrusion.widthPixels-50)<4);assert.equal(built.group.userData.engineeringExtrusion.holes.length,2);assert.ok(built.size[2]>.25);assert.match(modelSTL(built.group),/facet normal/);built.dispose();
});
for(const variant of[{scale:.5,offset:0,bow:60},{scale:.8,offset:35,bow:44},{scale:1.7,offset:12,bow:85},{scale:1,offset:60,bow:30}])test('chooses the same modelling operation with different paper placement, scale and curvature '+JSON.stringify(variant),()=>{
  const image=sheet(variant),a=analyzeEngineeringDrawing(image);assert.equal(a.multiView,true);assert.equal(a.recommendedOperation,'extrude');const d=drawingFromEngineeringView(image,a);assert.ok(d.bounds.x0>(220+variant.offset)*variant.scale);assert.ok(d.bounds.height>210*variant.scale);
});
test('proposed holes are actual openings in the 3D mesh, with solid material beside them',()=>{
  const {d,built}=model(sheet()),e=built.group.userData.engineeringExtrusion,mpp=built.metersPerPixel,b=d.bounds,mid=(b.x0+b.x1)/2;
  assert.equal(e.holes.length,2);built.group.updateMatrixWorld(true);
  const ray=(zPixels,y)=>new THREE.Raycaster(new THREE.Vector3((b.x0-mid-20)*mpp,(b.y1-y)*mpp,-zPixels*mpp),new THREE.Vector3(1,0,0)).intersectObject(built.group,true);
  for(const h of e.holes){assert.equal(ray(h.zPixels,h.y).length,0);assert.ok(ray(h.zPixels+h.radiusPixels+4,h.y).length>0);}built.dispose();
});
test('selecting another view does not reuse the previous view or its inferred depth',()=>{
  const image=sheet(),a=analyzeEngineeringDrawing(image),side=drawingFromEngineeringView(image,a),front=drawingFromEngineeringView(image,a,a.companionId);
  assert.notDeepEqual(front.bounds,side.bounds);assert.equal(engineeringExtrusion(image,a,front.engineeringView),null);assert.notDeepEqual(analyzeEngineeringDrawing(sheet({bow:30})).views.map(v=>v.bounds),a.views.map(v=>v.bounds));
});
test('blank or open strokes do not become invented closed solids',()=>{
  const image={width:200,height:200,data:new Uint8ClampedArray(200*200*4).fill(255)};for(let x=20;x<180;x++)image.data.set([0,0,0,255],(100*200+x)*4);
  const a=analyzeEngineeringDrawing(image);assert.equal(a.views.length,0);assert.throws(()=>drawingFromEngineeringView(image,a),/cerrada/);
});
test('legacy mechanical section and facade keep their original routing with the new preflight',()=>{
  for(const [name,domain]of[['mechanical','mechanical'],['facade','exterior']]){const b=readFileSync(new URL('./fixtures/'+name+'.rgba.z',import.meta.url)),im={width:b.readUInt32LE(0),height:b.readUInt32LE(4),data:inflateSync(b.subarray(8))};assert.equal(drawingEvidence(extractDrawing(im),{engineering:analyzeEngineeringDrawing(im)}).domain,domain);}
});

test('monochrome circles are recognised alongside coloured centre lines',()=>{
  const {built}=model(sheet({greyHoles:true}));assert.equal(built.group.userData.engineeringExtrusion.holes.length,2);built.dispose();
});
test('predominantly coloured CAD geometry has an automatic all-colour fallback',()=>{
  const image=sheet();for(let k=0;k<image.data.length;k+=4)if(image.data[k]===92)image.data.set([20,120,180,255],k);
  const a=analyzeEngineeringDrawing(image);assert.equal(a.multiView,true);assert.equal(a.channel,'all');assert.equal(a.recommendedOperation,'extrude');
});
test('contour threshold affects faint geometry and rejects invalid frames',()=>{
  const image=sheet();for(let k=0;k<image.data.length;k+=4)if(image.data[k]===92)image.data.set([235,235,235,255],k);
  assert.ok(engineeringInk(image,{threshold:248}).ink.reduce((a,b)=>a+b)>engineeringInk(image,{threshold:200}).ink.reduce((a,b)=>a+b));
  assert.throws(()=>engineeringInk({width:100000,height:100000,data:[]}));
});
test('depth can be set manually without retaining the inferred width or transverse holes',()=>{
  const image=sheet(),a=analyzeEngineeringDrawing(image),d=drawingFromEngineeringView(image,a),built=buildDisciplineModel({domain:'mechanical',params,drawing:d,profiles:d.profiles});
  assert.ok(Math.abs(built.size[2]-.03)<1e-6);assert.equal(built.group.userData.engineeringExtrusion,undefined);built.dispose();
});

test('automatic DXF selection excludes annotation layers and explicit layer selection remains available',()=>{
  const paths=[{closed:true,layer:'PIEZA'},{closed:true,layer:'A-COTAS'},{closed:true,layer:'TEXT'},{closed:false,layer:'CENTER'}];
  assert.deepEqual(engineeringCADPaths(paths),[paths[0]]);assert.deepEqual(engineeringCADPaths(paths,'A-COTAS'),[paths[1]]);assert.deepEqual(engineeringCADPaths([paths[1]]),[paths[1]]);
});

test('horizontal orthographic views generate the rotated section and real transverse holes',()=>{
  const original=sheet(),image={width:original.height,height:original.width,data:new Uint8ClampedArray(original.data.length)};
  for(let y=0;y<original.height;y++)for(let x=0;x<original.width;x++){const target=(x*image.width+original.height-1-y)*4;image.data.set(original.data.subarray((y*original.width+x)*4,(y*original.width+x)*4+4),target);}
  const {analysis,d,built}=model(image),e=built.group.userData.engineeringExtrusion,mpp=built.metersPerPixel,b=d.bounds;
  assert.equal(analysis.multiView,true);assert.equal(analysis.alignedAxis,'x');assert.equal(e.holes.length,2);built.group.updateMatrixWorld(true);
  const ray=(zPixels,x)=>new THREE.Raycaster(new THREE.Vector3((x-(b.x0+b.x1)/2)*mpp,(b.height+20)*mpp,-zPixels*mpp),new THREE.Vector3(0,-1,0)).intersectObject(built.group,true);
  for(const h of e.holes){assert.equal(ray(h.zPixels,h.x).length,0);assert.ok(ray(h.zPixels+h.radiusPixels+4,h.x).length>0);}built.dispose();
});

test('choosing the front view retains observed circular holes without changing the cached source profile',()=>{
  const image=sheet(),a=analyzeEngineeringDrawing(image),original=a.views.find(v=>v.id===a.companionId).profile.holes.length,front=drawingFromEngineeringView(image,a,a.companionId,{holes:true});assert.equal(front.proposedHoles.length,2);assert.equal(front.profiles[0].holes.length,original+2);assert.equal(a.views.find(v=>v.id===a.companionId).profile.holes.length,original);assert.equal(drawingFromEngineeringView(image,a,a.companionId).proposedHoles.length,0);
});

test('small hatch and weld marks are not promoted to additional circular holes',()=>{
  const a=analyzeEngineeringDrawing(sheet({hatchBand:true}));assert.equal(a.views.find(v=>v.id===a.companionId).circles.length,2);
});

test('raster curve smoothing is optional, bounded and leaves the observed mask and source profile intact',()=>{
  const image=sheet(),a=analyzeEngineeringDrawing(image),source=a.views.find(v=>v.id===a.selectedId),raw=structuredClone(source.profile),treated=drawingFromEngineeringView(image,a),original=drawingFromEngineeringView(image,a,undefined,{smooth:false});
  assert.equal(treated.profiles[0].contourTreatment,'smoothed-image');assert.equal(treated.profiles[0].maxBoundaryAdjustmentPixels,1.25);assert.deepEqual(source.profile,raw);assert.deepEqual(original.profiles[0],raw);assert.strictEqual(treated.mask,source.mask);
});

function grayCopy(image){const im={...image,data:image.data.slice()};for(let i=0;i<im.data.length;i+=4){const g=Math.round(.299*im.data[i]+.587*im.data[i+1]+.114*im.data[i+2]);im.data[i]=im.data[i+1]=im.data[i+2]=g;}return im;}
for(const bow of[40,64,85])test('monochrome dimensions do not enlarge the companion plate or fill a bent section: '+bow,()=>{
 const im=grayCopy(sheet({bow}));
 // A closed dimension panel is much larger than the thin material strip.
 for(let y=30;y<=250;y++)im.data.set([90,90,90,255],(y*im.width+210)*4);
 for(const y of[30,250])for(let x=210;x<=225;x++)im.data.set([90,90,90,255],(y*im.width+x)*4);
 const a=analyzeEngineeringDrawing(im),d=drawingFromEngineeringView(im,a),e=engineeringExtrusion(im,a,d.engineeringView);
 assert.equal(a.multiView,true);assert.equal(a.mechanicalEvidence.dimensionSeparated,true);assert.ok(d.bounds.x0>220);assert.ok(d.mask.reduce((s,n)=>s+n,0)/(d.bounds.width*d.bounds.height)<.28);assert.ok(Math.abs(e.widthPixels-50)<5);assert.equal(e.holes.length,2);
});

test('display grayscale, paper cleanup and inversion cannot change the geometry extraction frame',async()=>{
 const {geometrySource}=await import('../dist/source-analysis.js'),original=sheet(),baseline=analyzeEngineeringDrawing(original),canvas=im=>({width:im.width,height:im.height,getContext:()=>({getImageData:()=>im})});
 const filtered=grayCopy(original),inverted={...filtered,data:Uint8ClampedArray.from(filtered.data,(v,i)=>i%4===3?v:255-v)};
 for(const im of[filtered,inverted]){const input={canvas:canvas(im),analysisCanvas:canvas(original)},a=analyzeEngineeringDrawing(geometrySource(input).getContext('2d').getImageData());assert.deepEqual(a.views.map(v=>v.bounds),baseline.views.map(v=>v.bounds));assert.equal(engineeringExtrusion(original,a,a.selectedId).holes.length,2);}
 assert.throws(()=>geometrySource({canvas:canvas(filtered),analysisCanvas:{width:1,height:2}}),/marco/);
});
