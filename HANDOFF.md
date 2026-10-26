# Diseño vinculado v2.5 — 25 de octubre de 2026

Se recuperó explícitamente el CGI aprobado de v2.3 para este plano (no era una generación local). `dist/presentation-projects.js` permite solo los dos SHA exactos del ejemplo 1280×749 y del JPEG aportado 724×424; asset nativo `dist/assets/presentation/reference-v23.png` SHA 881b59749fe4043a63095e58c2eae4b2e4f7ca6219987386bb7149b2026efb8d. `kind:linked` nunca declara validación geométrica. Nunca usar esta referencia para inferencia ni otros planos.

IndexedDB guarda imágenes nativas y encuadre por SHA original + tamaño de marco. Reprocesar filtros/calibración conserva el diseño del mismo plano al restaurar; no restaura todo el estado de una sesión. El inicio sigue vacío. `reference-surfaces.js` extrae parches limpios y textiles; el encuadre de esta referencia conocida usa sus límites visuales explícitos, sin intervenir en el reconocimiento. Apariencia 3D recuperó 8 pisos y ambientó 53 muebles en la prueba real. El exterior es una superficie fotográfica; no son árboles 3D ni nuevas detecciones. Muebles de catálogo, no modelos 3D reconstruidos de la foto. La nueva v2.5 mantiene el núcleo 3D de v2.4 y su inferencia.

71 pruebas Node + 4 Python aprobadas. Backend/server siguen activos en sesión 44969. No hay clave OpenAI ni generación nueva. Entrega v2.5 preparada para publicar en `origin/main` de `sployola-wq/Render_2Dto3D`. Copia previa de los archivos de presentación en `.local-backup/v2.4-before-reference/` (ignorada). Ver `reports/diseno-vinculado-08.md`.

---

# Carga real v2.4 — 25 de octubre de 2026

La prueba anterior sobre el ejemplo guardado no cubría archivos nuevos. El servidor Node carecía de rutas de inferencia y no había modelos/entorno en este Mac. Se preparó `.venv`, se verificaron los pesos del manifiesto y se integró un worker local gestionado por `npm start` (puerto privado 4174, frontend/API 4173). Sesión de servidor final: 44969.

El caso real es `/Users/macsl/Downloads/images (2).jpeg`, SHA e31bf22f4e6e71bc96e679cde230ee6d243b02d3064cabbce085312e7999c34e. Se verificó inferencia real y carga desde una mesa vacía. Se recuperaron siete camas, se resolvieron conflictos sanitarios mediante símbolos de la misma imagen y se apartaron ocho fragmentos pequeños. No se usaron la referencia manual ni el CGI para inferir la geometría.

Se retiró la carga lateral duplicada, el inicio usa mesa vacía, y el cargador antiguo del Paso 3 queda oculto. Hay resumen de calidad, bandas estructurales con evidencia del mismo archivo, máscaras de baño/cocina del modelo existente, pisos exteriores delimitados y muebles cosméticos detallados. El render local del Paso 2 comparte la presentación con el Paso 3 y tiene resolución propia hasta 2048 px. «Ampliar mesa» se cierra con Escape.

62 pruebas Node + 4 Python aprobadas. `architecture.js`, `components.js` y `detector.js` no cambian. `app.js` añade solo `importAnalysis` al adaptador público; no cambia su constructor 3D. Ver `reports/carga-real-07.md` para los límites. **El resultado local todavía no iguala al CGI adjunto**; OpenAI sigue sin clave y no se hizo generación externa. No presentar la imagen de referencia como salida generada. Cambios locales, sin push en esta etapa.

---

# Ambientación del Paso 3 v2.3 — 25 de octubre de 2026

El usuario autorizó enriquecer el aspecto del Paso 3 aprovechando el render del Paso 2, conservando el proceso de creación 3D. Se añadieron `appearance-mapping.js` y `appearance-3d.js` y la integración en `workflow.js`. El núcleo `app.js`, `architecture.js`, `components.js` y `detector.js` sigue idéntico a HEAD.

55 pruebas aprobadas. El modo Ambientado clona/restaura materiales, crea una cobertura cosmética de piso separada y mantiene vértices, jerarquía, posición, orientación, visibilidad y cámara. Los colores se aproximan desde el render compatible; no se recrean muebles desde la fotografía ni se declara precisión geométrica nueva. Sin render usa el estilo local del Paso 2. Ver `reports/ambientacion-3d-06.md`.

En navegador: 10 zonas de piso, 51 muebles ambientados, controles de capas/altura/cotas operativos. Permanecen las 24 regiones, 88 propuestas y 31 aberturas con soporte del ejemplo. Se comprobaron el regreso a Técnico y el retorno al Paso 2. Los cambios siguen locales; no se hizo push en esta etapa.

---

# Integración Argon v2.2 — 25 de octubre de 2026

Se revisó la carpeta hermana `Beta_Render_Pro-main_Argon` y se adaptaron mejoras de los pasos 1 y 2. El usuario pidió una alternativa a Gemini: se preparó OpenAI mediante el endpoint oficial de edición de imágenes. No hay clave configurada ni se hizo una generación real. El informe `reports/integracion-argon-05.md` registra procedencia, decisiones, limitaciones y validación.

El render fotorrealista es una presentación independiente: `model.presentation`. El render técnico permanece en `model.render` y la geometría del visor no se deriva de la imagen generada. `dist/app.js`, `architecture.js`, `components.js` y `detector.js` no cambian en esta integración.

