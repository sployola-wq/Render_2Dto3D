# v3.3.4 · Geometría de edificio desde la lámina

El problema reportado era reproducible: el modo registrado v3.3.3 sustituía un ajuste de profundidad fallido por caras coplanares texturadas y un respaldo de 300 mm. Eso evitaba vértices corruptos, pero mantenía una imagen sobre una tabla.

## Resultado

El modo inicial es ahora `volume`. `source-volume.js` construye geometría independiente de la imagen: muros de 180 mm con huecos reales, vidrios rehundidos y marcos separados, cubiertas, pisos y caras posteriores. No crea `CanvasTexture`, mallas con la fotografía ni respaldos de la lámina. El relieve permanece como una elección técnica explícita; no es la salida automática ante un ajuste fallido.

Para la casa del reporte se estiman dos puntos de fuga desde los contornos, se agrupan fachadas por dirección y nivel y se proponen masas a partir de las aristas verticales comunes. El resultado contiene dos masas superiores y una base, con geometría de ventanas independiente. Los laterales y la parte posterior tienen volumen durante la órbita. Para un alzado frontal se utiliza la envolvente de su propio contorno y la profundidad del edificio. Los perfiles manuales/CAD conservan concavidades y huecos de la pared frontal.

Las preferencias v4 del modo registrado migran a volumen. Conservan los valores guardados de ancho, profundidad, material, paleta y espesor técnico. Las elecciones explícitas de relieve o diseño conceptual de v4 permanecen disponibles.

## Comprobaciones

**197 pruebas Node aprobadas**, entrega estática verificada (48 módulos) y diff sin errores. La suite Node comprueba regresiones de interiores, mecánica, estructuras, identidad del archivo y calibración. Las nuevas pruebas verifican:

- La casa reportada produce masas, muros, cubierta y profundidad de varios metros aunque el ajuste anterior haya rechazado la imagen.
- Una imagen del Paso 2 suministrada al constructor no puede convertirse en textura de fachada.
- Los rayos pasan a través de los huecos de las propias paredes y alcanzan vidrios independientes.
- El alzado posee retornos de profundidad completa y una pared posterior.
- Cambiar la profundidad modifica los cuerpos; cambiar materiales conserva sus vértices y dimensiones.
- El ancho calibrado prevalece sobre el ancho provisional.
- Los perfiles manuales conservan concavidades y huecos; dos fuentes diferentes producen envolventes diferentes.

Se revisan en navegador la misma casa, el arrastre orbital, Perspectiva, Lateral, Trasera y Superior. JSON y STL se descargan desde los controles reales. Los metadatos `sourceVolume` incluyen el origen, las masas, los puntos de fuga, la rotación del modelo y `photoProjection: false`.

## Límites

Es una **reconstrucción geométrica aproximada y revisable**. La profundidad y los lados ocultos se proponen; algunas aberturas y proporciones visibles requieren ajustes. No se afirma correspondencia exacta con un levantamiento del edificio ni validez de fabricación. La clasificación conserva las confirmaciones de las entradas ambiguas añadidas en v3.3.3. La imagen original y su presentación 2D permanecen separadas del modelo volumétrico.

Capturas: [perspectiva](../docs/images/v334/perspective.png), [lateral](../docs/images/v334/side.png), [trasera](../docs/images/v334/back.png), [superior](../docs/images/v334/top.png) y [giro libre](../docs/images/v334/orbit.png).

La descarga real del navegador produjo un STL de 532 triángulos con coordenadas finitas y dimensiones aproximadas de 12.120 × 6.188,2 × 6.120 mm. La consola del preview no presentó errores.

Revisión local, sin publicar en GitHub Pages.
