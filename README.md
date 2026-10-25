# Prodalam Render Pro v2.0

Aplicación local de preparación de planos y reconstrucción 3D. Repositorio de esta entrega: [sployola-wq/Render_2Dto3D](https://github.com/sployola-wq/Render_2Dto3D).

```sh
npm start
```

Abrir **http://127.0.0.1:4173**. Los recursos del navegador se incluyen en `dist/vendor`; la vista estática no requiere instalar dependencias para iniciar. Node.js 20 o superior.

## Flujo v2.0

1. **Mesa 2D:** carga múltiple PNG/JPG/WEBP/PDF/DXF, selección de página PDF, cuadrícula graduada, grises, inversión, grosor vectorial y extracción de contornos. Procesamiento local, hasta 20 MB por archivo.
2. **Render cenital:** CGI de la geometría disponible mediante una cámara y un renderer independientes; cortina comparativa alineada en coordenadas de imagen. Exportación SVG y PNG.
3. **Entorno 3D:** conserva la implementación original del visor. El adaptador añadido al final de `dist/app.js` permite compartir geometría, escala y textura; `dist/workflow.js` incorpora las herramientas como extensión.

Tema claro/oscuro persistente, ficha de desarrollador configurable en Ajustes y módulo Acerca de. Regla en metros/mm, calibración por dos puntos y cotas conmutables. Las medidas 3D se proyectan sobre el plano horizontal.

Las métricas automáticas corresponden a la **envolvente rectangular** de la estructura, no a la superficie útil. Para un área específica, usar **Delimitar superficie**. Sin calibración se utiliza un ancho supuesto de 24 m y se muestran medidas provisionales. La escala se vincula a la identidad de la lámina.

## Alcance de la entrega

- El render cenital es CGI con materiales y alturas de catálogo. **No se ha implementado un motor de render fotorrealista ni generación de acabados por IA.**
- Los PDF se rasterizan localmente antes de extraer geometría; se puede seleccionar cualquier página.
- El importador DXF conserva trazos compatibles y avisa de entidades omitidas. Filtra capas con nombres de muros cuando existen. Los contornos cerrados pareados se interpretan como bandas de muro; los trazos aislados usan un espesor supuesto y requieren revisión. No es un intérprete BIM general.
- Los modelos Python y sus pesos no están incluidos. La IA de planos nuevos requiere preparar el servicio local; sin él se usa el detector geométrico. El ejemplo incluido conserva su predicción precalculada.
- Los archivos del proyecto se mantienen en la sesión. Tema, ficha del desarrollador y calibraciones se conservan en este navegador; no existe guardado completo de proyectos.

## Verificación

```sh
npm test
```

35 pruebas: las 27 originales más medición, conversión de coordenadas, contornos CAD, perímetros/superficies y validación de enlaces. Ver `tests/workflow.test.mjs`. Las bibliotecas PDF.js y DXF Parser están fijadas en `package-lock.json` y sus licencias acompañan a los archivos de `dist/vendor`.

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