Validación: 46 pruebas, incluida la integración OpenAI con respuestas simuladas; importación del PNG existente del usuario y regreso al Paso 3 conservando los resultados anteriores. El proyecto fuente no se modifica; no se trasladan su geometría PDF fija, generación heurística de mobiliario, visores 3D ni funciones comerciales.

---

# Actualización v2.1 — mesa 2D y nuevo proyecto

Cambios locales del 25 de octubre de 2026: botón Nuevo proyecto con confirmación y estado vacío, importación por arrastre en toda la mesa y encuadre proporcional según su tamaño real. El nuevo módulo `dist/workspace-ui.js` comparte el comportamiento de importación y el cálculo de encuadre.

`dist/app.js` y la implementación original del visor 3D no cambian en esta actualización. Verificación: 38 pruebas aprobadas; cancelación del reinicio, reinicio desde el Paso 3, importación después de vaciar el proyecto, plano vertical 600 × 1200 con encuadre completo en escritorio 2248 × 1307 y móvil 390 × 844; sin errores de consola. Las preferencias globales se conservan.

---

# Entrega local Prodalam Render Pro v2.0 — 25 de octubre de 2026

Destino solicitado: `https://github.com/sployola-wq/Render_2Dto3D`.

La carpeta recibida era una copia sin `.git`. Esta entrega agrega una interfaz de tres etapas, importación PDF/DXF, herramientas de medición y ficha del desarrollador. `README.md` documenta el alcance actual, incluyendo las limitaciones del CGI y las medidas provisionales.

La implementación original de `dist/app.js` se conserva byte por byte como prefijo del archivo actual. Solo se añadió un adaptador exportado `blueprintBridge`. La extensión reside en `dist/workflow.js`, `dist/technical-geometry.js` y `dist/workflow.css`. No se cambiaron `architecture.js`, `components.js`, el detector ni las predicciones del ejemplo.

Pruebas: 35 aprobadas. Verificación en navegador: ejemplo en el comparador, PDF de dos páginas y cambio de página, importación múltiple y DXF con geometría nativa/avisos de entidades omitidas. El nuevo renderer cenital no mueve la cámara del visor existente.

Se conservan abajo los antecedentes originales. Sus autorizaciones históricas y estados de servidores/hosting pertenecen a la máquina y al proyecto originales.

---

# Blueprint Builder — contexto para el próximo agente

Actualizado el **25 de octubre de 2026**, zona horaria America/Santiago.

## Estado de la entrega a GitHub

Este handoff acompaña la entrega de los Ensayos 03 y 04 a la rama `main` de `Paulsaac/Blueprint_builder`: reconstrucción depurada, imagen de 1280 × 749, auditoría de aberturas, pruebas, informes y capturas. Para identificar la revisión exacta, consultar `git log -1` y `origin/main`; no confundir el clon GitHub con el checkout histórico `app`.

- **Estado vigente:** asociación resuelta para las 15 propuestas revisadas, 31 cuerpos de abertura, 2 fragmentos excluidos y 6 ventanas con geometría pendiente. La ventana vertical de cocina sigue dividida. El registro y las limitaciones están en `reports/aberturas-04.md`.
- **Validación de esta entrega:** 27 pruebas Node aprobadas; comparación anterior/depurada, fichas ampliadas, calibración fuera del recorte, descarga de auditoría y exportación JSON verificadas en navegador. La predicción original se conserva; las dos puertas añadidas a la referencia no representan un reentrenamiento.
- **Ejecución local:** `start-local.cmd` inicia el servicio Python en `http://127.0.0.1:4173`. En otro equipo ejecutar antes `setup-local.ps1`. El servidor local quedó activo al cerrar el trabajo; comprobar `/api/health` antes de intentar iniciar otro proceso en el mismo puerto. `npm start` ofrece únicamente la vista estática.
- **Publicación:** GitHub Pages usa `main` y `/ (root)`; el `index.html` raíz abre `dist/`. Un push dispara la actualización estática. Pages permite revisar la predicción guardada y no ejecuta Python para imágenes nuevas. La calibración se guarda por navegador/origen, por lo que la medida local no se transfiere automáticamente a Pages.
- **Archivos locales:** `.venv`, pesos de `models`, junctions, cachés y logs están excluidos del repositorio. En este equipo los dos primeros se reutilizan desde `app`; no borrarlos recursivamente. La publicación anterior de Sites fue eliminada por solicitud del usuario y no debe recrearse sin una solicitud nueva.
- **Siguiente trabajo:** afinar máscara/extensión de las seis ventanas y la división de la ventana de cocina; después comparar resoluciones de YOLO para mobiliario. Mantener evaluación, anotaciones y geometría derivada separadas.

Las secciones siguientes conservan el progreso de cada etapa. Sus valores históricos de 18/20 pruebas, 21/27 aberturas y métricas anteriores no sustituyen el estado vigente del Ensayo 04.

## Último entregable: Ensayo 04 — auditoría de 15 aberturas

El usuario autorizó revisar las 15 propuestas sin asociación, corregir los casos sustentados y documentar los pendientes. El código y los resultados de esta etapa forman parte de la entrega a `main`. Leer `reports/aberturas-04.md` y `dist/data/openings-audit.json`.

