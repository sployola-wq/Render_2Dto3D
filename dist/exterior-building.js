import {addPitchedExteriorRoof} from './exterior-roof.js';
import * as THREE from './vendor/three.module.js';
import {proposeExteriorLayout} from './exterior-layout.js';
import {studioTexture} from './studio-materials.js';
/** Build independent walls, reveals, glazing, roofs and designed return elevations.
 * No photograph or source drawing is projected onto these meshes. */
export function addExteriorBuilding(project,group,mpp,{own,textures,atlas,palette={}}){
  const plan=proposeExteriorLayout(project.drawing,project.params,mpp,project.architectureEvidence);if(plan.width<2||plan.depth<2)throw new Error('La propuesta arquitectónica necesita al menos 2 m de ancho y profundidad. Usa Alzado técnico para piezas de menor escala.');
  const tint=(target,base)=>{const a=new THREE.Color(target),b=new THREE.Color(base);return new THREE.Color().setRGB(Math.min(1.8,Math.max(.35,a.r/b.r)),Math.min(1.8,Math.max(.35,a.g/b.g)),Math.min(1.8,Math.max(.35,a.b/b.b)));};
  const tex=(key,repeat=1)=>studioTexture(atlas?.[key],textures,{repeat}),plaster=tex('plaster'),woodMap=tex('wood'),stone=own(new THREE.MeshStandardMaterial({color:'#d6d3cb',roughness:.82})),wall=own(new THREE.MeshStandardMaterial({color:plaster?tint(palette.wall??'#e5ddd0','#e5ddd0'):palette.wall??'#e3dacb',map:plaster,bumpMap:plaster,bumpScale:.001,roughness:.88})),timber=own(new THREE.MeshStandardMaterial({color:woodMap?tint(palette.wood??'#b17c48','#b17c48'):palette.wood??'#a8764c',map:woodMap,bumpMap:woodMap,bumpScale:.002,roughness:.52})),metal=own(new THREE.MeshStandardMaterial({color:palette.metal??'#353e43',metalness:.7,roughness:.26})),glass=own(new THREE.MeshPhysicalMaterial({color:'#a5c1cb',metalness:.08,roughness:.08,transparent:true,opacity:.48,clearcoat:1,clearcoatRoughness:.06,side:THREE.FrontSide,depthWrite:false})),room=own(new THREE.MeshStandardMaterial({color:'#c9bba7',roughness:.85,emissive:'#9c7043',emissiveIntensity:.15})),cloth=own(new THREE.MeshStandardMaterial({color:'#e8e1d4',roughness:1,side:THREE.DoubleSide})),lamp=own(new THREE.MeshStandardMaterial({color:'#ffdfae',emissive:'#ffc477',emissiveIntensity:2,roughness:.5}));
  if(woodMap){woodMap.repeat.set(1,.17);woodMap.offset.y=.02;}
  let parts=0;const tag=(mesh,kind,proposed=false)=>{mesh.name=kind;mesh.userData.architecture={kind,proposed};mesh.castShadow=kind!=='recessed-glazing'&&kind!=='balcony-glass';mesh.receiveShadow=true;parts++;return mesh;};
  const solidBox=(w,h,d)=>{const r=Math.min(.012,w*.10,h*.10,d*.10);if(r<.002)return new THREE.BoxGeometry(w,h,d);const shape=new THREE.Shape([new THREE.Vector2(-w/2+r,-h/2+r),new THREE.Vector2(w/2-r,-h/2+r),new THREE.Vector2(w/2-r,h/2-r),new THREE.Vector2(-w/2+r,h/2-r)]),g=new THREE.ExtrudeGeometry(shape,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:2,steps:1});g.translate(0,0,-d/2+r);return g;};
  const box=(parent,w,h,d,x,y,z,mat,kind,proposed=false)=>{const mesh=tag(new THREE.Mesh(solidBox(Math.max(w,.002),Math.max(h,.002),Math.max(d,.002)),mat),kind,proposed);mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
  const W=plan.width,D=plan.depth,T=.22,roof=own(new THREE.MeshStandardMaterial({color:palette.roof??'#414e56',roughness:.76}));
  function face(level,side,opens){
    const front=side==='front',back=side==='back',right=side==='right',length=front||back?level.x1-level.x0:level.zFront-level.zBack,height=level.y1-level.y0,originU=front||back?(level.x0+level.x1)/2:(level.zFront+level.zBack)/2,orientation=back||right?-1:1,parent=new THREE.Group();
    parent.position.set(front||back?originU:right?level.x1:level.x0,level.y0,front?level.zFront:back?level.zBack:originU);parent.rotation.y=front?0:back?Math.PI:right?Math.PI/2:-Math.PI/2;group.add(parent);
    const holes=opens.map(o=>({...o,uLocal:(o.u-originU)*orientation,yLocal:o.y0-level.y0})).filter(o=>o.width<length-.24&&o.height<height-.1&&Math.abs(o.uLocal)+o.width/2<length/2-.1);
    const shape=new THREE.Shape([new THREE.Vector2(-length/2,0),new THREE.Vector2(length/2,0),new THREE.Vector2(length/2,height),new THREE.Vector2(-length/2,height)]);
    for(const o of holes){const p=new THREE.Path();p.moveTo(o.uLocal-o.width/2,o.yLocal);p.lineTo(o.uLocal-o.width/2,o.yLocal+o.height);p.lineTo(o.uLocal+o.width/2,o.yLocal+o.height);p.lineTo(o.uLocal+o.width/2,o.yLocal);p.closePath();shape.holes.push(p);}
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:T,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:2});geometry.translate(0,0,-T);const shell=tag(new THREE.Mesh(geometry,wall),'wall-'+side,side!=='front');shell.userData.wallOpenings=holes.length;parent.add(shell);
    const accent=front?level.index>0||holes.some(o=>!o.door):back&&level.index===0;
    if(accent){const focus=[...holes].sort((a,b)=>b.uLocal-a.uLocal)[0],a=focus?Math.max(-length/2+.15,focus.uLocal-focus.width/2-.28):-length*.2,z=focus?Math.min(length/2-.15,focus.uLocal+focus.width/2+.35):length*.2;
      for(let y=.13;y<height-.12;y+=.16){let spans=[[a,z]];for(const o of holes)if(y+.15>o.yLocal&&y<o.yLocal+o.height){const lo=o.uLocal-o.width/2-.025,hi=o.uLocal+o.width/2+.025;spans=spans.flatMap(([x0,x1])=>hi<=x0||lo>=x1?[[x0,x1]]:[[x0,Math.max(x0,lo)],[Math.min(x1,hi),x1]].filter(q=>q[1]-q[0]>.015));}for(const[x0,x1]of spans)box(parent,x1-x0,.148,.028,(x0+x1)/2,y+.074,.015,timber,'cedar-board',side!=='front');}
    }
    for(const o of holes){const x=o.uLocal,y=o.yLocal,w=o.width,h=o.height,f=.055,z=-.055;
      box(parent,w+.12,.055,.24,x,y-.025,.035,stone,'window-sill',o.inferred);
      for(const k of[-1,1]){box(parent,f,h+.11,.14,x+k*w/2,y+h/2,z,metal,'window-jamb',o.inferred);box(parent,w+.10,f,.14,x,y+(k>0?h:0),z,metal,'window-head',o.inferred);}
      box(parent,w-f,h-f,.012,x,y+h/2,-.11,glass,'recessed-glazing',o.inferred);
      for(let c=1;c<o.cols;c++)box(parent,.035,h,.10,x-w/2+w*c/o.cols,y+h/2,-.045,metal,'window-mullion',o.inferred);
      for(let r=1;r<o.rows;r++)box(parent,w,.035,.10,x,y+h*r/o.rows,-.045,metal,'window-transom',o.inferred);
      box(parent,w+.16,h+.16,.04,x,y+h/2,-.85,room,'interior-backdrop',true);box(parent,w+.12,.05,.72,x,y-.03,-.48,timber,'interior-sill-floor',true);
      for(const k of[-1,1]){const cw=w*.23,cg=new THREE.PlaneGeometry(cw,h*.95,18,1),p=cg.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(p.getX(i)/cw*Math.PI*12)*.025);cg.computeVertexNormals();const curtain=tag(new THREE.Mesh(cg,cloth),'folded-curtain',true);curtain.position.set(x+k*(w/2-cw/2-.04),y+h*.49,-.26);parent.add(curtain);}
    }
  }
  box(group,W+.32,.16,D+.5,0,.08,-D/2+.08,stone,'foundation');
  for(const level of plan.levels){for(const side of['front','back','left','right'])face(level,side,plan.openings.filter(o=>o.level===level.index&&o.side===side));
    const lw=level.x1-level.x0,ld=level.zFront-level.zBack;if(plan.roof.kind!=='hipped'||level.index<plan.levels.length-1)box(group,lw+.42,.20,ld+.4,(level.x0+level.x1)/2,level.y1+.07,(level.zFront+level.zBack)/2,level.index===plan.levels.length-1?roof:stone,'projecting-roof-slab');
    box(group,lw,.12,ld,(level.x0+level.x1)/2,level.y0,(level.zFront+level.zBack)/2,stone,'storey-floor');
    if(level.index===plan.levels.length-1&&plan.roof.kind!=='hipped'){for(const z of[level.zFront+.12,level.zBack-.12])box(group,lw+.35,.20,.10,(level.x0+level.x1)/2,level.y1+.24,z,wall,'roof-coping');}
  }
  if(plan.roof.kind==='hipped')parts+=addPitchedExteriorRoof(group,plan,{own,roofMaterial:roof,wallMaterial:wall,metalMaterial:metal,glassMaterial:glass});
  const first=plan.levels[0],canopyY=first.y1+.05,canopyDepth=plan.porch+.42;
  box(group,W+.3,.22,canopyDepth,0,canopyY,first.zFront+canopyDepth/2-.12,stone,'entrance-canopy');
  for(let z=first.zFront+.08;z<.16;z+=.16)box(group,W-.12,.035,.148,0,canopyY-.13,z,timber,'timber-soffit');
  if(plan.roof.kind==='hipped'){const y=first.y1+.16;for(const x of[-W/2+.22,-W/6,W/6,W/2-.22])box(group,.19,1.06,.19,x,y+.53,.12,stone,'front-balcony-post',true);for(const height of[.16,.65,1.06])box(group,W-.22,.08,.12,0,y+height,.12,stone,'front-balcony-rail',true);for(const x of[-W/2+.22,W/2-.22])for(const height of[.16,.65,1.06])box(group,.12,.08,-first.zFront+.12,x,y+height,(first.zFront+.12)/2,stone,'front-balcony-return',true);}
  for(const x of[-W/2+.26,W*.19])box(group,.14,first.y1,.14,x,first.y1/2,.04,metal,'porch-column');
  for(let x=-W/2+.7;x<W/2-.3;x+=Math.max(1.8,W/4)){const light=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.018,12),lamp);light.position.set(x,canopyY-.16,-plan.porch*.45);light.userData.architecture={kind:'downlight',proposed:true};group.add(light);parts++;}
  // A designed rear deck/pergola completes the unseen side as requested.
  const deckWidth=W*.56,deckDepth=1.8,deckZ=-D-deckDepth/2+.06;
  box(group,deckWidth,.14,deckDepth,-W*.14,.11,deckZ,stone,'rear-terrace',true);
  for(let z=-D+.1;z>-D-deckDepth;z-=.14)box(group,deckWidth-.08,.035,.128,-W*.14,.2,z,timber,'rear-deck-board',true);
  const pergolaY=first.y0+plan.floorHeight*.87;for(const x of[-W*.14-deckWidth/2+.10,-W*.14+deckWidth/2-.10])box(group,.09,pergolaY,.09,x,pergolaY/2,-D-deckDepth+.18,metal,'rear-pergola-post',true);
  for(const z of[-D+.04,-D-deckDepth+.18])box(group,deckWidth,.13,.10,-W*.14,pergolaY-.065,z,timber,'rear-pergola-support-beam',true);
  for(let x=-W*.14-deckWidth/2;x<=-W*.14+deckWidth/2;x+=.4)box(group,.075,.14,deckDepth+.16,x,pergolaY,-D-deckDepth/2+.04,timber,'rear-pergola-rafter',true);
  if(plan.levels.length>1&&plan.roof.kind!=='hipped'){const upper=plan.levels[1],span=upper.x1-upper.x0,balconyZ=(upper.zBack-D)/2;box(group,span,.1,upper.zBack+D, (upper.x0+upper.x1)/2,upper.y0-.05,balconyZ,stone,'rear-balcony',true);
    box(group,span,.045,.045,(upper.x0+upper.x1)/2,upper.y0+1.02,-D+.05,metal,'balcony-toprail',true);box(group,span-.1,.86,.012,(upper.x0+upper.x1)/2,upper.y0+.53,-D+.05,glass,'balcony-glass',true);for(const x of[upper.x0+.04,upper.x1-.04]){box(group,.045,1.02,.045,x,upper.y0+.51,-D+.05,metal,'balcony-post',true);box(group,.045,.045,upper.zBack+D,x,upper.y0+1.02,balconyZ,metal,'balcony-return-rail',true);box(group,.012,.86,upper.zBack+D-.10,x,upper.y0+.53,balconyZ,glass,'balcony-glass',true);}
  }

  const soil=own(new THREE.MeshStandardMaterial({color:'#42392c',roughness:1})),foliage=own(new THREE.MeshStandardMaterial({color:'#58744c',roughness:.85,side:THREE.DoubleSide}));
  let seed=17429;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const leafShape=new THREE.Shape();leafShape.moveTo(0,-.045);leafShape.quadraticCurveTo(.024,0,0,.045);leafShape.quadraticCurveTo(-.024,0,0,-.045);const leafGeometry=new THREE.ShapeGeometry(leafShape,3);
  for(const[x,z]of[[-W/2+.62,-.32],[W/2-.62,-.32],[-W*.14-deckWidth*.40,-D-1.25],[-W*.14+deckWidth*.40,-D-1.25]]){box(group,.72,.38,.48,x,.35,z,stone,'landscape-planter',true);box(group,.66,.025,.42,x,.55,z,soil,'planter-soil',true);const leaves=new THREE.InstancedMesh(leafGeometry,foliage,420),dummy=new THREE.Object3D();for(let i=0;i<420;i++){const a=random()*Math.PI*2,b=random()*Math.PI,r=Math.cbrt(random())*.34;dummy.position.set(x+Math.cos(a)*Math.sin(b)*r,.64+Math.abs(Math.cos(b))*r*1.6,z+Math.sin(a)*Math.sin(b)*r*.7);dummy.rotation.set(random()*Math.PI,random()*Math.PI,random()*Math.PI);dummy.scale.setScalar(.7+random()*.9);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);}leaves.castShadow=leaves.receiveShadow=true;leaves.name='proposed-shrub';leaves.userData.architecture={kind:'landscape-foliage',proposed:true};leaves.userData.annotation=true;group.add(leaves);parts++;}
  group.userData.architecturalProposal={...plan,photoProjection:false,wallThickness:T,materialsSource:atlas?'ai-material-atlas':'physical-materials'};
  return {parts,plan,assumptions:plan.roof.kind==='hipped'?[...plan.assumptions,'Cubierta inclinada según los planos visibles; alturas y posiciones de lucarnas y chimeneas aproximadas.']:plan.assumptions};
}
