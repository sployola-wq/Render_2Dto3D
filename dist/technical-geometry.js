/** Pure coordinate and measurement helpers shared by the 2D/3D adapters. */
export function distance(a,b,scale=1){return Math.hypot(b[0]-a[0],b[1]-a[1])*scale;}
export function polygonMetrics(points,scale=1){
  if(points.length<3)return {area:0,perimeter:0};
  let twice=0,perimeter=0;
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];twice+=a[0]*b[1]-b[0]*a[1];perimeter+=distance(a,b,scale);}
  return {area:Math.abs(twice)/2*scale*scale,perimeter};
}
export function geometryBounds(data){
  const points=(data?.wallPolygons??[]).flatMap(p=>p.outer);
  for(const w of data?.walls??[]){const t=w.thickness/2;points.push(...(w.axis==='h'?[[w.from,w.c-t],[w.to,w.c+t]]:[[w.c-t,w.from],[w.c+t,w.to]]));}
  if(!points.length)return null;
  return boundsOf(points);
}
export function boundsOf(points){
  if(!points.length||points.some(p=>!p.every(Number.isFinite)))throw new Error('Geometría vacía o no válida.');
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const [x,y] of points){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  return {x0,y0,x1,y1,width:x1-x0,height:y1-y0};
}
export function pixelToWorld([x,y],width,height,scale){return [(x-width/2)*scale,0,(y-height/2)*scale];}
export function worldToPixel([x,,z],width,height,scale){return [x/scale+width/2,z/scale+height/2];}
export function pointOnCanvas(event,canvas){const r=canvas.getBoundingClientRect();return [(event.clientX-r.left)*canvas.width/r.width,(event.clientY-r.top)*canvas.height/r.height];}
export function validSupportURL(value){if(!value)return '';try{const u=new URL(value);return ['https:','http:','mailto:'].includes(u.protocol)?u.href:'';}catch{return '';}}
export function vectorSVG(data,width,height,lineWidth=1){
  const paths=[];
  for(const p of data.wallPolygons??[])paths.push([p.outer,...(p.holes??[])].map(r=>r.map(([x,y],i)=>`${i?'L':'M'}${x},${y}`).join(' ')+'Z').join(' '));
  for(const w of data.walls??[])paths.push(w.axis==='h'?`M${w.from},${w.c}L${w.to},${w.c}`:`M${w.c},${w.from}L${w.c},${w.to}`);
  for(const p of data.paths??[])paths.push(p.points.map(([x,y],i)=>`${i?'L':'M'}${x},${y}`).join(' ')+(p.closed?'Z':''));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><title>Prodalam Render Pro v2.0 — Vectores de análisis</title><g fill="none" stroke="#005b9a" stroke-width="${lineWidth}" stroke-linejoin="round">${paths.map(d=>`<path d="${d}"/>`).join('')}</g></svg>`;
}
/** DXF 2D tessellation; unsupported entities are reported rather than silently lost. */
export function dxfPaths(document){
  const paths=[],unsupported=new Set();let budget=0;
  const transform=(p,m)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
  const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
  function visit(entities,m=[1,0,0,1,0,0],depth=0){
    if(depth>8)throw new Error('DXF con bloques recursivos demasiado profundos.');
    for(const e of entities??[]){
      if(++budget>100000)throw new Error('El DXF supera el límite de 100.000 entidades.');
      if(e.type==='INSERT'){
        const block=document.blocks?.[e.name];if(!block){unsupported.add('INSERT sin bloque');continue;}
        const r=(e.rotation??0)*Math.PI/180,c=Math.cos(r),s=Math.sin(r),sx=e.xScale??1,sy=e.yScale??1,p=e.position??{x:0,y:0},base=block.position??{x:0,y:0};
        const local=[c*sx,s*sx,-s*sy,c*sy,p.x-c*sx*base.x+s*sy*base.y,p.y-s*sx*base.x-c*sy*base.y];visit(block.entities,multiply(m,local),depth+1);continue;
      }
      let points=[],closed=false;
      if(['LINE','LWPOLYLINE','POLYLINE'].includes(e.type)){
        const v=e.vertices??[];closed=!!e.shape;
        for(let i=0;i<v.length;i++){
          const a=v[i],b=v[(i+1)%v.length];points.push([a.x,a.y]);
          if(a.bulge&&b&&(i<v.length-1||closed)){
            const dx=b.x-a.x,dy=b.y-a.y,chord=Math.hypot(dx,dy),theta=4*Math.atan(a.bulge),offset=chord*(1-a.bulge*a.bulge)/(4*a.bulge);
            const cx=(a.x+b.x)/2-dy/chord*offset,cy=(a.y+b.y)/2+dx/chord*offset,start=Math.atan2(a.y-cy,a.x-cx),rad=Math.hypot(a.x-cx,a.y-cy),steps=Math.max(4,Math.ceil(Math.abs(theta)*24));
            for(let j=1;j<steps;j++){const t=start+theta*j/steps;points.push([cx+rad*Math.cos(t),cy+rad*Math.sin(t)]);}
          }
        }
      }else if(['CIRCLE','ARC'].includes(e.type)){
        const start=e.startAngle??0;let sweep=e.type==='CIRCLE'?Math.PI*2:(e.endAngle??Math.PI*2)-start;while(sweep<=0)sweep+=Math.PI*2;
        const n=Math.max(16,Math.ceil(sweep*32));closed=e.type==='CIRCLE';
        for(let i=0;i<=n;i++){const t=start+sweep*i/n;points.push([e.center.x+e.radius*Math.cos(t),e.center.y+e.radius*Math.sin(t)]);}
      }else if(e.type==='ELLIPSE'){
        const a=e.majorAxisEndPoint,rx=Math.hypot(a.x,a.y),ry=rx*e.axisRatio,r=Math.atan2(a.y,a.x),start=e.startAngle??0,end=e.endAngle??Math.PI*2;
        for(let i=0;i<=128;i++){const t=start+(end-start)*i/128,x=rx*Math.cos(t),y=ry*Math.sin(t);points.push([e.center.x+x*Math.cos(r)-y*Math.sin(r),e.center.y+x*Math.sin(r)+y*Math.cos(r)]);}closed=Math.abs(end-start-Math.PI*2)<.001;
      }else {unsupported.add(e.type);continue;}
      if(points.length>1)paths.push({points:points.map(p=>transform(p,m)),closed,layer:e.layer??'0'});
    }
  }
  visit(document.entities);
  if(!paths.length)throw new Error('El DXF no contiene trazos 2D compatibles.');
  const bounds=boundsOf(paths.flatMap(p=>p.points));
  return {paths,bounds,unsupported:[...unsupported],units:document.header?.$INSUNITS??0};
}
export function isSimplePolygon(points){
  if(points.length<3||polygonMetrics(points).area<1)return false;
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const on=(a,b,p)=>Math.abs(cross(a,b,p))<1e-8&&p[0]>=Math.min(a[0],b[0])-1e-8&&p[0]<=Math.max(a[0],b[0])+1e-8&&p[1]>=Math.min(a[1],b[1])-1e-8&&p[1]<=Math.max(a[1],b[1])+1e-8;
  for(let i=0;i<points.length;i++){
    if(distance(points[i],points[(i+1)%points.length])<1e-6)return false;
    for(let j=i+1;j<points.length;j++){
      if(j===i+1||i===0&&j===points.length-1)continue;
      const a=points[i],b=points[(i+1)%points.length],c=points[j],d=points[(j+1)%points.length];
      if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))return false;
    }
  }
  return true;
}
/** Preserve CAD coordinates; paired closed contours represent a wall band.
 * Unpaired contours become thin strokes, never filled rooms. Thickness is an explicit assumption.
 */
export function cadWallGeometry(paths,width,height,thickness=3){
  const structural=paths.filter(p=>/wall|muros?|pared|murs?/i.test(p.layer??'')),chosen=structural.length?structural:paths;
  const inside=(point,ring)=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
  const rings=chosen.filter(p=>p.closed&&isSimplePolygon(p.points)).map(p=>({points:p.points,area:polygonMetrics(p.points).area})).sort((a,b)=>b.area-a.area);
  const parent=new Map();for(let i=0;i<rings.length;i++)for(let j=i-1;j>=0;j--)if(inside(rings[i].points[0],rings[j].points)){parent.set(rings[i],rings[j]);break;}
  const polygons=[],used=new Set();
  for(const ring of rings){if(used.has(ring))continue;const children=rings.filter(r=>parent.get(r)===ring);const fill=ring.area-children.reduce((s,r)=>s+r.area,0);if(children.length&&fill>0&&fill/ring.area<.4){polygons.push({outer:ring.points,holes:children.map(r=>r.points)});used.add(ring);children.forEach(r=>used.add(r));}}
  const same=(a,b)=>a.length===b.length&&a.every((p,i)=>p[0]===b[i][0]&&p[1]===b[i][1]);
  for(const path of chosen){if([...used].some(r=>same(r.points,path.points)))continue;const points=path.points;
    const b=boundsOf(points);
    if(path.closed&&Math.min(b.width,b.height)/Math.max(b.width,b.height)<.12&&isSimplePolygon(points)){polygons.push({outer:points,holes:[]});continue;}
    for(let i=1;i<points.length+(path.closed?1:0);i++){const a=points[i-1],b=points[i%points.length],len=distance(a,b);if(len<.01)continue;const nx=-(b[1]-a[1])/len*thickness/2,ny=(b[0]-a[0])/len*thickness/2;polygons.push({outer:[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]],holes:[]});}
  }
  return {width,height,walls:[],wallPolygons:polygons,objects:[],openings:[],provenance:{kind:'cad-vector-import',selectedLayers:structural.length?'wall-name-filter':'all-geometric-layers',strokeThicknessPixels:thickness},warnings:['Los contornos cerrados emparejados se interpretan como bandas de muro. Los trazos aislados usan un espesor supuesto; revisar la clasificación CAD.']};
}
