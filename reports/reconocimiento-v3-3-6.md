# Reconocimiento y render 3D v3.3.6

## Causa y corrección del interior vacío

Los pesos y dependencias del motor Python no estaban instalados. Por ello, una imagen nueva usaba exclusivamente el detector geométrico y producía muros parciales sin mobiliario. Se instaló el entorno local con los modelos definidos en el proyecto y se verificaron sus SHA-256. El servidor Node administra el worker de inferencia en loopback; también vuelve a comprobar la disponibilidad del motor al analizar.

QA en el JPG exacto `2e84c8e34ee4affee86f3d31f629d4f8.jpg`: el navegador ejecutó reconocimiento local y mostró 19 regiones depuradas, 25 propuestas de equipamiento/mobiliario y 11 de puertas/ventanas. Se verificaron el render cenital, la nueva perspectiva del Paso 2 y el modelo del Paso 3. La perspectiva utiliza la misma geometría, no otra imagen ni una vivienda de ejemplo. Las detecciones y las formas de catálogo siguen requiriendo revisión.

## Clasificación automática

Se añadió CLIP ViT-B/32 local, con revisión fijada y pesos verificados, mediante `/api/classify`. La clasificación compara el contenido con descripciones de plantas interiores, fachadas, ingeniería, estructuras y entradas desconocidas. No consulta el nombre del archivo ni una tabla de identidades conocidas.

La respuesta incluye identidad SHA-256, puntuaciones relativas y margen. Solo las decisiones suficientemente separadas seleccionan el motor automáticamente. Las ambiguas requieren confirmación; las selecciones manuales y las capas estructurales CAD conservan su prioridad. Una respuesta de otra imagen no se aplica a la lámina actual. Se corrigió el caso de un clasificador ocupado mientras otro archivo se analizaba: espera al worker y conserva el resultado automático.

Se verificaron con los pesos reales cinco archivos: el interior reportado, una lámina mecánica, el alzado existente, la casa en perspectiva anterior y `create_home-plans_hero.jpg`. Los cinco eligieron la categoría esperada; una hoja blanca no autorizó procesamiento automático. Esto es una regresión sobre esos archivos, no una medición universal de precisión. [Modelo y límites del clasificador](https://huggingface.co/openai/clip-vit-base-patch32).

## Fachada y continuidad al girar

La fachada de la nota 1 ya no se bloquea por el fallo del ajuste anterior. Se extrae una silueta apoyada por los trazos, se excluyen marcos y se limpian salientes estrechos de líneas auxiliares. La envolvente usa un encuentro de fachadas, contornos superior/inferior, cubierta continua, caras posteriores, fondo plano y cierre de la base propuesto para evitar apoyos fragmentados. Los huecos detectados tienen vidrios separados y retranqueados y paredes de 180 mm. El acabado del Paso 2 se aplica a esa geometría; puede desactivarse en el visor para inspeccionar materiales físicos.

Se verificaron la cámara del dibujo, la perspectiva y el giro por arrastre. Los contornos extraídos se conservan en su cámara; la prueba de reproyección compara vértices contra esos contornos, con error inferior a 0,002 píxeles. La extracción suaviza trazos auxiliares y tiene una tolerancia de varios píxeles. Esa comprobación no prueba que toda la profundidad sea la del edificio real.

**La envolvente es aproximada.** La profundidad y las caras ocultas son propuestas editables; dos fachadas no recuperan todos los retranqueos, cubiertas interiores ni habitaciones de una sola perspectiva. No se declara un CAD exacto ni validación constructiva. La alternativa conceptual explícita, los alzados y los perfiles manuales se conservan. El rechazo anterior sigue disponible si no hay una envolvente compatible.

## Validación

- 210 pruebas Node: clasificación por identidad y margen, motor ocupado, cámaras, contornos, profundidad, huecos por rayos, STL finito y regresiones existentes.
- 3 pruebas de integración neural con los pesos reales: cinco tipos de archivo, rechazo de hoja blanca y detección de estructura/equipamiento del interior reportado. Una cuarta prueba consulta simultáneamente las dos rutas de la API y exige conservar tanto la categoría como los muebles y muros reconocidos.
- Build estático: 52 módulos.
- QA real en navegador con cargas ordinarias de archivos y elección Automático; pasos 1–3, giro, materiales y exportaciones.

Capturas en `docs/images/v336/`. Los cambios y modelos instalados se mantienen en el entorno local; no se publicaron en GitHub Pages.