- Se inspeccionaron las 15 propuestas sobre recortes de la imagen original. Todas eran aberturas reales: 9 puertas, 6 ventanas. Dos puertas del vestidor/acceso a cocina faltaban en la referencia, por lo que se añadieron `ref-door-13/14` mediante `backend/opening_reference_review.py`. La procedencia marca revisión parcial del agente, no independiente. El estado general permanece `transferred-initial-review`.
- Se archivó la referencia y las métricas anteriores en `dist/data/archive/1280x749-before-opening-audit`. Ambas asociaciones se comparan contra la **misma referencia corregida**, con el mismo IoU de caja 0,50. La detección bruta no cambió; las nuevas métricas de detección (24 TP, 28 FP, 21 FN) reflejan la corrección de referencia y no un modelo nuevo.
- `dist/openings.js` busca pares de jambas collineales/perpendiculares y no solo la primera línea más próxima. Usa apoyos cortos de la máscara y separa el eje del muro de la caja semántica. Limita desplazamiento transversal para evitar llevar una abertura a otra estructura. Agrupa propuestas de la misma clase; jamás mezcla puertas con ventanas. Conserva machones sólidos y exige dos apoyos independientes: una caja dentro de una pared continua no autoriza cortarla.
- `architecture.js` conserva `openingMode: reviewed/legacy` y `associateOpeningsLegacy` para reproducir la comparación. Los apoyos cortos se usan para aberturas; la orientación de muebles conserva los ejes largos anteriores. Se exportan `openingDiagnostics`, `rejectedOpeningIds`, `openingSupportRuns`, dos apoyos por abertura y `supportSpan` para reconstruir jambas/dinteles sin rellenar la parte libre del vano.
- Resultado al umbral 0,35: cuerpos 21 → 31, propuestas sin soporte 15 → 0, 2 fragmentos conflictivos excluidos y 4 propuestas agrupadas en un cuerpo existente. Las 15 asociaciones se recuperan, **pero las seis ventanas mantienen revisión de ancho, jamba o desplazamiento de máscara**. La ventana vertical de cocina `semantic-8/9` continúa dividida en dos cuerpos; no se elimina el tramo sólido por consultar la referencia. No afirmar que 31 cuerpos son 31 aberturas correctas.
- Comparación de huella de los cuerpos contra referencia corregida (IoU de caja ≥ 0,50): coincidencias de puertas 4 → 9 y de ventanas 7 → 10. Cuerpos sin coincidencia 10 → 12; ese aumento absoluto acompaña la generación de más cuerpos y no equivale automáticamente a falsos positivos. La medida no valida el volumen ni su uso constructivo. La máscara 2D de muros no se alteró en esta auditoría.
- `dist/data/openings-visual-review.json` contiene la inspección de los 15 casos, las dos adiciones y las seis alertas. **Es dato de evaluación/interfaz; nunca entrada de inferencia/asociación.** La interfaz valida hash, clase y caja antes de mostrar una revisión. `prepare_sample.py` reaplica las dos adiciones solo para el hash exacto; otra imagen requiere revisión nueva.
- Interfaz: selector **Asociación de aberturas**, tabla en **Evaluación → Cada caso, sobre el plano**, botón por caso, superposición **Auditoría de aberturas**, selector de recorte y descarga JSON de auditoría. Los contadores distinguen «sin soporte» de «en revisión geométrica». La calibración sale del recorte y vuelve a coordenadas completas para no corromper la escala.
- Exportación de datos JSON v3 incluye modo de asociación, diagnósticos, apoyos y revisión visual separados de la predicción original. La exportación de captura identifica la auditoría y el caso. La medida de 20,96 m del mismo hash sigue guardada.
- **27 pruebas**: regresiones de vanos/antepechos, encuentro L, apoyos insuficientes, machón sólido entre ventanas, cambio de eje hacia una pared lejana, conflictos de categoría y contabilidad de todas las propuestas. Los tests históricos continúan sobre 724 × 424. Se añadió validación de hash/caja para no aplicar la revisión a otro resultado.
- Reproducción: ejecutar `backend/opening_reference_review.py`, `node backend/build_opening_audit.mjs`, `node backend/build_report.mjs` y `node backend/build_reconstruction_report.mjs`. `backend/render_opening_audit.py` genera las planchas de diagnóstico en `docs/images/openings-audit/` a partir de `reports/openings-inspection.json` (instantánea anterior) y el informe de auditoría vigente.

Comprobación final en navegador: alternancia 21/31 cuerpos, fichas ampliadas de puerta 23 y ventana 3, notas de geometría pendientes, descarga de auditoría (15 casos, 15 → 0 sin soporte, 6 alertas, 2 fragmentos excluidos) y datos v3 (37 diagnósticos, predicción conservada, escala 20,96 m). Iniciar calibración desde un recorte restablece canvas 1280 × 749 y modo categorías; cancelar conserva la medida. Consola sin errores. El visor quedó en 3D depurado. Capturas `docs/images/aberturas-04-*.png`; planchas antes/después en `docs/images/openings-audit/`.

Siguiente mejora delimitada: máscara/extensión de las seis ventanas y la división de la ventana vertical de cocina. No aumentar métricas cambiando tolerancias del evaluador ni usar las cajas de referencia para rellenar la predicción. Después, comparar resoluciones de YOLO para mobiliario; esa prueba no se realizó en el Ensayo 04.

