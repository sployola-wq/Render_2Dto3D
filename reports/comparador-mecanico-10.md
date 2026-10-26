# Comparación alineada y acabado mecánico

Fecha: 26 de octubre de 2026. Cambio local sobre v2.9.

El procesamiento especializado seleccionaba automáticamente la perspectiva y el modo de render completo. La cortina permanecía visible, pero moverla no activaba el comparador. El cambio de altura disponible entre los Pasos 1 y 2 también reducía y desplazaba la lámina en pantalla.

El Paso 2 comienza ahora con la proyección frontal y la comparación activada. Botones, deslizador y arrastre comparten el estado del comparador. Mover el deslizador desde la perspectiva o desde el plano completo activa la comparación y restaura la proyección frontal. Las mediciones y el desplazamiento conservan prioridad sobre los gestos de comparación. La captura se libera al finalizar o cancelar un arrastre.

La mesa reserva la misma fila de controles en el Paso 1, con una indicación de vista original, para conservar el encuadre. La cámara frontal usa el desplazamiento real del grupo en las secciones explícitas, también en orientación vertical y con regiones descentradas.

Se ajustaron la rugosidad y los reflejos del metal, se añadieron sombras internas al render mecánico y contornos finos a las caras de corte y sus huecos. Los contornos proceden de las superficies existentes; no añaden superficies a la exportación STL. No se cambió la extracción, la escala ni las dimensiones del modelo.

## Verificación

- `npm test`: 118 pruebas aprobadas. La última revisión de la prueba de puntos de referencia se comprobó además con las ocho pruebas de `drawing-routing.test.mjs`.
- Pruebas de cortina: activar desde perspectiva/plano, extremos 0/100 %, captura y cancelación, límites del marco, medición, desplazamiento y estado ocupado.
- Prueba de proyección: vértices reales de secciones descentradas vuelven a sus coordenadas de origen en los dos sentidos del eje.
- Prueba STL: retirar los contornos de presentación no cambia los triángulos exportados.
- Navegador integrado: se descargó una copia limpia de la lámina cargada por el usuario y se abrió en otra pestaña para conservar la sesión original. Se procesó con los parámetros mostrados: 500 mm provisionales, revolución horizontal y conservación de vacíos.
- El marco midió lo mismo en ambos pasos: x=697,6953125, y=304,3515625, ancho=184,609375 y alto=150 píxeles CSS en el viewport de comprobación. Se verificaron el deslizador en 0/100 %, la selección de perspectiva y el retorno automático a la proyección frontal al moverlo.
- Comparación ampliada al 50 % revisada visualmente. Consola sin errores capturados. Captura de esta sesión: `/tmp/render-comparison-verified.png`.

La geometría sigue siendo la reconstrucción aproximada ya existente de una sola sección. La alineación de la cámara facilita revisar sus diferencias frente a la lámina; no certifica la exactitud de los perfiles extraídos ni agrega detalles de fabricación ausentes.
