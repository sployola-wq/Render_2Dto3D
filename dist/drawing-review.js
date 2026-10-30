/** Keep a usable, identity-bound review when depth cannot be recovered.
 * This is an analysis sheet, never a substitute building or a claimed 3D render.
 */
export function geometryReview(review,sourceHash,width,height){
  if(review?.sourceHash!==sourceHash)throw new Error('La revisión no corresponde a esta lámina.');
  const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=0&&p[0]<=width&&p[1]>=0&&p[1]<=height;
  const faces=(review.faces??[]).filter(f=>f.outer?.length>=3&&f.outer.every(validPoint));
  const openings=(review.openings??[]).filter(o=>o.bounds?.length===4&&validPoint(o.bounds.slice(0,2))&&validPoint(o.bounds.slice(2))&&o.bounds[2]>o.bounds[0]&&o.bounds[3]>o.bounds[1]);
  return {schema:'prodalam.recognition-review.v1',sourceHash,width,height,domain:review.domain,status:'needs-geometry',geometryReady:false,geometryValidated:false,quality:review.quality,faces,openings};
}

export function renderGeometryReview(canvas,review){
  const output=document.createElement('canvas');output.width=canvas.width;output.height=canvas.height;
  const ctx=output.getContext('2d');ctx.drawImage(canvas,0,0);ctx.lineWidth=Math.max(1,canvas.width/700);
  ctx.strokeStyle='#0866d6';ctx.fillStyle='rgba(8,102,214,.07)';
  for(const f of review.faces){ctx.beginPath();f.outer.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();ctx.stroke();}
  ctx.strokeStyle='#b96b06';ctx.setLineDash([5,3]);
  for(const {bounds:[x,y,x1,y1]}of review.openings)ctx.strokeRect(x,y,x1-x,y1-y);
  return output;
}
