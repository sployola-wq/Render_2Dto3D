import {renderPoint,rectangleSamples} from './appearance-mapping.js';
const luminance=([r,g,b])=>.2126*r+.7152*g+.0722*b;
function pixel(image,x,y){const a=Math.floor(x),b=Math.floor(y);if(a<0||b<0||a>=image.width||b>=image.height)return null;const i=(b*image.width+a)*4;return Array.from(image.data.subarray(i,i+4));}
export function registrationFromBounds(image,frame,bounds,source){
  if(!source||!bounds||![source.x0,source.y0,source.x1,source.y1,bounds.width,bounds.height].every(Number.isFinite)||source.x1<=source.x0||source.y1<=source.y0)return {offsetX:0,offsetY:0,zoom:1};
  const {x0,x1,y0,y1}=source,fit=Math.min(frame.width/image.width,frame.height/image.height),zx=bounds.width/((x1-x0)*fit),zy=bounds.height/((y1-y0)*fit),zoom=Math.max(.7,Math.min(1.4,Math.sqrt(zx*zy)));
  return {zoom,offsetX:Math.max(-20,Math.min(20,((bounds.x0+bounds.x1)/2-frame.width/2-((x0+x1-image.width)/2)*fit*zoom)/frame.width*100)),offsetY:Math.max(-20,Math.min(20,((bounds.y0+bounds.y1)/2-frame.height/2-((y0+y1-image.height)/2)*fit*zoom)/frame.height*100))};
}
export function estimateReferenceRegistration(image,frame,bounds){
  if(!image||!bounds)return {offsetX:0,offsetY:0,zoom:1};
  const xs=new Uint32Array(image.width),ys=new Uint32Array(image.height);
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const i=(y*image.width+x)*4,r=image.data[i],g=image.data[i+1],b=image.data[i+2];if(image.data[i+3]>220&&Math.max(r,g,b)<90&&Math.max(r,g,b)-Math.min(r,g,b)<28){xs[x]++;ys[y]++;}}
  const columns=Array.from(xs,(n,i)=>n>image.height*.08?i:-1).filter(i=>i>=0),rows=Array.from(ys,(n,i)=>n>image.width*.08?i:-1).filter(i=>i>=0);
  if(columns.length<4||rows.length<4)return {offsetX:0,offsetY:0,zoom:1};
  return registrationFromBounds(image,frame,bounds,{x0:columns[0],x1:columns.at(-1)+1,y0:rows[0],y1:rows.at(-1)+1});
}
/** Choose unobstructed real floor pixels; furniture and black baked shadows are excluded. */
export function surfacePatch(image,frame,zoning,zoneId,objects,kind,registration={}){
  if(!image)return null;const zone=zoning.zones[zoneId];if(!zone)return null;
  const [x0,y0,x1,y1]=zone.bounds,patchW=Math.max(6,Math.min((x1-x0)*.30,frame.width*.045)),patchH=Math.max(4,Math.min((y1-y0)*.30,frame.height*(kind==='wood'?.035:.065)));
  let best=null;
  for(let gy=0;gy<15;gy++)for(let gx=0;gx<15;gx++){
    const cx=x0+(gx+.5)/15*(x1-x0),cy=y0+(gy+.5)/15*(y1-y0),box=[cx-patchW/2,cy-patchH/2,cx+patchW/2,cy+patchH/2];
    const samples=rectangleSamples(box,7);let valid=0,total=0,sum=0,sum2=0;
    for(const p of samples){const x=Math.floor(p[0]*zoning.sx),y=Math.floor(p[1]*zoning.sy);if(x<0||y<0||x>=zoning.width||y>=zoning.height||zoning.labels[y*zoning.width+x]!==zoneId)continue;
      if(objects.some(o=>o.bbox&&p[0]>=o.bbox[0]-2&&p[0]<=o.bbox[2]+2&&p[1]>=o.bbox[1]-2&&p[1]<=o.bbox[3]+2))continue;
      const q=renderPoint(p,frame.width,frame.height,image.width,image.height,registration),c=pixel(image,...q);if(!c||c[3]<220)continue;const [r,g,b]=c,l=luminance(c);total++;sum+=l;sum2+=l*l;
      const green=g>r*1.1&&g>b*1.1;
      if(l>90&&l<241&&!green&&(kind==='wood'?r>b*1.1&&r>=g:Math.max(r,g,b)-Math.min(r,g,b)<48&&l>155))valid++;
    }
    if(total<48||valid<48)continue;const variance=Math.max(0,sum2/total-(sum/total)**2),score=valid-variance*.012;
    if(variance>650)continue;if(!best||score>best.score)best={box,score,frameWidth:patchW,frameHeight:patchH};
  }
  return best;
}
/** Texture coordinates for a crop inside an existing object's footprint. */
export function objectSurfaceBox(object,fraction=.55){if(!object?.bbox)return null;const [x0,y0,x1,y1]=object.bbox,dx=(x1-x0)*(1-fraction)/2,dy=(y1-y0)*(1-fraction)/2;return [x0+dx,y0+dy,x1-dx,y1-dy];}
export function cropReference(canvas,frame,box,registration,makeCanvas,max=256){
  const a=renderPoint(box.slice(0,2),frame.width,frame.height,canvas.width,canvas.height,registration),b=renderPoint(box.slice(2),frame.width,frame.height,canvas.width,canvas.height,registration);
  if(a[0]<0||a[1]<0||b[0]>canvas.width||b[1]>canvas.height||b[0]-a[0]<2||b[1]-a[1]<2)return null;
  const f=Math.min(1,max/Math.max(b[0]-a[0],b[1]-a[1])),out=makeCanvas(Math.max(2,Math.round((b[0]-a[0])*f)),Math.max(2,Math.round((b[1]-a[1])*f)));
  out.getContext('2d').drawImage(canvas,a[0],a[1],b[0]-a[0],b[1]-a[1],0,0,out.width,out.height);return out;
}
/** Preserve source vegetation/stone outdoors while excluding printed walls and furnishings. */
export function exteriorReferencePixels(image,frame,zoning,registration={}){
  const out=new Uint8ClampedArray(zoning.width*zoning.height*4);let count=0,greenCount=0,greenR=0,greenG=0,greenB=0;
  for(let y=0;y<zoning.height;y++)for(let x=0;x<zoning.width;x++){const i=y*zoning.width+x,id=zoning.labels[i];if(id<0||zoning.zones[id]?.interior)continue;
    const q=renderPoint([(x+.5)/zoning.sx,(y+.5)/zoning.sy],frame.width,frame.height,image.width,image.height,registration),c=pixel(image,...q);if(!c)continue;const [r,g,b]=c,l=luminance(c),green=g>r*1.03&&g>b*1.1,stone=Math.max(r,g,b)-Math.min(r,g,b)<32&&l>85&&l<225;
    if(!green&&!stone||l<32)continue;if(green){greenCount++;greenR+=r;greenG+=g;greenB+=b;}out.set([r,g,b,255],i*4);count++;
  }
  const {width,height}=zoning,expanded=new Uint8Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(out[(y*width+x)*4+3])for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height)expanded[(y+dy)*width+x+dx]=1;
  for(let y=2;y<height-2;y++)for(let x=2;x<width-2;x++){const i=y*width+x,id=zoning.labels[i];if(id<0||zoning.zones[id]?.interior||out[i*4+3])continue;let solid=true;for(let dy=-2;dy<=2&&solid;dy++)for(let dx=-2;dx<=2;dx++)if(!expanded[(y+dy)*width+x+dx]){solid=false;break;}if(solid){out.set([255,255,255,255],i*4);count++;}}
  return {width,height,data:out,count,groundColor:greenCount>count*.15?[greenR/greenCount,greenG/greenCount,greenB/greenCount]:[181,181,175]};
}

