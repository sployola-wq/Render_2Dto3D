import * as THREE from './vendor/three.module.js';
import {studioTexture} from './studio-materials.js';
import {SURFACE_MATERIALS} from './technical-sheet.js';
import {architecturalPalette} from './exterior-finishes.js';
import {sourcePlanes} from './source-volume.js';
import {addPitchedExteriorRoof} from './exterior-roof.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function validObservedEnvelope(project){
  const e=project.exteriorEnvelope;
  return !!e&&e.algorithm==='observed-silhouette-fold-v1'&&e.sourceHash===project.sourceHash&&e.width===project.drawing.width&&e.height===project.drawing.height&&e.top?.length>=2&&e.bottom?.length>=2&&[...e.top,...e.bottom].every(p=>p.length===2&&p.every(Number.isFinite))&&e.corner>e.bounds[0]&&e.corner<e.bounds[2]-1;
}
const interpolate=(profile,u)=>{let i=1;while(i<profile.length-1&&profile[i][0]<u)i++;const a=profile[i-1],b=profile[i];return a[1]+(b[1]-a[1])*(u-a[0])/Math.max(.00001,b[0]-a[0]);};
/** Window assemblies, not every white compartment in a pencil drawing. Retain
 * source boxes for review; the output is a proposal, not recovered dimensions. */
