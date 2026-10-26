# Prodalam Render Pro v3.0 · Conjunto por componentes

26 de octubre de 2026. Entrega local 3.0.0.

## Cambio visible

La presentación mecánica predeterminada pasa a **v3.0 · Conjunto por componentes**. En la lámina de comprobación identifica cinco bandas axiales de sección: brida de entrada (39–105 px), carcasa central (105–337), tapa/alojamiento (337–364), brida de salida (364–416) y cierre axial (416–453). Los límites siguen cambios de la envolvente; los nombres funcionales son interpretaciones propuestas.

Cada banda se reconstruye por separado desde la máscara de material, con huecos grandes conservados y limpieza de pequeñas irregularidades de raster. La carcasa usa un acabado de fundición más oscuro; bridas, tapa y cierre reciben acabados metálicos diferenciados. Las caras de corte mantienen contornos propios.

El **Eje escalonado propuesto**, activable de forma independiente, sigue límites emparejados alrededor del núcleo sin rayado. Su superficie es un volumen completo de revolución, con acabado de acero mecanizado. Esta convención cambia deliberadamente la interpretación del centro: el modo de corte anterior continúa disponible para conservarlo como vacío. Los datos de análisis originales permanecen separados.

El Paso 2 utiliza una cámara frontal alineada con el marco completo de origen. El visor permite aislar una pieza por nombre, recorrer componentes y alternar un **Despiece** reversible. Las fijaciones y elementos de rodamiento acompañan a su alojamiento en el despiece. Las mediciones se desactivan en ese modo para evitar medir separaciones de presentación.

El STL se genera siempre en la posición ensamblada y luego restaura la vista que estaba abierta. El JSON incluye versión 3.0.0, modo, perfiles, bandas, eje propuesto y supuestos; omite las máscaras de raster de trabajo. No se han realizado operaciones booleanas de unión entre piezas.

## Versión y entrega

- `package.json`, el paquete raíz del lockfile y las identificaciones de la interfaz indican 3.0.0 / v3.0.
- La insignia de versión es independiente del nombre del producto y se conserva en paneles estrechos.
- `npm run build` verifica coherencia de versiones, recursos HTML e importaciones locales, y genera `dist/build-info.json` para esta aplicación estática de módulos ES. No hay una etapa de transpilar o empaquetar que sustituir.
- Los estudios guardados con la presentación de sección anterior pasan al nuevo modo al abrirlos si no contienen perfiles manuales. Una selección explícita guardada desde v3.0 se respeta.
- No se publicaron ni sincronizaron cambios con GitHub.

## Validación

- **129 pruebas Node aprobadas**, incluidas las cinco nuevas de conjuntos mecánicos.
- Partición del ejemplo, conservación del análisis original, eje opcional y materiales diferenciados.
- Reproyección del eje al marco de origen y calibración métrica.
- Construcción del conjunto y despiece con una lámina rotada 90°.
- Exportación STL idéntica en posición ensamblada y con el visor en despiece; la vista separada se restaura después.
- Verificación real en el navegador con una copia de la lámina del usuario: Paso 1 y Paso 2 tuvieron el mismo marco, x=604, y=332,046875, ancho=352 y alto=286 píxeles CSS.
- Activación y desactivación del eje, comparación frontal, selección de carcasa, aislamiento, regreso al conjunto y despiece revisados en pantalla. El botón de medir quedó deshabilitado durante el despiece.
- Capturas de la sesión: `/tmp/render-v3-frontal.png`, `/tmp/render-v3-conjunto.png`, `/tmp/render-v3-despiece.png`.

## Límites

La separación se apoya en cambios de envolvente de una sección; no recupera un despiece CAD autenticado. El eje, los roles funcionales, las cabezas y las piezas ocultas son propuestas revisables. No se deducen tolerancias, roscas normalizadas ni referencias comerciales. Una lámina con varios alzados, ejes oblicuos o componentes sin simetría requiere delimitar o trazar la geometría y revisar el modo elegido.
