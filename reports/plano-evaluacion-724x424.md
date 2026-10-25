# Ensayo 02 · plano.jpeg

Referencia manual inicial de un único plano, pendiente de revisión independiente. No se utilizó para entrenar ni completar las predicciones. Los resultados no estiman precisión sobre planos nuevos.

- Puntuación mínima: 0,35. Superposición de cajas requerida: IoU ≥ 0,50.
- Puertas y ventanas: caja de la huella de la abertura, excluyendo arcos de giro. Muebles: huella exterior del símbolo.
- Arquitectura: CubiCasa5K hourglass + YOLOv8 de símbolos, sin ajuste con este plano.
- Huella del archivo: 1eaaa77811f87c7a623468c69f533e6f1221fea1f1112e60d2ca82315ed78f90.

| Categoría | Referencia | Detectados | Correctos | Omitidos | Sobrantes | Precisión | Cobertura |
|---|---:|---:|---:|---:|---:|---:|---:|
| Puertas | 12 | 13 | 10 | 2 | 3 | 76.9 % | 83.3 % |
| Ventanas | 16 | 21 | 12 | 4 | 9 | 57.1 % | 75.0 % |
| Camas | 7 | 4 | 4 | 3 | 0 | 100.0 % | 57.1 % |
| Sofás | 4 | 8 | 3 | 1 | 5 | 37.5 % | 75.0 % |
| Mesas | 4 | 6 | 2 | 2 | 4 | 33.3 % | 50.0 % |

Precisión agregada de las cinco clases: 59.6 %. Cobertura: 72.1 %. Otras categorías son propuestas auxiliares y no se incluyen en estas métricas.

Muros, IoU por área de máscara: IA 57.3 %; detector geométrico anterior 70.5 %. El segmentador recupera estructura y aberturas, pero su máscara es más irregular y amplia que la anotación; la geometría anterior conserva mejor coincidencia de área en este ejemplo. No se declara una mejora general de precisión.

El primer segmentador probado (Yytsi ResNet34-UNet) produjo cero regiones de muro. Se registra en dist/data/model-experiments.json y se sustituyó por CubiCasa5K.

Persisten errores de clase entre bañeras, sofás y armarios; omisiones de camas; regiones de abertura fragmentadas; y espesor de muro irregular. Las alturas y la orientación del catálogo 3D son supuestas. El próximo ajuste debe validarse sobre más planos reservados para evaluación.
