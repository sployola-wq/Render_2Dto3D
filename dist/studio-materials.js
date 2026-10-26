import * as THREE from './vendor/three.module.js';
let pending;
export async function loadMaterialAtlas(){
  return pending??=(async()=>{const image=new Image();image.src='./assets/materials/material-atlas-v29.png';try{await image.decode();}catch{return null;}const result={};for(const [key,x,y]of[['plaster',0,0],['wood',1,0],['steel',0,1],['cast',1,1]]){const c=document.createElement('canvas');c.width=c.height=512;c.getContext('2d').drawImage(image,x*image.naturalWidth/2,y*image.naturalHeight/2,image.naturalWidth/2,image.naturalHeight/2,0,0,512,512);result[key]=c;}const sky=new Image();sky.src='./assets/materials/daylight-environment-v29.png';try{await sky.decode();result.environment=sky;}catch{}return result;})();
}
export function studioTexture(canvas,textures,{repeat=1,data=false}={}){if(!canvas)return null;const t=new THREE.CanvasTexture(canvas);t.colorSpace=data?THREE.NoColorSpace:THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.MirroredRepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=8;textures.add(t);return t;}

export function reflectionEnvironment(renderer,image){const texture=new THREE.Texture(image);texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;const generator=new THREE.PMREMGenerator(renderer),target=generator.fromEquirectangular(texture);generator.dispose();texture.dispose();return target;}
