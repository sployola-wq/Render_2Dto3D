import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {floorZones,floorFinishes,renderPoint,sampleColor,eligiblePresentation,APPEARANCE_PRESETS} from '../dist/appearance-mapping.js';
import {createAppearanceLayer} from '../dist/appearance-3d.js';
const rect=(a,b,c,d)=>({outer:[[a,b],[c,b],[c,d],[a,d]],holes:[]});
const room=()=>({width:100,height:80,wallPolygons:[rect(10,10,90,14),rect(10,66,90,70),rect(10,10,14,70),rect(86,10,90,70)],openings:[]});
const pixels=(width,height,color)=>({width,height,data:Uint8ClampedArray.from(Array.from({length:width*height},()=>[...color,255]).flat())});

test('render sampling uses the same contain frame as Step 2, with invertible alignment offsets',()=>{
  assert.deepEqual(renderPoint([100,100],200,200,100,50),[50,25]);
  assert.deepEqual(renderPoint([0,50],200,200,100,50),[0,0]);
  assert.deepEqual(renderPoint([200,150],200,200,100,50),[100,50]);
  assert.deepEqual(renderPoint([120,80],200,200,100,50,{offsetX:10,offsetY:-10}),[50,25]);
});
test('a render from a different sheet or analysis frame cannot supply appearance',()=>{
  const record={sourceHash:'a'.repeat(64),width:100,height:80,kind:'imported'};
  assert.equal(eligiblePresentation(record,'a'.repeat(64),100,80),true);
  assert.equal(eligiblePresentation(record,'b'.repeat(64),100,80),false);
  assert.equal(eligiblePresentation(record,'a'.repeat(64),80,100),false);
});
test('floor zoning leaves the exterior unpainted and never changes a wall or an opening',()=>{
  const geometry=room(),before=JSON.stringify(geometry),z=floorZones(geometry);
  assert.equal(z.zones.filter(r=>r.interior).length,1);
  assert.equal(z.zones[z.labels[40*z.width+40]].interior,true);
  assert.equal(z.zones[z.labels[0]].interior,false);
  assert.equal(z.labels[11*z.width+20],-2);
  assert.equal(JSON.stringify(geometry),before);
});
test('known door gaps divide floor coverage without closing the actual structural passage',()=>{
  const geometry=room();geometry.wallPolygons[0]=rect(10,10,40,14);geometry.wallPolygons.push(rect(55,10,90,14));
  assert.equal(floorZones(geometry).zones.filter(r=>r.interior).length,0);
  geometry.openings=[{axis:'h',c:12,from:40,to:55,thickness:4,category:'door'}];
  const before=JSON.stringify(geometry);assert.equal(floorZones(geometry).zones.filter(r=>r.interior).length,1);assert.equal(JSON.stringify(geometry),before);
});
test('bathrooms receive ceramic and dry rooms wood without creating furniture or semantic rooms',()=>{
  const geometry=room(),z=floorZones(geometry),objects=[{category:'toilet',bbox:[20,20,30,30]}],before=JSON.stringify(objects);
  const wet=floorFinishes(z,objects,null,geometry,APPEARANCE_PRESETS.oak);
  assert.equal([...wet.values()][0].kind,'tile');
  const dry=floorFinishes(z,[],null,geometry,APPEARANCE_PRESETS.oak);assert.equal([...dry.values()][0].kind,'wood');
  assert.equal(JSON.stringify(objects),before);
});
test('source colors exclude transparent margins, grass and black baked shadows',()=>{
  const points=Array.from({length:16},(_,i)=>[i%4,Math.floor(i/4)]);
  assert.equal(sampleColor(pixels(4,4,[175,125,80]),points,'#ffffff',{warm:true}),'#af7d50');
  for(const color of [[20,20,20],[80,150,60]])assert.equal(sampleColor(pixels(4,4,color),points,'#ffffff'),'#ffffff');
});
// A texture canvas substitute allows real Three.js material/scene lifetime tests in Node.
// GPU appearance is additionally checked in the actual browser.
function canvasFactory(width,height){return {width,height,getContext(){return {fillRect(){},drawImage(){},putImageData(){},save(){},restore(){},translate(){},rotate(){},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};}};}};}
function sceneFixture(){
  const scene=new THREE.Scene(),model=new THREE.Group();scene.add(model);scene.background=new THREE.Color('#abcdef');scene.add(new THREE.HemisphereLight(0xffffff,0x888888,2));
  const wall=new THREE.Mesh(new THREE.BoxGeometry(2,3,.2),new THREE.MeshStandardMaterial({color:'#dddddd'}));wall.userData.wallId='wall-1';wall.position.set(1,1.5,0);model.add(wall);
  const planMesh=new THREE.Mesh(new THREE.PlaneGeometry(10,8),new THREE.MeshStandardMaterial({opacity:.3,transparent:true}));planMesh.rotation.x=-Math.PI/2;model.add(planMesh);
  const item=new THREE.Group();item.userData={id:'bed-1',category:'bed'};item.position.set(1,.02,1);item.rotation.y=.4;const mat=new THREE.MeshStandardMaterial({color:'#b8a17d'});item.add(new THREE.Mesh(new THREE.BoxGeometry(1,.2,2),mat),new THREE.Mesh(new THREE.BoxGeometry(1,.3,2),mat));model.add(item);
  const renderer={toneMappingExposure:1.05,capabilities:{getMaxAnisotropy:()=>4}},camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,100);camera.position.set(10,20,30);
  return {scene,model,planMesh,renderer,camera,pixelCanvas:canvasFactory(100,80)};
}
function structure(model){const entries=[];model.traverse(o=>entries.push({id:o.uuid,parent:o.parent?.uuid,geometry:o.geometry?.uuid,vertices:o.geometry?.attributes.position?.array.slice(),position:o.position.toArray(),rotation:o.rotation.toArray(),scale:o.scale.toArray(),visible:o.visible,userData:structuredClone(o.userData)}));return entries;}
const options=()=>({snapshot:{result:{width:100,height:80,objects:[{id:'bed-1',category:'bed',bbox:[20,20,40,40]}]},imageSha256:'a'.repeat(64),metersPerPixel:.1},architecture:room(),preset:'oak'});
test('ambient styling leaves mesh vertices, topology, transforms, visibility and camera intact and restores shared materials exactly',()=>{
  const ctx=sceneFixture(),before=structure(ctx.model),camera=ctx.camera.toJSON(),background=ctx.scene.background,light=ctx.scene.children.find(o=>o.isLight),materials=new Map();ctx.model.traverse(o=>{if(o.isMesh)materials.set(o,o.material);});
  const adapter=createAppearanceLayer({canvasFactory}),result=adapter.apply(ctx,options());assert.equal(result.rooms,1);assert.equal(result.furniture,1);assert.equal(result.source,'preset');
  assert.deepEqual(structure(ctx.model),before);assert.deepEqual(ctx.camera.toJSON(),camera);assert.equal(adapter.group.parent,ctx.scene);assert.equal(ctx.renderer.toneMappingExposure,.92);
  adapter.restore();for(const [mesh,material]of materials)assert.equal(mesh.material,material);assert.equal(ctx.scene.background,background);assert.equal(light.intensity,2);assert.equal(ctx.renderer.toneMappingExposure,1.05);assert.equal(adapter.group.parent,null);assert.deepEqual(structure(ctx.model),before);
});
test('repeated styling and model rebuilds release old appearance resources without stacking floors',()=>{
  const ctx=sceneFixture(),adapter=createAppearanceLayer({canvasFactory});adapter.apply(ctx,options());const floor=adapter.group.children.find(o=>o.name==='Acabados de piso');let disposed=0;floor.geometry.addEventListener('dispose',()=>disposed++);
  adapter.apply(ctx,options());assert.equal(disposed,1);assert.equal(ctx.scene.children.filter(o=>o.name==='ProdalamAppearance').length,1);assert.equal(adapter.group.children.filter(o=>o.name==='Acabados de piso').length,1);
  const old=ctx.model.children[0];adapter.restore();let oldDisposed=0;old.material.addEventListener('dispose',()=>oldDisposed++);adapter.apply(ctx,options());ctx.scene.remove(ctx.model);const next=sceneFixture();adapter.apply(next,options());assert.equal(oldDisposed,1);assert.equal(adapter.group.parent,next.scene);adapter.restore();
});
test('matching render pixels supply finishes, while stale renders and unusable colors fall back locally',()=>{
  const ctx=sceneFixture(),adapter=createAppearanceLayer({canvasFactory}),opts=options(),image=pixels(100,80,[175,125,80]);
  opts.presentation={record:{sourceHash:'a'.repeat(64),width:100,height:80,kind:'imported'}};opts.imageData=image;
  const result=adapter.apply(ctx,opts);assert.equal(result.source,'presentation');assert.equal(result.palette.wood,'#af7d50');
  opts.presentation.record.sourceHash='b'.repeat(64);const stale=adapter.apply(ctx,opts);assert.equal(stale.source,'preset');assert.equal(stale.palette.wood,APPEARANCE_PRESETS.oak.wood);
  opts.presentation.record.sourceHash='a'.repeat(64);opts.imageData=pixels(100,80,[80,150,60]);assert.equal(adapter.apply(ctx,opts).source,'preset');adapter.restore();
});
test('detailed furniture skins remain separate from detections and restore original shadow settings',()=>{
  const ctx=sceneFixture(),adapter=createAppearanceLayer({canvasFactory}),before=structure(ctx.model),bed=ctx.model.children.find(o=>o.userData.category==='bed'),sourceMesh=bed.children[0];sourceMesh.castShadow=true;
  adapter.apply(ctx,options());assert.equal(sourceMesh.material.opacity,0);assert.equal(sourceMesh.castShadow,false);assert.ok(adapter.group.children.some(o=>o.name==='Acabado bed'&&o.children.length>=6));assert.deepEqual(structure(ctx.model),before);
  adapter.restore();assert.equal(sourceMesh.castShadow,true);assert.equal(sourceMesh.material.opacity,1);
});

test('photo finish resources remain cosmetic and a technical restore releases their native crop textures',()=>{
  const ctx=sceneFixture(),adapter=createAppearanceLayer({canvasFactory}),opts=options(),before=structure(ctx.model),camera=ctx.camera.toJSON();
  opts.presentation={canvas:canvasFactory(1000,800),record:{sourceHash:'a'.repeat(64),width:100,height:80,kind:'linked'}};opts.imageData=pixels(100,80,[180,185,195]);
  const result=adapter.apply(ctx,opts);assert.equal(result.source,'presentation');assert.equal(result.surfaceObjects,1);assert.equal(ctx.renderer.toneMappingExposure,1.02);assert.deepEqual(structure(ctx.model),before);assert.deepEqual(ctx.camera.toJSON(),camera);
  const own=adapter.group.children.find(o=>o.name==='Acabado bed');let released=0;const maps=new Set();own.traverse(o=>{if(o.material?.map)maps.add(o.material.map);});for(const map of maps)map.addEventListener('dispose',()=>released++);
  adapter.restore();assert.equal(released,maps.size);assert.deepEqual(structure(ctx.model),before);assert.equal(ctx.renderer.toneMappingExposure,1.05);
});
