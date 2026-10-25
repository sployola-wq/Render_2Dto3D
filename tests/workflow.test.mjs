import test from 'node:test';
import assert from 'node:assert/strict';
import {distance,polygonMetrics,boundsOf,geometryBounds,pixelToWorld,worldToPixel,dxfPaths,validSupportURL,vectorSVG,isSimplePolygon} from '../dist/technical-geometry.js';

test('measurement calibration uses Euclidean length and squares scale for area',()=>{
  assert.equal(distance([0,0],[3,4],.002),.01);
  const metric=polygonMetrics([[0,0],[100,0],[100,50],[0,50]],.1);
  assert.deepEqual(metric,{area:50,perimeter:30});
  assert.deepEqual(polygonMetrics([[0,50],[100,50],[100,0],[0,0]],.1),metric);
});
test('image/world coordinates round-trip with off-center points and measured scale',()=>{
  for(const p of [[0,0],[1280,749],[314,285]]){const back=worldToPixel(pixelToWorld(p,1280,749,.018),1280,749,.018);assert.ok(distance(p,back)<1e-9);}
});
test('structural bounds include actual thickness and do not use image frame',()=>{
  assert.deepEqual(geometryBounds({walls:[{axis:'h',from:10,to:80,c:50,thickness:10}]}),{x0:10,y0:45,x1:80,y1:55,width:70,height:10});
  assert.equal(geometryBounds({walls:[]}),null);
  assert.throws(()=>boundsOf([[NaN,2]]));
});
test('DXF block transforms, curved segments and skipped entity diagnostics are retained',()=>{
  const doc={header:{$INSUNITS:4},blocks:{A:{position:{x:0,y:0},entities:[{type:'LINE',vertices:[{x:0,y:0},{x:10,y:0}]}]}},entities:[{type:'INSERT',name:'A',position:{x:20,y:30},rotation:90,xScale:2,yScale:2},{type:'ARC',center:{x:0,y:0},radius:5,startAngle:0,endAngle:Math.PI/2},{type:'TEXT',text:'example'}]};
  const result=dxfPaths(doc);assert.ok(distance(result.paths[0].points[1],[20,50])<1e-9);assert.equal(result.units,4);assert.deepEqual(result.unsupported,['TEXT']);assert.ok(result.paths[1].points.length>10);
  assert.throws(()=>dxfPaths({entities:[{type:'SPLINE'}]}),/compatibles/);
});
test('DXF polylines preserve bulges and closed paths in SVG export',()=>{
  const result=dxfPaths({entities:[{type:'LWPOLYLINE',shape:true,vertices:[{x:0,y:0,bulge:1},{x:10,y:0},{x:10,y:10}]}]});
  assert.ok(result.paths[0].points.length>3);assert.equal(result.paths[0].closed,true);
  assert.match(vectorSVG(result,100,100,2),/stroke-width="2"/);assert.match(vectorSVG(result,100,100),/Z/);
});
test('technical surface rejects self crossings and duplicate vertices',()=>{
  assert.equal(isSimplePolygon([[0,0],[100,0],[100,50],[0,50]]),true);
  assert.equal(isSimplePolygon([[0,0],[100,100],[0,100],[100,0]]),false);
  assert.equal(isSimplePolygon([[0,0],[100,0],[100,0],[0,100]]),false);
});
test('configurable developer links reject script and local-file URLs',()=>{
  assert.equal(validSupportURL('javascript:alert(1)'), '');assert.equal(validSupportURL('file:///etc/passwd'),'');assert.equal(validSupportURL('https://example.com/support'),'https://example.com/support');
});

test('native CAD import makes paired contours into a wall band and preserves the empty interior',async()=>{
  const {cadWallGeometry}=await import('../dist/technical-geometry.js');
  const outer={closed:true,layer:'WALLS',points:[[0,0],[100,0],[100,60],[0,60]]};
  const inner={closed:true,layer:'WALLS',points:[[2,2],[98,2],[98,58],[2,58]]};
  const ignored={closed:false,layer:'FURNITURE',points:[[20,20],[30,30]]};
  const geometry=cadWallGeometry([outer,inner,ignored],100,60,2);
  assert.equal(geometry.wallPolygons.length,1);assert.deepEqual(geometry.wallPolygons[0].holes,[inner.points]);assert.equal(geometry.provenance.selectedLayers,'wall-name-filter');
  const isolated=cadWallGeometry([{closed:true,points:outer.points}],100,60,2);
  assert.equal(isolated.wallPolygons.length,4);assert.ok(isolated.wallPolygons.every(p=>polygonMetrics(p.outer).area<300));
});
