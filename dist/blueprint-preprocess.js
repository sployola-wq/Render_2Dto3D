/** Adapted from Argon's Step 1: paper normalization + cross-kernel sharpening.
 * Coordinates and dimensions are retained. The source pixel buffer is never mutated.
 */
export function enhanceBlueprintPixels({data,width,height}) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||data.length!==width*height*4)throw new Error('Lámina no válida para limpieza.');
  const luminance=new Float32Array(width*height);let total=0;
  for(let i=0;i<luminance.length;i++){const k=i*4,a=data[k+3]/255;const value=(.299*data[k]+.587*data[k+1]+.114*data[k+2])*a+255*(1-a);luminance[i]=value;total+=value;}
  const dark=total/luminance.length<115;
  if(dark)for(let i=0;i<luminance.length;i++)luminance[i]=255-luminance[i];
  const mean=dark?255-total/luminance.length:total/luminance.length;
  const white=Math.min(235,Math.max(190,mean*.96)),black=45,result=new Uint8ClampedArray(data.length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x,c=luminance[i];
    const neighbors=(y?luminance[i-width]:c)+(y<height-1?luminance[i+width]:c)+(x?luminance[i-1]:c)+(x<width-1?luminance[i+1]:c);
    const sharp=c*2.4-neighbors*.35;
    const value=sharp>=white?255:sharp<=black?12:Math.round(12+Math.pow((sharp-black)/(white-black),1.1)*243);
    const k=i*4;result[k]=result[k+1]=result[k+2]=value;result[k+3]=255;
  }
  return {data:result,width,height,backgroundNormalized:dark};
}

export const FINISH_PRESETS=Object.freeze({
  oak:{label:'Roble cálido',prompt:'Parquet de roble cálido en recintos secos; porcelanato blanco en baños y cocina; deck de madera solo donde exista una terraza.'},
  neutral:{label:'Contemporáneo',prompt:'Piedra y porcelanato claro, madera natural, muros neutros y textiles sobrios. Iluminación cenital suave.'},
  industrial:{label:'Industrial',prompt:'Hormigón pulido, acero negro mate y madera cálida, con sombras ambientales suaves.'}
});

export function createRenderRecord({sourceHash,width,height,kind,provider=null,model=null,nativeWidth=width,nativeHeight=height}){
  if(!/^[a-f0-9]{64}$/.test(sourceHash??'')||![width,height,nativeWidth,nativeHeight].every(v=>Number.isInteger(v)&&v>0)||!['technical','imported','generated','linked'].includes(kind))throw new Error('El render no tiene una identidad de origen válida.');
  return {sourceHash,width,height,nativeWidth,nativeHeight,kind,provider,model,geometryValidated:kind==='technical',createdAt:new Date().toISOString()};
}
