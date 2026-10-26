# Carga desde cero y calidad de presentación · v2.4

25 de octubre de 2026. Caso aportado por el usuario: `images (2).jpeg`, 724 × 424 px, SHA-256 `e31bf22f4e6e71bc96e679cde230ee6d243b02d3064cabbce085312e7999c34e`. La segunda imagen aportada es una referencia CGI; no es un resultado generado por esta versión.

## Diagnóstico

El servidor Node anterior no exponía `/api/health` ni `/api/analyze`. Tampoco había entorno Python ni pesos instalados en este Mac. El ejemplo de 1280 × 749 tenía una predicción guardada asociada a su hash; al cargar otro archivo, el visor recurría al detector geométrico, cuyo resultado contiene `objects: []`. Añadir materiales sobre esa estructura no podía recuperar mobiliario ausente. La prueba anterior sobre el ejemplo guardado no verificaba el requisito de procesar archivos nuevos.

## Correcciones verificables

- Se instalaron las dependencias en `.venv` y se descargaron los dos modelos del manifiesto existente. Sus SHA-256 coinciden exactamente con los fijados en el proyecto. Los modelos y el entorno permanecen excluidos de Git.
- `npm start` inicia el worker privado en `127.0.0.1:4174` y sirve frontend, reconocimiento y CGI por `127.0.0.1:4173`. Las rutas de reconocimiento validan origen, tipo y tamaño de carga. No se envió el JPEG a un proveedor externo.
- `setup-local.sh`, `requirements-macos.txt` y `download_models.py` permiten repetir la preparación en macOS con Python 3.10–3.13. El arranque ordinario no descarga paquetes ni pesos.
- La aplicación comienza con una mesa vacía. El ejemplo solo se carga por elección del usuario. Se retiró el cargador lateral redundante y se ocultó el antiguo cargador del Paso 3; la mesa central y «Cambiar plano» conservan la carga múltiple.
- La calidad del análisis se informa explícitamente: inferencia ejecutada, resultado guardado o solo contornos. Un resultado geométrico no se presenta como reconocimiento completo del interior.
- Se usa repetición de símbolos del propio archivo para recuperar camas omitidas y resolver conflictos sanitarios. Las semillas proceden de las detecciones de esa misma imagen; no se leen referencias manuales, coordenadas guardadas ni el render CGI. Se conservan las detecciones originales y la evidencia de cada corrección.
- Fragmentos muy pequeños de armarios/equipamiento quedan en `reviewOnlyObjects`, evitando convertir letras o fragmentos en muebles altos. No se eliminan de la evidencia original de segmentación.
- `structure-evidence.js` incorpora bandas ausentes del detector geométrico de la misma imagen. Exige identidad/dimensiones coincidentes, soporte en la estructura existente y protege los intervalos de puertas/ventanas propuestos. El resultado queda marcado para revisión.
- El motor ya calcula clases de recintos. Se conservan máscaras de cocina y baño con puntuación suficiente para distribuir cerámica; se recortan a la cobertura del piso. Las clases se contrastaron con el [mapeo original de CubiCasa](https://github.com/CubiCasa/CubiCasa5k/blob/master/floortrans/loaders/house.py).
- El render local del Paso 2 utiliza el mismo acabado que el Paso 3, con contornos oscuros, madera, cerámica y mobiliario de presentación detallado. Se renderiza hasta el doble de la resolución de análisis, con límite de 2048 px en el lado mayor; las coordenadas de análisis no cambian.
- `furniture-visuals.js` añade pieles de catálogo: camas con colchón, almohadas y cabecero; sofás con cojines y brazos; sillas, mesas, armarios y sanitarios con formas redondeadas. Son objetos de presentación separados; la ubicación, orientación y huella proceden de las detecciones aceptadas.
- Se añade piso de exterior solo donde una línea cerrada de la propia lámina delimita una zona dentro de la extensión estructural. Las letras interiores se rellenan en la máscara para evitar huecos blancos. No se extruyen estas líneas ni se suman a una superficie medida.
- «Ampliar mesa» permite inspeccionar la imagen con más espacio; Escape devuelve la vista normal.

## Conservación del proceso 3D

`architecture.js`, `components.js` y `detector.js` permanecen idénticos a HEAD. En `app.js` se añade únicamente un método al adaptador público (`importAnalysis`, cinco líneas) para recibir el análisis de la misma lámina; no se modifican el constructor, la cámara, los controles, la calibración ni el tratamiento de aberturas. Los datos inferidos pueden mejorar; el proceso que los convierte a 3D se conserva.

La presentación mantiene geometría y materiales originales y restaura las propiedades de sombra al volver a Técnico. Los muebles detallados se añaden al grupo cosmético y se liberan al cambiar de modelo. La inferencia original se conserva en la exportación separada del análisis refinado.

## Validación y límites

62 pruebas JavaScript y 4 pruebas Python aprobadas. Incluyen regresiones del motor, identidad de imagen, protección de huecos, conservación de geometrías originales, liberación de recursos, cobertura exterior, acabados semánticos recortados, repetición de símbolos y rechazo de inferencias sin evidencia.

Se ejecutó el motor sobre los bytes del JPEG adjunto y se probó la carga en una mesa vacía del navegador. En la última llamada verificada (1,389 s de inferencia, sin incluir inicio del motor) se recuperan siete camas y dos bañeras; ocho fragmentos pequeños se apartan de la extrusión. Solo la cocina superó el umbral de confianza de las máscaras de acabado semánticas en este archivo (0,915). Los baños restantes conservan la asignación aproximada por objetos y cobertura; aún pueden presentar límites de piso imperfectos. Las correcciones son propuestas revisables. Esta es una comprobación sobre un caso concreto; no valida precisión general ni elimina todas las confusiones del detector.

El render local es una visualización de catálogo. **Todavía no iguala el fotorrealismo del CGI aportado.** La ruta de generación OpenAI continúa preparada, pero no hay clave de API configurada y no se efectuó una generación externa. Se distingue esta función del render local en la interfaz. No se ha sustituido el render local por la imagen de referencia para aparentar éxito.
