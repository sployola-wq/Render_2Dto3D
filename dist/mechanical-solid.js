import {validateClosedProfile} from './discipline-analysis.js';
import * as THREE from './vendor/three.module.js';
/** A back half-revolution of each observed material region, with actual planar
 * end faces. Holes are swept as inner boundaries, rather than filled as a shell. */
export function addMechanicalSection(project,group,mpp,{own,material,sectionCanvas,onTexture}){
  if(!project.section?.profiles?.length||project.section.profiles.length>40)throw new Error('El corte necesita entre 1 y 40 perfiles materiales válidos.');for(const p of project.section.profiles)validateClosedProfile(p);
  const section=project.section,d=project.drawing,b=d.bounds,horizontal=project.params.orientation==='horizontal',axis=section.axis,center=horizontal?(b.x0+b.x1)/2:(b.y0+b.y1)/2;
  const radial=q=>Math.max(0,(axis-q[horizontal?1:0])*mpp),axial=q=>(q[horizontal?0:1]-center)*mpp*(horizontal?1:-1),palette=['#8296a4','#a1acb3','#667c8b','#91a5ac'],tex=sectionCanvas?new THREE.CanvasTexture(sectionCanvas):null;
  if(tex){tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;onTexture(tex);}let parts=0;
  for(const [index,profile]of section.profiles.entries()){
    const body=own(material(palette[index%palette.length],.7)),capMaterial=own(new THREE.MeshStandardMaterial({color:tex?'#ffffff':'#d1b57a',map:tex,metalness:.28,roughness:.44,side:THREE.DoubleSide}));
    for(const [i,ring]of [profile.outer,...profile.holes].entries()){
      const points=ring.map(q=>new THREE.Vector2(radial(q),axial(q))),area=points.reduce((n,p,j)=>{const z=points[(j+1)%points.length];return n+p.x*z.y-z.x*p.y;},0);if((area<0)!==(i>0))points.reverse();points.push(points[0].clone());
      const mesh=new THREE.Mesh(new THREE.LatheGeometry(points,64,Math.PI/2,Math.PI),body);if(horizontal)mesh.rotation.z=-Math.PI/2;else mesh.rotation.y=Math.PI/2;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.component=index;group.add(mesh);
    }
    for(const sign of [-1,1]){
      const xy=q=>horizontal?[axial(q),sign*radial(q)]:[sign*radial(q),axial(q)],shape=new THREE.Shape(profile.outer.map(q=>new THREE.Vector2(...xy(q))));
      for(const hole of profile.holes)shape.holes.push(new THREE.Path(hole.map(q=>new THREE.Vector2(...xy(q)))));
      const geom=new THREE.ShapeGeometry(shape),p=geom.attributes.position,uv=geom.attributes.uv;
      for(let i=0;i<uv.count;i++){const x=horizontal?p.getX(i)/mpp+center:p.getX(i)/mpp+axis,y=horizontal?axis-p.getY(i)/mpp:center-p.getY(i)/mpp;uv.setXY(i,x/d.width,1-y/d.height);}
      const cap=new THREE.Mesh(geom,capMaterial);cap.position.z=0;cap.castShadow=cap.receiveShadow=true;cap.userData.sectionFace=true;cap.userData.component=index;group.add(cap);
    }parts++;
  }
  const chrome=own(material('#c8d5df',.9));
  for(const ball of section.balls){const x=horizontal?axial(ball.center):(ball.center[0]-axis)*mpp,y=horizontal?(axis-ball.center[1])*mpp:axial(ball.center),radius=ball.radius*mpp;
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,24,16,Math.PI,Math.PI),chrome);mesh.position.set(x,y,0);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.observedCircularFeature=true;group.add(mesh);
    const cap=new THREE.Mesh(new THREE.CircleGeometry(radius,32),chrome);cap.position.set(x,y,0);cap.userData.sectionFace=true;group.add(cap);parts++;
  }
  group.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(group);group.position.y-=box.min.y;
  group.userData.section={source:'drawing-material-regions',plane:'longitudinal-z0',profiles:section.profiles.length,observedCircularFeatures:section.balls.length,voids:section.voids.length,core:section.core};
  return {parts,assumptions:section.assumptions};
}
