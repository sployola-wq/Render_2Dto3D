# Correspondencia entre el Paso 2 y el Paso 3 · v3.3.2

## Causa

El Paso 2 materializaba los contornos del archivo original, mientras el Paso 3 utilizaba un generador conceptual. Compartían la paleta y algunos indicios de cubierta, pero el generador redistribuía huecos y completaba accesos, terrazas y vegetación. Por tanto, cambiar de etapa podía mostrar otro edificio aunque no se hubiera cambiado de archivo.

## Corrección

El nuevo modo `registered` reconstruye las regiones visibles del archivo y les asigna las coordenadas de textura de la misma superficie procesada del Paso 2. Cada vértice se sitúa sobre su rayo de proyección original: la estimación de profundidad puede cambiar su posición tridimensional, pero su posición en la cámara de referencia permanece vinculada al dibujo.

Las caras comparten vértices en sus uniones. El ajuste de unión en el contorno se limita a 1,05 píxeles. Las fachadas frontales conservan su silueta y usan una profundidad explícitamente provisional. Las fachadas con direcciones axonométricas usan una estimación de planos, con restricciones de coplanaridad para regiones contenidas y aleros horizontales. Las texturas proceden del render actual, sin introducir una imagen ni una distribución de otro ejemplo.

El visor incorpora **Vista del Paso 2**, con proyección ortográfica registrada y ajuste de encuadre para distintas proporciones de pantalla. Las cámaras de órbita permiten inspeccionar la malla. Las ventanas y accesos visibles no se sustituyen por vanos de tamaño o posición predefinidos.

Las preferencias de versiones anteriores se migran al modo registrado. El generador de v3.3.1 permanece como **Diseño conceptual · edificio alternativo**, con selección explícita. La validación rechaza una reconstrucción que pertenezca a otro archivo o a otro marco.

## Verificación

- 180 pruebas aprobadas, incluidas correspondencia de vértices y UV con los píxeles de origen, uniones compartidas entre caras, distintos emplazamientos de ventanas, protección contra mezclar archivos, extrusión de una fachada frontal y encuadre de la vista registrada.
- En las pruebas de proyección, los vértices renderizados vuelven al píxel de origen con un error inferior a 0,001 píxeles después de convertir sus posiciones a `Float32`. Esto comprueba la correspondencia de proyección, no la exactitud de las profundidades inferidas.
- El archivo `prodalam-plano-limpio (2).png` se procesó en la APP. Se inspeccionaron el Paso 2, la vista registrada del Paso 3 y la órbita. La malla utiliza 174 caras del mismo archivo; no contiene las terrazas ni la distribución alternativa del generador conceptual.
- Verificación estática v3.3.2: 46 módulos. Comprobaciones de sintaxis y `git diff --check` correctas.

## Límites

La reconstrucción representa las superficies observadas y conserva su correspondencia visual en la cámara de referencia. La profundidad sigue siendo una estimación; al orbitar pueden aparecer deformaciones o zonas incompletas donde una sola imagen no aporta geometría suficiente. No es una reconstrucción BIM ni una certificación de medidas. El interior y las caras ocultas requieren planos, vistas adicionales o geometría CAD. No se empleó generación externa de imágenes ni se incorporaron archivos privados al repositorio.
