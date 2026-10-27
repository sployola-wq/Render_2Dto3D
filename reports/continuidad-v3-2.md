# Continuidad, lámina completa y materiales · v3.2

## Problemas reproducidos

La ilustración isométrica de la construcción contenía marcas repetidas que el detector aceptaba como vistas ortográficas de una pieza. En la lámina real, esa supuesta pareja representaba aproximadamente el 3,1 % de los trazos neutros y solo el 12 % de su extensión; en la pieza curva la pareja representa aproximadamente el 65 % de los trazos. La clasificación ahora requiere apoyo global antes de activar el flujo mecánico.

La fachada diferente del Paso 2 procedía del constructor de una propuesta volumétrica. No era suficiente verificar la clave de caché: se estaba comparando una nueva propuesta con la perspectiva original como si fueran equivalentes. El modo inicial conserva ahora la proyección de la lámina. Las propuestas volumétricas quedan como una elección conceptual explícita.

En la pieza curva, el render frontal solo mostraba la sección elegida. El nuevo compositor conserva toda la lámina y superpone únicamente superficies en sus posiciones originales. La vista complementaria se obtiene con otra cámara del mismo modelo, manteniendo el marco completo. Al final se aplica el trazado original, incluidas cotas, llamadas, rayados y vistas sin reconstrucción compatible.

## Cambios de continuidad

- La reutilización de geometría exige identidad y dimensiones de origen coincidentes.
- Las imágenes asíncronas se asocian con identidad, selección, revisión, disciplina, marco y huella procesada. Una respuesta anterior no se aplica a un contexto nuevo.
- Al cargar otro archivo se vacían los renders y las métricas anteriores; durante la lectura no se muestra una clasificación provisional como resultado confirmado.
- Se retiró la restauración automática de ilustraciones empaquetadas. Los renders guardados compatibles se ofrecen como opción y no sustituyen automáticamente la lámina técnica.
- Las importaciones explícitas anteriores del mismo archivo se conservan como opción; los generados antiguos sin la nueva revisión no se reinstalan. No se borraron imágenes de disco.

## Materiales y proyección

Hay propuestas de acero, aluminio, latón/bronce, polímero técnico, hormigón y madera. Un plano monocromo no permite confirmar por sí solo el material; la interfaz pide confirmarlo. Los materiales explícitos también actualizan la respuesta de iluminación y reflexión del modelo 3D.

En perfiles finos compatibles, las normales de iluminación se derivan de una línea central suavizada para que las variaciones del escaneo no parezcan nervaduras reales. Esta operación no modifica posiciones, agujeros ni caras de la malla. El suavizado geométrico opcional de v3.1 sigue siendo independiente y puede desactivarse.

La lámina arquitectónica usa superficies delimitadas por sus propios trazos, manteniendo ventanas, cubierta, escaleras y perspectiva. El relieve del Paso 3 conserva esa proyección; no equivale a reconstruir un edificio completo desde una sola ilustración.

## Generación fotorrealista por IA

El render local conserva el dibujo y usa sombreado/materiales. La generación de una imagen fotorrealista nueva es otra función: necesita credenciales del servidor. El estado local consultado durante esta revisión fue `ready: false`; no se ejecutó una generación externa ni se sustituyó ese resultado por un ejemplo.

Se reforzaron las instrucciones para mantener todas las vistas, anotaciones y la perspectiva existente, respetar el material seleccionado y no sustituir el edificio por una fachada genérica. La conexión existente usa el endpoint de edición y el modelo predeterminado admitidos por la [documentación oficial de OpenAI](https://developers.openai.com/api/reference/resources/images/methods/edit). Se verificaron las solicitudes con proveedor simulado; falta una prueba externa con credenciales para confirmar disponibilidad de cuenta y calidad generativa real. Las cotas de una imagen generativa deben revisarse contra el original.

## Verificación

`npm run build` comprueba la entrega estática y la versión visible. `npm test` pasa 160 pruebas. Las nuevas verificaciones cubren conservación de trazos y anotaciones, materialización de vistas completas, cambios de material y paños, marcas repetidas de una construcción, aislamiento de contextos, restauración de presentaciones y coordenadas de ambas orientaciones de la vista complementaria. También comprueban que el suavizado de iluminación no modifica vértices ni normales de las tapas.

Se probaron en el navegador las láminas reales de construcción y de pieza curva, además de las regresiones anteriores. Los archivos privados de entrada y las capturas de esta revisión no se añadieron al repositorio.
