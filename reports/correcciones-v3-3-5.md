# Validación v3.3.5

## Plano interior reportado

Se reproduce con el JPG exacto del comentario y una fixture comprimida de sus píxeles. El error exigía detecciones semánticas de puertas/muebles incluso cuando había una red estructural aprovechable. Ahora se admite una planta confirmada con al menos tres muros por eje, ocho muros en total y cuatro encuentros que abarquen una parte significativa del dibujo. Se rechazan trazos dispersos, fachadas y perspectivas. No se fabrican muebles para superar la validación.

QA real: 39 tramos de muro, 30 regiones depuradas, acceso a pasos 2 y 3. El resultado se identifica como solo estructura; falta el motor semántico para equipamiento. La captura de comparación conserva el plano en su encuadre.

## Fachada

La propuesta de masas v3.3.4 no conservó la construcción original. También se descartó una prueba de reconstrucción parcial por planos porque seguía mostrando separaciones al girar. No se entrega esa implementación experimental ni se considera resuelto el volumen de la casa.

La corrección entregada evita el resultado falso: cuando la validación de profundidad falla, el modo inicial detiene la construcción y explica la necesidad de perfiles o vistas acotadas. No sustituye el archivo por un edificio genérico ni presenta una tabla texturada como edificio. El modo conceptual requiere una elección explícita. Una reconstrucción automática fiel sigue pendiente.

QA real con `maxresdefault.jpg`: mensaje de profundidad no fiable; no se habilitan los pasos 2/3 ni queda un modelo anterior. Los perfiles manuales y alzados siguen pasando sus pruebas. Una prueba de rayos a través de todas las ventanas del alzado encontró un hueco tapado por la triangulación anterior; la división por celdas corrige el problema.

## Verificación

199 pruebas Node aprobadas y build estático verificado. Incluye regresiones del archivo interior exacto, clasificación, rechazo de profundidad fallida, huecos físicos, material/escala y perfiles manuales cóncavos. Estas pruebas no constituyen una validación universal del reconocimiento de planos.

Capturas: `docs/images/v335/interior-processed.png`, `interior-comparison.png`, `interior-3d.png` y `exterior-depth-guard.png`. Cambios locales en preview; no publicados en GitHub Pages.
