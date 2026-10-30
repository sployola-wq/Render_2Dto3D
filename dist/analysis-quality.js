/** Report actual inference coverage; never promote contours to semantic recognition. */
export function summarizeAnalysis(snapshot,confidence=.35){
  const result=snapshot?.result,objects=(result?.objects??[]).filter(o=>Number.isFinite(o.confidence)&&o.confidence>=confidence),furniture=objects.filter(o=>!['door','window'].includes(o.category)).length,openings=objects.length-furniture;
  const limited=!result||result.provenance?.kind==='geometric-detector'||!objects.length;
  const execution=snapshot?.rawPrediction?.provenance?.execution??result?.provenance?.execution;
  const reviewOnly=result?.reviewOnlyObjects??snapshot?.rawPrediction?.reviewOnlyObjects??[],lowConfidence=(result?.objects??[]).filter(o=>o.confidence<confidence).length;
  return {limited,furniture,openings,live:!limited&&execution==='live',geometryValidated:false,coverageVerified:false,reviewCount:reviewOnly.length,lowConfidence,
    message:limited?`Solo estructura · no se reconocieron muebles ni tipos de abertura. ${execution==='live'?'El reconocimiento se ejecutó, pero no identificó el equipamiento. Revisa el dibujo y las detecciones.':'El motor local debe estar disponible para interpretar el equipamiento.'}`:`Reconocimiento ${execution==='live'?'ejecutado en este equipo':'guardado para este archivo'} · ${furniture} propuestas de mobiliario/equipamiento · ${openings} de puertas/ventanas. ${reviewOnly.length} detecciones apartadas para revisión; ${lowConfidence} bajo el umbral. Compara con el original: no se ha verificado que estén todos sus elementos.`};
}
