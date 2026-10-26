import * as THREE from './vendor/three.module.js';
export const VISUAL_CATEGORIES=new Set(['bed','sofa','chair','table','desk','toilet','sink','bathtub','wardrobe','cupboard','stove','refrigerator','washingmachine']);
/** Optional catalogue skins, fitted to the recognized footprint and orientation.
 * These are presentation meshes, never new detections or replacement measurements. */
export function furnitureVisual(category,width,depth,m){
  if(!VISUAL_CATEGORIES.has(category)||width<=0||depth<=0)return null;
  const g=new THREE.Group(),w=width,d=depth;
  function box(a,h,b,x,y,z,mat,r=.035){
    const bevel=Math.min(.03,h*.22,a*.055,b*.055,r*.7);a-=2*bevel;b-=2*bevel;
    r=Math.max(.001,Math.min(r-bevel,a*.2,b*.2));const x0=-a/2,y0=-b/2,s=new THREE.Shape();s.moveTo(x0+r,y0);s.lineTo(x0+a-r,y0);s.quadraticCurveTo(x0+a,y0,x0+a,y0+r);s.lineTo(x0+a,y0+b-r);s.quadraticCurveTo(x0+a,y0+b,x0+a-r,y0+b);s.lineTo(x0+r,y0+b);s.quadraticCurveTo(x0,y0+b,x0,y0+b-r);s.lineTo(x0,y0+r);s.quadraticCurveTo(x0,y0,x0+r,y0);
    const geometry=new THREE.ExtrudeGeometry(s,{depth:Math.max(.001,h-2*bevel),bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:3,curveSegments:6,steps:1});geometry.rotateX(-Math.PI/2);geometry.translate(0,bevel,0);
    const uv=geometry.attributes.uv,position=geometry.attributes.position,normal=geometry.attributes.normal;for(let i=0;i<uv.count;i++){const px=position.getX(i),py=position.getY(i),pz=position.getZ(i);if(Math.abs(normal.getY(i))>.6)uv.setXY(i,px/(a+2*bevel)+.5,.5-pz/(b+2*bevel));else if(Math.abs(normal.getX(i))>.6)uv.setXY(i,pz/(b+2*bevel)+.5,py/h);else uv.setXY(i,px/(a+2*bevel)+.5,py/h);}
    const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;
  }
  function ellipsoid(a,h,b,x,y,z,mat){const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,24,12),mat);mesh.scale.set(a/2,h/2,b/2);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;}
  const legs=(height,spread=.37)=>{for(const x of [-1,1])for(const z of [-1,1])box(.045,height,.045,x*w*spread,0,z*d*spread,m.metal,.008);};
  if(category==='bed'){
    legs(.12);box(w*.95,.16,d*.95,0,.1,0,m.wood);box(w,.22,d,0,.26,0,m.linen,.08);
    box(w*.98,.045,d*.65,0,.48,d*.15,m.fabric,.025);box(w*.99,.012,d*.12,0,.525,d*.33,m.throw,.018);
    const count=w>1.25?2:1;for(let i=0;i<count;i++){const pillow=box(w*.82/count,.13,d*.23,(i-(count-1)/2)*w*.45,.48,-d*.33,m.linen,.065);pillow.rotation.y=(i%2?1:-1)*.035;}
    for(let i=1;i<5;i++)box(w*.98,.003,.006,0,.528,d*(.15+(i/5-.5)*.60),m.throw,.002);
    box(w,.65,Math.min(.09,d*.08),0,0,-d*.46,m.wood,.025);
  }else if(category==='sofa'){
    legs(.1);box(w,.24,d,0,.1,0,m.fabric,.08);box(w,.43,d*.15,0,.3,-d*.41,m.fabric,.05);
    for(const x of [-1,1])box(w*.09,.35,d,x*w*.45,.24,0,m.fabric,.04);
    const seats=w>1.6?3:w>1?2:1;for(let i=0;i<seats;i++){const x=(i-(seats-1)/2)*w*.8/seats;box(w*.77/seats,.14,d*.73,x,.34,d*.035,m.fabric,.045);box(w*.76/seats,.28,d*.15,x,.48,-d*.30,m.fabric,.045);}
    for(const side of [-1,1]){const cushion=box(w*.15,.24,d*.18,side*w*.28,.47,-d*.20,m.throw,.055);cushion.rotation.z=side*.18;}
  }else if(category==='chair'){
    legs(.42);box(w,.10,d,0,.42,0,m.fabric,.04);box(w,.37,d*.10,0,.5,-d*.43,m.fabric,.04);
  }else if(category==='table'||category==='desk'){
    legs(.7);box(w,.07,d,0,.7,0,m.wood,.06);
    if(category==='desk')box(w*.25,.55,d*.8,-w*.3,.08,0,m.cabinet,.02);
  }else if(category==='toilet'){
    ellipsoid(w*.65,.35,d*.55,0,.2,d*.1,m.ceramic);box(w*.86,.08,d*.65,0,.34,d*.06,m.ceramic,.09);ellipsoid(w*.58,.015,d*.40,0,.425,d*.08,m.water);box(w*.8,.4,d*.22,0,.05,-d*.35,m.ceramic,.04);
  }else if(category==='bathtub'){
    box(w,.46,d,0,0,0,m.ceramic,.10);box(w*.78,.015,d*.82,0,.462,0,m.water,.12);box(w*.63,.008,d*.66,0,.48,0,m.inner,.1);
  }else if(category==='sink'){
    box(w,.72,d,0,0,0,m.cabinet,.02);box(w,.055,d,0,.72,0,m.ceramic,.025);ellipsoid(w*.65,.015,d*.6,0,.78,0,m.water);
    box(.025,.13,.025,0,.78,-d*.35,m.metal,.005);box(.025,.025,d*.18,0,.89,-d*.27,m.metal,.005);
  }else if(category==='stove'){
    box(w,.76,d,0,0,0,m.cabinet,.02);box(w,.025,d,0,.76,0,m.metal,.018);
    for(const x of [-1,1])for(const z of [-1,1])ellipsoid(w*.27,.008,d*.27,x*w*.24,.79,z*d*.24,m.inner);
  }else if(category==='washingmachine'){
    box(w,.8,d,0,0,0,m.ceramic,.025);const drum=ellipsoid(w*.65,.4,d*.015,0,.42,d*.502,m.metal);drum.scale.y=w*.65/2;drum.scale.z=.015;
  }else{
    const height=category==='cupboard'?.85:2;box(w,height,d,0,0,0,category==='refrigerator'?m.ceramic:m.cabinet,.025);
    const panels=Math.max(2,Math.min(4,Math.round(w/.55)));for(let i=1;i<panels;i++)box(.006,height*.94,.008,(i/panels-.5)*w,.03,d*.501,m.metal,.001);
    for(let i=0;i<panels;i++)box(.012,.16,.025,((i+.65)/panels-.5)*w,height*.52,d*.51,m.metal,.003);
  }
  return g;
}