## Etapa previa: actualización de imagen a 1280 × 749

El usuario reemplazó `bocetos/plano.jpeg` por una versión de mayor resolución. Se copió a `dist/assets/plano.jpeg` y se ejecutó una inferencia real nueva con el servicio local, sin reducción previa porque está bajo el límite de 1.400 px. Hash actual: `9f3f598dd2db7f26fa7374c0b5bbbf7764e70bda9febb9aca65243fe3389f049`.

- La imagen anterior de 724 × 424 y sus JSON se preservaron en `dist/assets/archive/plano-724x424.jpeg` y `dist/data/archive/724x424/`; informes históricos con sufijo `-724x424`. Los tests anteriores ahora apuntan explícitamente al archivo histórico.
- `backend/prepare_sample.py` registró ambas resoluciones mediante SIFT/RANSAC y un ajuste afín sin giro: 587 correspondencias candidatas, 466 inliers, error mediano 0,2887 px. Trasladó las coordenadas de la referencia inicial, con procedencia y estado `transferred-initial-review`. **No presentar esa transferencia como una revisión manual nueva.** La interfaz lo indica en Evaluación; la inferencia no lee la referencia.
- `dist/sample.js` y `dist/data/sample-manifest.json` identifican el ejemplo vigente; las URLs incluyen el hash para impedir que se mezclen imágenes y datos de la caché. `tests/fixtures/plano-current.json` y `plano-current.rgba.gz` tienen dimensiones y hash comprobables. `build_report.mjs` usa esos metadatos y ya no fija 724 × 424.
- La limpieza adapta su tolerancia a la huella de cada resolución, conservando IoU ≥ 90 % con la máscara original antes de aceptar un cambio. Resultado actual: 3.146 → 1.110 vértices, 24 → 20 regiones, 21 aberturas vinculadas y 15 pendientes. La coincidencia con la máscara original es 90,04 %.
- Referencia transferida: IoU de muros de IA 59,5 %, huella limpia 60,2 %, baseline geométrico 56,7 %. Objetos: 23 aciertos, 29 sobrantes y 20 omisiones en cinco clases; precisión 44,2 %, cobertura 53,5 %. **La resolución mayor no mejoró el reconocimiento de objetos en esta ejecución.** Revisar anotaciones transferidas y modelos antes de sacar conclusiones generales. El detector YOLO conserva `imgsz=640`; el segmentador sí recibe la imagen completa de 1280 × 749.
- Las 20 pruebas incluyen ahora coherencia de hash/dimensiones/píxeles del reemplazo, separación del ensayo histórico y limpieza adaptable. Los informes activos se regeneraron con la imagen nueva. La calibración antigua no se reutiliza automáticamente: pertenece al hash anterior. En el navegador se marcó de nuevo la cota superior de 20,96 m, entre los puntos de análisis (35,15) y (1197,15); se comprobó su persistencia al recargar. La colocación 3D con esa escala muestra 47 muebles/equipos y registra 4 descartes por tamaño; el informe numérico usa la escala provisional para mantener una comparación reproducible.
- Capturas de esta etapa: `docs/images/reconstruccion-03-1280x749.png` y `docs/images/comparacion-muros-03-1280x749.png`. El visor se comprobó con el archivo nuevo, escala calibrada y consola sin errores. Esta etapa se mantuvo local durante las pruebas y se incluye en la entrega actual a GitHub.

## Entregable previo: Ensayo 03 con imagen de 724 × 424

El usuario pidió continuar en orden con limpieza de muros, integración de aberturas, escala, mobiliario y presentación. Los cambios de este entregable se prepararon **localmente en el clon GitHub**, sin push ni publicación nueva. Leer también `reports/reconstruccion-03.md`.

