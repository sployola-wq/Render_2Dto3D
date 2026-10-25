/** A measured scale is tied to the exact file and its analysis coordinates. */
export function createCalibration({imageSha256,width,height,points,distanceMeters}) {
  if(!/^[a-f0-9]{64}$/.test(imageSha256??'')||!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0)throw new Error('Imagen de calibración no válida.');
  if(!Array.isArray(points)||points.length!==2||points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[0]>width||p[1]<0||p[1]>height))throw new Error('Selecciona dos puntos dentro del plano.');
  const pixels=Math.hypot(points[0][0]-points[1][0],points[0][1]-points[1][1]);
  if(pixels<10||!Number.isFinite(distanceMeters)||distanceMeters<=0||distanceMeters>10000)throw new Error('La distancia o los puntos de calibración no son válidos.');
  return {version:1,imageSha256,width,height,points:points.map(p=>[...p]),distanceMeters,metersPerPixel:distanceMeters/pixels,source:'user-measured'};
}
export function restoreCalibration(serialized,identity) {
  try {
    const data=JSON.parse(serialized);
    if(data?.version!==1||data.imageSha256!==identity.imageSha256||data.width!==identity.width||data.height!==identity.height)return null;
    return createCalibration(data);
  }catch{return null;}
}
