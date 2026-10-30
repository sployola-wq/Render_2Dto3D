import {detectMembers} from './discipline-analysis.js';

/** Contrast-relative strokes for classification only. Paper shade, scanner
 * borders and presentation filters must not choose a reconstruction engine. */
export function classificationImage(image){
  const factor=Math.min(1,400/Math.max(image.width,image.height)),w=Math.round(image.width*factor),h=Math.round(image.height*factor),gray=new Float64Array(w*h),integral=new Float64Array((w+1)*(h+1));
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(Math.min(image.height-1,Math.floor(y/factor))*image.width+Math.min(image.width-1,Math.floor(x/factor)))*4;
    gray[y*w+x]=image.data[i+3]<100?255:.299*image.data[i]+.587*image.data[i+1]+.114*image.data[i+2];
  }
  for(let y=0;y<h;y++){let sum=0;for(let x=0;x<w;x++){sum+=gray[y*w+x];integral[(y+1)*(w+1)+x+1]=integral[y*(w+1)+x+1]+sum;}}
  const data=new Uint8ClampedArray(w*h*4).fill(255),ink=new Uint8Array(w*h),r=6;
  // Ignore solid dark frame columns/rows; their edges are not building edges.
  const frameX=new Uint8Array(w),frameY=new Uint8Array(h);
  for(let x=0;x<w;x++){let count=0;for(let y=0;y<h;y++)count+=gray[y*w+x]<45;frameX[x]=count>h*.85?1:0;}
  for(let y=0;y<h;y++){let count=0;for(let x=0;x<w;x++)count+=gray[y*w+x]<45;frameY[y]=count>w*.85?1:0;}
  for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){
    if(frameX[x]||frameX[Math.max(0,x-2)]||frameX[Math.min(w-1,x+2)]||frameY[y])continue;
    const x0=Math.max(0,x-r),x1=Math.min(w,x+r+1),y0=Math.max(0,y-r),y1=Math.min(h,y+r+1),mean=(integral[y1*(w+1)+x1]-integral[y0*(w+1)+x1]-integral[y1*(w+1)+x0]+integral[y0*(w+1)+x0])/((x1-x0)*(y1-y0));
    if(gray[y*w+x]<mean-13){ink[y*w+x]=1;data.set([0,0,0,255],(y*w+x)*4);}
  }
  return {width:w,height:h,data,ink};
}

export function drawingSignals(image){
  const normalized=classificationImage(image),{width:w,height:h,ink}=normalized,span=Math.max(w,h),lines=detectMembers(normalized,{minLength:span*.14}).filter(line=>{
    const [x,y]=line.from,dx=line.to[0]-x,dy=line.to[1]-y,n=Math.ceil(Math.hypot(dx,dy));let hits=0;
    for(let i=0;i<=n;i++){const px=Math.round(x+dx*i/n),py=Math.round(y+dy*i/n);let hit=false;for(let v=-1;v<=1;v++)for(let u=-1;u<=1;u++)if(px+u>=0&&px+u<w&&py+v>=0&&py+v<h&&ink[(py+v)*w+px+u])hit=true;hits+=hit;}
    return hits/(n+1)>.82;
  }).map(l=>{const dx=l.to[0]-l.from[0],dy=l.to[1]-l.from[1];let angle=Math.atan2(dy,dx)*180/Math.PI;if(angle>90)angle-=180;if(angle<-90)angle+=180;return {...l,angle,length:Math.hypot(dx,dy)};});
  const vertical=lines.filter(l=>Math.abs(l.angle)>83),horizontal=lines.filter(l=>Math.abs(l.angle)<5),positive=lines.filter(l=>l.angle>9&&l.angle<65),negative=lines.filter(l=>l.angle<-9&&l.angle>-65);
  const diagonalLength=[...positive,...negative].reduce((s,l)=>s+l.length,0),orthogonalLength=[...vertical,...horizontal].reduce((s,l)=>s+l.length,0);
  const diagonalFraction=diagonalLength/Math.max(1,orthogonalLength+diagonalLength),perspective=vertical.length>=3&&positive.length>=2&&negative.length>=2&&diagonalFraction>.28;
  const upperPositive=positive.filter(l=>Math.min(l.from[1],l.to[1])<h*.52&&Math.abs(l.angle)>=14&&Math.abs(l.angle)<=58),upperNegative=negative.filter(l=>Math.min(l.from[1],l.to[1])<h*.52&&Math.abs(l.angle)>=14&&Math.abs(l.angle)<=58);
  const elevationOrSection=!perspective&&vertical.length>=3&&horizontal.length>=3&&upperPositive.length>=2&&upperNegative.length>=2&&diagonalFraction>=.12;
  return {perspective,elevationOrSection,vertical:vertical.length,horizontal:horizontal.length,positive:positive.length,negative:negative.length,diagonalFraction,lineCount:lines.length,normalized};
}
