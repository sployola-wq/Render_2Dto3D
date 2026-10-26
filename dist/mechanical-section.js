import {drawingMask, morphology, connectedRegions, traceContour, validateClosedProfile} from './discipline-analysis.js';
import {boundsOf} from './technical-geometry.js';
/** Recover the material shown by section hatching. Large closed white regions
 * remain voids; unlike silhouette filling, this never fills every enclosure. */
export function extractMechanicalSection(image,drawing,{axis=null,orientation='horizontal',core='void',threshold=205}={}){
  const {width:w,height:h}=image,b=drawing.bounds,horizontal=orientation==='horizontal',center=axis??(horizontal?(b.y0+b.y1)/2:(b.x0+b.x1)/2),ink=drawingMask(image,{threshold,roi:drawing.roi}),closed=morphology(morphology(ink,w,h,true),w,h,false),material=new Uint8Array(closed),pixelScale=Math.max(1,Math.min(w,h)/400),fillLimit=Math.round(210*pixelScale*pixelScale),balls=[],voids=[];
  for(const region of connectedRegions(closed,w,h,0)){
    if(region.edge)continue;const [x0,y0,x1,y1]=region.bbox,cx=(x0+x1)/2,cy=(y0+y1)/2,bw=x1-x0,bh=y1-y0,axial=horizontal?bw:bh,radial=horizontal?bh:bw,r=Math.abs((horizontal?cy:cx)-center),inside=drawing.mask[Math.floor(cy)*w+Math.floor(cx)];if(!inside)continue;
    const circular=region.count>=18*pixelScale**2&&region.count<=180*pixelScale**2&&bw/bh>.72&&bw/bh<1.38&&region.count/(bw*bh)>.62&&region.count/(bw*bh)<.92&&r>Math.min(b.width,b.height)*.055;
    if(circular){balls.push({center:[cx,cy],radius:Math.sqrt(region.count/Math.PI),source:'closed-circular-region'});continue;}
    const shaft=core==='shaft'&&axial>(horizontal?b.width:b.height)*.16&&radial<Math.min(b.width,b.height)*.45&&(horizontal?y0<=center&&y1>=center:x0<=center&&x1>=center);
    if(region.count<=fillLimit||shaft)for(const i of region.pixels)material[i]=1;else if(region.count>fillLimit)voids.push({bbox:region.bbox,pixels:region.count});
  }
  // Keep observed solid material inside the recognized component, on one side of
  // the axis. The rotational counterpart is constructed in the geometry layer.
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!drawing.mask[i]|| (horizontal?y:x)>=center)material[i]=0;}
  const solid=morphology(morphology(material,w,h,false),w,h,true),profiles=[];
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(material[i]&&(!drawing.mask[i-1]||!drawing.mask[i+1]||!drawing.mask[i-w]||!drawing.mask[i+w]))solid[i]=1;}
  for(const part of connectedRegions(solid,w,h).filter(c=>c.count>=Math.max(25,35*pixelScale**2)).sort((a,b)=>b.count-a.count).slice(0,24)){
    const region=new Uint8Array(w*h);for(const i of part.pixels)region[i]=1;const outer=traceContour(region,w,h,.65);if(outer.length<3)continue;const holes=[];
    for(const hole of connectedRegions(region,w,h,0).filter(c=>!c.edge&&c.count>12*pixelScale**2)){const inner=new Uint8Array(w*h);for(const i of hole.pixels)inner[i]=1;const ring=traceContour(inner,w,h,.65);if(ring.length>=3)holes.push(ring);}
    const profile={outer,holes,source:'raster-section',bounds:boundsOf(outer)};try{validateClosedProfile(profile);profiles.push(profile);}catch{/* Ambiguous contours remain visible in the source; never triangulate invalid rings. */}
  }
  if(!profiles.length)throw new Error('No se pudo separar el material del corte. Ajusta sensibilidad, delimita la región o traza las medias secciones.');
  // Only a round enclosed feature paired across the axis qualifies as an observed
  // rolling element. This excludes leader numerals and most hatch fragments.
  const paired=balls.filter(a=>balls.some(c=>c!==a&&Math.abs((horizontal?a.center[0]-c.center[0]:a.center[1]-c.center[1]))<2.5*pixelScale&&Math.abs((horizontal?a.center[1]+c.center[1]:a.center[0]+c.center[0])-2*center)<7*pixelScale&&Math.abs(a.radius-c.radius)<2*pixelScale));
  return {profiles,balls:paired,voids,axis:center,orientation,core,materialMask:solid,assumptions:['Corte reconstruido desde regiones rayadas y contornos cerrados de la lámina.',core==='shaft'?'Núcleo longitudinal interpretado como eje sin seccionar por selección del usuario.':'Espacios blancos conservados como vacíos; confirma la convención de ejes sin seccionar.','Geometría interior propuesta desde una sola sección; no es un despiece CAD certificado.']};
}

export function sectionVectorPaths(section){
  const ri=section.orientation==='horizontal'?1:0,paths=[];
  for(const profile of section.profiles)for(const ring of[profile.outer,...(profile.holes??[])])for(const mirror of[false,true])paths.push({closed:true,source:'section-material',points:ring.map(q=>q.map((n,i)=>mirror&&i===ri?2*section.axis-n:n))});
  for(const ball of section.balls)paths.push({closed:true,source:'observed-circular-feature',points:Array.from({length:32},(_,i)=>[ball.center[0]+Math.cos(i*Math.PI/16)*ball.radius,ball.center[1]+Math.sin(i*Math.PI/16)*ball.radius])});
  return paths;
}
