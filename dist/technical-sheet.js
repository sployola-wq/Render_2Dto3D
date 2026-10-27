import {exteriorFaces,exteriorPixel} from './exterior-finishes.js';
export const SURFACE_MATERIALS=Object.freeze({
  auto:{label:'Según disciplina · propuesto',color:[164,173,179],metalness:.8,roughness:.32},
  steel:{label:'Acero mecanizado',color:[165,174,181],metalness:.9,roughness:.3},
  aluminum:{label:'Aluminio satinado',color:[198,204,208],metalness:.88,roughness:.36},
  brass:{label:'Latón / bronce',color:[185,145,78],metalness:.88,roughness:.3},
  polymer:{label:'Polímero técnico',color:[80,89,98],metalness:0,roughness:.4},
  concrete:{label:'Hormigón / acabado mineral',color:[202,200,193],metalness:0,roughness:.88},
  wood:{label:'Madera natural',color:[166,123,79],metalness:0,roughness:.7}
});
const clamp=(n,a=0,b=255)=>Math.max(a,Math.min(b,n));
function distanceField(mask,w,h){const d=new Float32Array(w*h);for(let i=0;i<d.length;i++)d[i]=mask[i]?32:0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!mask[i])continue;d[i]=Math.min(d[i],x?d[i-1]+1:1,y?d[i-w]+1:1,x&&y?d[i-w-1]+1.42:32);}for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(!mask[i])continue;d[i]=Math.min(d[i],x<w-1?d[i+1]+1:1,y<h-1?d[i+w]+1:1,x<w-1&&y<h-1?d[i+w+1]+1.42:32);}return d;}
function materialAt(material,role,x,y,b,edge){
  let p=SURFACE_MATERIALS[material]??SURFACE_MATERIALS.steel;
  if(role==='glass')p={color:[143,176,192],metalness:.35,roughness:.16};
  if(role==='roof')p={color:[133,143,151],metalness:.18,roughness:.65};
  if(role==='ground')p={color:[216,218,211],metalness:0,roughness:.95};
  const u=(x-b[0])/Math.max(1,b[2]-b[0]),v=(y-b[1])/Math.max(1,b[3]-b[1]),noise=((((Math.imul(x,374761393)^Math.imul(y,668265263))>>>0)%1024)/1024-.5);
  const reflection=p.metalness*(.13*Math.sin(v*6.2+.4)+.2*Math.exp(-Math.pow((u-.27)/.12,2))-.13*Math.exp(-Math.pow((u-.77)/.09,2))),bevel=(edge<1.7?.18:0)-.17*Math.exp(-edge/2.1),grain=noise*(material==='wood'?5:material==='concrete'?3.4:1.5),wood=material==='wood'?Math.sin(x*.5+Math.sin(y*.025)*2)*5:0;
  return p.color.map(c=>clamp(c*(.94+reflection+bevel)+grain+wood));
}
/** All surfaces come from this source. No facade template or example image enters
 * this compositor. Linework is applied last so annotations and unused views survive. */
export function sheetSurface(image,{domain='mechanical',material='auto',facadeScheme='warm',drawing=null,views=[],faceOverrides={}}={}){
  const {width:w,height:h}=image,out=new Uint8ClampedArray(w*h*4),masks=[];
  for(let i=0;i<w*h;i++)out.set([249,250,251,255],i*4);
  const chosen=material==='auto'?(domain==='exterior'?'concrete':'steel'):material;
  if(domain==='exterior'){
    masks.push(...exteriorFaces(image));
  }else if(views.length){for(const v of views)masks.push({mask:v.mask,bbox:[v.bounds.x0,v.bounds.y0,v.bounds.x1,v.bounds.y1],role:'body'});}
  else if(drawing?.mask&&drawing.bounds){const b=drawing.bounds;masks.push({mask:drawing.mask,bbox:[b.x0,b.y0,b.x1,b.y1],role:'body'});}
  const union=new Uint8Array(w*h);for(const part of masks){if(part.pixels){for(const i of part.pixels)union[i]=1;}else for(let i=0;i<union.length;i++)if(part.mask[i])union[i]=1;}
  const distance=distanceField(union,w,h),paint=(part,i)=>out.set([...(domain==='exterior'?exteriorPixel(part,i%w,Math.floor(i/w),distance[i],{scheme:facadeScheme,material,width:w,materials:SURFACE_MATERIALS}):materialAt(chosen,part.role,i%w,Math.floor(i/w),part.bbox,distance[i])),255],i*4);
  for(const part of masks){if(part.pixels){for(const i of part.pixels)paint(part,i);}else for(let y=part.bbox[1];y<part.bbox[3];y++)for(let x=part.bbox[0];x<part.bbox[2];x++){const i=y*w+x;if(part.mask[i])paint(part,i);}}
  for(const [id,type]of Object.entries(faceOverrides)){const face=drawing?.faces?.[id];if(!face)continue;const finish={wall:'concrete',metal:'steel',wood:'wood'}[type]??chosen;for(const i of face.pixels)out.set([...materialAt(finish,type==='glass'?'glass':'body',i%w,Math.floor(i/w),face.bbox,distance[i]),255],i*4);}
  return {width:w,height:h,data:out};
}
export function retainDrawingInk(surface,image){
  if(surface.width!==image.width||surface.height!==image.height)throw new Error('La lámina y su acabado deben compartir el mismo marco.');
  const data=new Uint8ClampedArray(surface.data);for(let i=0;i<data.length;i+=4)for(let k=0;k<3;k++)data[i+k]=Math.round(data[i+k]*image.data[i+k]/255);return {...surface,data};
}
export function sheetCanvas(source,options){const image=source.getContext('2d').getImageData(0,0,source.width,source.height),surface=sheetSurface(image,options),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').putImageData(new ImageData(surface.data,image.width,image.height),0,0);return canvas;}
export function completeTechnicalSheet(source,{surface,primary,primaryProfiles=[],companion=null,companionProfile=null}){
  const canvas=document.createElement('canvas'),density=Math.min(3,2560/Math.max(source.width,source.height));canvas.width=Math.round(source.width*density);canvas.height=Math.round(source.height*density);const c=canvas.getContext('2d');c.drawImage(surface,0,0,canvas.width,canvas.height);
  const overlay=(image,profiles)=>{if(!image||!profiles.length)return;c.save();c.scale(canvas.width/source.width,canvas.height/source.height);c.beginPath();for(const p of profiles){p.outer.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}c.clip();c.drawImage(image,0,0,source.width,source.height);c.restore();};
  overlay(primary,primaryProfiles);overlay(companion,companionProfile?[companionProfile]:[]);
  c.globalCompositeOperation='multiply';c.drawImage(source,0,0,canvas.width,canvas.height);c.globalCompositeOperation='source-over';return canvas;
}