- `dist/architecture.js` recibe únicamente la fuente seleccionada; no completa predicciones con la referencia. Simplifica/alinea bordes cercanos a ejes y conserva diagonales. Incluye una guarda de coincidencia de área y conserva los contornos originales si la modificación es excesiva. No impone un espesor único ni recupera paredes omitidas por IA.
- En el ejemplo guardado: 1.688 → 1.301 vértices, huella limpia/original IoU 94,1 %. Frente a la referencia inicial: 57,3 % → 58,4 % de IoU de huella 2D. Estas medidas preceden a la restauración de antepechos y dinteles; no miden el volumen final ni precisión constructiva.
- 27 aberturas asociadas (8 puertas, 19 ventanas), 7 pendientes. La asociación requiere apoyo de muro en ambos extremos. Se generan cuerpos de muro por franjas de altura, con vano libre, dinteles y antepechos. Las propuestas sin asociación permanecen marcadas para revisar en 2D. Una asociación no valida la categoría detectada.
- Mobiliario: se conservan los centros y las huellas; 24 de las 58 propuestas de muebles/equipos del ejemplo tienen una orientación sugerida por un muro próximo. Las restantes usan orientación de catálogo. Duplicados, solapes fuertes con muros y tamaños incompatibles con una escala medida se omiten solo en 3D y se registran en la exportación. Con la calibración del navegador pueden variar los descartes por tamaño.
- `dist/calibration.js` valida y vincula la medición al SHA-256 y las dimensiones de análisis. Se guarda en `localStorage` para ese origen/archivo. Se probó en navegador con la cota superior de 20,96 m, marcada manualmente sobre el ejemplo; persiste al recargar. No es OCR, no se añade una escala automática específica de esta imagen al código.
- Selector **Geometría 3D**: reconstrucción u original. Superposición 2D **Muros · antes y después**: original naranja, reconstrucción verde. La evaluación distingue huella reconstruida y predicción original. Exportación JSON v3: reconstrucción, asociación de aberturas, colocación del mobiliario y medición separados de la inferencia.
- Presentación: base neutra, materiales y sombras más suaves, cuadrícula opcional, intensidad del plano, cámara centrada en los cuerpos y ajuste al cambiar el tamaño del visor. Estilos nuevos en `dist/reconstruction.css`.
- `backend/build_reconstruction_report.mjs` genera el informe Markdown y `dist/data/plano-reconstruction-report.json`. Las pruebas actuales son **18**; cubren vanos, antepechos/dinteles, patios interiores, diagonales, duplicados/colisiones, identidad de la escala y no modificación de la inferencia.
- El servidor Python devuelve `Cache-Control: no-store` para evitar mezclar módulos anteriores con HTML nuevo. Se reinició y se verificó una nueva inferencia real desde el botón del visor, además de la comparación, persistencia de escala y consola. Se descargó y leyó el JSON v3: unidades explícitas, 27 aberturas con alturas, medición de 20,96 m y predicción original conservada. Capturas: `docs/images/reconstruccion-03.png` y `docs/images/comparacion-muros-03.png`.
- El clon local reutiliza `.venv` y `models` del checkout original `app` mediante junctions locales, excluidas por `.gitignore`. **No borrar recursivamente estas rutas ni sus destinos como parte de una limpieza.** En otros equipos usar `setup-local.ps1`. El servidor queda en segundo plano en `http://127.0.0.1:4173`; logs locales ignorados `server-local.log` y `server-local-error.log`.

Los pesos y `dist/data/plano-prediction.json` no se modificaron. Las métricas de reconocimiento siguen en 31 aciertos, 21 sobrantes y 12 omisiones en cinco categorías. Se necesita revisar las siete aberturas pendientes y validar otros planos antes de generalizar la limpieza.

## 1. Objetivo y decisiones del usuario

Construir una herramienta web donde el usuario cargue una imagen de un plano arquitectónico y el sistema reconozca automáticamente sus componentes, incluyendo mobiliario, y genere el levantamiento 3D alineado sobre la misma imagen.

La prioridad es **el reconocimiento y levantamiento automático**, no crear un editor CAD ni dedicar esfuerzo a la edición manual del 3D. Three.js fue elegido como base del visor, aprovechando experiencia previa del usuario con JavaScript y entornos 3D.

El usuario entregó dos imágenes: `plano.jpeg`, elegida para el desarrollo, y `diseño.jpeg`, referencia de acabado. En este repositorio se conservan como `dist/assets/plano.jpeg` y `dist/assets/referencia.jpeg`. La imagen de acabado nunca debe presentarse como un resultado generado.

El usuario autorizó este entregable: **detección 2D por categorías, comparación con anotaciones del plano y levantamiento 3D correspondiente**. Después pidió conectar este proyecto a `https://github.com/Paulsaac/Blueprint_builder`, documentar el progreso y hacer push.

## 2. Estado real del proyecto

Existe una aplicación funcional, buildless, con dos formas de ejecución:

| Forma | Qué funciona |
|---|---|
| Sitio estático / GitHub Pages | Ensayo precalculado de una inferencia real sobre el archivo `plano.jpeg`, revisión, métricas, catálogo 3D, calibración y exportaciones. Para otras imágenes solo funciona el detector geométrico anterior. |
| Servicio Python local | Sirve la misma interfaz y ejecuta los modelos CPU sobre imágenes nuevas; todo ocurre en el equipo del usuario. |

**No existe todavía inferencia de IA en la nube.** GitHub Pages sirve archivos estáticos y no ejecuta el backend Python. Iniciar el motor local no transforma la URL publicada en un servicio de IA: para usarlo hay que abrir `http://127.0.0.1:4173`.

