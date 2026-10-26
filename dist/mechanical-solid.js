import {studioTexture} from './studio-materials.js';
import {validateClosedProfile} from './discipline-analysis.js';
import {addMechanicalDetails} from './mechanical-detail-models.js';
import * as THREE from './vendor/three.module.js';
/** A back half-revolution of each observed material region, with actual planar
 * end faces. Holes are swept as inner boundaries, rather than filled as a shell. */
export function addMechanicalSection(project,group,mpp,{own,material,atlas,textures}){
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
