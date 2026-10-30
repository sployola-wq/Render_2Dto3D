import {studioTexture} from './studio-materials.js';
import {validateClosedProfile} from './discipline-analysis.js';
import {addMechanicalDetails} from './mechanical-detail-models.js';
import * as THREE from './vendor/three.module.js';

function roundedPlateShape(halfW,halfD,cornerR,halfSection=false){
  const r=Math.max(1e-4,Math.min(cornerR,halfW*.45,halfD*.45)),s=new THREE.Shape();
  if(halfSection){
    s.moveTo(-halfW,0);
    s.lineTo(-halfW,halfD-r);
    s.absarc(-halfW+r,halfD-r,r,Math.PI,Math.PI*.5,true);
    s.lineTo(halfW-r,halfD);
    s.absarc(halfW-r,halfD-r,r,Math.PI*.5,0,true);
    s.lineTo(halfW,0);
    s.closePath();
    return s;
  }
  s.moveTo(-halfW+r,-halfD);
  s.lineTo(halfW-r,-halfD);
  s.absarc(halfW-r,-halfD+r,r,-Math.PI*.5,0,false);
  s.lineTo(halfW,halfD-r);
  s.absarc(halfW-r,halfD-r,r,0,Math.PI*.5,false);
  s.lineTo(-halfW+r,halfD);
  s.absarc(-halfW+r,halfD-r,r,Math.PI*.5,Math.PI,false);
  s.lineTo(-halfW,-halfD+r);
  s.absarc(-halfW+r,-halfD+r,r,Math.PI,Math.PI*1.5,false);
  s.closePath();
  return s;
}

