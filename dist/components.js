import * as THREE from 'three';
import { CATEGORY, bboxIou } from './evaluation.js';
import { openingHeights } from './architecture.js';

/** Approximate catalogue geometry; heights/orientation are not inferred. */
export function buildComponents(objects, regions, width, height, scale, wallHeight) {
  const group=new THREE.Group();
  const material = color => new THREE.MeshStandardMaterial({color,roughness:.84});
  const wood=material('#b8a17d'), white=material('#f1eee4'), fabric=material('#b3bead'), dark=material('#738774');
  const addBox=(parent,w,h,d,x,y,z,mat) => {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.02,w),Math.max(.02,h),Math.max(.02,d)),mat);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  for(const object of objects) {
    const item=new THREE.Group();item.userData={id:object.id,category:object.category};
    let bbox=object.bbox;
    if(['door','window'].includes(object.category)) {
      const region=regions.filter(r=>r.category===object.category).map(r=>({r,iou:bboxIou(r.bbox,bbox)})).sort((a,b)=>b.iou-a.iou)[0];
      if(region?.iou>.04) bbox=region.r.bbox;
    }
    const [x0,y0,x1,y1]=bbox, w=(object.placement?.widthPixels??(x1-x0))*scale,d=(object.placement?.depthPixels??(y1-y0))*scale;
    item.position.set(((x0+x1)/2-width/2)*scale,.02,((y0+y1)/2-height/2)*scale);
    item.rotation.y=object.placement?.rotation??0;
    const color=material(object.placement?'#98a89a':CATEGORY[object.category]?.color??'#a4ab9b');
    if(object.category==='bed') {
      addBox(item,w,.24,d,0,.12,0,wood);
      addBox(item,w*.96,.22,d*.96,0,.35,0,white);
      const wide=object.placement?false:w>d;
      addBox(item,wide?w*.72:w*.96,.055,wide?d*.96:d*.72,wide?w*.10:0,.485,wide?0:d*.10,fabric);
      addBox(item,wide?w*.20:w*.84,.10,wide?d*.84:d*.20,wide?-w*.36:0,.51,wide?0:-d*.36,white);
      addBox(item,wide?.09:w,.65,wide?d:.09,wide?-w/2:0,.33,wide?0:-d/2,wood);
    } else if(object.category==='sofa') {
      addBox(item,w,.32,d,0,.18,0,color);
      addBox(item,w*.88,.16,d*.82,0,.42,0,fabric);
      if(object.placement||w>=d) {
        addBox(item,w,.45,d*.15,0,.55,-d*.42,color);
        addBox(item,w*.09,.36,d,-w*.45,.5,0,color);addBox(item,w*.09,.36,d,w*.45,.5,0,color);
      } else {
        addBox(item,w*.15,.45,d,-w*.42,.55,0,color);
        addBox(item,w,.36,d*.09,0,.5,-d*.45,color);addBox(item,w,.36,d*.09,0,.5,d*.45,color);
      }
    } else if(['table','desk'].includes(object.category)) {
      addBox(item,w,.09,d,0,.73,0,wood);
      for(const sx of [-1,1])for(const sz of [-1,1])addBox(item,.06,.68,.06,sx*w*.38,.34,sz*d*.38,dark);
    } else if(object.category==='chair') {
      addBox(item,w,.09,d,0,.45,0,wood);addBox(item,w,.4,.08,0,.65,-d*.42,color);
      for(const sx of [-1,1])for(const sz of [-1,1])addBox(item,.04,.41,.04,sx*w*.35,.205,sz*d*.35,dark);
    } else if(object.category==='window') {
      const alongX=w>=d, frameW=alongX?w:Math.min(w,.14),frameD=alongX?Math.min(d,.14):d;
      const sill=Math.min(.9,wallHeight*.3), h=Math.min(1.2,wallHeight-sill-.1);
      const glass=new THREE.MeshStandardMaterial({color:'#7eb3bd',transparent:true,opacity:.4,roughness:.2,depthWrite:false});
      addBox(item,frameW,h,frameD,0,sill+h/2,0,glass);
      addBox(item,frameW,.07,frameD+.04,0,sill,0,white);addBox(item,frameW,.07,frameD+.04,0,sill+h,0,white);
      addBox(item,alongX?.05:frameW,h,alongX?frameD:.05,0,sill+h/2,0,white);
    } else if(object.category==='door') {
      const alongX=w>=d, h=Math.min(2.1,wallHeight-.08);
      addBox(item,alongX?w:.055,h,alongX?.055:d,0,h/2,0,new THREE.MeshStandardMaterial({color:'#c7a873',transparent:true,opacity:.65,roughness:.85}));
    } else if(['wardrobe','cupboard','refrigerator'].includes(object.category)) {
      const h=object.category==='cupboard'?.85:2.0;addBox(item,w,h,d,0,h/2,0,object.category==='refrigerator'?white:wood);
    } else if(['sink','bathtub','toilet','stove','washingmachine'].includes(object.category)) {
      const h=object.category==='bathtub'?.5:object.category==='toilet'?.45:.8;
      addBox(item,w,h,d,0,h/2,0,white);
      addBox(item,w*.7,.025,d*.66,0,h+.013,0,object.category==='stove'?dark:material('#acc2c3'));
    } else addBox(item,w,.65,d,0,.325,0,color);
    group.add(item);
  }
  return group;
}

export function buildArchitecturalOpenings(openings,width,height,scale,wallHeight) {
  const group=new THREE.Group();
  const frame=new THREE.MeshStandardMaterial({color:'#e9e6dc',roughness:.72});
  const wood=new THREE.MeshStandardMaterial({color:'#b79a71',roughness:.8});
  const glass=new THREE.MeshStandardMaterial({color:'#a8c4c8',transparent:true,opacity:.38,roughness:.18,depthWrite:false});
  const box=(parent,w,h,d,x,y,z,material)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.01,w),Math.max(.01,h),Math.max(.01,d)),material);
    mesh.position.set(x,y,z);mesh.castShadow=material!==glass;mesh.receiveShadow=true;parent.add(mesh);
  };
  for(const opening of openings) {
    const item=new THREE.Group(),along=(opening.from+opening.to)/2,w=(opening.to-opening.from)*scale;
    const {bottom,top}=openingHeights(opening.category,wallHeight),h=top-bottom,depth=opening.thickness*scale+.025;
    item.userData={category:opening.category,objectIds:opening.objectIds,wallId:opening.wallId};
    item.position.set(((opening.axis==='h'?along:opening.c)-width/2)*scale,.012,((opening.axis==='h'?opening.c:along)-height/2)*scale);
    item.rotation.y=opening.axis==='h'?0:Math.PI/2;
    const border=Math.min(.055,w*.12);
    box(item,border,h,depth,-w/2+border/2,bottom+h/2,0,frame);
    box(item,border,h,depth,w/2-border/2,bottom+h/2,0,frame);
    box(item,w,border,depth,0,top-border/2,0,frame);
    if(opening.category==='window') {
      box(item,w,border,depth,0,bottom+border/2,0,frame);
      box(item,w-2*border,h-2*border,.025,0,bottom+h/2,0,glass);
      box(item,border,h,.035,0,bottom+h/2,0,frame);
    } else box(item,w-2*border,h-border,.035,0,bottom+(h-border)/2,0,wood);
    group.add(item);
  }
  return group;
}
