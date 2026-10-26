/** Report actual inference coverage; never promote contours to semantic recognition. */
export function summarizeAnalysis(snapshot,confidence=.35){
  const result=snapshot?.result,objects=(result?.objects??[]).filter(o=>Number.isFinite(o.confidence)&&o.confidence>=confidence),furniture=objects.filter(o=>!['door','window'].includes(o.category)).length,openings=objects.length-furniture;
  const limited=!result||result.provenance?.kind==='geometric-detector'||!objects.length;
  const execution=snapshot?.rawPrediction?.provenance?.execution??result?.provenance?.execution;
  return {limited,furniture,openings,live:!limited&&execution==='live',message:limited?'Solo estructura · no se reconocieron muebles ni tipos de abertura. Este resultado no representa un interior completo. El motor local debe estar disponible para interpretar el equipamiento.':`Reconocimiento ${execution==='live'?'ejecutado en este equipo':'guardado para este archivo'} · ${furniture} propuestas de mobiliario/equipamiento · ${openings} de puertas/ventanas. Revisa las detecciones antes de continuar.`};
}
