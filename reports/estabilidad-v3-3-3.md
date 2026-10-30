# v3.3.3 · Órbita y clasificación de láminas

## Problemas reproducidos

La lámina `maxresdefault.jpg` visible en el preview se exportó mediante «Plano limpio» antes de recargar. Su marco de 1280 × 720 se conserva en `tests/fixtures/perspective-house.rgba.z`; no se consulta su nombre ni su identidad para clasificarla. El clasificador v3.3.2 sugería Interior. Al elegir Exterior, producía 101 caras: la vista inicial mantenía la imagen, pero al girar aparecían superficies torcidas y separadas. Captura: [antes](../docs/images/v333/before-perspective.png).

El defecto geométrico era anterior al giro: las pruebas solo comprobaban proyección y UV. El ajuste de profundidad usaba fronteras entre píxeles y después promediaba alturas de vértices; ese promedio podía doblar planos enteros. La geometría de una imagen en perspectiva tampoco cumple necesariamente los ejes paralelos supuestos por ese ajuste.

La clasificación dependía de densidad y simetría de la envolvente. Los márgenes negros, el sombreado del papel y un plano interior con trazos escasos distorsionaban esas señales. Si fallaba la extracción, se continuaba con Interior por defecto.

## Cambios

- Las fronteras comunes y sus uniones en T participan en la resolución de planos. Antes del visor y del modelo exportable se verifican coordenadas finitas, proyección, planitud y amplificación de bordes.
- Una reconstrucción que no supera las verificaciones se sustituye por un relieve cerrado de sus propias superficies y siluetas. Conserva coordenadas, imagen, materiales y escala; el espesor provisional es editable y no reutiliza los 6 m de profundidad del edificio. Se declara como `representation: relief` y conserva el motivo de rechazo en el JSON.
- Los casos axonométricos coherentes conservan su reconstrucción espacial. El modo conceptual anterior continúa como opción explícita.
- Para clasificar se normaliza el contraste de una copia reducida, se excluyen bandas negras y se buscan trazos verticales y familias de aristas en perspectiva. No se modifica la imagen utilizada para extraer geometría.
- La simetría y la baja densidad dejan de autorizar por sí solas un motor. Las sugerencias dudosas muestran «Por confirmar»; la lámina desconocida queda bloqueada hasta seleccionar una disciplina. La selección manual sigue disponible y queda vinculada al archivo.
- Las vistas mecánicas complementarias deben estar separadas y compartir extremos alineados antes de proponer una profundidad de extrusión.

## Validación

**188 pruebas Node aprobadas**, entrega estática verificada (47 módulos) y `git diff --check` sin errores. La suite Node cubre interiores, aberturas, materiales, comparación, cortes y conjuntos mecánicos, extrusiones con taladros, estructuras, identidad de proyectos, calibración y modos exteriores. Las nuevas regresiones cubren la casa reportada, cambios de escala y tono de papel, el plano interior real, entradas desconocidas, simetría ambigua, vistas mecánicas desalineadas, rechazo de un plano retorcido y preservación de un caso axonométrico coherente.

En el navegador se cargó la misma lámina mediante el selector real, se comprobó la sugerencia Exterior con el procesamiento bloqueado hasta confirmarla, se procesó y se revisaron Perspectiva, arrastre orbital, Trasera y Lateral. La consola no presentó errores. El JSON descargado conserva la v3.3.3, la identidad, la representación de relieve y el diagnóstico de rechazo; se comprobaron coordenadas y STL finitos mediante las pruebas.

Capturas: [clasificación](../docs/images/v333/classification.png), [perspectiva corregida](../docs/images/v333/after-perspective.png), [órbita](../docs/images/v333/after-orbit.png), [trasera](../docs/images/v333/after-back.png).

## Límites pendientes

**Esta casa todavía no se reconstruye como edificio completo.** La salida estable es un relieve de la lámina; las ventanas y acabados pertenecen a su textura. Las caras ocultas y la profundidad real requieren vistas o perfiles adicionales y un proceso de reconstrucción adecuado. La corrección evita presentar caras corruptas como un volumen válido, pero no convierte una perspectiva única en CAD completo.

El clasificador sigue siendo geométrico y revisable. Las comprobaciones sobre estas imágenes y variantes no constituyen una medición de precisión sobre un conjunto independiente de planos. Una evaluación general necesita más casos representativos reservados para validación.

Entrega local para revisión en preview. No se ha publicado en GitHub Pages.
