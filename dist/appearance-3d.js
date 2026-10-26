import { surfacePatch, cropReference, objectSurfaceBox, exteriorReferencePixels, textileSample, cleanSurfaceTexture } from './reference-surfaces.js';
import { furnitureVisual, VISUAL_CATEGORIES } from './furniture-visuals.js';
import * as THREE from './vendor/three.module.js';
import { floorZones, addOutlinedExterior, applyFinishRegions, floorFinishes, appearancePalette, objectAppearanceColor, eligiblePresentation } from './appearance-mapping.js';
const defaultCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const tint=(hex,delta)=>'#'+rgb(hex).map(v=>Math.max(0,Math.min(255,Math.round(v+delta))).toString(16).padStart(2,'0')).join('');
const noise=(x,y)=>{const n=Math.sin(x*12.9898+y*78.233)*43758.5453;return n-Math.floor(n);};
/** Owns cloned materials/textures and one cosmetic floor plane. Geometry and
 * transforms of the original scene are never written. Restore is exact. */
export function createAppearanceLayer({canvasFactory=defaultCanvas}={}){
  let context=null,originals=new Map(),shadowStates=new Map(),materials=new Set(),textures=new Set(),floor=null,sceneState=null;
  const group=new THREE.Group();group.name='ProdalamAppearance';group.userData.presentationOnly=true;
  const texture=(canvas)=>{const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,context.renderer?.capabilities?.getMaxAnisotropy?.()??1);textures.add(t);return t;};
  function pattern(kind,color){
    const c=canvasFactory(256,256),ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,256,256);
    if(kind==='wood')for(let y=0;y<256;y+=2){ctx.fillStyle=tint(color,(noise(y,13)-.5)*28);ctx.fillRect(0,y,256,1);}
    if(kind==='fabric')for(let i=0;i<256;i+=3){ctx.fillStyle=tint(color,8);ctx.fillRect(i,0,1,256);ctx.fillStyle=tint(color,-8);ctx.fillRect(0,i,256,1);}
    const t=texture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
  }
  function remember(mesh){if(!originals.has(mesh))originals.set(mesh,mesh.material);}
  function cloneMaterial(source,{color,map,roughness=.75,metalness=0}={}){
    const m=source.clone();materials.add(m);if(color)m.color.set(color);if(map){m.map=map;m.color.set('#ffffff');if(roughness<1){m.bumpMap=map;m.bumpScale=roughness>.9?.004:.008;}}m.roughness=roughness;m.metalness=metalness;m.needsUpdate=true;return m;
  }
  function restore(){
    for(const [mesh,material]of originals)mesh.material=material;for(const [mesh,shadow]of shadowStates)mesh.castShadow=shadow;shadowStates.clear();
    // The viewer disposes only the currently attached clones when rebuilding.
    // Release the detached model's retained originals as well, without touching a live model.
    if(context?.model&&!context.model.parent){const old=new Set([...originals.values()].flatMap(m=>Array.isArray(m)?m:[m]));for(const m of old){m.map?.dispose();m.dispose();}}
    originals.clear();if(sceneState){context.scene.background=sceneState.background;context.renderer.toneMappingExposure=sceneState.exposure;for(const [light,intensity]of sceneState.lights)light.intensity=intensity;}
    group.removeFromParent();group.traverse(child=>child.geometry?.dispose());group.clear();
    for(const m of materials)m.dispose();for(const t of textures)t.dispose();materials.clear();textures.clear();floor=null;context=null;sceneState=null;
  }
  function apply(ctx,{snapshot,architecture,presentation=null,imageData=null,preset='oak',registration={},reference=false,referenceTextures=true,environment=true}={}){
    restore();if(!ctx.model||!ctx.scene||!ctx.renderer||!snapshot?.result||!architecture)return null;
    context=ctx;
    const frame=snapshot.result,valid=eligiblePresentation(presentation?.record,snapshot.imageSha256,frame.width,frame.height),image=valid?imageData:null;
    const referenceCanvas=valid?presentation?.canvas:null,native=referenceTextures?referenceCanvas:null,landscapeSource=environment?referenceCanvas:null;
    const palette=appearancePalette(image,frame,preset,registration),objects=(snapshot.result.objects??[]).filter(o=>o.confidence==null||o.confidence>=.35),objectsById=new Map([...objects,...(snapshot.furnitureReport?.objects??[])].map(o=>[o.id,o]));
    const sourcePixels=ctx.pixelCanvas?.getContext('2d')?.getImageData?.(0,0,ctx.pixelCanvas.width,ctx.pixelCanvas.height);
    const zoning=applyFinishRegions(addOutlinedExterior(floorZones(architecture),sourcePixels,architecture),snapshot.result.finishRegions),finishes=floorFinishes(zoning,objects,image,frame,palette,preset,registration);
    let woodSurface=null;if(native)for(const [id,finish]of finishes){if(finish.kind!=='wood')continue;const selected=surfacePatch(image,frame,zoning,id,objects,'wood',registration);if(selected){woodSurface=cleanSurfaceTexture(cropReference(native,frame,selected.box,registration,canvasFactory,256),'wood');if(woodSurface)break;}}
    const wood=woodSurface?texture(woodSurface):pattern('wood',palette.wood),fabricCache=new Map();
    const cloth=color=>{if(!fabricCache.has(color))fabricCache.set(color,pattern('fabric',color));return fabricCache.get(color);};
    const roleMaterial=(color,roughness=.65,map=null)=>{const m=new THREE.MeshStandardMaterial({color:map?'#ffffff':color,roughness,map});if(map){m.bumpMap=map;m.bumpScale=.005;}materials.add(m);return m;};
    const baseRoles={wood:roleMaterial(palette.wood,.45,wood),linen:roleMaterial('#eeece6',.95,cloth('#eeece6')),throw:roleMaterial('#c6c5bf',.95,cloth('#c6c5bf')),ceramic:roleMaterial('#f1f0ed',.22),water:roleMaterial('#a5b8be',.25),inner:roleMaterial('#cad4d5',.4),metal:roleMaterial(palette.metal,.35),cabinet:roleMaterial(palette.wood,.5,wood)};
    let surfaceObjects=0;
    const decorativeOwners=new Set();ctx.model.traverse(owner=>{
      const object=objectsById.get(owner.userData.id);if(!object||!VISUAL_CATEGORIES.has(owner.userData.category))return;
      const [x0,y0,x1,y1]=object.bbox,w=(object.placement?.widthPixels??x1-x0)*snapshot.metersPerPixel,d=(object.placement?.depthPixels??y1-y0)*snapshot.metersPerPixel;
      const sample=textileSample(image,frame,object,registration),textile=sample.color??'#b9bec4',surface=native&&sample.usable&&['bed','sofa','chair'].includes(object.category)?cropReference(native,frame,objectSurfaceBox(object,.42),registration,canvasFactory,192):null;
      if(surface)surfaceObjects++;
      const roles={...baseRoles,fabric:roleMaterial(textile,.94,surface?texture(surface):cloth(textile))};
      const visual=furnitureVisual(owner.userData.category,w,d,roles);if(!visual)return;owner.updateWorldMatrix(true,false);owner.matrixWorld.decompose(visual.position,visual.quaternion,visual.scale);visual.name='Acabado '+owner.userData.category;visual.userData.presentationOnly=true;group.add(visual);decorativeOwners.add(owner);
    });
    let furniture=0;
    ctx.model.traverse(mesh=>{
      if(!mesh.isMesh)return;
      remember(mesh);
      if(mesh===ctx.planMesh){const blank=canvasFactory(1,1);mesh.material=cloneMaterial(mesh.material,{map:reference?texture(ctx.pixelCanvas):texture(blank),roughness:1});return;}
      let parent=mesh.parent,item=null;while(parent&&parent!==ctx.model){if(parent.userData.category){item=parent;break;}parent=parent.parent;}
      const category=item?.userData.category;
      if(decorativeOwners.has(item)){const invisible=mesh.material.clone();materials.add(invisible);invisible.transparent=true;invisible.opacity=0;invisible.depthWrite=false;shadowStates.set(mesh,mesh.castShadow);mesh.castShadow=false;mesh.material=invisible;return;}
      const sourceColor=objectAppearanceColor(objectsById.get(item?.userData.id),image,frame,palette.fabric,registration);
      const mapMaterial=(source,index)=>{
        if(source.transparent&&source.opacity<.8)return cloneMaterial(source,{roughness:.13});
        if(!category){if(mesh.geometry.type==='ExtrudeGeometry'||mesh.userData.wallId)return cloneMaterial(source,{color:index===0?'#353631':palette.wall,roughness:.82});return cloneMaterial(source,{color:'#e6e4df',roughness:.88});}
        const srgb=source.color?.getHexString()??'ffffff',isWood=['b8a17d','b79a71','c7a873'].includes(srgb),isWhite=['f1eee4','e9e6dc'].includes(srgb);
        if(isWood)return cloneMaterial(source,{map:wood,roughness:.48});
        if(['bed','sofa','chair'].includes(category)&&!isWhite&&srgb!=='738774')return cloneMaterial(source,{map:cloth(sourceColor),roughness:.94});
        if(isWhite)return cloneMaterial(source,{color:['bed'].includes(category)?'#f4f1e9':'#efeeea',roughness:['sink','bathtub','toilet'].includes(category)?.23:.63});
        if(srgb==='738774')return cloneMaterial(source,{color:palette.metal,roughness:.38,metalness:.5});
        if(['sink','bathtub','toilet','stove','washingmachine'].includes(category))return cloneMaterial(source,{color:'#b3c5c8',roughness:.19,metalness:.15});
        return cloneMaterial(source,{color:sourceColor,roughness:.68});
      };
      mesh.material=Array.isArray(mesh.material)?mesh.material.map(mapMaterial):mapMaterial(mesh.material);
    });
    const owners=new Set();ctx.model.traverse(o=>{if(o.userData.id&&o.userData.category&&!['door','window'].includes(o.userData.category))owners.add(o.userData.id);});furniture=owners.size;
    const textureScale=native||landscapeSource?Math.min(2,2048/Math.max(frame.width,frame.height)):1;
    const floorCanvas=canvasFactory(Math.round(frame.width*textureScale),Math.round(frame.height*textureScale)),fc=floorCanvas.getContext('2d');let textureRooms=0;
    for(const [id,finish]of finishes){
      const mask=canvasFactory(zoning.width,zoning.height),mc=mask.getContext('2d'),pixels=mc.createImageData(zoning.width,zoning.height);
      for(let i=0;i<zoning.labels.length;i++)if(zoning.labels[i]===id){pixels.data[i*4]=pixels.data[i*4+1]=pixels.data[i*4+2]=255;pixels.data[i*4+3]=255;}
      mc.putImageData(pixels,0,0);
      const tile=canvasFactory(floorCanvas.width,floorCanvas.height),tc=tile.getContext('2d');tc.drawImage(mask,0,0,tile.width,tile.height);tc.globalCompositeOperation='source-in';tc.fillStyle=finish.color;tc.fillRect(0,0,tile.width,tile.height);tc.globalCompositeOperation='source-atop';
      const selected=native?surfacePatch(image,frame,zoning,id,objects,finish.kind,registration):null;
      const rawPatch=selected?cropReference(native,frame,selected.box,registration,canvasFactory,384):null,patch=rawPatch?cleanSurfaceTexture(rawPatch,finish.kind):null;
      if(patch&&tc.createPattern){const swatch=canvasFactory(Math.max(2,Math.round(selected.frameWidth*textureScale)),Math.max(2,Math.round(selected.frameHeight*textureScale)));swatch.getContext('2d').drawImage(patch,0,0,swatch.width,swatch.height);const repeat=canvasFactory(swatch.width*2,swatch.height*2),rc=repeat.getContext('2d');for(let ry=0;ry<2;ry++)for(let rx=0;rx<2;rx++){rc.save();rc.translate(rx?repeat.width:0,ry?repeat.height:0);rc.scale(rx?-1:1,ry?-1:1);rc.drawImage(swatch,0,0);rc.restore();}tc.fillStyle=tc.createPattern(repeat,'repeat');tc.fillRect(0,0,tile.width,tile.height);fc.drawImage(tile,0,0);textureRooms++;continue;}
      const mpp=snapshot.metersPerPixel/textureScale,woodFloor=finish.kind==='wood',across=Math.max(4,Math.round((woodFloor ? .18 : .65)/mpp)),along=Math.max(10,Math.round(1.2/mpp));
      const vertical=finish.bounds[3]-finish.bounds[1]>finish.bounds[2]-finish.bounds[0];
      tc.save();if(vertical){tc.translate(tile.width/2,tile.height/2);tc.rotate(Math.PI/2);tc.translate(-tile.height/2,-tile.width/2);}
      const a=vertical?tile.height:tile.width,b=vertical?tile.width:tile.height;
      for(let y=0;y<b;y+=across){tc.fillStyle=tint(finish.color,(noise(y,id)-.5)*(woodFloor?24:7));tc.fillRect(0,y,a,across-1);tc.fillStyle=tint(finish.color,-18);tc.fillRect(0,y,a,1);
        if(woodFloor)for(let line=3;line<across;line+=3){tc.fillStyle=tint(finish.color,(noise(y,line)-.5)*18);tc.fillRect(0,y+line,a,1);}
        const stride=woodFloor?along:across;for(let x=(Math.floor(y/across)%2)*stride/2;x<a;x+=stride){tc.fillStyle=tint(finish.color,-22);tc.fillRect(x,y,1,across);}
      }
      tc.restore();fc.drawImage(tile,0,0);
    }
    const fm=new THREE.MeshStandardMaterial({map:texture(floorCanvas),transparent:true,alphaTest:.5,roughness:.67,metalness:.025,side:THREE.DoubleSide});materials.add(fm);
    fm.bumpMap=fm.map;fm.bumpScale=.009;
    floor=new THREE.Mesh(new THREE.PlaneGeometry(frame.width*snapshot.metersPerPixel,frame.height*snapshot.metersPerPixel),fm);floor.rotation.x=-Math.PI/2;floor.position.y=.004;floor.receiveShadow=true;floor.name='Acabados de piso';group.add(floor);
    let exterior=false;if(landscapeSource&&image){const coverage=exteriorReferencePixels(image,frame,zoning,registration);if(coverage.count>zoning.width*zoning.height*.003){
      const mask=canvasFactory(coverage.width,coverage.height),mc=mask.getContext('2d'),pixels=mc.createImageData(coverage.width,coverage.height);pixels.data.set(coverage.data);mc.putImageData(pixels,0,0);
      const landscape=canvasFactory(floorCanvas.width,floorCanvas.height),lc=landscape.getContext('2d'),fit=Math.min(frame.width/landscapeSource.width,frame.height/landscapeSource.height)*(registration.zoom??1)*textureScale;
      lc.drawImage(landscapeSource,(landscape.width-landscapeSource.width*fit)/2+(registration.offsetX??0)/100*landscape.width,(landscape.height-landscapeSource.height*fit)/2+(registration.offsetY??0)/100*landscape.height,landscapeSource.width*fit,landscapeSource.height*fit);lc.globalCompositeOperation='destination-in';lc.drawImage(mask,0,0,landscape.width,landscape.height);
      lc.globalCompositeOperation='destination-over';lc.fillStyle=`rgb(${coverage.groundColor.map(Math.round).join(',')})`;lc.fillRect(0,0,landscape.width,landscape.height);
      pixels.data.fill(0);for(let i=0;i<zoning.labels.length;i++){const id=zoning.labels[i];if(id>=0&&!zoning.zones[id]?.interior)pixels.data.set([255,255,255,255],i*4);}mc.putImageData(pixels,0,0);lc.globalCompositeOperation='destination-in';lc.drawImage(mask,0,0,landscape.width,landscape.height);
      const lm=new THREE.MeshStandardMaterial({map:texture(landscape),transparent:true,alphaTest:.5,roughness:1,side:THREE.DoubleSide});materials.add(lm);const ground=new THREE.Mesh(new THREE.PlaneGeometry(frame.width*snapshot.metersPerPixel,frame.height*snapshot.metersPerPixel),lm);ground.rotation.x=-Math.PI/2;ground.position.y=.002;ground.receiveShadow=true;ground.name='Entorno de referencia';group.add(ground);exterior=true;
    }}ctx.scene.add(group);
    sceneState={background:ctx.scene.background,exposure:ctx.renderer.toneMappingExposure,lights:ctx.scene.children.filter(c=>c.isLight).map(l=>[l,l.intensity])};
    ctx.scene.background=new THREE.Color('#edf0f4');ctx.renderer.toneMappingExposure=native?1.02:.92;for(const [light,intensity]of sceneState.lights)light.intensity=intensity*(light.isHemisphereLight ? .68 : .86);
    return {palette,furniture,rooms:finishes.size,textureRooms,surfaceObjects,exterior,source:valid&&palette.sampled?'presentation':'preset',group};
  }
  return {apply,restore,group};
}
