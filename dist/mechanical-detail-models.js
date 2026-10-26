import * as THREE from './vendor/three.module.js';

/** A V-shaped ridge with its root inside the shank, rather than a round wire
 * wrapped around a cylinder. The pitch is illustrative, not a thread standard. */
export function helicalThreadGeometry(length,rootRadius,crestRadius,turns){
  const segments=turns*32,pitch=length/turns,positions=[],indices=[];
  for(let i=0;i<=segments;i++){
    const t=i/segments,a=t*turns*Math.PI*2,x=(t-.5)*length;
    for(const [dx,r]of[[-pitch*.27,rootRadius],[0,crestRadius],[pitch*.27,rootRadius]])positions.push(x+dx,Math.cos(a)*r,Math.sin(a)*r);
    if(i)for(let j=0;j<3;j++){const a=(i-1)*3+j,b=(i-1)*3+(j+1)%3,c=i*3+j,d=i*3+(j+1)%3;indices.push(a,c,b,b,c,d);}
  }
  indices.push(0,1,2,segments*3,segments*3+2,segments*3+1);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.userData={kind:'helical-v-thread',turns,rootRadius,crestRadius};return geometry;
}
const polygon=(radius,n=6)=>Array.from({length:n},(_,i)=>new THREE.Vector2(Math.cos(i*Math.PI*2/n)*radius,Math.sin(i*Math.PI*2/n)*radius));

/** Physical detail meshes are separate assemblies. Positions/diameters follow
 * source evidence; threads, heads and rear rolling elements are explicit proposals. */
