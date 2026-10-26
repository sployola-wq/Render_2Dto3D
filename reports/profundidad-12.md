# Profundidad y materiales · v2.9

## Arquitectura

La nueva ruta `exteriorMode:spatial` reemplaza la fachada fotográfica de una extrusión por elementos separados: muros con huecos y espesor, marcos, alféizares, montantes, vidrio rehundido y un espacio interior sugerido. La propuesta no proyecta una fotografía sobre sus fachadas.

Se agrupan las celdas del dibujo en ventanas: puerta de cuatro paños, puerta de dos paños y ventanas superiores con montantes/travesaños. La anchura superior se orienta por la silueta; profundidad y plantas son parámetros explícitos. Aleros y revestimientos tienen geometría y cantos suavizados.

Por petición expresa se diseña lo no observado: huecos laterales/posteriores alineados, terraza con pérgola apoyada en postes/vigas y balcón con acceso y barandas de retorno. Las jardineras son ambientación propuesta. No son una recuperación exacta del edificio real. El JSON incluye el diseño y sus unidades en metros. Alzado técnico conserva la extrusión anterior.

## Materiales y presentación

Se retiró la imagen del dibujo de las caras de corte. El metal mecanizado y el acabado de fundición usan el atlas como variación de rugosidad; no imprimen sus trazos. Se mantiene la geometría interior y se parametriza por longitud recorrida para evitar comprimir el grano según el número de vértices.

`material-atlas-v29.png` y `daylight-environment-v29.png` se generaron con `image_gen` integrado de OpenAI, se verificaron visualmente y se guardaron con prompts, tamaños y SHA en `provenance-v29.json`. El panorama es LDR para reflejos, no una medición HDR. Los recursos incluidos no requieren llamadas API al navegar.

Render 3D realista del Paso 2 usa la malla del Paso 3 con cámara en perspectiva y sombras. La proyección frontal sigue disponible para el comparador. La exportación PNG usa la vista elegida. Las cámaras trasera/lateral y el ajuste por esquinas permiten revisar toda la profundidad. El visor especializado solo redibuja cuando cambia cámara, parámetros, medición o tamaño.

## Verificación

113 pruebas Node y 4 Python: agrupaciones de ventanas del JPEG, hueco frontal verificable por raycast, marcos/espacio interior, propuesta posterior con acceso, modo técnico conservado, parámetros inválidos, metal sin textura del plano, material sin alteración geométrica y encuadre en varias relaciones de aspecto.

Regresión real: JPEG interior procesado desde cero, 53 propuestas y 34 aberturas; referencia 2752×1536, 8 pisos texturados y 53 muebles en 3D. Los seis archivos del núcleo residencial siguen idénticos. La fachada y el corte se verifican en navegador antes de la publicación solicitada.
