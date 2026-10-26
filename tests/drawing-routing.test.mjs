import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {extractDrawing} from '../dist/discipline-analysis.js';
import {drawingEvidence,restoreRoutingMode,resolveDrawingRoute,assertInteriorRoute,hasInteriorEvidence} from '../dist/drawing-routing.js';
import {alignedProjection} from '../dist/discipline-render.js';
import {buildDisciplineModel} from '../dist/discipline-models.js';
import * as THREE from '../dist/vendor/three.module.js';
const raster=name=>{const b=readFileSync(new URL('./fixtures/'+name+'.rgba.z',import.meta.url));return {width:b.readUInt32LE(0),height:b.readUInt32LE(4),data:inflateSync(b.subarray(8))};};
test('an ordinary mechanical upload is routed to mechanics before residential inference',()=>{const d=extractDrawing(raster('mechanical')),e=drawingEvidence(d);assert.equal(resolveDrawingRoute('auto',e),'mechanical');assert.equal(e.orientation,'horizontal');assert.throws(()=>assertInteriorRoute({mode:'auto',evidence:e}),/especializado/);assert.throws(()=>assertInteriorRoute({mode:'interior',evidence:e}),/ingeniería mecánica/);});
test('an ordinary facade upload resolves to the exterior workflow without an example button',()=>{const e=drawingEvidence(extractDrawing(raster('facade')));assert.equal(resolveDrawingRoute('auto',e),'exterior');assert.throws(()=>assertInteriorRoute({mode:'interior',evidence:e}),/fachada exterior/);});
test('legacy interior defaults cannot force a mechanical file through the residential pipeline',()=>{assert.equal(restoreRoutingMode({schema:2,domain:'interior'}),'auto');assert.equal(restoreRoutingMode({schema:1,domain:'interior'}),'auto');assert.equal(restoreRoutingMode({schema:3,domain:'interior',mode:'auto'}),'auto');assert.equal(restoreRoutingMode({schema:3,domain:'interior',mode:'interior'}),'interior');assert.equal(restoreRoutingMode({schema:2,domain:'mechanical'}),'mechanical');});
test('weak residential predictions cannot produce a room model even after an unconfirmed manual selection',()=>{const facadeFalsePositives={result:{objects:Array.from({length:5},()=>({category:'table',confidence:.8}))}},mechanicalFalsePositives={result:{objects:[{category:'chair',confidence:.8},{category:'sofa',confidence:.6}]}};for(const snapshot of[facadeFalsePositives,mechanicalFalsePositives]){assert.equal(hasInteriorEvidence(snapshot),false);assert.throws(()=>assertInteriorRoute({mode:'auto',evidence:{domain:'interior'},snapshot}),/evidencia suficiente/);assert.throws(()=>assertInteriorRoute({mode:'interior',evidence:{domain:'interior'},snapshot}),/evidencia suficiente/);}});
test('a genuine residential prediction keeps the original pipeline and explicit overrides remain possible',()=>{const snapshot={result:{objects:[...Array.from({length:4},()=>({category:'door',confidence:.8})),{category:'bed',confidence:.9},{category:'sink',confidence:.7}]}};assert.equal(assertInteriorRoute({mode:'auto',evidence:{domain:'interior'},snapshot}),true);assert.equal(assertInteriorRoute({mode:'interior',evidence:{domain:'mechanical'},forceInterior:true}),true);});
test('the mechanical preview preserves the complete source frame and projects the actual shaft axis onto the drawing axis',()=>{const d=extractDrawing(raster('mechanical')),project={domain:'mechanical',sourceHash:'f'.repeat(64),drawing:d,profiles:d.profiles,axis:(d.bounds.y0+d.bounds.y1)/2,params:{widthMm:500,depthMm:30,sectionMm:100,wallMm:5,boreMm:0,operation:'revolve',orientation:'horizontal'}},result=buildDisciplineModel(project),p=alignedProjection(project,result),worldAxisY=result.size[1]/2,projectedY=d.height/2-(worldAxisY-p.center[1])/result.metersPerPixel;assert.ok(Math.abs(projectedY-project.axis)<1e-8);assert.equal(p.width,d.width*result.metersPerPixel);assert.equal(p.height,d.height*result.metersPerPixel);result.dispose();});

test('structural CAD layers route ordinary DXF uploads to members instead of rooms',()=>{const d=extractDrawing(raster('mechanical')),e=drawingEvidence(d,{asset:{kind:'dxf',mappedPaths:[{layer:'S_ESTRUCTURA'},{layer:'S_ESTRUCTURA'},{layer:'COTAS'}]}});assert.equal(resolveDrawingRoute('auto',e),'structure');assert.equal(e.preferredLayer,'S_ESTRUCTURA');assert.throws(()=>assertInteriorRoute({mode:'auto',evidence:e}),/especializado/);assert.equal(drawingEvidence(d,{asset:{kind:'dxf',mappedPaths:[{layer:'COTAS'},{layer:'COTAS'}]}}).domain,'mechanical');});

test('offset sections preserve source landmarks in the frontal camera in both shaft orientations',()=>{
  const profile={outer:[[40,20],[150,20],[150,50],[40,50]],holes:[]};
  for(const orientation of ['horizontal','vertical']){
    const horizontal=orientation==='horizontal',axis=horizontal?70:180,drawing={width:260,height:210,bounds:{x0:10,x1:230,y0:5,y1:190,width:220,height:185}},project={domain:'mechanical',drawing,axis,section:{profiles:[profile],balls:[],voids:[],axis,core:'user-traced',assumptions:[]},params:{widthMm:500,depthMm:30,sectionMm:100,wallMm:5,boreMm:0,operation:'revolve',representation:'section',orientation}},result=buildDisciplineModel(project),p=alignedProjection(project,result),camera=new THREE.OrthographicCamera(-p.width/2,p.width/2,p.height/2,-p.height/2,.001,100);
    camera.position.set(p.center[0],p.center[1],10);camera.lookAt(...p.center);camera.updateMatrixWorld();
    const cap=result.group.children.filter(o=>o.userData.sectionFace)[horizontal?1:0],vertices=cap.geometry.attributes.position;result.group.updateMatrixWorld(true);
    for(let i=0;i<vertices.count;i++){
      const projected=new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(cap.matrixWorld).project(camera),x=(projected.x+1)*drawing.width/2,y=(1-projected.y)*drawing.height/2;
      assert.ok(profile.outer.some(([sx,sy])=>Math.abs(sx-x)<1e-4&&Math.abs(sy-y)<1e-4));
    }
    assert.ok(vertices.count>0);result.dispose();
  }
});
