# Ensayo 03 — reconstrucción geométrica

Reproducir con `node backend/build_reconstruction_report.mjs`. Umbral de puntuación: 0.35. Archivo identificado por SHA-256: `1eaaa77811f87c7a623468c69f533e6f1221fea1f1112e60d2ca82315ed78f90`.

La reconstrucción recibe únicamente la detección seleccionada. La referencia manual se usa después para evaluar; no participa en la limpieza, la asociación de aberturas ni la orientación de muebles. Los pesos y las predicciones originales no se modificaron.

| Medida | Resultado |
|---|---:|
| Vértices de los contornos | 1688 → 1301 |
| Reducción de vértices | 22,9 % |
| Regiones de muro | 35 → 35 |
| IoU huella limpia / predicción original | 94,1 % |
| IoU original / referencia inicial | 57,3 % |
| IoU limpia / referencia inicial | 58,4 % |
| Aberturas vinculadas a muros | 27 |
| Aberturas pendientes de revisión 2D | 7 |
| Muebles/equipos mostrados con escala provisional | 58 |
| Orientaciones propuestas a partir de un muro próximo | 24 |

## Comportamiento

- Limpieza conservadora de contornos y alineación de bordes casi horizontales o verticales. Se conservan diagonales y huecos interiores; una guarda de área descarta cambios excesivos. No se fuerza un espesor único ni se inventa una red de paredes faltantes.
- La asociación de puertas y ventanas exige apoyo en ambos extremos del vano. Los cuerpos se construyen por franjas de altura: paso libre de puerta, antepecho y dintel de ventana. Las propuestas sin apoyo quedan en 2D, identificadas para revisión. Vincular una abertura no demuestra que su categoría o dimensiones sean correctas.
- Los muebles conservan centro y huella detectados. La orientación usa una pared próxima cuando existe apoyo; en otro caso sigue una suposición de catálogo explícita. Duplicados, solapes fuertes con muros y tamaños incompatibles con una escala calibrada se omiten solo en 3D y se registran.
- La escala de dos puntos se guarda en el navegador, ligada al hash y las dimensiones de análisis. No se restaura para otros archivos y no se infiere una cota con OCR. En la prueba de navegador se introdujo manualmente la cota superior visible de 20,96 m.
- El selector de geometría permite comparar la detección original con la reconstrucción. La vista 2D superpone ambos contornos. El visor incluye intensidad del plano, cuadrícula opcional, base neutra y encuadre ajustado al modelo.
- La exportación JSON versión 3 conserva la predicción, reconstrucción en píxeles, asociación, colocación, medición y supuestos por separado.

## Límites de la medición

El IoU de la tabla mide la huella 2D limpia antes de restaurar dinteles y antepechos; no evalúa el volumen final ni su validez constructiva. Las métricas de detección siguen siendo 31 aciertos, 21 sobrantes y 12 omisiones en cinco clases. Hay una sola referencia inicial, pendiente de revisión independiente. La mejora visual no demuestra una mejora de reconocimiento sobre otros planos.

## Capturas de la comprobación local

[Levantamiento 3D](../docs/images/reconstruccion-03.png) · [Comparación de muros y cota medida](../docs/images/comparacion-muros-03.png).