function slopedHollowCylinderGeometry(outerR,innerR,yBottom,yFlangeTop,yTopAt,halfSection=false,segments=96){
  const startAngle=halfSection?Math.PI:0,sweep=halfSection?Math.PI:Math.PI*2;
  const positions=[],indices=[];
  const addQuad=(a,b,c,d)=>{const i=positions.length/3;positions.push(...a,...b,...c,...d);indices.push(i,i+1,i+2,i,i+2,i+3);};
  for(let s=0;s<segments;s++){
    const t0=startAngle+(s/segments)*sweep,t1=startAngle+((s+1)/segments)*sweep;
    const c0=Math.cos(t0),s0=Math.sin(t0),c1=Math.cos(t1),s1=Math.sin(t1);
    const xOut0=outerR*c0,zOut0=outerR*s0,xOut1=outerR*c1,zOut1=outerR*s1;
    const xIn0=innerR*c0,zIn0=innerR*s0,xIn1=innerR*c1,zIn1=innerR*s1;
    const yOut0=yTopAt(xOut0),yOut1=yTopAt(xOut1),yIn0=yTopAt(xIn0),yIn1=yTopAt(xIn1);
    // Outer wall
    addQuad([xOut0,yFlangeTop,zOut0],[xOut1,yFlangeTop,zOut1],[xOut1,yOut1,zOut1],[xOut0,yOut0,zOut0]);
    // Inner bore wall
    addQuad([xIn1,yBottom,zIn1],[xIn0,yBottom,zIn0],[xIn0,yIn0,zIn0],[xIn1,yIn1,zIn1]);
    // Top inclined/flat annular rim
    addQuad([xIn0,yIn0,zIn0],[xOut0,yOut0,zOut0],[xOut1,yOut1,zOut1],[xIn1,yIn1,zIn1]);
    // Bottom annular closure
    addQuad([xOut0,yFlangeTop,zOut0],[xIn0,yFlangeTop,zIn0],[xIn1,yFlangeTop,zIn1],[xOut1,yFlangeTop,zOut1]);
  }
  if(halfSection){
    for(const sign of[-1,1]){
      const xIn=sign*innerR,xOut=sign*outerR,yIn=yTopAt(xIn),yOut=yTopAt(xOut);
      if(sign<0)addQuad([xOut,yFlangeTop,0],[xIn,yFlangeTop,0],[xIn,yIn,0],[xOut,yOut,0]);
      else addQuad([xIn,yFlangeTop,0],[xOut,yFlangeTop,0],[xOut,yOut,0],[xIn,yIn,0]);
    }
  }
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

export function addCompoundMechanicalHousing(project,group,mpp,{own,atlas,textures}){
  const d=project.drawing,b=d.bounds,ch=d.compoundHousing,axis=ch.barrelCx,center=(b.y0+b.y1)/2;
  const halfSection=project.params.representation==='section';
  const yBottom=(center-b.y1)*mpp,flangeH=Math.max(.002,ch.flangeHeightPx*mpp),yFlangeTop=yBottom+flangeH;
  const yTopMax=(center-ch.topCut.yTopLeftPx)*mpp,yTopRight=(center-ch.topCut.yTopRightPx)*mpp,xSlopeStart=(ch.topCut.slopeStartPx-axis)*mpp;
  const outerR=Math.max(.004,ch.outerRadiusPx*mpp),innerR=Math.min(outerR*.84,Math.max(outerR*.45,ch.innerRadiusPx*mpp));
  const halfW=Math.max(outerR*1.2,ch.flangeWidthPx*mpp/2),halfD=Math.max(outerR*1.2,ch.flangeDepthPx*mpp/2),cornerR=ch.cornerRadiusPx*mpp;
  const cutMap=studioTexture(atlas?.steel,textures,{repeat:4,data:true}),bodyMap=studioTexture(atlas?.cast,textures,{repeat:6,data:true});
  const flangeMat=own(new THREE.MeshPhysicalMaterial({color:'#5e7484',roughnessMap:bodyMap,metalness:.82,roughness:.32,clearcoat:.08,envMapIntensity:1.15,side:THREE.DoubleSide}));
  const housingMat=own(new THREE.MeshPhysicalMaterial({color:'#7b91a0',roughnessMap:cutMap,metalness:.86,roughness:.26,anisotropy:.35,envMapIntensity:1.2,side:THREE.DoubleSide}));
  const portMat=own(new THREE.MeshPhysicalMaterial({color:'#8da3b2',roughnessMap:cutMap,metalness:.88,roughness:.24,anisotropy:.4,envMapIntensity:1.2,side:THREE.DoubleSide}));
  const boreMat=own(new THREE.MeshStandardMaterial({color:'#263642',metalness:.68,roughness:.48,side:THREE.DoubleSide}));
  const edgeMat=own(new THREE.LineBasicMaterial({color:'#1d2f3b',transparent:true,opacity:.44,depthWrite:false}));
  const addEdges=mesh=>{const lines=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,24),edgeMat);lines.name='machined-cut-boundary';lines.userData.annotation=true;lines.raycast=()=>{};mesh.add(lines);};

  const components=[
    {id:'cross-ports',label:'Toberas y alojamientos laterales',role:'cover',from:b.y0,to:b.y0+b.height*.45,proposed:true},
    {id:'housing',label:'Cuerpo cilíndrico principal',role:'housing',from:b.y0+b.height*.45,to:b.y1-ch.flangeHeightPx,proposed:true},
    {id:'base-flange',label:'Brida base con 4 taladros',role:'flange',from:b.y1-ch.flangeHeightPx,to:b.y1,proposed:true}
  ];
  const componentGroups=new Map();
  for(const comp of components){
    const part=new THREE.Group();part.name=comp.label;
    part.userData={assemblyComponent:true,id:comp.id,label:comp.label,role:comp.role,sourceFrom:comp.from,sourceTo:comp.to,assembledPosition:[0,0,0],proposed:true};
    group.add(part);componentGroups.set(comp.id,part);
  }
  let parts=0;
  // 1. Base Flange with 4 corner bolt holes and central bore
  const flangeGroup=componentGroups.get('base-flange');
  const plateShape=roundedPlateShape(halfW,halfD,cornerR,halfSection);
  if(!halfSection){
    const centerHole=new THREE.Path();centerHole.absarc(0,0,innerR,0,Math.PI*2,true);plateShape.holes.push(centerHole);
  }
  for(const h of ch.boltHoles??[]){
    const bx=h.dx*mpp,bz=h.dz*mpp,br=Math.max(.0015,h.radiusPx*mpp);
    if(halfSection&&bz<br*1.2)continue;
    const path=new THREE.Path();path.absarc(bx,bz,br,0,Math.PI*2,true);plateShape.holes.push(path);
    const liner=new THREE.Mesh(new THREE.CylinderGeometry(br*.985,br*.985,flangeH*1.01,28,1,true),boreMat);
    liner.position.set(bx,yBottom+flangeH/2,-bz);liner.castShadow=liner.receiveShadow=true;flangeGroup.add(liner);
  }
  const bev=Math.min(.0012,flangeH*.055);
  const flangeGeom=new THREE.ExtrudeGeometry(plateShape,{depth:Math.max(.001,flangeH-bev*2),bevelEnabled:true,bevelSize:bev,bevelThickness:bev,bevelSegments:2,curveSegments:36});
  const flangeMesh=new THREE.Mesh(flangeGeom,flangeMat);
  flangeMesh.rotation.x=-Math.PI/2;flangeMesh.position.y=yBottom+bev;
  flangeMesh.castShadow=flangeMesh.receiveShadow=true;addEdges(flangeMesh);flangeGroup.add(flangeMesh);parts++;

  // 2. Main Vertical Cylindrical Barrel with inclined top cut
  const housingGroup=componentGroups.get('housing');
  const yTopAt=x=>{
    if(x<=xSlopeStart)return yTopMax;
    const t=Math.max(0,Math.min(1,(x-xSlopeStart)/Math.max(1e-6,outerR-xSlopeStart)));
    return yTopMax-t*(yTopMax-yTopRight);
  };
  const barrelGeom=slopedHollowCylinderGeometry(outerR,innerR,yBottom,yFlangeTop,yTopAt,halfSection,96);
  const barrelMesh=new THREE.Mesh(barrelGeom,housingMat);
  barrelMesh.castShadow=barrelMesh.receiveShadow=true;addEdges(barrelMesh);housingGroup.add(barrelMesh);
  const boreLiner=new THREE.Mesh(slopedHollowCylinderGeometry(innerR*.992,innerR*.965,yBottom+.001,yBottom+.001,yTopAt,halfSection,72),boreMat);
  boreLiner.receiveShadow=true;housingGroup.add(boreLiner);parts++;

  // 3. Transverse Cylindrical Boss Ports
  const portsGroup=componentGroups.get('cross-ports');
  for(const boss of ch.bosses??[]){
    if(halfSection&&boss.dir[1]>0)continue;
    const cy=(center-boss.cy)*mpp,rOut=Math.max(.002,boss.outerRadiusPx*mpp),rIn=Math.max(.001,boss.innerRadiusPx*mpp);
    const rStart=innerR*.92,rEnd=outerR+Math.max(.002,boss.protrusionPx*mpp),len=Math.max(.002,rEnd-rStart);
    const bossShape=new THREE.Shape();bossShape.absarc(0,0,rOut,0,Math.PI*2,false);
    const bossHole=new THREE.Path();bossHole.absarc(0,0,rIn,0,Math.PI*2,true);bossShape.holes.push(bossHole);
    const bBev=Math.min(.0008,len*.05);
    const bossGeom=new THREE.ExtrudeGeometry(bossShape,{depth:Math.max(.001,len-bBev),bevelEnabled:true,bevelSize:bBev,bevelThickness:bBev,bevelSegments:2,curveSegments:40});
    const bossMesh=new THREE.Mesh(bossGeom,portMat);
    const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(rIn*.985,rIn*.985,len*1.02,32,1,true),boreMat);
    sleeve.rotation.x=Math.PI/2;sleeve.position.z=len/2;bossMesh.add(sleeve);
    const holder=new THREE.Group();holder.add(bossMesh);addEdges(bossMesh);
    if(boss.dir[0]<0){holder.rotation.y=-Math.PI/2;holder.position.set(-rStart,cy,0);}
    else if(boss.dir[0]>0){holder.rotation.y=Math.PI/2;holder.position.set(rStart,cy,0);}
    else if(boss.dir[1]>0){holder.position.set(0,cy,rStart);}
    else{holder.rotation.y=Math.PI;holder.position.set(0,cy,-rStart);}
    bossMesh.castShadow=bossMesh.receiveShadow=true;portsGroup.add(holder);parts++;
  }
  group.userData.mechanicalDetails={enabled:project.params.details!==false,fasteners:[],bearings:[],proposed:true};
  group.userData.mechanicalAssembly={version:3,proposed:true,components,shaftEnabled:false,shaft:null,orientation:'vertical',spacing:Math.max(b.width,b.height)*mpp*.14,explosionFactor:0};
  group.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(group);group.position.y-=box.min.y;
  group.userData.section={source:'compound-orthographic-housing',plane:'longitudinal-z0',profiles:components.length,observedCircularFeatures:(ch.boltHoles?.length??0)+(ch.bosses?.length??0),voids:1,core:'void'};
  return {parts,assumptions:['Pieza mecánica compuesta reconstruida desde la sección vertical A-A y su vista en planta alineada.','Incluye brida base cuadrada con 4 taladros, cuerpo cilíndrico hueco con corte superior inclinado y toberas transversales.']};
}

