# Reconocimiento y correcciones v3.3.8

29 de octubre de 2026. Revisión local de la aplicación; no publicada en GitHub.

## Cambios

- Clasificación local de hoja completa y contenido, cuatro orientaciones, márgenes y papel oscuro. Acuerdo entre vistas, alternativas visibles en casos ambiguos y botón para repetir el reconocimiento.
- Fusión de detecciones y segmentación sin descartar automáticamente todas las puertas, ventanas o piezas sanitarias del detector. Duplicados suprimidos; propuestas contradictorias conservadas en el informe sin apilar geometrías.
- Detección de detalle en láminas grandes, con coordenadas originales y rechazo de fragmentos cortados. Un ensayo con recortes en la imagen interior pequeña produjo falsos sofás en armarios: se descartó ese cambio y se exige corroboración contextual de las propuestas de detalle.
- Plantas vacías con geometría de muros neuronal pueden procesarse si la clasificación visual respalda Interior.
- Editor de correcciones sobre el original: agregar, reclasificar y eliminar objetos; agregar/eliminar muros; deshacer. Las correcciones se conservan aparte de las predicciones y quedan vinculadas al archivo. Se reflejan en ambos renders y en el informe descargable.
- Paso 2 cenital del mismo modelo usado en Paso 3. Perspectiva opcional.
- La envolvente genérica ya no se acepta como evidencia suficiente para reconstruir automáticamente una fachada. El modo conceptual permanece como propuesta independiente explícita. Una profundidad no resuelta conserva la imagen y contornos en revisión 2D, con acceso al trazado de perfiles, sin presentar otro edificio como resultado fiel.

## Verificación

226 pruebas JavaScript correctas y 18 pruebas Python correctas con modelos locales reales. Incluyen geometría de alzados, huecos, volumen, mecánica y estructura; identidad del archivo; correcciones y deshacer; fusión y clasificación multivista. Nueve variantes adicionales de tres imágenes comprueban rotaciones, márgenes y papel oscuro. Build estático: 55 módulos. No es una evaluación de precisión universal sobre planos desconocidos.

En el navegador se procesó el interior reportado mediante identificación automática: 32 propuestas de mobiliario/equipamiento y 12 de aberturas; 30 muebles ambientados tras las comprobaciones de colocación. Se comprobó borrar un objeto y deshacer la operación. Cero errores de consola en esa prueba. No todos los símbolos del plano quedaron reconocidos: persisten omisiones y categorías equivocadas que necesitan revisión.

La casa a dos aguas se identificó automáticamente como Exterior y quedó disponible para comparar sus contornos en Paso 2. Paso 3 se mantuvo deshabilitado porque su profundidad no está resuelta. Esto evita el resultado inventado, pero **no equivale a haber reconstruido correctamente esa casa en 3D**.

## Límites que siguen pendientes

Las perspectivas exteriores difíciles todavía necesitan perfiles/vistas adicionales o una reconstrucción geométrica más capaz. El detector interior no recupera de manera fiable todos los sofás y demás símbolos; los objetos renderizados son aproximaciones de catálogo. Las escalas sin calibrar y dimensiones no observadas son provisionales. No se garantiza cobertura completa ni aptitud constructiva del resultado.

El reconocimiento neuronal funciona con el servicio local activo. GitHub Pages aloja solo la interfaz y no puede ejecutar los modelos Python por sí mismo.

## Capturas

![Interior en 3D](../docs/images/v338/interior-3d.png)

![Revisión de fachada sin edificio sustituto](../docs/images/v338/facade-review.png)
