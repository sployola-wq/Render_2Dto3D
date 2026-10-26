# Prodalam Render Pro v2.8

Aplicación local de preparación de planos y reconstrucción 3D. Repositorio de esta entrega: [sployola-wq/Render_2Dto3D](https://github.com/sployola-wq/Render_2Dto3D).

```sh
npm start
```

Abrir **http://127.0.0.1:4173**. Los recursos del navegador se incluyen en `dist/vendor`; la vista estática no requiere instalar dependencias para iniciar. Node.js 20 o superior.

## Cambios v2.8 · Corte mecánico y fachada IA

El modo mecánico comienza en **Corte longitudinal**: separa regiones de material, conserva espacios cerrados internos y construye medias revoluciones con caras de sección. Los trazos originales se proyectan únicamente sobre esas caras materiales. Hay alternativas de envolvente cerrada y núcleo como eje longitudinal sin seccionar. La comparación, el 3D y los vectores SVG comparten la interpretación del corte; JSON y STL conservan su geometría y unidades.

Se generó con la herramienta de imágenes de OpenAI una propuesta para **la fachada exacta aportada** (SHA `81331e…3641d`). Queda vinculada por identidad, con procedencia `generated`, y se recupera al procesar nuevamente ese archivo. El modelo exterior toma de su presentación la fachada, la paleta, una muestra de revestimiento y reflejos de vidrio; no aplica esa imagen a otros proyectos. La geometría se mantiene independiente de la propuesta visual.

**Otras fachadas necesitan su propia generación o importación.** El botón de generación por API está preparado para el proveedor configurado en el servidor; en este equipo no hay clave API configurada. La propuesta incluida se generó mediante la herramienta integrada de Codex, sin utilizar la API del servidor. No constituye un generador universal sin conexión. Imagen y prompt: [facade-ai-v28.png](dist/assets/presentation/facade-ai-v28.png), [procedencia y prompt](dist/assets/presentation/facade-ai-v28.json).

Verificación: **104 pruebas Node y 4 Python**, corte real con cavidad central, cambio entre corte/envolvente, fachada IA recuperada tras recarga y regresión real del interior con 8 pisos texturados y 53 muebles. El núcleo interior de v2.5 permanece idéntico. Ver [reports/cortes-y-fachadas-11.md](reports/cortes-y-fachadas-11.md).

## Cambios v2.7 · Interpretación antes del render

El modo inicial es **Automático**: identifica la evidencia de una sección mecánica, un alzado o capas CAD estructurales antes de invocar el motor de interiores. Se migran los registros antiguos que habían guardado Interior como valor predeterminado. Una selección manual incompatible bloquea el procesamiento residencial salvo verificación expresa; las predicciones sin evidencia suficiente de aberturas y equipamiento tampoco habilitan el modelo residencial.

El Paso 2 especializado ahora renderiza la **misma geometría** que se navega en el Paso 3, con cámara ortográfica alineada al marco original e iluminación de estudio. Los metales reciben reflejos de entorno generados localmente. Los DXF con una única capa estructural identificable la seleccionan sin incluir sus cotas. El flujo interior de v2.5 se conserva.

Verificación: **95 pruebas Node y 4 Python**, carga normal de los JPEG mecánico/fachada del usuario y regresión real del interior (8 pisos con textura, 53 muebles ambientados), más un pórtico DXF de 7 barras. La envolvente mecánica no equivale a reconstruir el ensamblaje: las cavidades y piezas separadas requieren perfiles explícitos. Ver [reports/ruteo-10.md](reports/ruteo-10.md).

## Cambios v2.6 · Exteriores e ingeniería

Selecciona **Tipo de proyecto** al cargar la lámina. El flujo anterior de interiores se conserva. Los nuevos modos ejecutan análisis y visores independientes:

- **Exterior / fachada:** silueta del alzado, paños candidatos con materiales editables y volumen por profundidad especificada. Una perspectiva aislada produce una aproximación volumétrica, no la reconstrucción de sus caras ocultas.
- **Ingeniería / pieza:** revolución de envolvente simétrica, diámetro interior especificado, medias secciones trazadas y extrusión de perfiles con huecos. Las cavidades complejas y la separación de piezas requieren perfiles explícitos.
- **Estructura / barras:** ejes raster propuestos o líneas DXF; secciones I y tubulares, edición de barras y pórticos duplicados por solicitud del usuario. Se pueden seleccionar capas DXF y usar sus unidades declaradas.

Hay región de trabajo, trazado de perfiles, eje de revolución, comparación 2D, medición entre superficies 3D, sección visual y exportación JSON/STL (STL en mm). El JSON distingue píxeles de análisis, parámetros en mm y geometría en metros. Los estudios y referencias se separan por archivo y disciplina; se mantiene la clave histórica de los diseños interiores.

Estos modos generan geometría de revisión: no son cálculos de resistencia, validación de fabricación ni conversión general de cualquier plano a un CAD exacto. La generación fotorrealista por API sigue siendo opcional. **88 pruebas Node + 4 Python aprobadas**, más revisión en navegador de los ejemplos, un pórtico DXF y el interior existente. Ver [reports/multidisciplina-09.md](reports/multidisciplina-09.md).

## Cambios v2.5 · Conservar el diseño y transferir sus acabados

El diseño fotorrealista aprobado de v2.3 está vinculado explícitamente a los dos archivos conocidos de este plano (ejemplo y JPEG adjunto), por SHA-256. Se muestra por defecto en el Paso 2; es una referencia aportada por el usuario, **no una nueva generación ni una salida de la inferencia local**. Otros planos necesitan su propia presentación importada o generada.

Las presentaciones importadas/generadas se guardan en IndexedDB por identidad de archivo y dimensiones del marco, y se recuperan al volver a abrir y procesar ese mismo plano. No se usan nombres de archivo para asociarlas. La exportación conserva los píxeles nativos; la vista comparativa usa hasta 3072 px y mantiene las coordenadas técnicas del plano.

El Paso 3 toma muestras reales de piso, madera y textiles, excluye mobiliario/sombras/césped de los parches de acabado y añade una superficie exterior opcional. Los muebles de catálogo incorporan bordes biselados, almohadas y costuras. Toda la ambientación pertenece a un grupo separado y a materiales clonados; el modo Técnico restaura los originales. El constructor 3D, las cámaras y el cálculo de geometría/medidas se conservan.

Validación: **71 pruebas Node y 4 Python**, más carga real del JPEG, recuperación tras recarga, comparación y navegación al 3D. Detalles y límites en [reports/diseno-vinculado-08.md](reports/diseno-vinculado-08.md).

## Cambios v2.4 · Carga real desde cero

Se habilitó el reconocimiento local para imágenes nuevas en macOS. `npm start` inicia automáticamente el motor preparado y sirve `/api/health` y `/api/analyze` junto con la app. En este equipo ya están instalados el entorno y los pesos verificados. Para repetir la preparación: `sh setup-local.sh` y después `npm start`.

La mesa comienza vacía y se eliminó la carga lateral redundante. La calidad del análisis se indica expresamente. Se recuperan símbolos repetidos del propio archivo, se apartan fragmentos pequeños, se complementan divisiones respaldadas por líneas del plano y se aprovechan los recintos segmentados para sus acabados.

Los pasos 2 y 3 comparten materiales y muebles de presentación detallados; la geometría de construcción, la calibración y los controles del visor conservan su proceso. Se incorpora «Ampliar mesa» y render local hasta 2048 px. **El render local no equivale al CGI fotorrealista de referencia**; esa generación opcional requiere configurar OpenAI.

**62 pruebas JavaScript + 4 Python aprobadas.** Se verificó el JPEG adjunto desde una mesa vacía. Ver [diagnóstico, validación y límites](reports/carga-real-07.md).

## Cambios v2.3 · Ambientación del Paso 3

El visor incorpora **Ambientado / Técnico**. El acabado aplica colores aproximados del render del Paso 2, texturas de madera y textiles, cerámica y una iluminación de presentación al modelo ya construido. El mobiliario conserva su forma y ubicación; la estructura, las aberturas y la calibración siguen a cargo del motor existente.

La capa es reversible y funciona localmente con un render importado. Sin render compatible usa el estilo seleccionado del Paso 2. Incluye ajuste de correspondencia y plano de referencia. Los archivos del núcleo 3D permanecen sin cambios.

**55 pruebas aprobadas.** Ver [alcance, límites y validación](reports/ambientacion-3d-06.md).

## Cambios v2.2 · Recuperación del trabajo Argon

Se integraron mejoras de los pasos 1 y 2 desde `Beta_Render_Pro-main_Argon`, conservando el motor 3D actual:

- Limpieza de papel y nitidez opcional; vista original/preparada y capa vectorial conmutable.
- Zoom, desplazamiento y encuadre, con medición en las coordenadas del plano.
- Revisión explícita de la extracción antes de continuar al Paso 2.
- Estilos e instrucciones de acabado, vista de render/plano/cortina, importación de renders existentes y descarga PNG en su resolución nativa.
- Integración opcional con OpenAI para edición de imagen a partir del plano limpio. No se envían imágenes al abrir el Paso 2; la generación exige una acción explícita.

Para habilitar OpenAI, copiar `.env.example` a `.env`, configurar `OPENAI_API_KEY` y reiniciar el servidor. La clave permanece en el servidor. Sin clave funcionan la mesa, la extracción, el render técnico y la importación. La generación real con OpenAI no se probó porque no hay una clave configurada; se verificó su contrato mediante respuestas simuladas.

Ver [revisión y decisiones de integración](reports/integracion-argon-05.md). **46 pruebas aprobadas.**

## Cambios v2.1

- Botón **Nuevo proyecto** visible desde todas las etapas. Confirma antes de vaciar la sesión y restablece láminas, calibraciones, herramientas y resultados, conservando tema y ficha del desarrollador.
- La **mesa 2D completa** admite arrastrar múltiples archivos, con una indicación visual al soltar. La tarjeta lateral mantiene la misma función.
- Encuadre de la lámina completa según su proporción y el espacio real disponible. Se reajusta al cambiar de etapa o redimensionar la ventana, y **Encuadrar** aplica el mismo ajuste.
- Estado vacío con selección de planos y acceso opcional al ejemplo. Las herramientas requieren una lámina cargada.

## Flujo v2.1

1. **Mesa 2D:** carga múltiple PNG/JPG/WEBP/PDF/DXF, selección de página PDF, cuadrícula graduada, grises, inversión, grosor vectorial y extracción de contornos. Procesamiento local, hasta 20 MB por archivo.
2. **Render cenital:** CGI de la geometría disponible mediante una cámara y un renderer independientes; cortina comparativa alineada en coordenadas de imagen. Exportación SVG y PNG.
3. **Entorno 3D:** conserva la implementación original del visor. El adaptador añadido al final de `dist/app.js` permite compartir geometría, escala y textura; `dist/workflow.js` incorpora las herramientas como extensión.

Tema claro/oscuro persistente, ficha de desarrollador configurable en Ajustes y módulo Acerca de. Regla en metros/mm, calibración por dos puntos y cotas conmutables. Las medidas 3D se proyectan sobre el plano horizontal.

Las métricas automáticas corresponden a la **envolvente rectangular** de la estructura, no a la superficie útil. Para un área específica, usar **Delimitar superficie**. Sin calibración se utiliza un ancho supuesto de 24 m y se muestran medidas provisionales. La escala se vincula a la identidad de la lámina.

## Alcance de la entrega

- El render cenital es CGI con materiales y alturas de catálogo. La presentación fotorrealista se puede importar o generar mediante la integración opcional de OpenAI; requiere una clave de API propia y revisión visual. No sustituye la geometría técnica del plano.
- Los PDF se rasterizan localmente antes de extraer geometría; se puede seleccionar cualquier página.
- El importador DXF conserva trazos compatibles y avisa de entidades omitidas. Filtra capas con nombres de muros cuando existen. Los contornos cerrados pareados se interpretan como bandas de muro; los trazos aislados usan un espesor supuesto y requieren revisión. No es un intérprete BIM general.
- Los modelos Python y sus pesos no están incluidos. La IA de planos nuevos requiere preparar el servicio local; sin él se usa el detector geométrico. El ejemplo incluido conserva su predicción precalculada.
- Los archivos del proyecto se mantienen en la sesión. Tema, ficha del desarrollador y calibraciones se conservan en este navegador; no existe guardado completo de proyectos.

## Verificación

```sh
npm test
```

46 pruebas: las 27 originales más medición, conversión de coordenadas, contornos CAD, perímetros/superficies y validación de enlaces. Ver `tests/workflow.test.mjs`, `tests/workspace-ui.test.mjs` y `tests/argon-integration.test.mjs`. Las bibliotecas PDF.js y DXF Parser están fijadas en `package-lock.json` y sus licencias acompañan a los archivos de `dist/vendor`.

## Antecedentes del proyecto Blueprint Builder

La documentación siguiente conserva la procedencia, los ensayos y las limitaciones del proyecto original compartido. Sus referencias históricas a otro repositorio o a Windows no sustituyen las instrucciones de inicio de esta entrega.

---

# Blueprint Builder · Ensayo 04

Repositorio: [Paulsaac/Blueprint_builder](https://github.com/Paulsaac/Blueprint_builder).

**[Abrir el modelador en GitHub Pages](https://paulsaac.github.io/Blueprint_builder/)**.

**Para continuar el trabajo con otro agente, leer primero [HANDOFF.md](HANDOFF.md)**: objetivos, progreso, arquitectura, experimentos, métricas, límites y próximos pasos. Las [capturas del progreso](docs/images/) incluyen el prototipo inicial y el ensayo actual.

Al clonar este repositorio, los comandos se ejecutan en su raíz (`Blueprint_builder`). La subcarpeta `app` mencionada en la ruta de la máquina original corresponde a esta misma raíz, no a un directorio adicional dentro del clon.

Detección por categorías, comparación con anotaciones manuales y levantamiento 3D sobre `plano.jpeg`. El visor conserva Three.js y añade dos motores de reconocimiento ejecutados localmente en CPU.

## Auditoría de puertas y ventanas

El **Ensayo 04** revisa las 15 propuestas que no tenían asociación de muro. Eran aberturas reales: nueve puertas y seis ventanas. La asociación depurada incorpora encuentros perpendiculares y apoyos cortos, agrupa fragmentos de la misma clase y excluye dos fragmentos conflictivos. La predicción de IA permanece intacta.

En el ejemplo activo, las propuestas sin soporte pasan de **15 a 0**, y los cuerpos de abertura de **21 a 31**. **Las seis ventanas revisadas todavía necesitan ajustes de extensión o alineación**. Una ventana vertical de cocina sigue dividida en dos cuerpos por la máscara; por eso 31 cuerpos no equivalen a 31 aberturas correctas. Se añadieron a la referencia dos puertas omitidas, con revisión visual del agente y sin validación independiente.

Usar **Asociación de aberturas → Anterior / Depurada** para comparar en 3D. En **Evaluación → Cada caso, sobre el plano** se puede abrir cada propuesta ampliada en 2D y descargar la auditoría. Ver [el registro completo, métricas y limitaciones](reports/aberturas-04.md).

```powershell
.\.venv\Scripts\python.exe backend/opening_reference_review.py
node backend/build_opening_audit.mjs
npm test
```

## Reconstrucción depurada

El **Ensayo 03** añade limpieza conservadora de muros, aberturas vinculadas con vanos reales, orientación de mobiliario según paredes próximas y una presentación más limpia. En **Geometría 3D** se puede alternar con la detección original; en **Detección 2D → Muros · antes y después** se comparan los contornos sobre la imagen.

La escala medida con dos puntos se conserva en este navegador para el mismo archivo, identificado por hash. La imagen de ejemplo se calibró manualmente en la prueba local con la cota superior visible de **20,96 m**; esa medición no se incorpora como una regla para otros planos. Las alturas siguen siendo supuestos de catálogo.

El ejemplo activo usa **1280 × 749 píxeles**, con una inferencia ligada al hash de ese archivo. Sus contornos pasan de **3.146 a 1.110 vértices**. La referencia manual se trasladó mediante alineación entre resoluciones y recibió una revisión visual parcial en el Ensayo 04; requiere revisión independiente. Ver [el informe de reconstrucción](reports/reconstruccion-03.md).

El ensayo anterior de 724 × 424 se conserva en `dist/data/archive/724x424`, junto a su imagen en `dist/assets/archive`. Sus métricas y sus pruebas son históricas. Aumentar la resolución cambió los resultados de ambos motores; la precisión y cobertura de objetos no mejoraron en esta ejecución, por lo que hay que revisar la referencia transferida y ajustar el detector sobre más datos.

```powershell
npm test
node backend/build_reconstruction_report.mjs
```

Los resultados de reconstrucción se exportan por separado en JSON versión 3, junto a la medición de escala y los supuestos. Para actualizar GitHub Pages con estos cambios hay que publicar el commit correspondiente en `main`.

Para preparar una nueva resolución del mismo plano, `backend/prepare_sample.py` comprueba correspondencias con la imagen histórica antes de trasladar anotaciones, genera píxeles de prueba y actualiza `dist/sample.js` con URLs que incluyen la huella del archivo. La inferencia se ejecuta por separado y nunca lee esas anotaciones. `backend/create_reference.py` solo regenera la referencia histórica, evitando asignar las coordenadas antiguas al hash de una imagen nueva.

## Probar

La versión estática publicada incluye **el resultado precalculado de una ejecución real sobre el archivo plano.jpeg**. Se verifica la huella SHA-256 del archivo; renombrar otra imagen como plano.jpeg no reutiliza ese resultado. Las anotaciones manuales se cargan únicamente para el archivo correspondiente y permanecen separadas de la inferencia.

- **Levantamiento 3D**: componentes de catálogo con alturas y orientación aproximadas.
- **Detección 2D**: categorías, referencia manual o aciertos/omisiones/sobrantes. Se puede filtrar por categoría.
- **Evaluación**: comparación de cinco clases, IoU de muros y exportación del informe y las anotaciones.
- **Fuente del levantamiento**: predicción IA, referencia manual claramente identificada o detector geométrico anterior. La referencia nunca rellena silenciosamente los errores del modelo.

### IA local para imágenes nuevas

En este equipo el entorno y los pesos ya se instalaron. Ejecutar **start-local.cmd** y abrir http://127.0.0.1:4173. También se puede ejecutar:

```powershell
cd Blueprint_builder
npm run start:ai
```

El servicio Python sirve la interfaz y `/api/analyze` en el mismo origen. Las imágenes se procesan en este equipo, sin enviarlas a un proveedor de inferencia. Pulsar **Generar levantamiento** vuelve a ejecutar los modelos y lo indica en la interfaz. Las imágenes nuevas se analizan al cargarlas cuando el motor local está disponible.

Para preparar otro equipo Windows con Python 3.12 y Node.js 20 o superior:

```powershell
.\setup-local.ps1
.\start-local.cmd
```

El instalador usa un entorno `.venv` aislado, PyTorch CPU y pesos públicos cuyo SHA-256 se comprueba contra `backend/model-manifest.json`. Los modelos pesan aproximadamente 215 MB en total, además del entorno Python. El código de inferencia no usa carga de pickle sin restricciones: CubiCasa utiliza `weights_only=True`; el checkpoint YOLO se carga con una lista restringida de clases de módulos neuronales. Se comprueban los hashes también al iniciar el motor.

### Vista estática

```powershell
npm start
```

La vista estática permite revisar el ensayo incluido sin instalar Python. GitHub Pages no ejecuta el backend Python: **para archivos nuevos, la IA requiere el servicio local**. Si falta ese servicio, las imágenes nuevas usan el detector geométrico y la interfaz lo indica. No se reutilizan predicciones de otro archivo ni se simula un análisis de IA.

### Publicar en GitHub Pages

En **Settings → Pages → Build and deployment**, mantener **Deploy from a branch**, rama **main** y carpeta **/ (root)**. Cada push a esa rama actualiza la publicación.

El `index.html` de la raíz abre `./dist/`, donde vive la aplicación completa. `.nojekyll` permite servir los archivos estáticos directamente. Las rutas del visor, los módulos de Three.js, el worker y los datos son relativas, por lo que funcionan bajo `/Blueprint_builder/dist/` sin un proceso de compilación.

Si aparece documentación en lugar del visor, comprobar que el despliegue de Pages terminó para el último commit y recargar la página. También se puede abrir [el builder directamente](https://paulsaac.github.io/Blueprint_builder/dist/). La publicación anterior de Sites fue eliminada a petición del usuario; el hosting actual es GitHub Pages.

## Qué se implementó

1. Segmentación estructural CubiCasa5K hourglass: muros, puertas, ventanas y algunos elementos de equipamiento.
2. YOLOv8 especializado en símbolos: camas, sofás, mesas, sillas y otros objetos. Los pesos se obtienen del proyecto REIkd/FYP-Floorplan.
3. Fusión determinista: aberturas y equipamiento se toman de la segmentación; mobiliario de YOLO. Se suprimen propuestas YOLO que se superponen a equipamiento segmentado con suficiente puntuación. Los resultados originales del detector se conservan en el JSON, junto con la procedencia de cada objeto.
4. Extracción de contornos con huecos y extrusión de muros. Las aberturas se representan con puertas y paneles de ventana de catálogo. Son propuestas, no geometría constructiva validada.
5. Una referencia manual inicial: 43 tramos de muro y 76 componentes. Sus cinco clases evaluadas son puertas, ventanas, camas, sofás y mesas. Sillas y equipamiento tienen anotaciones auxiliares y se excluyen de las métricas iniciales.
6. Comparación por clase mediante emparejamiento uno a uno con IoU de caja ≥ 0,50. Para puertas/ventanas se anota la huella de la abertura, excluyendo el arco de giro; para muebles, la huella del símbolo. Los muros se comparan por IoU de unión de máscaras. Los objetos duplicados cuentan como sobrantes.
7. Hash del archivo, versión del esquema, parámetros, pesos, puntuaciones, datos originales y supuestos en las exportaciones. Los porcentajes de puntuación del detector no son probabilidades calibradas.

## Resultado y límites

Ver [reports/plano-evaluacion.md](reports/plano-evaluacion.md) para los números reproducibles. El primer segmentador probado (ResNet34-UNet de Yytsi) no recuperó muros; el seleccionado es CubiCasa5K. El informe conserva ese resultado negativo.

La referencia es una anotación visual inicial, pendiente de revisión independiente. No es un conjunto de prueba independiente ni una garantía de desempeño sobre otros estilos de plano. Hay errores entre muebles y sanitarios, omisiones, fragmentación de aberturas y espesores irregulares. No se afirma que la IA mejore la coincidencia de área de los muros frente al detector anterior; ambas medidas se muestran.

La escala inicial supone 24 m para el ancho completo de la imagen. Calibrar con dos puntos y una distancia conocida; la cota superior del ejemplo indica 20,96 m. Altura de muro, altura de puertas, antepechos y mobiliario son parámetros de catálogo. No se recuperan medidas reales ausentes ni acabados. La orientación se aproxima con la caja del objeto.

JPEG, PNG y WEBP hasta 20 MB y 25 millones de píxeles en el motor Python; el lado mayor de análisis se limita a 1.400 px. Las coordenadas de la predicción pertenecen a esa imagen de análisis. Los JSON conservan dimensiones originales. El visor requiere WebGL 2. No hay guardado persistente de proyectos.

## Reproducir y verificar

```powershell
npm test
.\.venv\Scripts\python.exe backend/inference.py --image dist/assets/plano.jpeg --output dist/data/plano-prediction.json
node backend/build_report.mjs
```

`backend/create_reference.py` contiene únicamente las anotaciones manuales; no es parte del motor de predicción. `backend/inference.py` no lo importa ni lee la referencia. La aplicación identifica la referencia por hash y rechaza la comparación con otro archivo. El fixture de píxeles comprimido usado por las pruebas viene de la imagen original sin cambios.

Las pruebas verifican geometría, emparejamiento sin duplicados, conservación de huecos, identidad del archivo y separación entre anotación y predicción. El servicio rechaza orígenes ajenos, tipos de archivo no admitidos y cargas excesivas; se enlaza únicamente a `127.0.0.1`. La API local se comprobó con inferencia real y rechazo de origen externo.

## Procedencia y licencias

- Three.js 0.180.0 y OrbitControls: MIT, licencia incluida en `dist/vendor`.
- CubiCasa5K: https://github.com/CubiCasa/CubiCasa5k. Arquitectura adaptada en `backend/cubicasa_model.py`, con atribución y licencia CC BY-NC 4.0 en `backend/licenses`. Se retiró la inicialización de pesos de pose humana que no se usa en inferencia.
- Detector de símbolos: https://github.com/REIkd/FYP-Floorplan. El repositorio ofrece el checkpoint público, pero no se encontró una licencia explícita de esos pesos. No se redistribuyen en el sitio publicado; el script local los obtiene de su fuente.
- La publicación contiene resultados de investigación sobre la imagen y no los pesos ni el entorno Python. Antes de convertir esta prueba en un servicio comercial, deben resolverse los permisos de los modelos y datos utilizados.

## Archivos principales

- `dist/app.js`: carga, selección de fuente, calibración, visor y revisión.
- `dist/components.js`: catálogo 3D paramétrico.
- `dist/evaluation.js`: comparación por clase y rasterización de muros.
- `dist/data/`: referencia manual, predicción real, informe y registro de experimentos.
- `dist/detector.js`, `worker.js`: detector geométrico anterior.
- `backend/inference.py`, `server.py`: modelos y API CPU local.
- `backend/model-manifest.json`: origen y hashes de pesos.
- `backend/build_report.mjs`: informe reproducible del ensayo.
- `reports/plano-evaluacion.md`: resultados y limitaciones.
- Configuración de hosting: conservada localmente fuera de la copia pública del repositorio.
