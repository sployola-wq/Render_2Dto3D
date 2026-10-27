# Validación v3.3

El modo inicial del Paso 3 descrito en este registro histórico fue corregido en [v3.3.1](volumen-v3-3-1.md): ahora inicia en edificio volumétrico, con el relieve disponible como opción explícita.

## Fallo reproducido

Con el JPEG original de la pieza curvada se detectaban dos vistas de 82 × 489 y 145 × 489 píxeles. La escala de grises borraba el canal de color de las cotas: el extractor obtenía un recinto de 180 × 591 píxeles que incluía anotaciones y perdía la profundidad de la vista complementaria. El reconocimiento inicial y el procesamiento posterior estaban usando preparaciones diferentes del mismo archivo.

## Correcciones

- Copia de análisis RGB independiente de los filtros, con comprobación del marco común. La comparación conserva las cotas y la apariencia preparada; el modelo utiliza el contenido original.
- Recuperación para secciones curvas delgadas en dibujos monocromos. Busca una región material independiente y la contrasta con una segunda vista: círculos alineados, bordes persistentes, tapas y extensión compatible. No rellena indiscriminadamente todos los espacios cerrados por dimensiones. La búsqueda de círculos se limita a franjas con bordes y tapas plausibles.
- Acabados exteriores por regiones del dibujo, con tres paletas editables, texturas orientadas según las aristas, oclusión de contacto y cristales con indicios de marco. La materialización se usa tanto en la lámina del Paso 2 como en el relieve del Paso 3.
- Versión 3.3.0 coherente en paquete, encabezado, exportación y manifiesto estático.

## Comprobaciones

- JPEG original reprocesado en la APP con limpieza de papel y escala de grises activas: mantiene las dos vistas, sección de 145 × 489 píxeles, profundidad proporcional y dos taladros propuestos.
- Copia realmente monocroma del mismo archivo: recupera la sección de 143 × 488 y la vista frontal de 71 × 489 píxeles. Las diferencias de uno o dos píxeles corresponden a la localización del borde rasterizado; no son precisión CAD.
- Pruebas sintéticas con distintas curvaturas y recintos de cotas cerrados: se conserva la sección delgada, el ancho de la vista complementaria y los dos taladros. Se comprueba también la invariancia del análisis ante filtros de presentación.
- Pruebas de fachadas distintas del ejemplo: paletas diferentes, geometría y tinta original conservadas, vidrio en paños con marco y orientación de las texturas según cada cara.
- Suite completa: 166 pruebas aprobadas. Verificación estática: 43 módulos. `git diff --check` sin errores.
- La fachada original se rasterizó con el mismo módulo usado por la APP y se revisaron sus salidas de acabado. El navegador integrado dejó de responder de forma estable durante la inspección visual final; la apertura de la nueva pestaña quedó encolada. No se declara completada la revisión visual final de la interfaz v3.3.

## Límites

Los materiales y el reconocimiento de ventanas son propuestas visuales editables. La recuperación monocroma exige evidencia de una pareja de vistas y no constituye reconocimiento universal de dibujos mecánicos. No se leen automáticamente los valores de las cotas: la escala debe calibrarse. Una perspectiva de fachada sigue siendo un relieve de la proyección, no una reconstrucción BIM de zonas ocultas. El motor de imágenes generativas no estaba conectado; estas mejoras corresponden al renderizador local y no equivalen a generación fotorrealista por IA.

No se incorporan los archivos privados del usuario ni renders de ejemplo fijos al repositorio. Los cambios quedan locales; esta solicitud no incluye publicar una nueva versión en GitHub.
