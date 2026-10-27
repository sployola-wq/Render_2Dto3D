import {drawingMask,morphology,connectedRegions,traceContour} from './discipline-analysis.js';

export const FACADE_SCHEMES=Object.freeze({
  warm:{label:'Contemporánea · mineral, madera y pizarra',wall:[231,220,199],accent:[151,108,65],roof:[65,78,86],ground:[181,178,165],accentType:'wood'},
  brick:{label:'Ladrillo cálido · carpintería oscura',wall:[174,104,72],accent:[217,206,184],roof:[60,69,78],ground:[179,175,163],accentType:'mineral'},
  mineral:{label:'Mineral claro · piedra y metal',wall:[222,222,213],accent:[115,128,130],roof:[73,82,91],ground:[188,187,177],accentType:'stone'}
});
/** The same finish selection colours independent walls and roofs in Step 3. */
export function architecturalPalette(scheme='warm'){
  const p=FACADE_SCHEMES[scheme]??FACADE_SCHEMES.warm,hex=rgb=>'#'+rgb.map(n=>n.toString(16).padStart(2,'0')).join('');
  return {wall:hex(p.wall),wood:hex(p.accent),roof:hex(p.roof),ground:hex(p.ground),metal:'#353e43',glass:'#a5c1cb'};
}
const clamp=n=>Math.max(0,Math.min(255,n)),fract=n=>n-Math.floor(n);
function faceEdges(region,w){
  const [x0,y0,x1,y1]=region.bbox,bw=x1-x0,bh=y1-y0,mask=new Uint8Array(bw*bh);
  for(const i of region.pixels)mask[(Math.floor(i/w)-y0)*bw+i%w-x0]=1;
  const points=traceContour(mask,bw,bh,Math.max(1,Math.max(bw,bh)*.006)),verticals=[];let vertical=0,slope=0,longest=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
    if(Math.abs(dx)<Math.abs(dy)*.17){vertical+=length;if(length>bh*.2)verticals.push({a:[a[0]+x0,a[1]+y0],b:[b[0]+x0,b[1]+y0],direction:(a[0]+b[0])/2<bw/2?-1:1});}
    if(Math.abs(dx)>4&&Math.abs(dy/dx)<1.2&&length>longest){longest=length;slope=dy/dx;}
  }
  return {slope,vertical,verticals};
}
function hasWindowFrame(edges,ink,w,h){
  const sides=new Set(),scale=Math.max(.45,w/1300);
  for(const {a,b,direction}of edges.verticals)for(let d=2;d<=Math.max(6,Math.round(9*scale));d++){
    let hits=0;for(const t of[.2,.35,.5,.65,.8]){const x=Math.round(a[0]+(b[0]-a[0])*t+direction*d),y=Math.round(a[1]+(b[1]-a[1])*t);if(x>=0&&x<w&&y>=0&&y<h&&ink[y*w+x])hits++;}
    if(hits>=4){sides.add(direction);break;}
  }
  return sides.size===2;
}
/** Finish only existing enclosed faces, with courses following their own edges.
 * These roles/materials are editable visual proposals, not CAD specifications. */
export function exteriorFaces(image){
  const {width:w,height:h}=image,ink=drawingMask(image,{threshold:180}),closed=morphology(morphology(ink,w,h,true),w,h,false),faces=[];
  for(const r of connectedRegions(closed,w,h,0)){
    if(r.edge||r.count<=Math.max(16,w*h*.000025))continue;
    const [x0,y0,x1,y1]=r.bbox,bw=x1-x0,bh=y1-y0,cy=(y0+y1)/2,fill=r.count/(bw*bh),edges=faceEdges(r,w);
    let role='wall';
    if(r.count>w*h*.025&&cy<h*.36&&edges.vertical<bh*.7||r.count>w*h*.006&&cy<h*.39&&fill<.4)role='roof';
    else if(r.count>w*h*.04&&cy>h*.5)role='ground';
    else if(r.count<w*h*.008&&bh>h*.009&&bw/bh>.5&&bw/bh<3&&cy>h*.22&&fill>.36&&edges.vertical>bh*1.08&&hasWindowFrame(edges,closed,w,h))role='glass';
    else if(r.count>w*h*.005&&bw/bh>.17&&bw/bh<.58&&edges.vertical>bh*.8)role='accent';
    else if(bh<h*.035&&bw>bh*2.2)role='trim';
    faces.push({pixels:r.pixels,bbox:r.bbox,role,slope:edges.slope});
  }
  return faces;
}
export function exteriorPixel(part,x,y,edge,{scheme='warm',material='auto',width=1300,materials={}}={}){
  const palette=FACADE_SCHEMES[scheme]??FACADE_SCHEMES.warm,role=part.role,scale=Math.max(.35,width/1300),u=x/scale,v=(y-part.slope*x)/scale;
  const noise=(((Math.imul(x,374761393)^Math.imul(y,668265263))>>>0)%1024)/1024-.5;
  const faceLight=part.slope>.15?1.04:part.slope<-.15?.89:.98,ao=.19*Math.exp(-edge/(2.7*scale)),sun=.035*Math.sin((x-y*.3)/Math.max(1,width)*Math.PI),bevel=edge<1.5*scale?.07:0;
  let color=palette.wall,detail=noise*2.5,light=faceLight-ao+sun+bevel;
  if(role==='glass'){
    const t=(y-part.bbox[1])/Math.max(1,part.bbox[3]-part.bbox[1]),shine=Math.exp(-Math.pow((fract((u+v*.27)/95)-.35)/.065,2));
    color=[64+76*t+shine*55,103+72*t+shine*48,126+66*t+shine*40];light=1-ao*.8;detail=noise*.6;
  }else if(role==='roof'){
    color=palette.roof;const course=fract(v/9),joint=fract((u+Math.floor(v/9)%2*14)/29);detail=noise*4+(course<.10?-15:course<.18?7:0)+(joint<.035?-10:0);light=.98-ao+sun;
  }else if(role==='ground'){
    color=palette.ground;const mortar=fract((u+v*.35)/45)<.035||fract(v/23)<.06;detail=noise*4+(mortar?-17:1);light=1-ao*.65;
  }else if(role==='trim'){
    color=[209,207,196];light=faceLight-ao*.7;detail=noise;
  }else if(material!=='auto'&&materials[material]){
    color=materials[material].color;if(material==='wood')detail+=Math.sin(u*.65+Math.sin(v*.023)*2)*7;
    if(materials[material].metalness>.5)light+=.16*Math.sin(v*.018)+.10*Math.exp(-Math.pow((fract(u/240)-.3)/.1,2));
  }else if(role==='accent'&&palette.accentType==='wood'){
    color=palette.accent;detail+=Math.sin(u*1.8+Math.sin(v*.022)*3)*5+(fract(u/9)<.12?-25:0);
  }else if(scheme==='brick'&&role==='wall'){
    color=palette.wall;const row=Math.floor(v/8),mortar=fract(v/8)<.15||fract((u+(row%2)*17)/34)<.045;detail+=mortar?34:(Math.sin(Math.floor((u+(row%2)*17)/34)*13+row*17)*7);
  }else if(role==='accent'){
    color=palette.accent;detail+=fract(v/18)<.055?-19:noise*3;
  }
  return color.map(c=>clamp(c*light+detail));
}
