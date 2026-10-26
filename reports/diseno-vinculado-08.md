# Diseño conservado y acabados 3D · v2.5

La comparación del usuario identificó el resultado preferido de v2.3: una imagen fotorrealista importada de 2752 × 1536 px. v2.4 mostraba por defecto el render local de catálogo. Se conservaron el reconocimiento actual y el constructor 3D y se añadió una vinculación explícita del diseño aprobado.

## Identidad y persistencia

- JPEG del usuario: e31bf22f4e6e71bc96e679cde230ee6d243b02d3064cabbce085312e7999c34e, 724 × 424.
- Ejemplo del mismo diseño: 9f3f598dd2db7f26fa7374c0b5bbbf7764e70bda9febb9aca65243fe3389f049, 1280 × 749.
- CGI aprobado: 881b59749fe4043a63095e58c2eae4b2e4f7ca6219987386bb7149b2026efb8d, 2752 × 1536.

Solo estas identidades reciben automáticamente esa referencia. No se asocia por nombre ni por semejanza visual. Nuevas referencias se guardan como Blob nativo en IndexedDB junto con el SHA original, las dimensiones del marco, la procedencia y el encuadre. Cambiar filtros no cambia la identidad del archivo original; la referencia restaurada se vincula al nuevo hash de análisis manteniendo coordenadas. No se considera que la imagen valide la geometría. El guardado corresponde al diseño, no al conjunto completo de una sesión.

## Presentación y modelo

El Paso 2 conserva los píxeles del CGI, usa un lienzo de vista de hasta 3072 px y exporta la resolución nativa. La creación de nuevas presentaciones queda en una sección opcional; no reemplaza una buena imagen al cambiar de etapa o acabado local.

El Paso 3 extrae parches de suelo de zonas reconocidas, excluye las cajas de muebles y evita césped, negro de sombras y muestras incompatibles. La referencia conocida incluye un encuadre visual de su envolvente; otras imágenes tienen estimación automática y ajuste manual. Los parches usan bordes reflejados para reducir cortes de repetición. Los textiles se admiten solo con evidencia neutral suficiente; se descartan las muestras de césped o madera. Los muebles conservan huella/orientación del catálogo reconocido y reciben biseles, almohadas y costuras. El exterior es una superficie fotográfica opcional, recortada fuera de muros y pisos interiores.

## Verificación

71 pruebas Node y 4 Python aprobadas. Cubren identidad de archivo, geometría no validada del CGI, rechazo de asociaciones ajenas, alineación, rechazo de texturas de césped/sombras/muebles, recorte del exterior, liberación de texturas, y restauración exacta de materiales/cámara/topología del modelo original. En navegador se cargó realmente el JPEG desde cero, se procesó, se recuperó el CGI, se recargó y reabrió el plano y se comprobó la recuperación. Se verificaron modos Técnico/Ambientado, entorno y comparación. Resultado observado: 58 regiones estructurales, 87 componentes propuestos, 28 aberturas con soporte, 53 muebles ambientados y 8 zonas con textura recuperada; las métricas provisionales se conservan.

`architecture.js`, `components.js` y `detector.js` permanecen idénticos a HEAD. La única diferencia de `app.js` respecto a HEAD sigue siendo el adaptador `importAnalysis` de v2.4. Esta iteración no toca inferencia, constructor, medidas ni control de cámara.

## Límites reales

No se hizo generación externa ni se configuró una clave OpenAI. La presentación aprobada es una referencia del proyecto y no equivale a generar automáticamente otro plano fotorrealista. La apariencia 3D reutiliza sus materiales; no reconstruye los modelos originales de sus muebles ni levanta los árboles fotografiados. Persisten las incertidumbres de reconocimiento, orientación/altura de catálogo y escala sin calibrar del Paso 1. No se modificaron los archivos originales aportados por el usuario. Cambios locales, sin push.