El usuario pidió eliminar la publicación de Sites y confirmó su eliminación permanente; se eliminó y luego eligió GitHub Pages. **No recrear Sites sin una nueva solicitud del usuario.** El modelador se publica en [GitHub Pages](https://paulsaac.github.io/Blueprint_builder/).

El código estaba inicialmente en la subcarpeta local `app`, que es la raíz de trabajo de Sites. La importación inicial a GitHub se realiza como una instantánea pública revisada, porque Git CLI no tenía una credencial de escritura válida. El historial y la configuración privada de Sites permanecen en el checkout original. Un clon independiente de GitHub se conserva en la carpeta local `Blueprint_builder`, junto a `app`; en el clon los archivos operativos están directamente en la raíz, sin otra carpeta `app` dentro.

GitHub Pages usa la rama `main`, carpeta `/ (root)`. Inicialmente mostraba el README porque faltaba un `index.html` en la raíz. Ahora ese archivo redirige a `./dist/`, conservando parámetros y fragmentos, con enlace y redirección HTML de respaldo. `.nojekyll` evita procesar el repositorio con Jekyll. Todas las dependencias de la aplicación usan rutas relativas; no mover ni duplicar los archivos de `dist/` para publicar. Los pushes a `main` actualizan Pages. La configuración privada de hosting anterior no se publica en GitHub; tampoco se debe subir el historial privado original sin revisar sus metadatos.

## 3. Progreso cronológico

### Fase inicial: definición

Se separaron tres problemas: interpretar píxeles, reconstruir geometría y visualizarla en 3D. Se descartó hacer del trazado manual o la edición 3D el flujo principal. La escala real y las alturas requieren datos de referencia o valores configurados; no se pueden recuperar con certeza si faltan en la imagen.

### Prototipo 01: geometría automática

Se desarrolló un detector JavaScript para planos ortogonales de doble línea o trama:

- Lectura de intensidad y búsqueda de pares de bordes paralelos.
- Dos pasadas de contraste, descarte de duplicados y filtrado de líneas cortas aisladas.
- Tramos de muro y huecos candidatos entre tramos colineales.
- Ejecución en Web Worker para mantener la interfaz disponible.
- Levantamiento automático Three.js sobre la imagen, vista superior/axonométrica, capas y calibración con dos puntos.
- Carga JPEG/PNG/WEBP y exportación JSON/PNG.

Este detector **no es IA entrenada**. Conservamos `dist/detector.js` y `dist/worker.js` como baseline y alternativa explícita. Se hicieron ajustes de contraste, longitud mínima y conexión al revisar el ejemplo. No hay coordenadas de muros del ejemplo codificadas dentro del detector.

### Ensayo 02: reconocimiento, anotaciones y comparación

1. Se preparó una referencia manual inicial separada de los modelos.
2. Se instaló un entorno Python CPU local y se evaluaron modelos públicos.
3. Se probó `Yytsi/floorplan-to-3d-walls`, ResNet34-UNet: **cero regiones de muro** sobre este JPEG, incluso tras contrastar el preprocesamiento con su código. No se presentó como una detección correcta; quedó registrado en `dist/data/model-experiments.json`.
4. Se evaluó el modelo original CubiCasa5K hourglass, con entrada RGB normalizada a `[-1, 1]`, salida de 44 canales y separación `[21 heatmaps, 12 clases de espacios, 11 iconos]`. Sí recuperó muros y aberturas.
5. Se integró un YOLOv8 de símbolos de planos del proyecto `REIkd/FYP-Floorplan` para mobiliario.
6. Se añadió fusión de resultados, extracción de contornos con huecos y un catálogo paramétrico de objetos Three.js.
7. Se implementaron vistas por categoría, referencia manual, aciertos/omisiones/sobrantes y una tabla de evaluación.
8. Se añadió API CPU local, preparación del entorno, verificación de hashes y documentación de reproducción.
9. Se publicó el ensayo 02 y se comprobó que funcionaba en el sitio privado.

## 4. Arquitectura y archivos clave

```text
Imagen JPEG/PNG/WEBP
  ├─ Inferencia local Python
  │    ├─ CubiCasa5K → muros, aberturas y equipamiento
  │    ├─ YOLOv8 → mobiliario y otras propuestas
  │    └─ Fusión y contornos → JSON con procedencia
  ├─ Detector geométrico JS → baseline de muros/huecos
  └─ Interfaz
       ├─ Detección 2D y filtros
       ├─ Comparación contra referencia manual del mismo archivo
       └─ Three.js → levantamiento y objetos de catálogo
```

| Archivo | Responsabilidad |
|---|---|
| `dist/app.js` | Carga, hash del archivo, elección de fuente, llamadas a API, vistas, calibración, escena y exportaciones. |
| `dist/components.js` | Camas, sofás, mesas, sillas, aberturas y equipamiento paramétricos. Alturas/orientación aproximadas. |
| `dist/evaluation.js` | Catálogo de categorías, IoU de cajas, emparejamiento uno a uno y rasterización/IoU de muros. |
| `dist/detector.js`, `dist/worker.js` | Baseline geométrico anterior. |
| `dist/data/plano-prediction.json` | Resultado real precalculado; conserva objetos originales y procedencia. |
| `dist/data/plano-reference.json` | Referencia manual inicial; exclusivamente inspección y evaluación. |
| `dist/data/plano-evaluation.json` | Informe numérico reproducible con procedencia. |
| `dist/data/model-experiments.json` | Registro de modelos probados, incluido el resultado negativo. |
| `backend/inference.py` | Carga restringida de pesos, inferencia CPU, máscaras, componentes y fusión. No lee anotaciones manuales. |
| `backend/cubicasa_model.py` | Arquitectura adaptada de CubiCasa5K, con atribución y licencia. Se retiró su bootstrap de pose humana no utilizado. |
| `backend/server.py` | Servidor HTTP de interfaz y API local en `127.0.0.1:4173`. |
| `backend/model-manifest.json` | Origen, tamaño y SHA-256 de los pesos. |
| `backend/create_reference.py` | Genera las anotaciones manuales, separadas de la inferencia. |
| `backend/build_report.mjs` | Recalcula el informe y la comparación de muros con el baseline. |
| `backend/probe_cubicasa.py` | Prueba aislada del segmentador original; genera diagnósticos en `models/`. |
| `server.mjs` | Servidor estático, sin inferencia. |
| `setup-local.ps1`, `start-local.cmd` | Preparación y arranque local Windows. |
| `tests/` | Pruebas Node y fixture RGBA comprimido de la imagen real. |
| `reports/plano-evaluacion.md` | Resultados actuales y limitaciones. |
| `docs/images/` | Capturas del progreso y de la comparación. |

El esquema de predicción usa píxeles de la imagen de análisis: `width`, `height`, `wallPolygons` (`outer` y `holes`), `objects` (`category`, `bbox`, `confidence`, `source`), `structuralRegions`, `rawObjectDetections` y `provenance`. El esquema anterior de muros usa `axis`, `c`, `from`, `to` y `thickness`. Las coordenadas del mundo se obtienen con la escala configurada; Y representa altura.

La fusión actual toma aberturas y equipamiento de CubiCasa, y mobiliario de YOLO. Suprime determinadas propuestas YOLO superpuestas a equipamiento segmentado con puntuación suficiente. Son reglas explícitas, no un sistema de confianza calibrado. Los datos originales quedan en `rawObjectDetections` para inspección.

Si la IA produce cero regiones de muro, la interfaz permite un resultado híbrido con el detector geométrico; se identifica mediante `provenance.structureFallback`. En el ejemplo publicado se utiliza CubiCasa, que sí genera contornos.

## 5. Referencia y métricas actuales

Archivo original: 724 × 424 px.

SHA-256:

```text
1eaaa77811f87c7a623468c69f533e6f1221fea1f1112e60d2ca82315ed78f90
```

Referencia manual: **43 tramos de muro y 76 componentes**. Se revisaron visualmente, entre otros, el número de camas (7), sofás (4), las puertas y la definición de sus cajas. La referencia sigue pendiente de revisión independiente.

Cinco clases evaluadas, puntuación mínima 0,35, IoU de caja ≥ 0,50:

| Clase | Referencia | Detectados | Correctos | Omitidos | Sobrantes |
|---|---:|---:|---:|---:|---:|
| Puertas | 12 | 13 | 10 | 2 | 3 |
| Ventanas | 16 | 21 | 12 | 4 | 9 |
| Camas | 7 | 4 | 4 | 3 | 0 |
| Sofás | 4 | 8 | 3 | 1 | 5 |
| Mesas | 4 | 6 | 2 | 2 | 4 |

- Agregado: 31 aciertos, 21 sobrantes, 12 omisiones.
- Precisión: **59,6 %**; cobertura/recall: **72,1 %**.
- Muros: **57,3 % IoU** de la IA frente a **70,5 % IoU** del detector geométrico anterior.
- Resultado del ejemplo: 35 regiones de muro y 92 componentes propuestos con puntuación ≥ 0,35; las métricas agregadas anteriores solo incluyen las cinco clases evaluadas, no esos 92 componentes completos.

**No declarar una mejora general de precisión ni un modelo listo para producción.** El nuevo segmentador recupera estructura y categorías, pero su máscara tiene espesor irregular y menor coincidencia de área que el baseline en este plano. Persisten muebles mal clasificados, aberturas fragmentadas y omisiones. La elección y revisión se hicieron sobre el mismo ejemplo; no es un conjunto de prueba independiente.

Las cajas de puertas/ventanas representan la **huella de la abertura**, excluyendo arcos de giro; las de muebles, la huella exterior del símbolo. No comparar cajas con otra definición sin adaptar las anotaciones y reportarlo. Sillas y equipamiento son propuestas/anotaciones auxiliares, excluidas de las métricas iniciales. La puntuación del modelo no equivale a una probabilidad calibrada.

## 6. Ejecutar y reproducir

Desde la raíz del repositorio:

```powershell
# Vista estática: Node.js 20+; no necesita npm install.
npm start

# Preparación de IA en otro equipo: Python 3.12, Node.js y Windows.
.\setup-local.ps1

# IA local (detener el servidor estático antes; usan el mismo puerto).
.\start-local.cmd
# Alternativa:
npm run start:ai
```

Abrir `http://127.0.0.1:4173`. `index.html` no debe abrirse con `file://`: utiliza módulos y Web Worker. En la máquina original ya se instalaron el entorno y los pesos, pero **no forman parte del repositorio**. Para otro clon, ejecutar el instalador.

```powershell
npm test
.\.venv\Scripts\python.exe backend/inference.py --image dist/assets/plano.jpeg --output dist/data/plano-prediction.json
node backend/build_report.mjs
```

Solo regenerar `plano-reference.json` con `python backend/create_reference.py` cuando se cambien/revisen sus anotaciones. Nunca tratar ese script como un detector ni entrenar/evaluar sobre la misma imagen declarando generalización.

La escala inicial supone un ancho total de imagen de 24 m. Calibrar con dos puntos y una medida conocida; la cota superior del ejemplo indica 20,96 m. Altura de muro inicial 2,70 m; puerta 2,10 m; antepecho 0,90 m; ventana 1,20 m, con límites según la altura de muro. Son supuestos de reconstrucción, igual que la orientación y altura de los muebles.

## 7. Verificaciones completadas

- **10 pruebas Node**, todas aprobadas: imagen vacía/transparente, tramos H/V, líneas aisladas, huecos, hitos del plano real, IoU de cajas, duplicados, huecos en polígonos, identidad del archivo y separación entre predicción y referencia.
- Sintaxis de JavaScript y compilación de fuentes Python comprobadas.
- Inferencia CPU real ejecutada por CLI y mediante la interfaz/API; orden de 1–2 segundos de inferencia sobre este ejemplo después de cargar modelos. No es un benchmark de latencia general ni incluye el arranque.
- `GET /api/health` y `POST /api/analyze` comprobados; origen externo rechazado con HTTP 403.
- Carga, capas, calibración, altura, fuentes separadas, puntuación, filtros, exportaciones JSON/PNG y descarga de métricas comprobadas en navegador durante el desarrollo.
- Imagen blanca distinta, también llamada `plano.jpeg`: la versión estática desactivó IA/referencia y no reutilizó datos del ejemplo. La comparación se vincula al hash, nunca al nombre.
- Vista estática y publicación privada revisadas; evaluación visible y sin errores de consola en la última revisión.
- Los servidores temporales de QA se detuvieron al terminar; no asumir que siguen funcionando.

## 8. Límites operativos y de publicación

- No hay detección de habitaciones integrada en la interfaz, OCR de cotas, BIM/IFC, techos ni acabados automáticos.
- No hay persistencia/importación de proyectos; recargar vuelve al ejemplo. La exportación JSON sí conserva geometría, referencia, procedencia y supuestos.
- JPEG/PNG/WEBP, límite de carga 20 MB; motor Python con límite de 25 millones de píxeles y reducción del lado mayor a 1.400 px. Revisar dimensiones originales frente a coordenadas de análisis.
- Visor WebGL 2; fallback 2D si falla su creación.
- Las alturas de puertas/ventanas y colocación de catálogo son aproximadas. Las cajas y contornos no son geometría CAD validada.
- API local con el mismo origen, enlazada a `127.0.0.1`; no está diseñada para exponerla directamente a Internet.
- Los pesos se comprueban por SHA-256 antes de cargar. CubiCasa usa `torch.load(..., weights_only=True)`; YOLO restringe los globals a clases neuronales permitidas. **No sustituir esto por `weights_only=False`.**
- `.venv/`, `models/`, `third_party/`, cachés, credenciales y archivos de runtime están excluidos. No subirlos al repositorio ni al paquete estático.
- Three.js y OrbitControls están vendorizados, versión 0.180.0, con licencia MIT. Las fuentes web son opcionales y tienen fallback del sistema.

Para mantener la publicación, trabajar en el clon GitHub cuyo `origin` apunta a `Paulsaac/Blueprint_builder` y comprobar el despliegue de Pages tras el push. El checkout original `app` conserva el historial anterior y los modelos locales; no confundirlo con el clon GitHub. Las credenciales se mantienen en memoria/stdin, nunca en archivos o commits. No forzar un push ni mezclar el historial privado anterior con el público.

## 9. Modelos, atribución y derechos

- Estructura: https://github.com/CubiCasa/CubiCasa5k. Arquitectura adaptada y atribuida en `backend/cubicasa_model.py`; licencia CC BY-NC 4.0 en `backend/licenses/cubicasa-license.txt`.
- Símbolos: https://github.com/REIkd/FYP-Floorplan. Se obtuvo el checkpoint público; no se encontró una licencia explícita de esos pesos. El repositorio y el sitio no incluyen los pesos; el instalador local los descarga de su origen.
- Experimento descartado: https://huggingface.co/Yytsi/floorplan-to-3d-walls.
- Los enlaces, tamaños y hashes exactos de los modelos seleccionados están en `backend/model-manifest.json`.
- Antes de convertir esta prueba en producto comercial, resolver licencias de modelos/datos y revisar el código derivado. No añadir una licencia permisiva global que ignore la licencia del código de terceros.

## 10. Próximos pasos recomendados

1. **Revisar la referencia con una segunda persona**, fijar categorías y completar anotaciones coherentes. Crear un conjunto de planos adicionales reservados para evaluación antes de ajustar umbrales/modelos.
2. Mejorar muros: espesor, contornos, continuidad y conexiones; contrastar IoU y conectividad con el baseline, evitando optimizar solo el aspecto del ejemplo.
3. Mejorar mobiliario: confusiones entre sofás, bañeras y armarios; tres camas omitidas; clasificación y orientación. Evaluar modelos alternativos o ajuste con símbolos anotados, con separación entrenamiento/validación/prueba.
4. Revisar fusión y duplicados, especialmente regiones fragmentadas de puertas/ventanas. Medir cada cambio por clase; conservar salidas originales y comparar antes/después.
5. Asociar cada abertura con su muro; reconstruir antepechos y dinteles con supuestos explícitos, en lugar de colocar paneles solo a partir de cajas.
6. Si el usuario quiere IA para cualquier imagen desde la URL publicada, definir un backend de inferencia desplegable o estudiar ONNX/WebGPU. Hoy no está implementado; no prometerlo por el mero hecho de publicar el frontend.
7. Después: persistencia/importación de proyectos, manejo de planos inclinados/fotografiados, OCR de cotas y métricas de conectividad. Mantener el foco en reconocimiento/levantamiento, sin convertir la edición 3D en prioridad.

## 11. Primeros minutos del próximo agente

1. Leer este documento, `README.md` y `reports/plano-evaluacion.md`.
2. Inspeccionar `git status`, ramas y remotos; conservar cambios del usuario y la configuración de GitHub Pages. La publicación de Sites fue eliminada por solicitud expresa.
3. Ejecutar `npm test` y abrir la vista estática. Iniciar el servicio local solo si el trabajo necesita inferencia.
4. Confirmar el problema concreto que se va a mejorar y guardar una medición antes de cambiar algoritmos.
5. Mantener anotación manual, predicción y baseline separados. Nunca completar una predicción con las anotaciones para aparentar mayor precisión.