export function architecturalOpenings(project){
  const e=project.exteriorEnvelope,d=project.drawing,[x0,y0,x1,y1]=e.bounds,bw=x1-x0,bh=y1-y0,groups=[],seen=[];
  const candidates=[...(d.faces??[]).map(f=>({b:f.bbox,area:f.count,white:true})),...(project.sourceReconstruction?.faces??[]).map(f=>({b:f.bounds,area:f.area,white:false}))].filter(f=>f.b?.length===4);
  for(const {b,area,white}of candidates){
    const [a,b0,c,d0]=b,w=c-a,h=d0-b0,cx=(a+c)/2,cy=(b0+d0)/2;
    if(w<bw*.010||h<bh*.035||w>bw*.32||h>bh*.42||h/w<.35||h/w>6||area/(w*h)<.50||cx<x0||cx>x1||cy<interpolate(e.top,cx)+bh*.06||cy>interpolate(e.bottom,cx)-bh*.09)continue;
    // A window frame has substantial ink along both jambs. Fine construction
    // rules around a white wall must not become extra windows.
    const band=Math.max(3,Math.round(d.width*.004));let scores=[];
    for(const side of[a,c]){let n=0,ink=0;for(let y=Math.round(b0+h*.2);y<b0+h*.8;y++)for(let x=Math.round(side-band);x<=side+band;x++)if(x>=0&&x<d.width&&y>=0&&y<d.height){ink+=d.ink[y*d.width+x]?1:0;n++;}scores.push(ink/Math.max(1,n));}
    if(Math.min(...scores)<.12)continue;
    let central=0,total=0;for(let y=Math.round(b0+h*.25);y<b0+h*.75;y++)for(let x=Math.round(a+w*.25);x<a+w*.75;x++){central+=d.ink[y*d.width+x]?1:0;total++;}
    const filled=central/Math.max(1,total)>.40;if(filled&&(w<bw*.035||h<bh*.07||area<bw*bh*.004))continue;
    if(seen.some(q=>{const inter=Math.max(0,Math.min(q[2],c)-Math.max(q[0],a))*Math.max(0,Math.min(q[3],d0)-Math.max(q[1],b0));return inter/((q[2]-q[0])*(q[3]-q[1])+w*h-inter)>.60;}))continue;seen.push(b);
    groups.push({source:[...b],score:Math.min(...scores),members:1,filled});
  }
  let again=true;
  while(again){again=false;outer:for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
    const a=groups[i].source,b=groups[j].source,ox=Math.min(a[2],b[2])-Math.max(a[0],b[0]),oy=Math.min(a[3],b[3])-Math.max(a[1],b[1]),gapX=Math.max(a[0]-b[2],b[0]-a[2],0),gapY=Math.max(a[1]-b[3],b[1]-a[3],0);
    if(ox>2&&oy>2)continue;
    if(oy>Math.max(a[3]-a[1],b[3]-b[1])*.90&&gapX<bw*.035||ox>Math.max(a[2]-a[0],b[2]-b[0])*.80&&gapY<bh*.016){groups[i]={source:[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])],score:Math.max(groups[i].score,groups[j].score),members:groups[i].members+groups[j].members,filled:groups[i].filled||groups[j].filled};groups.splice(j,1);again=true;break outer;}
  }}
  const detected=(e.openings??[]).filter(q=>q.confidence>=.18&&q.bounds?.length===4).map(q=>({source:q.bounds,kind:q.kind,confidence:q.confidence,detected:true,members:1,filled:true}));
  const intersection=(a,b)=>Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
  const area=b=>(b[2]-b[0])*(b[3]-b[1]);
  const selected=groups.filter(g=>(g.members>=2||g.filled)&&(g.source[2]-g.source[0])/(g.source[3]-g.source[1])>.24&&g.source[2]-g.source[0]<bw*.45&&g.source[3]-g.source[1]<bh*.45&&!detected.some(q=>intersection(g.source,q.source)/area(g.source)>.45)).concat(detected);
  const perspective=project.sourceReconstruction?sourcePlanes(project.sourceReconstruction,project.params?.facadeFloors??2):null,sourceFaces=perspective?.frame?perspective.faces:project.sourceReconstruction?.faces??[];
  const sourceFace=box=>sourceFaces.map(f=>({f,match:intersection(box,f.bounds)/(area(box)+area(f.bounds)-intersection(box,f.bounds))})).sort((a,b)=>b.match-a.match)[0];
  for(const g of selected){const match=sourceFace(g.source);g.slope=match?.match>.3?match.f.slope:0;g.sourceAxis=match?.match>.3?match.f.axis:null;g.sourceLevel=match?.match>.3?match.f.level:undefined;}
  const upperCorner=Math.max(e.corner,...selected.filter(g=>(g.sourceAxis==='x'||!g.sourceAxis&&g.slope<-.12)&&(g.source[1]+g.source[3])/2<y0+bh*.55).map(g=>g.source[2]));
  const normalized=selected.map(g=>{const [a,b,c,d0]=g.source,cx=(a+c)/2,cy=(b+d0)/2,vertical=clamp((interpolate(e.bottom,cx)-cy)/(interpolate(e.bottom,cx)-interpolate(e.top,cx)),0,1),corner=vertical>.55?upperCorner:e.corner,axis=g.kind==='garage'?(cx>corner?'right':'front'):g.sourceAxis==='x'?'front':g.sourceAxis==='z'?'right':g.slope>.12?'right':g.slope<-.12?'front':cx>corner?'right':'front',lo=axis==='front'?x0:corner,span=axis==='front'?corner-x0:x1-corner,kind=g.kind??(axis==='front'&&vertical<.45&&(d0-b)/(c-a)>1.65&&d0-b>bh*.12?'door':'window');return {...g,axis,kind,u:clamp((cx-lo)/span,.06,.94),widthFraction:(c-a)/span,heightFraction:(d0-b)/bh,vertical};});
  // Keep a full entrance assembly instead of interpreting a nearby jamb as a
  // second door. Separate entrances elsewhere on the facade remain independent.
  return normalized.filter(q=>q.kind!=='door'||!normalized.some(o=>o!==q&&o.kind==='door'&&o.axis===q.axis&&area(o.source)>area(q.source)&&Math.abs(o.u-q.u)<.10)).sort((a,b)=>Number(!!b.detected)-Number(!!a.detected)||Number(b.kind==='door')-Number(a.kind==='door')||b.members-a.members||area(b.source)-area(a.source));
}
/** Perspective contours are evidence for proportions, never a height field.
 * Every storey has horizontal slabs, vertical walls and planar roof facets.
 * No source image is wrapped over the building. Hidden geometry stays proposed.
 */
