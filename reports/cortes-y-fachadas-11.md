# Corte y acabados de fachada · v2.8

## Cambio de interpretación mecánica

La envolvente cerrada de v2.7 ocultaba los interiores presentes en el dibujo. El nuevo análisis conserva grandes regiones blancas cerradas y llena las pequeñas celdas del rayado para proponer regiones materiales. Excluye anotaciones mediante la máscara reconocida. Elementos circulares pequeños emparejados a ambos lados del eje se conservan como detalles observados; no se inventa la distribución completa de un rodamiento.

Cada región produce una media revolución posterior con superficies interiores y caras planas de sección. Los huecos de los perfiles se barren como límites internos. Sobre las caras materiales se recuperan los trazos y rayados originales. El vacío central del ejemplo tiene geometría: un rayo desde el frente atraviesa la abertura antes de tocar la pared posterior. El núcleo puede reinterpretarse expresamente como eje sin seccionar. Los perfiles manuales deben ser medias secciones a un lado del eje. Se conserva la alternativa de envolvente cerrada.

La comparación y el 3D usan la misma malla. SVG exporta ambas mitades de los perfiles y los elementos circulares; JSON conserva perfiles, vacío/eje y procedencia; STL exporta el modelo de corte en mm. Las regiones propuestas no equivalen a identificar de forma certificada las 16 llamadas del ensamblaje. Un corte aislado tampoco determina toda geometría no axisimétrica.

## Fachada enriquecida con IA

Se editó el JPEG real de fachada con la herramienta integrada `image_gen` de OpenAI, conservando cámara, encuadre, volúmenes principales y aberturas. La propuesta aporta revestimiento mineral claro, madera natural, perfilería oscura, vidrio y luz cálida bajo las marquesinas existentes. Asset nativo de 1662×946 y prompt/procedencia se guardan en `dist/assets/presentation/facade-ai-v28.*`.

La asociación usa el SHA original 81331e9731e53cb39c46ec13616d3e519998f829a38610496a8332ced6a3641d y disciplina exterior. No hay asociación por nombre de archivo ni reutilización para otros dibujos. El render queda identificado como generado por IA y geometría sin validar. IndexedDB permite recuperarlo en la misma lámina. El modelo usa su fachada, paleta, muestra de revestimiento para relieve y reflejos en paños de vidrio; esos acabados cosméticos no modifican la exportación geométrica ni las medidas físicas.

Las capas visuales usan offsets pequeños y una cámara con mayor precisión de profundidad; se eliminó la interferencia entre el frente y los vidrios. La fase 2 prioriza presentación y herramientas IA sobre parámetros de geometría. Los supuestos se pueden desplegar sin ocupar permanentemente el visor.

Para otras fachadas se necesita su propia imagen generada/importada. El proveedor por API conserva su ruta general y prompts específicos, incluyendo la petición de corte en mecánica; no está autenticado en este equipo. La imagen de esta entrega se generó en Codex. El ejemplo no demuestra un servicio autónomo sin clave. La especificación del proveedor se contrastó con su [referencia oficial de edición de imágenes](https://developers.openai.com/api/reference/resources/images/methods/edit).

## Verificación

104 pruebas Node y 4 Python aprobadas: cavidad real, elementos observados, raycast al interior, reversibilidad corte/envolvente, convención del núcleo, STL, vectores de sección, identidad de la referencia IA y extracción de color. Se probó la carga ordinaria de los dos JPEG del usuario y la recuperación de la fachada tras recarga.

Regresión con el JPEG interior real: 53 propuestas de equipamiento, 34 de aberturas, diseño aprobado 2752×1536, 8 pisos texturados y 53 muebles en el 3D. `app.js`, `architecture.js`, `components.js`, `detector.js`, `appearance-3d.js` y `appearance-mapping.js` siguen idénticos a v2.5. No se hizo commit/push.
