/** Display filters must not erase the colour distinction between CAD geometry
 * and annotations. Both canvases retain exactly the same coordinate frame. */
export function geometrySource(source){
  const canvas=source.analysisCanvas??source.canvas;
  if(canvas.width!==source.canvas.width||canvas.height!==source.canvas.height)throw new Error('El análisis y la lámina deben compartir el mismo marco.');
  return canvas;
}
