/** Appearance-only helpers. Never infer/replace structural or furniture geometry. */
import { wallMask } from './evaluation.js';
export const APPEARANCE_PRESETS=Object.freeze({
  oak:{wood:'#b88e60',fabric:'#a7aaa0',wall:'#eee9de',stone:'#d9d7d1',metal:'#43494b'},
  neutral:{wood:'#b39b7b',fabric:'#9aa6b0',wall:'#eceef0',stone:'#d7d9d9',metal:'#515861'},
  industrial:{wood:'#9e7854',fabric:'#8b9297',wall:'#d8d8d3',stone:'#a7aaa8',metal:'#30363b'}
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function renderPoint([x,y],width,height,imageWidth,imageHeight,{offsetX=0,offsetY=0,zoom=1}={}){
  const fit=Math.min(width/imageWidth,height/imageHeight)*clamp(zoom,.7,1.4);
  return [(x-width/2-width*offsetX/100)/fit+imageWidth/2,(y-height/2-height*offsetY/100)/fit+imageHeight/2];
}
export function eligiblePresentation(record,sourceHash,width,height){
  return !!record&&record.sourceHash===sourceHash&&record.width===width&&record.height===height&&['imported','generated','linked'].includes(record.kind);
}
const green=([r,g,b])=>g>r*1.12&&g>b*1.13;
export function sampleColor(image,points,fallback,{warm=false,light=false}={}){
  if(!image)return fallback;
  const bins=new Map();
  for(const [x,y] of points){const px=Math.floor(x),py=Math.floor(y);if(px<0||py<0||px>=image.width||py>=image.height)continue;
    const i=(py*image.width+px)*4,c=Array.from(image.data.slice(i,i+3)),[r,g,b]=c,l=.2126*r+.7152*g+.0722*b;
    if(image.data[i+3]<220||l<55||l>(light?252:232)||green(c)||Math.max(...c)-Math.min(...c)>125)continue;
    if(warm&&(l<95||!(r>b*1.12&&r>=g&&g>b*.95)))continue;
    if(light&&l<175)continue;
    const key=c.map(v=>Math.floor(v/28)).join(',');const bin=bins.get(key)??{n:0,c:[0,0,0]};bin.n++;c.forEach((v,j)=>bin.c[j]+=v);bins.set(key,bin);
  }
  const best=[...bins.values()].sort((a,b)=>b.n-a.n)[0];
  if(!best||best.n<3)return fallback;
  return '#'+best.c.map(v=>Math.round(v/best.n).toString(16).padStart(2,'0')).join('');
}
export function rectangleSamples(bbox,steps=12){
  const [x0,y0,x1,y1]=bbox,points=[];
  for(let y=0;y<steps;y++)for(let x=0;x<steps;x++)points.push([x0+(x+.5)/steps*(x1-x0),y0+(y+.5)/steps*(y1-y0)]);
  return points;
}
/** Seal only known openings for floor zoning; the outside stays unpainted.
 * A tiny raster close is used for texture coverage only, never for the 3D walls. */
export function floorZones(architecture,maxSize=600){
  const ratio=Math.min(1,maxSize/Math.max(architecture.width,architecture.height)),width=Math.max(1,Math.round(architecture.width*ratio)),height=Math.max(1,Math.round(architecture.height*ratio));
  const sx=width/architecture.width,sy=height/architecture.height;
  const data={width,height,wallPolygons:(architecture.wallPolygons??[]).map(p=>({outer:p.outer.map(([x,y])=>[x*sx,y*sy]),holes:(p.holes??[]).map(r=>r.map(([x,y])=>[x*sx,y*sy]))})),walls:(architecture.runs??architecture.walls??[]).map(w=>({...w,from:w.from*(w.axis==='h'?sx:sy),to:w.to*(w.axis==='h'?sx:sy),c:w.c*(w.axis==='h'?sy:sx),thickness:w.thickness*Math.max(sx,sy)}))};
  const mask=wallMask(data);
  for(const o of architecture.openings??[]){const t=(o.thickness??4)/2+2,x0=(o.axis==='h'?o.from:o.c-t)*sx,x1=(o.axis==='h'?o.to:o.c+t)*sx,y0=(o.axis==='h'?o.c-t:o.from)*sy,y1=(o.axis==='h'?o.c+t:o.to)*sy;
    for(let y=Math.max(0,Math.floor(y0));y<Math.min(height,Math.ceil(y1));y++)for(let x=Math.max(0,Math.floor(x0));x<Math.min(width,Math.ceil(x1));x++)mask[y*width+x]=1;
  }
  const labels=new Int32Array(width*height),queue=new Int32Array(width*height),zones=[];labels.fill(-1);
  for(let i=0;i<labels.length;i++)if(mask[i])labels[i]=-2;
  for(let start=0;start<labels.length;start++){
    if(labels[start]!==-1)continue;
    const id=zones.length;let head=0,tail=1,touchesEdge=false,x0=width,y0=height,x1=0,y1=0;queue[0]=start;labels[start]=id;
    while(head<tail){const index=queue[head++],x=index%width,y=Math.floor(index/width);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);if(x===0||y===0||x===width-1||y===height-1)touchesEdge=true;
      for(const next of [x>0?index-1:-1,x<width-1?index+1:-1,y>0?index-width:-1,y<height-1?index+width:-1])if(next>=0&&labels[next]===-1){labels[next]=id;queue[tail++]=next;}
    }
    zones.push({id,count:tail,interior:!touchesEdge&&tail>Math.max(8,width*height*.0001),bounds:[x0/sx,y0/sy,(x1+1)/sx,(y1+1)/sy]});
  }
  return {width,height,labels,zones,sx,sy};
}
export function appearancePalette(image,frame,preset='oak',registration={}){
  const palette={...(APPEARANCE_PRESETS[preset]??APPEARANCE_PRESETS.oak),sampled:0};
  if(!image)return palette;
  const points=rectangleSamples([0,0,frame.width,frame.height],50).map(p=>renderPoint(p,frame.width,frame.height,image.width,image.height,registration));
  const wood=sampleColor(image,points,null,{warm:true}),wall=sampleColor(image,points,null,{light:true});
  if(wood){palette.wood=wood;palette.sampled++;}if(wall){palette.wall=wall;palette.sampled++;}
  const neutral=points.filter(([x,y])=>{const a=Math.floor(x),b=Math.floor(y);if(a<0||b<0||a>=image.width||b>=image.height)return false;const i=(b*image.width+a)*4,r=image.data[i],g=image.data[i+1],blue=image.data[i+2],l=(r+g+blue)/3;return l>110&&l<210&&Math.max(r,g,blue)-Math.min(r,g,blue)<30;});
  palette.fabric=sampleColor(image,neutral,'#b9bec4');return palette;
}
export function objectAppearanceColor(object,image,frame,fallback,registration={}){
  if(!object?.bbox||!image)return fallback;
  const [a,b,c,d]=object.bbox,dx=(c-a)*.2,dy=(d-b)*.2;
  const points=rectangleSamples([a+dx,b+dy,c-dx,d-dy]).map(p=>renderPoint(p,frame.width,frame.height,image.width,image.height,registration));
  return sampleColor(image,points,fallback);
}
export function floorFinishes(zoning,objects,image,frame,palette,preset='oak',registration={}){
  const mapped=new Map();
  for(const zone of zoning.zones.filter(z=>z.interior)){
    const inside=([x,y])=>{const a=Math.floor(x*zoning.sx),b=Math.floor(y*zoning.sy);return a>=0&&a<zoning.width&&b>=0&&b<zoning.height&&zoning.labels[b*zoning.width+a]===zone.id;};
    const contents=objects.filter(o=>o.bbox&&inside([(o.bbox[0]+o.bbox[2])/2,(o.bbox[1]+o.bbox[3])/2]));
    const wet=zone.wet||!zone.outdoor&&!contents.some(o=>o.category==='bed'&&(o.confidence??1)>=.35)&&contents.some(o=>['toilet','bathtub'].includes(o.category));
    const points=rectangleSamples(zone.bounds,30).filter(p=>inside(p)&&!contents.some(o=>p[0]>=o.bbox[0]&&p[0]<=o.bbox[2]&&p[1]>=o.bbox[1]&&p[1]<=o.bbox[3])).map(p=>renderPoint(p,frame.width,frame.height,image?.width??frame.width,image?.height??frame.height,registration));
    const wood=sampleColor(image,points,null,{warm:true}),color=zone.outdoor?palette.wood:wet?sampleColor(image,points,palette.stone,{light:true}):wood??(preset==='oak'?palette.wood:palette.stone);
    mapped.set(zone.id,{color,kind:zone.outdoor?'wood':wet?'tile':wood||preset==='oak'?'wood':preset==='industrial'?'concrete':'tile',bounds:zone.bounds});
  }
  return mapped;
}
/** Cosmetic exterior coverage from closed ink outlines (e.g. a porch).
 * Never extrudes these lines, creates walls, or includes them in metric geometry. */
export function addOutlinedExterior(zoning,image,architecture){
  if(!image?.data)return zoning;
  const {width,height}=zoning,n=width*height,ink=new Uint8Array(n),blocked=new Uint8Array(n),seen=new Uint8Array(n),queue=new Int32Array(n),labels=new Int32Array(zoning.labels),zones=[...zoning.zones];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const a=Math.min(image.width-1,Math.floor((x+.5)/width*image.width)),b=Math.min(image.height-1,Math.floor((y+.5)/height*image.height)),i=(b*image.width+a)*4;ink[y*width+x]=image.data[i+3]>128&&(.299*image.data[i]+.587*image.data[i+1]+.114*image.data[i+2])<195?1:0;}
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++)if(ink[y*width+x])for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)blocked[(y+dy)*width+x+dx]=1;
  const points=(architecture.wallPolygons??[]).flatMap(p=>p.outer);if(!points.length)return zoning;
  const minX=Math.min(...points.map(p=>p[0]))*zoning.sx,maxX=Math.max(...points.map(p=>p[0]))*zoning.sx,minY=Math.min(...points.map(p=>p[1]))*zoning.sy,maxY=Math.max(...points.map(p=>p[1]))*zoning.sy;
  for(let start=0;start<n;start++){
    if(seen[start]||blocked[start])continue;let head=0,tail=1,edge=false,outside=0,insideBounds=0,x0=width,x1=0,y0=height,y1=0;queue[0]=start;seen[start]=1;
    while(head<tail){const i=queue[head++],x=i%width,y=Math.floor(i/width);if(!x||!y||x===width-1||y===height-1)edge=true;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
      if(x>=minX&&x<=maxX&&y>=minY&&y<=maxY)insideBounds++;
      const label=zoning.labels[i];if(label>=0&&!zoning.zones[label].interior)outside++;
      for(const next of [x?i-1:-1,x<width-1?i+1:-1,y?i-width:-1,y<height-1?i+width:-1])if(next>=0&&!seen[next]&&!blocked[next]){seen[next]=1;queue[tail++]=next;}
    }
    if(edge||tail<n*.012||tail>n*.45||outside/tail<.85||insideBounds/tail<.98||x1-x0<width*.06||y1-y0<height*.06)continue;
    const id=zones.length;zones.push({id,count:tail,interior:true,outdoor:true,bounds:[x0/zoning.sx,y0/zoning.sy,(x1+1)/zoning.sx,(y1+1)/zoning.sy]});for(let i=0;i<tail;i++)labels[queue[i]]=id;
    // Fill enclosed ink islands (room labels), so annotations never become white holes.
    const holes=new Uint8Array(n),walk=new Int32Array(n);let h=0,t=0;
    const push=i=>{if(!holes[i]&&labels[i]!==id){holes[i]=1;walk[t++]=i;}};
    for(let x=x0;x<=x1;x++){push(y0*width+x);push(y1*width+x);}for(let y=y0;y<=y1;y++){push(y*width+x0);push(y*width+x1);}
    while(h<t){const i=walk[h++],x=i%width,y=Math.floor(i/width);for(const next of [x>x0?i-1:-1,x<x1?i+1:-1,y>y0?i-width:-1,y<y1?i+width:-1])if(next>=0)push(next);}
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=y*width+x,label=zoning.labels[i];if(!holes[i]&&label>=0&&!zoning.zones[label].interior)labels[i]=id;}
  }
  return {...zoning,labels,zones};
}
/** Learned wet-room masks affect finishes only, clipped to the existing floor coverage. */
export function applyFinishRegions(zoning,regions=[]){
  const labels=new Int32Array(zoning.labels),zones=zoning.zones.map(o=>({...o}));
  for(const region of regions){
    if(region.confidence<.7||!['kitchen','bathroom'].includes(region.category)||!region.outer?.length)continue;
    const coverage=wallMask({width:zoning.width,height:zoning.height,wallPolygons:[{outer:region.outer.map(([x,y])=>[x*zoning.sx,y*zoning.sy]),holes:[]}]});
    const id=zones.length;let count=0;for(let i=0;i<labels.length;i++){const old=labels[i];if(coverage[i]&&old>=0&&zones[old].interior&&!zones[old].outdoor){labels[i]=id;count++;}}
    if(count)zones.push({id,count,interior:true,wet:true,category:region.category,bounds:[Math.min(...region.outer.map(p=>p[0])),Math.min(...region.outer.map(p=>p[1])),Math.max(...region.outer.map(p=>p[0])),Math.max(...region.outer.map(p=>p[1]))]});
  }
  return {...zoning,labels,zones};
}
