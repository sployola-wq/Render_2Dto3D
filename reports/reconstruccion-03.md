# Ensayo 03 — reconstrucción geométrica

Resolución de este ensayo: **1280 × 749**. Estado de referencia: **transferred-initial-review**. Anotaciones transferidas con 466 correspondencias; error mediano 0.2887 px. Pendientes de revisión en esta resolución.

Reproducir con `node backend/build_reconstruction_report.mjs`. Umbral de puntuación: 0.35. Archivo identificado por SHA-256: `9f3f598dd2db7f26fa7374c0b5bbbf7764e70bda9febb9aca65243fe3389f049`.

La reconstrucción recibe únicamente la detección seleccionada. La referencia manual se usa después para evaluar; no participa en la limpieza, la asociación de aberturas ni la orientación de muebles. Los pesos y las predicciones originales no se modificaron.

| Medida | Resultado |
|---|---:|
| Vértices de los contornos | 3146 → 1110 |
| Reducción de vértices | 64,7 % |
| Regiones de muro | 24 → 20 |
| IoU huella limpia / predicción original | 90,0 % |
| IoU original / referencia inicial | 59,5 % |
| IoU limpia / referencia inicial | 60,2 % |
| Aberturas vinculadas a muros | 31 |
| Aberturas pendientes de revisión 2D | 0 |
| Muebles/equipos mostrados con escala provisional | 51 |
| Orientaciones propuestas a partir de un muro próximo | 14 |

## Comportamiento

- Limpieza conservadora de contornos y alineación de bordes casi horizontales o verticales. Se conservan diagonales y huecos interiores; una guarda de área descarta cambios excesivos. No se fuerza un espesor único ni se inventa una red de paredes faltantes.
- La asociación de puertas y ventanas exige apoyo en ambos extremos del vano. Los cuerpos se construyen por franjas de altura: paso libre de puerta, antepecho y dintel de ventana. Las propuestas sin apoyo quedan en 2D, identificadas para revisión. Vincular una abertura no demuestra que su categoría o dimensiones sean correctas.
- Los muebles conservan centro y huella detectados. La orientación usa una pared próxima cuando existe apoyo; en otro caso sigue una suposición de catálogo explícita. Duplicados, solapes fuertes con muros y tamaños incompatibles con una escala calibrada se omiten solo en 3D y se registran.
- La escala de dos puntos se guarda en el navegador, ligada al hash y las dimensiones de análisis. No se restaura para otros archivos y no se infiere una cota con OCR. En la prueba de navegador se introdujo manualmente la cota superior visible de 20,96 m.
- El selector de geometría permite comparar la detección original con la reconstrucción. La vista 2D superpone ambos contornos. El visor incluye intensidad del plano, cuadrícula opcional, base neutra y encuadre ajustado al modelo.
- La exportación JSON versión 3 conserva la predicción, reconstrucción en píxeles, asociación, colocación, medición y supuestos por separado.

## Límites de la medición

El IoU de la tabla mide la huella 2D limpia antes de restaurar dinteles y antepechos; no evalúa el volumen final ni su validez constructiva. Las métricas de detección siguen siendo 24 aciertos, 28 sobrantes y 21 omisiones en cinco clases. Hay una sola referencia inicial, pendiente de revisión independiente. La mejora visual no demuestra una mejora de reconocimiento sobre otros planos.

## Auditoría de asociación

Las 15 propuestas originalmente pendientes ya tienen asociación geométrica. Se excluyen dos fragmentos conflictivos y se agrupan propuestas repetidas. **6 ventanas mantienen revisión de extensión o alineación**; la ventana vertical de cocina sigue dividida en dos cuerpos. Ver [el registro por caso y la comparación](aberturas-04.md). No interpretar cero propuestas sin soporte como cero errores de geometría.

## Capturas de la comprobación local

[Levantamiento 3D](../docs/images/reconstruccion-03-1280x749.png) · [Comparación de muros y cota medida](../docs/images/comparacion-muros-03-1280x749.png).
