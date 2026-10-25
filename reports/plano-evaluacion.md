# Ensayo 03 · plano.jpeg · 1280 × 749

Referencia manual inicial de un único plano, pendiente de revisión independiente. No se utilizó para entrenar ni completar las predicciones. Los resultados no estiman precisión sobre planos nuevos.

Estado de referencia: transferred-initial-review. Anotaciones transferidas desde 724 × 424 mediante registro: 466 correspondencias y 0.2887 píxeles de error mediano. Requieren revisión en esta resolución.

- Puntuación mínima: 0,35. Superposición de cajas requerida: IoU ≥ 0,50.
- Puertas y ventanas: caja de la huella de la abertura, excluyendo arcos de giro. Muebles: huella exterior del símbolo.
- Arquitectura: CubiCasa5K hourglass + YOLOv8 de símbolos, sin ajuste con este plano.
- Huella del archivo: 9f3f598dd2db7f26fa7374c0b5bbbf7764e70bda9febb9aca65243fe3389f049.

| Categoría | Referencia | Detectados | Correctos | Omitidos | Sobrantes | Precisión | Cobertura |
|---|---:|---:|---:|---:|---:|---:|---:|
| Puertas | 14 | 16 | 9 | 5 | 7 | 56.3 % | 64.3 % |
| Ventanas | 16 | 21 | 8 | 8 | 13 | 38.1 % | 50.0 % |
| Camas | 7 | 3 | 3 | 4 | 0 | 100.0 % | 42.9 % |
| Sofás | 4 | 6 | 2 | 2 | 4 | 33.3 % | 50.0 % |
| Mesas | 4 | 6 | 2 | 2 | 4 | 33.3 % | 50.0 % |

Precisión agregada de las cinco clases: 46.2 %. Cobertura: 53.3 %. Otras categorías son propuestas auxiliares y no se incluyen en estas métricas.

Muros, IoU por área de máscara: IA 59.5 %; detector geométrico anterior 56.7 %. La comparación corresponde únicamente a este archivo y a la referencia inicial con el estado indicado arriba. No se declara una mejora general de precisión ni que aumentar la resolución mejore todas las categorías.

El primer segmentador probado (Yytsi ResNet34-UNet) produjo cero regiones de muro. Se registra en dist/data/model-experiments.json y se sustituyó por CubiCasa5K.

Persisten errores de clase entre bañeras, sofás y armarios; omisiones de camas; regiones de abertura fragmentadas; y espesor de muro irregular. Las alturas y la orientación del catálogo 3D son supuestas. El próximo ajuste debe validarse sobre más planos reservados para evaluación.
