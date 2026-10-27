# Corrección del Paso 3 · v3.3.1

Registro histórico: el generador de esta versión conservaba solamente rasgos aproximados y podía producir otra distribución. En [v3.3.2](continuidad-v3-3-2.md) pasó a ser una alternativa explícita; el modo inicial reconstruye las caras del mismo Paso 2.

## Causa

El inicio y la restauración de preferencias de v3.2–v3.3 imponían `exteriorMode: projection` y `depthMm: 300`. El modelo era una extrusión de la imagen, por lo que aparecía como una tabla al orbitar. El motor de edificio con paredes independientes seguía disponible pero no era el modo inicial y requería otra profundidad.

## Corrección

- El exterior inicia en edificio volumétrico con profundidad provisional de 6000 mm. Las preferencias anteriores se migran conservando material, ancho, calibración y perfiles.
- La profundidad del edificio y el espesor del relieve son independientes. Alternar los modos recupera el valor correspondiente; un relieve seleccionado expresamente con la nueva versión se conserva al reabrir.
- Las cubiertas se clasifican a partir de varios planos inclinados presentes en el dibujo. En el archivo reportado se reconocen cuatro regiones de cubierta, dos grupos de chimenea y una lucarna. Se crean mallas tridimensionales; las ventanas de la lucarna son huecos con cristales detrás.
- El edificio con cubierta inclinada mantiene la extensión de sus plantas, en vez de aplicar el retranqueo del generador de fachadas planas. La cubierta automática puede sustituirse por una elección explícita en la interfaz.
- Los materiales de las paletas se aplican a paredes y cubierta. Las superficies de la lámina del Paso 2 mantienen su encuadre y sus trazos originales.

## Verificación

- 172 pruebas aprobadas, incluidas migración de preferencias de 300 mm, alternancia de profundidades, mallas de cubierta inclinada, chimeneas, lucarna con cristales y selección explícita de cubierta plana.
- Entrega estática v3.3.1 verificada: 45 módulos. Comprobación de sintaxis y `git diff --check` correctas.
- Archivo original procesado en la APP: Paso 3 con 354 componentes, muros, ventanas con profundidad, cubierta inclinada, dos chimeneas y lucarna. Inspección visual de perspectiva y lateral; accionamiento de cámara trasera.
- Cambio en la interfaz a relieve: 300 mm. Regreso a edificio: 6000 mm y geometría volumétrica reconstruida.
- Capturas del resultado guardadas como artefactos locales de esta sesión. No se agrega una imagen de ejemplo como sustituto del modelo.

## Alcance

La información visible orienta la familia de cubierta y sus elementos. La perspectiva de una sola imagen no determina una reconstrucción métrica completa: la pendiente, las posiciones tridimensionales aproximadas y los lados ocultos siguen siendo propuestas. Los valores predeterminados de ancho y profundidad no son cotas leídas del dibujo. Esta corrección utiliza geometría local y no requiere generación de imágenes por IA.
