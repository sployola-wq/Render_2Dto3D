# Detalles mecánicos propuestos

26 de octubre de 2026. Mejora local sobre v2.9 y la corrección del comparador.

## Resultado

El análisis conserva la geometría de sección existente y añade una capa de componentes de presentación. En la lámina mecánica de referencia encuentra dos recintos claros alargados, emparejados a ambos lados del eje, en (320,5; 129) y (320,5; 273) píxeles. Se interpretan como dos tornillos axiales. La detección usa proporciones, posición dentro de la pieza y simetría; no usa el nombre ni el hash del ejemplo.

Los tornillos incorporan un vástago, una cresta helicoidal de perfil en V, una arandela y una cabeza hexagonal con rebaje. La longitud y el diámetro de presentación se escalan desde el recinto observado. El tipo de cabeza, su extremo, la profundidad y el paso de rosca son propuestas, sin asignar una norma de tornillería.

Los dos círculos ya observados se representan como esferas completas. A partir de ese par se proponen pistas de rodamiento y cinco elementos posteriores en la mitad abierta del conjunto. El número real de elementos, la jaula, las tolerancias y la referencia comercial no se recuperan de la lámina.

La casilla **Detalles finos propuestos**, disponible en los pasos de revisión y en el visor, permite desactivar las propuestas conservando los perfiles y círculos observados. **Ver detalle** recorre los dos tornillos y el rodamiento, aislando y acercando cada conjunto. **Encuadrar** restaura el modelo completo. El aislamiento es una operación de presentación.

Los componentes forman parte del STL exportado. El JSON incluye los recintos de origen, las posiciones, las dimensiones de presentación, los componentes propuestos y sus supuestos. Las nuevas superficies son piezas separadas; no se realizó una unión booleana con el cuerpo de sección.

## Verificación

- `npm test`: 124 pruebas aprobadas.
- La detección encuentra exactamente los dos candidatos esperados; descarta el chavetero central y los fragmentos de rayado. Retirar uno de los recintos impide generar una pareja inventada.
- Pruebas con la misma lámina rotada 90 grados y ampliada al doble: los candidatos siguen la imagen.
- Geometrías finitas; las cabezas tienen un hueco real y las roscas contienen vértices de raíz y cresta.
- El control desactivado conserva los perfiles originales y los dos elementos circulares observados.
- Los detalles aumentan la geometría del STL y respetan la calibración. Sus centros se reproyectan a las posiciones de origen en la cámara frontal.
- Navegador integrado: copia de la lámina del usuario procesada con 500 mm provisionales. Se verificaron activación/desactivación, render frontal, visor, recorrido de los tres detalles, aislamiento y regreso al conjunto. Consola sin errores capturados.
- Capturas de la sesión: `/tmp/render-fastener-detail.png`, `/tmp/render-bearing-detail.png` y `/tmp/render-detailed-assembly.png`.

Esta mejora recupera indicios y propone una presentación mecánica revisable. No convierte una sección de baja resolución en un conjunto CAD certificado ni identifica automáticamente todos los tornillos, remaches, chavetas o uniones de otros planos.
