# Ambientación 3D · Prodalam Render Pro v2.3

25 de octubre de 2026. Se añade una capa visual independiente al Paso 3 existente.

## Qué cambia

- Modo **Ambientado / Técnico**, reversible en el mismo visor.
- Colores de madera, muros y textiles muestreados del render importado o generado en el Paso 2, usando su mismo encuadre proporcional. Las sombras oscuras, transparencias y verdes de vegetación se excluyen del muestreo.
- Materiales con grano de madera, tejido y relieve óptico, cerámica, vidrio y metal sobre los componentes ya construidos. Se conservan sus formas, alturas, posición y orientación.
- Pisos texturizados en zonas cerradas de la estructura existente. Las aberturas conocidas solo se sellan en la máscara de cobertura para separar acabados; los huecos estructurales 3D siguen abiertos. Los recintos con inodoro o bañera reciben cerámica.
- Iluminación de presentación, plano de referencia conmutable, ajuste de correspondencia horizontal/vertical/escala y paleta visible.
- Si falta un render compatible o no contiene colores utilizables, se utiliza el estilo seleccionado en el Paso 2. Este acabado funciona localmente, sin API ni llamadas externas.

## Protección del levantamiento

`dist/app.js`, `dist/architecture.js`, `dist/components.js` y `dist/detector.js` permanecen idénticos a Git HEAD. No se cambian el reconocimiento, la asociación de puertas/ventanas, los volúmenes del mobiliario ni la calibración.

`dist/appearance-mapping.js` contiene las operaciones puras de encuadre, muestreo y cobertura de pisos. `dist/appearance-3d.js` administra materiales clonados, texturas y un plano cosmético de piso en un grupo separado de la jerarquía estructural. Conserva y restaura los materiales originales, el fondo y la exposición. No escribe geometrías, transformaciones, visibilidad ni datos semánticos de los objetos originales. Libera recursos al cambiar de modelo o salir de la presentación.

La integración se realiza en el adaptador `dist/workflow.js`. Al volver a los pasos 1 o 2 se restaura la escena técnica. La generación del render técnico se ejecuta con los materiales originales. El render fotorrealista permanece separado de la geometría; no se utiliza como una nueva inferencia ni como una malla.

## Límites de la transferencia

La transferencia es de apariencia aproximada. Una imagen cenital no determina por sí sola la forma tridimensional exacta de una silla, la altura real de un mueble ni una textura oculta. Se ambienta el mobiliario reconocido por el motor actual, conservando sus supuestos existentes. Los ajustes de encuadre corrigen dónde se muestrean colores, sin deformar la estructura. La cobertura de piso no se exporta como nuevos recintos ni como superficie medida.

Los espacios abiertos o con discontinuidades que permiten conexión al exterior quedan fuera de la cobertura automática de pisos. No se crean muros para cerrarlos. Los materiales procedurales interpretan el acabado; no proyectan la fotografía completa sobre los muebles ni generan duplicados planos de su imagen.

## Validación

55 pruebas Node aprobadas. Las nueve pruebas nuevas comprueban correspondencia proporcional, rechazo de renders de otro archivo/tamaño, cobertura interior/exterior, conservación de huecos, cerámica en baños, exclusión de verdes/sombras, restauración exacta de materiales compartidos y liberación de recursos. Las pruebas usan objetos reales de Three.js y verifican que vértices, jerarquía, transformaciones, visibilidad, datos semánticos y cámara permanezcan intactos.

En navegador se verificaron ambos modos, el acabado sin render, importación del render existente de 2752 × 1536, 10 zonas de piso y 51 muebles ambientados, ocultación/restauración del mobiliario, modificación/restauración de altura y cotas. El ejemplo mantiene 24 regiones de muro, 88 propuestas y 31 aberturas con soporte. Se conservan los seis casos de aberturas que ya requerían revisión. No se afirma una nueva precisión de detección.
