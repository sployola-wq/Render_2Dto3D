# Exteriores e ingeniería · v2.6

## Problema y alcance

El motor anterior aplicaba un reconocimiento de plantas residenciales a fachadas y cortes mecánicos; sus predicciones se convertían en muros y muebles. La v2.6 conserva ese flujo para interiores y añade rutas independientes elegidas mediante «Tipo de proyecto». Las sugerencias de disciplina son orientativas y requieren selección del usuario.

## Implementación

`discipline-analysis.js` obtiene siluetas y regiones mediante umbral, cierre, relleno de recintos y separación de componentes; las líneas auxiliares finas se eliminan de la envolvente principal. La detección de barras admite ejes inclinados. Los perfiles CAD conservan huecos e islas anidadas; la validación rechaza cruces, huecos exteriores y solapados. El usuario puede delimitar una región o trazar perfiles y ejes.

`discipline-models.js` construye extrusiones, envolventes de revolución y medias secciones explícitas, o barras I/tubulares. La orientación de secciones conserva el ancho de ala normal al plano del pórtico. El modelo físico excluye la lámina cosmética de fachada al medir su extensión o exportar STL. La escala calibrada prevalece; DXF permite unidades declaradas y selección de capa. Sin calibración ni unidades, la longitud y profundidad son parámetros provisionales visibles.

`discipline-viewer.js` tiene cámara, controles, materiales, medición por intersección con superficies, sección visual, captura y exportación propios. No modifica el visor de interiores. El corte visual no altera la geometría completa exportada. `discipline-controller.js` coordina edición y guardado por archivo/disciplina y conserva el último modelo válido si un parámetro es rechazado.

El render 2D conserva la proyección de la lámina: un alzado no se convierte en planta cenital. La fachada admite materiales por paño. Los prompts opcionales de imágenes se adaptan a la disciplina. No se realizó una nueva generación por API.

## Evidencia

- 88 pruebas Node y 4 Python aprobadas, incluidos datos raster de los dos ejemplos reales, huecos abiertos, escala, revolución, varias medias secciones, barras inclinadas, sección de pórtico, namespaces de referencias y prompts por disciplina.
- Fachada real: silueta completa de dos niveles; 23 paños claros candidatos, editables, sin muebles residenciales. La profundidad es especificada, no deducida.
- Corte mecánico real: envolvente simétrica y modelo de revolución navegable. El diámetro interior constante se especifica; los componentes/cavidades no se infieren automáticamente.
- DXF sintético con unidades mm: 7 barras en ESTRUCTURA; la línea de COTAS queda fuera al seleccionar capa.
- Regresión con el JPEG interior original: reconocimiento local, diseño aprobado recuperado, 28 aberturas con soporte, 53 muebles ambientados y 8 pisos con textura. Núcleo 3D y módulos de apariencia de interiores idénticos a v2.5.

## Límites

No hay interpretación universal ni reconstrucción inequívoca de caras ocultas a partir de una sola imagen. Los contornos y paños son propuestas para revisar. Una envolvente exterior no equivale a reconocer todas las piezas internas de un mecanismo. No se hacen cálculos de resistencia ni comprobaciones de fabricación; STL es una exportación de mallas de estudio, con unidades mm. La versión permanece local hasta una solicitud de publicación.
