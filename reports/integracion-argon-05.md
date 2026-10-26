# Integración de Argon · Prodalam Render Pro v2.2

Revisión: 25 de octubre de 2026. Fuente local: `../Beta_Render_Pro-main_Argon`. Destino: este proyecto. La carpeta fuente se leyó sin modificarla. Se revisaron los componentes y utilidades de las etapas 1 y 2; no se incorporaron sus visores, generadores de mallas ni lógica comercial.

## Resultado de la revisión

| Componente de Argon | Decisión en esta versión |
| --- | --- |
| `Workbench2D.tsx` | Recuperar zoom, desplazamiento, revisión vectorial opcional y confirmación consciente antes de pasar a la etapa 2. Mantener nuestra carga múltiple y encuadre según el espacio real. |
| `enhanceAndSharpenBlueprintImage` en `blueprintExtractor.ts` | Adaptar el núcleo de normalización de papel y nitidez como filtro opcional. No modificar los píxeles originales ni las dimensiones del análisis. Mantener la opción de ver el original. |
| `StepComparisonSlider.tsx` | Recuperar el arrastre sobre la imagen, conservar el rango accesible por teclado y usar un marco compartido para evitar deformar las imágenes. Una coincidencia de formato no valida la geometría de una imagen generada. |
| `AIEnhancerPhase.tsx` | Recuperar instrucciones de acabado, estilos, importación y exportación PNG. Conservar el render técnico anterior cuando haya errores. No marcar una generación fallida como completada. |
| `server.ts`, generación CGI con Gemini | Sustituir por una integración opcional con OpenAI solicitada durante el trabajo. No reutilizar sus modelos/credenciales ni ejecutar llamadas externas automáticamente. |
| Logo y paleta de `public/assets/aistudio` | Reutilizar el logo suministrado y los valores corporativos del proyecto fuente. |
| `buildBlueprintFromPdfMeta` | No trasladar: construye muros y aberturas fijos a partir del nombre y tamaño del archivo, sin interpretar sus páginas. Conservar PDF.js y la selección de páginas reales del proyecto actual. |
| `spatialPartitioner.ts` y sincronización del blueprint CGI | No trasladar: genera mobiliario y distribuciones por heurísticas. No usar una imagen generada para reemplazar automáticamente la estructura validada del Paso 1. |
| Visores 3D, Tripo, mallas GLB y cotizaciones | Excluidos del alcance. |

## Implementación

- `dist/blueprint-preprocess.js`: limpieza opcional, estilos y registro de procedencia de la imagen.
- `dist/workspace-ui.js`: zoom que mantiene el punto de referencia, además de encuadre y carga por arrastre existentes.
- `dist/workflow.js`, `dist/index.html`, `dist/workflow.css`: controles y secuencia de revisión para las etapas 1 y 2.
- `backend/cgi-service.mjs`: validación de origen y dimensiones, petición de edición de imagen a OpenAI, errores explícitos y ningún reintento silencioso que pueda generar cargos adicionales.
- `server.mjs`: estado del motor y rutas locales del generador. `.env` no se sirve y está excluido de Git.

La presentación fotorrealista se almacena aparte del render técnico. Puede ser importada o generada y siempre queda marcada como correspondencia geométrica sin validar. No reemplaza las geometrías ni la textura técnica ya usada por el visor existente.

Los archivos `dist/app.js`, `dist/architecture.js`, `dist/components.js` y `dist/detector.js` permanecen sin cambios en esta integración. No se modifica el render del Paso 3.

## OpenAI opcional

Documentación consultada: [generación y edición de imágenes](https://developers.openai.com/api/docs/guides/image-generation) y [endpoint de edición](https://developers.openai.com/api/reference/resources/images/methods/edit).

1. Copiar `.env.example` a `.env`.
2. Configurar `OPENAI_API_KEY` localmente. No pegarla en el chat ni en los archivos de `dist/`.
3. Reiniciar `npm start`.
4. En el Paso 2, seleccionar estilo y pulsar **Generar con OpenAI**. La interfaz indica qué se envía al proveedor.

Modelo predeterminado configurable: `gpt-image-2.5-sunburst`. Se envía el PNG limpio de la lámina como entrada del endpoint de edición y se recibe un PNG. La disponibilidad real depende del acceso de la cuenta al modelo.

No había una clave configurada en el entorno de esta revisión. Se verificaron contrato, validaciones y errores con respuestas simuladas, sin una generación real ni cargos. La importación del render ya existente del usuario permite probar ahora la presentación y la cortina sin llamar a proveedores.

## Validación

46 pruebas Node aprobadas: regresiones originales, limpieza sin mutar el origen ni inventar trazos en papel vacío, fondo CAD oscuro, límites y anclaje del zoom, procedencia, dimensiones PNG, encuadre solicitado, falta de credenciales, respuesta sin imagen y límites de uso.

En navegador: extracción del ejemplo, revisión opcional de vectores, avance explícito al Paso 2, importación de PNG de 2752 × 1536, comparación y cambio al Paso 3 conservando 31 aberturas con soporte y la predicción original. Sin errores de consola durante estas comprobaciones.
