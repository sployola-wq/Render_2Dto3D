import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {evaluatePrediction,CATEGORY} from '../dist/evaluation.js';
import {detectPlan} from '../dist/detector.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=path=>JSON.parse(readFileSync(resolve(root,path),'utf8'));
const prediction=read('dist/data/plano-prediction.json'),reference=read('dist/data/plano-reference.json');
const metadata=read('tests/fixtures/plano-current.json');
if(metadata.imageSha256!==prediction.imageSha256||metadata.imageSha256!==reference.imageSha256)throw new Error('La imagen, los píxeles y las predicciones no corresponden al mismo ensayo.');
const pixels=gunzipSync(readFileSync(resolve(root,'tests/fixtures/plano-current.rgba.gz')));
const baseline={...detectPlan({width:metadata.width,height:metadata.height,data:pixels}),imageSha256:reference.imageSha256,objects:[]};
const result=evaluatePrediction(prediction,reference,.35),geometric=evaluatePrediction(baseline,reference,.35);
const report={...result,baselineWallIou:geometric.wallIou,imageSha256:reference.imageSha256,referenceStatus:reference.provenance.status,modelProvenance:prediction.provenance};
writeFileSync(resolve(root,'dist/data/plano-evaluation.json'),JSON.stringify(report,null,2)+'\n');
const pct=value=>value===null?'—':`${(value*100).toFixed(1)} %`;
mkdirSync(resolve(root,'reports'),{recursive:true});
writeFileSync(resolve(root,'reports/plano-evaluacion.md'),`# Ensayo 03 · plano.jpeg · ${prediction.width} × ${prediction.height}

Referencia manual inicial de un único plano, pendiente de revisión independiente. No se utilizó para entrenar ni completar las predicciones. Los resultados no estiman precisión sobre planos nuevos.

Estado de referencia: ${reference.provenance.status}. ${reference.provenance.registration?`Anotaciones transferidas desde 724 × 424 mediante registro: ${reference.provenance.registration.inliers} correspondencias y ${reference.provenance.registration.medianErrorPixels} píxeles de error mediano. Requieren revisión en esta resolución.`:''}

- Puntuación mínima: 0,35. Superposición de cajas requerida: IoU ≥ 0,50.
- Puertas y ventanas: caja de la huella de la abertura, excluyendo arcos de giro. Muebles: huella exterior del símbolo.
- Arquitectura: CubiCasa5K hourglass + YOLOv8 de símbolos, sin ajuste con este plano.
- Huella del archivo: ${reference.imageSha256}.

| Categoría | Referencia | Detectados | Correctos | Omitidos | Sobrantes | Precisión | Cobertura |
|---|---:|---:|---:|---:|---:|---:|---:|
${result.rows.map(r=>`| ${CATEGORY[r.category].label} | ${r.expected} | ${r.predicted} | ${r.tp} | ${r.fn} | ${r.fp} | ${pct(r.precision)} | ${pct(r.recall)} |`).join('\n')}

Precisión agregada de las cinco clases: ${pct(result.totals.precision)}. Cobertura: ${pct(result.totals.recall)}. Otras categorías son propuestas auxiliares y no se incluyen en estas métricas.

Muros, IoU por área de máscara: IA ${pct(result.wallIou)}; detector geométrico anterior ${pct(geometric.wallIou)}. La comparación corresponde únicamente a este archivo y a la referencia inicial con el estado indicado arriba. No se declara una mejora general de precisión ni que aumentar la resolución mejore todas las categorías.

El primer segmentador probado (Yytsi ResNet34-UNet) produjo cero regiones de muro. Se registra en dist/data/model-experiments.json y se sustituyó por CubiCasa5K.

Persisten errores de clase entre bañeras, sofás y armarios; omisiones de camas; regiones de abertura fragmentadas; y espesor de muro irregular. Las alturas y la orientación del catálogo 3D son supuestas. El próximo ajuste debe validarse sobre más planos reservados para evaluación.
`,'utf8');
console.log(JSON.stringify({wallIou:result.wallIou,baselineWallIou:geometric.wallIou,totals:result.totals}));