/** Reject wrong-room, garden and hard-shadow crops before using them as textiles. */
export function textileSample(image,frame,object,registration={}){
  if(!image||!object?.bbox)return {color:null,usable:false};
  const points=rectangleSamples(objectSurfaceBox(object,.42),9);let n=0,r=0,g=0,b=0;
  for(const p of points){const c=pixel(image,...renderPoint(p,frame.width,frame.height,image.width,image.height,registration));if(!c)continue;const l=luminance(c);if(c[3]>220&&l>110&&l<248&&Math.max(...c.slice(0,3))-Math.min(...c.slice(0,3))<42){n++;r+=c[0];g+=c[1];b+=c[2];}}
  return {usable:n/points.length>.88,color:n>points.length*.35?'#'+[r,g,b].map(c=>Math.round(c/n).toString(16).padStart(2,'0')).join(''):null};
}
/** Keep real grain, replacing tiny non-surface intrusions with the surrounding albedo. */
export function cleanSurfaceTexture(canvas,kind){
  if(!canvas)return null;const ctx=canvas.getContext('2d');if(!ctx.getImageData)return canvas;const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),good=new Uint8Array(canvas.width*canvas.height);let n=0,r=0,g=0,b=0;
  for(let i=0;i<good.length;i++){const k=i*4,c=Array.from(pixels.data.subarray(k,k+3)),l=luminance(c);if(l>90&&l<245&&(kind==='wood'?c[0]>c[2]*1.1&&c[0]>=c[1]:Math.max(...c)-Math.min(...c)<48&&l>150)){good[i]=1;n++;r+=c[0];g+=c[1];b+=c[2];}}
  if(n<good.length*.7)return null;const color=[r/n,g/n,b/n,255];for(let i=0;i<good.length;i++)if(!good[i])pixels.data.set(color,i*4);ctx.putImageData(pixels,0,0);return canvas;
}
