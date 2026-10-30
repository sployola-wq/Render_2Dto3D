# Fachadas y vista cenital · v3.3.7

El Paso 2 vuelve a abrir el render interior en vista cenital ortográfica. Conserva el modelo neuronal y sus muebles; la perspectiva queda como opción. El render recibe más espacio, sin alterar las medidas disponibles en el Paso 1.

La fachada en perspectiva deja de usar el contorno de la imagen como campo de alturas y deja de envolver el edificio con la lámina. Ese procedimiento podía coincidir desde una cámara y producir una forma equivocada al orbitar. Ahora se generan muros verticales con espesor, plantas horizontales, huecos reales, cristales retranqueados y cubiertas de planos regulares con espesor. Los encuentros de la buhardilla se unen al plano de cubierta. El modelo y el render cenital exterior proceden de la misma geometría.

Las propuestas usan las proporciones del archivo, conjuntos de paños, la familia de cubierta sugerida por CLIP y candidatos de ventanas/puertas. Un detector local [YOLO-World de Ultralytics](https://docs.ultralytics.com/models/yolo-world/) complementa la lectura geométrica; sus pesos públicos están fijados y verificados en `backend/model-manifest.json`. Las detecciones y los accesos tienen prioridad sobre fragmentos que se solapan. Las familias de líneas de perspectiva ayudan a separar frentes, laterales y plantas, conservando el acceso y el vidrio lateral de la fachada moderna. El garaje usa una hoja opaca, no un vidrio. La fachada moderna conserva dos cuerpos superiores separados cuando la evidencia de sus aberturas permite proponerlos.

Esto es una **propuesta arquitectónica**, no una recuperación exacta de CAD: plantas, alturas, profundidad, partes ocultas y algunos huecos requieren revisión. La detección puede omitir o confundir elementos. No se inventa una planta interior a partir de una fachada. Los perfiles manuales y CAD mantienen su ruta anterior. El ancho, profundidad, plantas, cubierta y material siguen siendo editables.

Un fallo transitorio de conexión al reconocimiento interior se reintenta una vez. Si vuelve a fallar y no existe una predicción para ese archivo, se conserva el plano y se muestra el error para reintentar, sin presentar un interior vacío como resultado completo.

## Validación

- 217 pruebas Node correctas: geometría arquitectónica, ventanas perforadas, planos de cubierta, uniones de buhardilla, dos cuerpos superiores, garaje opaco, cambios de profundidad y cámara cenital sin perspectiva. Incluyen la batería existente de interiores, CAD e ingeniería.
- Cuatro pruebas de integración correctas con los modelos locales: disciplinas de cinco láminas, papel vacío, cubierta plana/dos aguas y garaje del JPEG original, mobiliario y estructura del interior reportado.
- Una prueba concurrente correcta de los endpoints locales de clasificación y análisis.
- Build estático verificado: 53 módulos; `git diff --check` sin errores.
- Revisión en navegador del interior y las dos fachadas reportadas; capturas en `docs/images/v337/`.

La prueba del detector usa el JPEG original para conservar la entrada que recibe `/api/classify`; las láminas RGBA preparadas siguen probando el reconocimiento de disciplina y la geometría. Un resultado sin detecciones no se presenta como una lectura completa.

El preview se sirve en `http://127.0.0.1:4173/`. Esta versión se entrega para subir a `origin/main` por petición del usuario. GitHub Pages aloja la interfaz estática; el reconocimiento neuronal requiere el servicio Python local y los pesos instalados con `setup-local.sh`.