export function addObservedEnvelope(project,group,mpp,{own,textures,atlas}){
  if(!validObservedEnvelope(project)||project.profiles?.some(p=>['user-traced','cad'].includes(p.source))||project.sourceReconstruction?.representation!=='relief'&&project.sourceReconstruction?.quality?.accepted)return null;
  const e=project.exteriorEnvelope,p=project.params,W=project.calibration?project.drawing.bounds.width*mpp:p.widthMm/1000,D=p.depthMm/1000,floors=p.facadeFloors??2,H=2.8,base=.16,roofKind=p.roofStyle==='auto'||!p.roofStyle?(e.roofKind==='gable'?'gable':'flat'):p.roofStyle,pal=architecturalPalette(p.facadeScheme);
  if(W<.5||D<.5)throw new Error('Revisa el ancho y la profundidad del edificio.');
  const chosen=p.material&&p.material!=='auto'?SURFACE_MATERIALS[p.material]:null,woodMap=studioTexture(atlas?.wood,textures),plaster=studioTexture(atlas?.plaster,textures,{repeat:2}),timber=own(new THREE.MeshStandardMaterial({color:woodMap?'#ffffff':pal.wood,map:woodMap,roughness:.65})),wall=own(new THREE.MeshStandardMaterial({color:chosen?new THREE.Color().setRGB(...chosen.color.map(v=>v/255),THREE.SRGBColorSpace):pal.wall,metalness:chosen?.metalness??0,roughness:chosen?.roughness??.86,bumpMap:!chosen||p.material==='concrete'?plaster:null,bumpScale:.002})),roof=own(new THREE.MeshStandardMaterial({color:pal.roof,roughness:.8,side:THREE.DoubleSide})),frame=own(new THREE.MeshStandardMaterial({color:pal.metal,roughness:.42,metalness:.3})),glass=own(new THREE.MeshPhysicalMaterial({color:pal.glass,roughness:.12,metalness:.15,clearcoat:1,side:THREE.DoubleSide})),stone=own(new THREE.MeshStandardMaterial({color:pal.ground,roughness:.9}));
  let parts=0;const records=[],levels=[],candidates=architecturalOpenings(project);
  const add=(geometry,material,name,parent=group)=>{const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.architecture={kind:name,proposed:true};parent.add(mesh);parts++;return mesh;};
  const box=(size,pos,mat,name,parent=group)=>{const m=add(new THREE.BoxGeometry(...size),mat,name,parent);m.position.set(...pos);return m;};
  function panel(width,height,pos,rotation,openings=[],name='architectural-wall',profile=null){
    const node=new THREE.Group();node.position.set(...pos);node.rotation.y=rotation;group.add(node);
    const shape=new THREE.Shape((profile??[[-width/2,0],[width/2,0],[width/2,height],[-width/2,height]]).map(v=>new THREE.Vector2(...v)));
    const accepted=[];for(const q of openings){const w=clamp(q.w,.28,width*.8),x=clamp(q.x,-width/2+w/2+.12,width/2-w/2-.12),h=clamp(q.h,.25,height-.30),y=clamp(q.y,.12,height-h-.12),r={x,w,h,y};
      if(profile&&[x-w/2,x+w/2].some(u=>y+h>height*(1-Math.abs(u)/(width/2))-.10))continue;
      if(accepted.some(o=>Math.abs(o.x-x)<(o.w+w)/2+.06&&y<o.y+o.h+.06&&y+h>o.y-.06))continue;
      const hole=new THREE.Path([[x-w/2,y],[x-w/2,y+h],[x+w/2,y+h],[x+w/2,y]].map(v=>new THREE.Vector2(...v)));shape.holes.push(hole);accepted.push(r);
      const opaque=['door','garage'].includes(q.kind),pane=box([w,h,.025],[x,y+h/2,-.10],q.kind==='door'?timber:q.kind==='garage'?stone:glass,opaque?'architectural-door-leaf':'architectural-glazing',node);if(q.kind==='garage')for(let j=1;j<10;j++)box([w,.018,.02],[x,y+h*j/10,-.075],roof,'garage-door-rib',node);pane.userData.sourceBox=q.source;if(q.kind==='door'){box([w*.72,h*.48,.025],[x,y+h*.68,-.073],glass,'entry-door-glass',node);box([.03,.22,.07],[x+w*.35,y+h*.45,-.045],frame,'entry-door-handle',node);}
      for(const dx of[-w/2,w/2])box([.055,h+.06,.09],[x+dx,y+h/2,.005],frame,'architectural-window-jamb',node);
      for(const dy of[0,h])box([w+.06,.055,.09],[x,y+dy,.005],frame,'architectural-window-head',node);
      if(w>.9&&!opaque)box([.035,h,.065],[x,y+h/2,-.015],frame,'architectural-window-mullion',node);
      records.push({...r,panelId:node.uuid,paneId:pane.uuid,source:q.source,axis:q.axis,kind:q.kind,nodePosition:pos,rotation});
    }
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:.20,bevelEnabled:false});geometry.translate(0,0,-.20);add(geometry,wall,name,node);return node;
  }
  const openingAt=(q,width,level)=>({x:(q.u-.5)*width,w:clamp(q.widthFraction*width,.4,width*.55),h:q.kind==='door'?H*.8:clamp(q.widthFraction*width*(q.source[3]-q.source[1])/(q.source[2]-q.source[0])*.85,.7,H*.73),y:q.kind==='door'?.12:.68,source:q.source,axis:q.axis,kind:q.kind});
  const levelOf=q=>clamp(Number.isInteger(q.sourceLevel)?q.sourceLevel:Math.floor(q.vertical*floors),0,floors-1);
  const frontUpper=candidates.filter(q=>q.axis==='front'&&levelOf(q)===floors-1),dormer=roofKind==='gable'&&floors>1&&frontUpper.length?frontUpper.reduce((a,b)=>a.heightFraction*a.widthFraction>b.heightFraction*b.widthFraction?a:b):null;
  const dormerWidth=dormer?clamp(dormer.widthFraction*W*1.6,W*.25,W*.48):0,dormerX=dormer?clamp((dormer.u-.5)*W,-W/2+dormerWidth/2+.2,W/2-dormerWidth/2-.2):0;
  const attic=roofKind==='gable'&&floors>1&&candidates.some(q=>q.vertical>.62),upperPositions=frontUpper.map(q=>q.u).sort((a,b)=>a-b);let flatSplit=null,gap=.25;
  for(let i=1;i<upperPositions.length;i++)if(upperPositions[i]-upperPositions[i-1]>gap){gap=upperPositions[i]-upperPositions[i-1];flatSplit=clamp((upperPositions[i]+upperPositions[i-1])/2,.32,.66);}
  let nextY=base;
  for(let i=0;i<floors;i++){
    const inset=i>0?(roofKind==='gable'?D*.18:D*.12):0,zFront=-inset,zBack=-D,y0=nextY,levelHeight=attic&&i===floors-1?H*.34:H,y1=y0+levelHeight,level={x0:-W/2,x1:W/2,y0,y1,zFront,zBack};levels.push(level);nextY=y1;
    if(i>0)box([Math.max(.02,W-.42),.16,Math.max(.02,D-inset-.42)],[0,y0-.08,(zBack+zFront)/2],stone,'architectural-floor');
        if(roofKind==='flat'&&i>0&&flatSplit!==null){
      const cut=(flatSplit-.5)*W,modules=[{x0:-W/2+W*.035,x1:cut-.14,zFront:-D*.12,zBack:-D*.88,y1:y0+H*.88},{x0:cut+.14,x1:W/2-W*.035,zFront:-D*.24,zBack:-D,y1}];level.modules=modules;
      for(const [index,m]of modules.entries()){
        const width=m.x1-m.x0,cx=(m.x0+m.x1)/2,md=m.zFront-m.zBack,mh=m.y1-y0;
        const front=candidates.filter(q=>q.axis==='front'&&levelOf(q)===i&&(q.u-.5)*W>=m.x0-.12&&(q.u-.5)*W<=m.x1+.12).map(q=>({...openingAt(q,W,i),x:(q.u-.5)*W-cx}));
        panel(width,mh,[cx,y0,m.zFront],0,front,'source-upper-module-wall');
        panel(md,mh,[m.x1,y0,(m.zFront+m.zBack)/2],Math.PI/2,index===1?candidates.filter(q=>q.axis==='right'&&levelOf(q)===i).map(q=>openingAt(q,md,i)):[]);
        panel(md,mh,[m.x0,y0,(m.zFront+m.zBack)/2],-Math.PI/2,[],'proposed-side-wall');panel(width,mh,[cx,y0,m.zBack],Math.PI,[],'proposed-rear-wall');
        box([width+.24,.18,md+.24],[cx,m.y1+.09,(m.zFront+m.zBack)/2],roof,'source-module-flat-roof');
      }
      continue;
    }
    const front=candidates.filter(q=>q.axis==='front'&&levelOf(q)===i&&q!==dormer).map(q=>openingAt(q,W,i));
    panel(W,levelHeight,[0,y0,zFront],0,front);
    const side=candidates.filter(q=>q.axis==='right'&&levelOf(q)===i&&!(attic&&i===floors-1)).map(q=>openingAt(q,D-inset,i));
    panel(D-inset,levelHeight,[W/2,y0,(zBack+zFront)/2],Math.PI/2,side);
    panel(W,levelHeight,[0,y0,zBack],Math.PI,[],'proposed-rear-wall');panel(D-inset,levelHeight,[-W/2,y0,(zBack+zFront)/2],-Math.PI/2,[],'proposed-side-wall');
    if(i<floors-1&&inset===0){const nextInset=roofKind==='gable'?D*.18:D;box([W+.18,.14,nextInset+.20],[0,y1+.02,-nextInset/2],roof,'architectural-porch-roof');}
  }
  const top=levels.at(-1),depth=top.zFront-top.zBack,eave=top.y1,rise=attic?H*1.05:clamp(depth*.42,1.0,H*.9),mid=(top.zFront+top.zBack)/2;
  function roofFacet(points,name){const shape=new THREE.BufferGeometry(),positions=[];const lower=points.map(p=>[p[0],p[1]-.10,p[2]]);for(const idx of[0,1,2,0,2,3])positions.push(...points[idx]);for(const idx of[0,2,1,0,3,2])positions.push(...lower[idx]);for(let i=0;i<4;i++){const j=(i+1)%4;for(const p of[points[i],lower[i],lower[j],points[i],lower[j],points[j]])positions.push(...p);}shape.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));shape.computeVertexNormals();return add(shape,roof,name);}
  if(roofKind==='gable'){
    const a=-W/2-.2,b=W/2+.2,frontZ=top.zFront+.2,backZ=top.zBack-.2,peak=eave+rise;
    roofFacet([[a,eave,frontZ],[b,eave,frontZ],[b,peak,mid],[a,peak,mid]],'architectural-roof-front-slope');
    roofFacet([[a,peak,mid],[b,peak,mid],[b,eave,backZ],[a,eave,backZ]],'architectural-roof-back-slope');
    for(const sign of[-1,1])panel(depth,rise,[sign*W/2,eave,mid],sign*Math.PI/2,attic&&sign===1?candidates.filter(q=>q.axis==='right'&&levelOf(q)===floors-1).map(q=>({...openingAt(q,depth,floors-1),y:.25})):[],'architectural-gable',[[-depth/2,0],[depth/2,0],[0,rise]]);
    if(dormer){
      const dw=dormerWidth,dy=top.y0,de=attic?dy+H*.82:eave-.25,dr=Math.min(rise*.6,dw*.40),roofFront=.12,mainFront=top.zFront+.2,slope=rise/(mainFront-mid),roofBack=mainFront-Math.max(0,de+dr-eave)/slope,edgeBack=mainFront-Math.max(0,de-eave)/slope;
      panel(dw,de-dy,[dormerX,dy,0],0,[{...openingAt(dormer,W,floors-1),x:0,w:clamp(dormer.widthFraction*W,.7,dw-.5)}],'source-gable-facade');
      panel(dw,dr,[dormerX,de,0],0,[],'source-front-gable',[[-dw/2,0],[dw/2,0],[0,dr]]);
      for(const sign of[-1,1])panel(-edgeBack,de-dy,[dormerX+sign*dw/2,dy,edgeBack/2],sign*Math.PI/2,[],'dormer-side-wall');
      roofFacet([[dormerX-dw/2-.12,de,roofFront],[dormerX,de+dr,roofFront],[dormerX,de+dr,roofBack],[dormerX-dw/2-.12,de,edgeBack]],'source-cross-gable-roof-left');
      roofFacet([[dormerX,de+dr,roofFront],[dormerX+dw/2+.12,de,roofFront],[dormerX+dw/2+.12,de,edgeBack],[dormerX,de+dr,roofBack]],'source-cross-gable-roof-right');
    }
  }else if(roofKind==='hipped')parts+=addPitchedExteriorRoof(group,{levels,roof:{rise,source:'user-selected-roof',chimneys:[],dormers:[]}},{roofMaterial:roof,wallMaterial:wall,metalMaterial:frame,glassMaterial:glass});
  else if(!top.modules)box([W+.24,.18,depth+.24],[0,eave+.09,mid],roof,'architectural-flat-roof');
  box([W,.16,D],[0,.08,-D/2],stone,'architectural-foundation');
  for(const door of records.filter(q=>q.kind==='door'&&q.axis==='front')){
    const stepWidth=Math.min(W*.4,door.w+.6),height=base+door.y;
    box([stepWidth,height,.7],[door.x,height/2,.35],stone,'proposed-entry-landing');
    for(let j=0;j<3;j++){const h=height*(3-j)/3;box([stepWidth,h,.30],[door.x,h/2,.85+j*.30],stone,'proposed-entry-step');}
  }
  group.userData.sourceVolume={algorithm:'source-architectural-massing-v2',sourceHash:project.sourceHash,width:W,depth:D,floors,storeyHeight:H,atticInferred:attic,roofKind,levels,openings:records.length,openingRecords:records,sourceCandidates:candidates,depthProposed:true,hiddenGeometryProposed:true,geometryProposed:true};
  return {parts,assumptions:['Propuesta arquitectónica: muros verticales, plantas horizontales y cubierta regular; aberturas candidatas de esta lámina.','Revisa la correspondencia con el dibujo. Alturas, profundidad y caras ocultas son propuestas editables, no medidas recuperadas.','La perspectiva de una sola imagen no determina la planta ni el interior del edificio.']};
}