export function addMechanicalDetails(project,group,mpp,{own}){
  const section=project.section,horizontal=project.params.orientation==='horizontal',b=project.drawing.bounds,axis=section.axis,mid=horizontal?(b.x0+b.x1)/2:(b.y0+b.y1)/2;
  const metadata={enabled:project.params.details!==false,fasteners:[],bearings:[],proposed:true};
  if(!metadata.enabled)return {parts:0,metadata};
  const steel=own(new THREE.MeshStandardMaterial({color:'#b8c6ce',metalness:.92,roughness:.22,side:THREE.DoubleSide})),threadSteel=own(new THREE.MeshStandardMaterial({color:'#788d9a',metalness:.88,roughness:.3})),dark=own(new THREE.MeshStandardMaterial({color:'#263540',metalness:.75,roughness:.4,side:THREE.DoubleSide}));
  const mesh=(geometry,material,parent,name)=>{const o=new THREE.Mesh(geometry,material);o.name=name;o.castShadow=o.receiveShadow=true;o.userData.detailProposal=true;parent.add(o);return o;};
  const place=(assembly,point)=>{assembly.position.set(horizontal?(point[0]-mid)*mpp:(point[0]-axis)*mpp,horizontal?(axis-point[1])*mpp:(mid-point[1])*mpp,0);if(!horizontal)assembly.rotation.z=-Math.PI/2;group.add(assembly);};
  let parts=0;
  for(const f of(section.features?.fasteners??[]).slice(0,24)){
    if(![...f.center,f.length,f.diameter].every(Number.isFinite)||f.length<=0||f.diameter<=0)continue;
    const assembly=new THREE.Group(),length=f.length*mpp,r=f.diameter*mpp/2,side=f.headSide===1?1:-1,headLength=r*.95,turns=Math.max(4,Math.min(18,Math.round(length/(r*.8))));
    assembly.name='proposed-threaded-fastener';assembly.userData={detailProposal:true,sourceFeature:f.id,source:f.source,proposed:true};
    const shank=mesh(new THREE.CylinderGeometry(r*.82,r*.82,length,32),steel,assembly,'fastener-shank');shank.rotation.z=-Math.PI/2;
    mesh(helicalThreadGeometry(length*.94,r*.79,r,turns),threadSteel,assembly,'helical-thread');
    const headShape=new THREE.Shape(polygon(r*1.6)),socket=new THREE.Path(polygon(r*.62).reverse());headShape.holes.push(socket);
    const head=mesh(new THREE.ExtrudeGeometry(headShape,{depth:headLength,bevelEnabled:true,bevelSize:r*.07,bevelThickness:r*.07,bevelSegments:2,curveSegments:6}),steel,assembly,'recessed-hex-head');head.rotation.y=Math.PI/2;head.position.x=side<0?-length/2-headLength:length/2;
    const floor=mesh(new THREE.CircleGeometry(r*.62,6),dark,assembly,'socket-recess-floor');floor.rotation.y=Math.PI/2;floor.position.x=side<0?-length/2-headLength*.35:length/2+headLength*.35;
    const washer=mesh(new THREE.TorusGeometry(r*1.3,r*.18,10,40),threadSteel,assembly,'fastener-washer');washer.rotation.y=Math.PI/2;washer.position.x=side*length/2;
    place(assembly,f.center);parts++;
    metadata.fasteners.push({...f,threadTurns:turns,diameterMm:f.diameter*mpp*1000,lengthMm:f.length*mpp*1000,headStyle:'hexagonal-with-recess',threadStandard:null});
  }
  const balls=section.balls??[],used=new Set();
  for(let i=0;i<balls.length&&metadata.bearings.length<12;i++){
    if(used.has(i))continue;const a=balls[i],ai=horizontal?0:1,ri=1-ai;
    const j=balls.findIndex((c,j)=>j!==i&&!used.has(j)&&Math.abs(c.center[ai]-a.center[ai])<3&&Math.abs(c.center[ri]+a.center[ri]-2*axis)<7);
    if(j<0)continue;used.add(i);used.add(j);const z=balls[j],axial=(a.center[ai]+z.center[ai])/2,r=(a.radius+z.radius)*mpp/2,R=(Math.abs(a.center[ri]-axis)+Math.abs(z.center[ri]-axis))*mpp/2;
    if(!(R>r*2))continue;const assembly=new THREE.Group(),width=r*2.15;
    assembly.name='proposed-bearing-assembly';assembly.userData={detailProposal:true,source:'paired-observed-circular-regions',proposed:true,observedSourceCenters:[a.center,z.center]};
    for(const [inner,outer,name]of[[R-r*1.4,R-r*.96,'bearing-inner-race'],[R+r*.96,R+r*1.4,'bearing-outer-race']]){
      const bevel=r*.08,points=[[-width/2+bevel,inner],[-width/2,inner+bevel],[-width/2,outer-bevel],[-width/2+bevel,outer],[width/2-bevel,outer],[width/2,outer-bevel],[width/2,inner+bevel],[width/2-bevel,inner]];
      const lathe=mesh(new THREE.LatheGeometry([...points,points[0]].map(([x,y])=>new THREE.Vector2(y,x)),128,Math.PI/2,Math.PI),steel,assembly,name);lathe.rotation.z=-Math.PI/2;
      for(const sign of[-1,1])mesh(new THREE.ShapeGeometry(new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y*sign)))),steel,assembly,name+'-cut');
    }
    for(let n=1;n<6;n++){const t=n*Math.PI/6,ball=mesh(new THREE.SphereGeometry(r*.97,32,20),steel,assembly,'proposed-rear-rolling-element');ball.position.set(0,R*Math.cos(t),-R*Math.sin(t));}
    place(assembly,horizontal?[axial,axis]:[axis,axial]);parts++;
    metadata.bearings.push({kind:'ball-bearing',source:'paired-observed-circular-regions',sourceCenters:[a.center,z.center],observedElements:2,proposedRearElements:5,raceRadiusMm:R*1000,proposed:true,assumptions:['Pistas y cinco elementos posteriores propuestos a partir de dos círculos observados.','Ancho y disposición circunferencial de presentación; sin referencia de rodamiento normalizado.']});
  }
  return {parts,metadata};
}