/** A back half-revolution of each observed material region, with actual planar
 * end faces. Holes are swept as inner boundaries, rather than filled as a shell. */
export function addMechanicalSection(project,group,mpp,{own,material,atlas,textures}){
  if(project.drawing?.compoundHousing)return addCompoundMechanicalHousing(project,group,mpp,{own,material,atlas,textures});
  if(!project.section?.profiles?.length||project.section.profiles.length>40)throw new Error('El corte necesita entre 1 y 40 perfiles materiales válidos.');for(const p of project.section.profiles)validateClosedProfile(p);
  const assembly=project.params.representation==='assembly'?project.assembly:null,section=assembly??project.section,d=project.drawing,b=d.bounds,horizontal=project.params.orientation==='horizontal',axis=section.axis,center=horizontal?(b.x0+b.x1)/2:(b.y0+b.y1)/2,componentGroups=new Map();
  for(const component of assembly?.components??[]){const part=new THREE.Group();part.name=component.label;part.userData={assemblyComponent:true,id:component.id,label:component.label,role:component.role,sourceFrom:component.from,sourceTo:component.to,assembledPosition:[0,0,0],proposed:true};group.add(part);componentGroups.set(component.id,part);}
  const radial=q=>Math.max(0,(axis-q[horizontal?1:0])*mpp),axial=q=>(q[horizontal?0:1]-center)*mpp*(horizontal?1:-1),palette=['#6d7b84','#9ba5ad','#536874','#91a0a8'],cutMap=studioTexture(atlas?.steel,textures,{repeat:4,data:true}),bodyMap=studioTexture(atlas?.cast,textures,{repeat:6,data:true});let parts=0;
  for(const [index,profile]of section.profiles.entries()){
    const target=componentGroups.get(profile.componentId)??group,colors=profile.role==='housing'?['#345264','#8fa5b2']:profile.role==='cover'?['#788f9d','#b8c9d2']:profile.role==='lock'?['#5a6c7a','#a2b3bf']:['#a4b4c0','#d6dfe4'];
    const body=own(new THREE.MeshStandardMaterial({color:assembly?colors[0]:palette[index%palette.length],roughnessMap:bodyMap,metalness:profile.role==='housing'?.55:.8,roughness:profile.role==='housing'?.65:.4,side:THREE.DoubleSide})),capMaterial=own(new THREE.MeshPhysicalMaterial({color:assembly?colors[1]:'#ced6db',roughnessMap:cutMap,metalness:.88,roughness:.27,anisotropy:assembly?.55:0,envMapIntensity:1.1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}));body.userData.source='cast-metal-material';capMaterial.userData.source='machined-metal-material';
    for(const [i,ring]of [profile.outer,...(profile.holes??[])].entries()){
      const points=ring.map(q=>new THREE.Vector2(radial(q),axial(q))),area=points.reduce((n,p,j)=>{const z=points[(j+1)%points.length];return n+p.x*z.y-z.x*p.y;},0);if((area<0)!==(i>0))points.reverse();points.push(points[0].clone());
      const geometry=new THREE.LatheGeometry(points,128,Math.PI/2,Math.PI),uv=geometry.attributes.uv,lengths=[0];for(let k=1;k<points.length;k++)lengths.push(lengths.at(-1)+points[k].distanceTo(points[k-1]));const total=lengths.at(-1)||1;for(let j=0;j<=128;j++)for(let k=0;k<points.length;k++)uv.setXY(j*points.length+k,j/128,lengths[k]/total);const mesh=new THREE.Mesh(geometry,body);if(horizontal)mesh.rotation.z=-Math.PI/2;else mesh.rotation.y=Math.PI/2;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.component=index;target.add(mesh);
    }
    for(const sign of [-1,1]){
      const xy=q=>horizontal?[axial(q),sign*radial(q)]:[sign*radial(q),axial(q)],shape=new THREE.Shape(profile.outer.map(q=>new THREE.Vector2(...xy(q))));
      for(const hole of profile.holes??[])shape.holes.push(new THREE.Path(hole.map(q=>new THREE.Vector2(...xy(q)))));
      const geom=new THREE.ShapeGeometry(shape),p=geom.attributes.position,uv=geom.attributes.uv;
      for(let i=0;i<uv.count;i++){const x=horizontal?p.getX(i)/mpp+center:p.getX(i)/mpp+axis,y=horizontal?axis-p.getY(i)/mpp:center-p.getY(i)/mpp;uv.setXY(i,x/d.width,1-y/d.height);}
      const cap=new THREE.Mesh(geom,capMaterial);cap.position.z=0;cap.castShadow=cap.receiveShadow=true;cap.userData.sectionFace=true;cap.userData.component=index;target.add(cap);
      // Drafting-weight boundaries follow the actual cut and its holes. They do
      // not project hatching onto the metal or change any construction surfaces.
      const outline=new THREE.LineSegments(new THREE.EdgesGeometry(geom,25),own(new THREE.LineBasicMaterial({color:'#253844',transparent:true,opacity:.42,depthWrite:false})));
      outline.name='machined-cut-boundary';outline.userData.annotation=true;outline.raycast=()=>{};cap.add(outline);
    }parts++;
  }
  if(assembly?.shaft&&project.params.assemblyShaft!==false){
    const part=new THREE.Group();part.name='Eje escalonado';part.userData={assemblyComponent:true,id:'shaft',label:'Eje escalonado propuesto',role:'shaft',sourceFrom:assembly.shaft.points[0][0],assembledPosition:[0,0,0],proposed:true};
    const points=assembly.shaft.points.map(([a,r])=>new THREE.Vector2(r*mpp,(a-center)*mpp*(horizontal?1:-1)));if(!horizontal)points.reverse();points.unshift(new THREE.Vector2(0,points[0].y));points.push(new THREE.Vector2(0,points.at(-1).y));
    const mat=own(new THREE.MeshPhysicalMaterial({color:'#8197a8',metalness:.94,roughness:.28,anisotropy:.4,envMapIntensity:.9,side:THREE.DoubleSide})),shaft=new THREE.Mesh(new THREE.LatheGeometry(points,160),mat);shaft.name='machined-stepped-shaft';if(horizontal)shaft.rotation.z=-Math.PI/2;shaft.castShadow=shaft.receiveShadow=true;part.add(shaft);group.add(part);parts++;
  }
  const chrome=own(material('#c8d5df',.9));
  for(const ball of section.balls){const x=horizontal?axial(ball.center):(ball.center[0]-axis)*mpp,y=horizontal?(axis-ball.center[1])*mpp:axial(ball.center),radius=ball.radius*mpp;
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,40,28),chrome);mesh.position.set(x,y,0);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.observedCircularFeature=true;mesh.userData.source='paired-observed-circular-region';mesh.userData.sourceCenter=ball.center;group.add(mesh);parts++;
  }
  const details=addMechanicalDetails(project,group,mpp,{own});parts+=details.parts;group.userData.mechanicalDetails=details.metadata;
  if(assembly){
    // Fasteners and rolling elements travel with their local housing in a
    // viewer-only exploded pose. Canonical source coordinates stay untouched.
    for(const child of [...group.children])if(child.userData.detailProposal||child.userData.observedCircularFeature){
      const value=horizontal?child.position.x/mpp+center:center-child.position.y/mpp,component=assembly.components.find(c=>value>=c.from&&value<c.to);componentGroups.get(component?.id)?.add(child);
    }
    group.userData.mechanicalAssembly={version:3,proposed:true,components:assembly.components,shaftEnabled:!!assembly.shaft&&project.params.assemblyShaft!==false,shaft:assembly.shaft,orientation:project.params.orientation,spacing:Math.max(b.width,b.height)*mpp*.12,explosionFactor:0};
  }
  group.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(group);group.position.y-=box.min.y;
  group.userData.section={source:'drawing-material-regions',plane:'longitudinal-z0',profiles:section.profiles.length,observedCircularFeatures:section.balls.length,voids:section.voids.length,core:section.core};
  return {parts,assumptions:[...section.assumptions,...(assembly?.shaft&&project.params.assemblyShaft!==false?assembly.shaft.assumptions:[]),...(details.metadata.fasteners.length||details.metadata.bearings.length?[`Propuestas: tornillos (${details.metadata.fasteners.length}) · conjuntos de rodamiento (${details.metadata.bearings.length}). Posiciones respaldadas por el dibujo; roscas, cabezas y piezas posteriores por revisar.`]:[])]};
}
