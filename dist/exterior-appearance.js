import * as THREE from './vendor/three.module.js';
import {traceContour} from './discipline-analysis.js';
const hex=values=>'#'+values.map(n=>Math.round(n).toString(16).padStart(2,'0')).join('');
export function exteriorPalette(image){
  const groups={wall:[],wood:[],metal:[],glass:[]},stride=Math.max(1,Math.ceil(image.width*image.height/90000));
  for(let i=0;i<image.width*image.height;i+=stride){const k=i*4,[r,g,b]=image.data.slice(k,k+3),hi=Math.max(r,g,b),lo=Math.min(r,g,b),l=(r+g+b)/3;if(image.data[k+3]<200||lo>238)continue;
    if(l>100&&l<225&&(hi-lo)<45)groups.wall.push([r,g,b]);
    if(r>g*1.13&&g>b*1.1&&r>85&&r<235&&b<165)groups.wood.push([r,g,b]);
    if(hi<80&&hi-lo<35)groups.metal.push([r,g,b]);
    if(b>r*1.08&&g>r*1.03&&l>70&&l<220)groups.glass.push([r,g,b]);
  }
  const defaults={wall:'#d7cdbd',wood:'#a46e40',metal:'#353b3e',glass:'#8faab7'},palette={};for(const[key,values]of Object.entries(groups))palette[key]=values.length>20?hex([0,1,2].map(c=>values.reduce((n,p)=>n+p[c],0)/values.length)):defaults[key];return palette;
}
/** Sample actual plaster pixels, excluding bright background, glazing and wood.
 * The texture and palette belong to this model; no interior material is mutated. */
export function facadeFinish(canvas,drawing){
  const sample=document.createElement('canvas'),scale=Math.min(1,640/canvas.width);sample.width=Math.round(canvas.width*scale);sample.height=Math.round(canvas.height*scale);const c=sample.getContext('2d');c.drawImage(canvas,0,0,sample.width,sample.height);const image=c.getImageData(0,0,sample.width,sample.height),palette=exteriorPalette(image);let best=null;
  for(let y=16;y<image.height-24;y+=12)for(let x=16;x<image.width-24;x+=12){let valid=0,sum=0,sq=0;for(let dy=0;dy<20;dy+=2)for(let dx=0;dx<20;dx+=2){const k=((y+dy)*image.width+x+dx)*4,r=image.data[k],g=image.data[k+1],b=image.data[k+2],l=(r+g+b)/3;if(l>130&&l<230&&Math.max(r,g,b)-Math.min(r,g,b)<35)valid++;sum+=l;sq+=l*l;}const variance=sq/100-(sum/100)**2;if(valid>94&&variance<180&&(!best||variance<best.variance))best={x,y,variance};}
  let wallMap=null;if(best){const patch=document.createElement('canvas');patch.width=patch.height=128;patch.getContext('2d').drawImage(canvas,best.x/scale,best.y/scale,20/scale,20/scale,0,0,128,128);wallMap=new THREE.CanvasTexture(patch);wallMap.colorSpace=THREE.SRGBColorSpace;wallMap.wrapS=wallMap.wrapT=THREE.MirroredRepeatWrapping;wallMap.repeat.set(.8,.8);wallMap.anisotropy=8;}
  const glassFaces=[];for(const face of drawing.faces??[]){if(!face.glass)continue;let blue=0,seen=0;const step=Math.max(1,Math.floor(face.pixels.length/150));for(let j=0;j<face.pixels.length;j+=step){const p=face.pixels[j],x=p%drawing.width,y=Math.floor(p/drawing.width),k=(Math.min(image.height-1,Math.floor(y/drawing.height*image.height))*image.width+Math.min(image.width-1,Math.floor(x/drawing.width*image.width)))*4,r=image.data[k],g=image.data[k+1],b=image.data[k+2];if(b>r*1.07&&g>r*1.02&&b>80)blue++;seen++;}if(blue/seen>.12)glassFaces.push(face);}
  return {palette,wallMap,glassFaces};
}
export function addFacadeGlazing(group,drawing,finish,mpp,{own}){
  const b=drawing.bounds,point=q=>[(q[0]-(b.x0+b.x1)/2)*mpp,(b.y1-q[1])*mpp],glass=own(new THREE.MeshPhysicalMaterial({color:finish.palette.glass,metalness:.15,roughness:.12,transparent:true,opacity:.16,clearcoat:1,clearcoatRoughness:.08,depthWrite:false,side:THREE.DoubleSide}));
  for(const face of finish.glassFaces){const mask=new Uint8Array(drawing.width*drawing.height);for(const i of face.pixels)mask[i]=1;const ring=traceContour(mask,drawing.width,drawing.height);if(ring.length<3)continue;const shape=new THREE.Shape(ring.map(p=>new THREE.Vector2(...point(p)))),mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),glass);mesh.position.z=Math.max(.006,mpp*.7);mesh.userData.annotation=true;mesh.userData.facadeGlazing=true;group.add(mesh);}
  group.userData.exteriorAppearance={source:'project-presentation',palette:finish.palette,reflectivePanes:finish.glassFaces.length,wallTexture:!!finish.wallMap};
}
