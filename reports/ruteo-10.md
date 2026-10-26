# Ruteo y proyección coherente · v2.7

## Fallo observado

El selector de v2.6 conservaba Interior y solo sugería Ingeniería. Una carga ordinaria podía seguir al detector de habitaciones aunque la misma lámina funcionara al seleccionar manualmente su disciplina. La captura del usuario mostraba exactamente ese caso. Las pruebas nuevas cubren los píxeles de ambos JPEG y el ruteo previo a la inferencia, además de la migración del estado guardado.

## Cambio

Automático resuelve la disciplina antes de llamar al puente residencial. La evidencia combina simetría axial horizontal/vertical, densidad y tonos del dibujo; en DXF también interpreta nombres de capas estructurales. Respeta las selecciones manuales explícitas nuevas, pero los antiguos valores Interior sin intención registrada vuelven a Automático. La clasificación es inicial y revisable; no identifica de forma universal todos los planos de ingeniería.

Una selección Interior incompatible exige verificación expresa y mantiene desactivados el procesamiento y los pasos posteriores. Otra comprobación, tras la inferencia y antes de publicar el resultado, exige aberturas y equipamiento/regiones compatibles con una planta. Evita que algunas mesas o sillas falsas justifiquen un edificio.

La comparación especializada del Paso 2 dejó de ser una recoloración de trazos. Ahora se renderiza la misma malla del Paso 3 mediante cámara ortográfica; su encuadre conserva el marco original, la posición del eje y la escala de análisis. La iluminación y las reflexiones de estudio se generan localmente. El visor residencial, sus geometrías y sus materiales originales no se modificaron.

## Verificación

- **95 pruebas Node:** incluye carga mecánica/fachada ordinaria, estado legado, rechazo de falsas detecciones residenciales, confirmación manual, encuadre de proyección y ruteo/capa estructural CAD, junto a las pruebas existentes de perfiles, unidades, STL y presentación interior.
- **4 pruebas Python:** repetición de símbolos del reconocimiento interior.
- **Mecánica real:** selección normal de `images (4).jpeg`; Automático eligió Ingeniería antes de procesar. Los Pasos 2/3 mostraron la envolvente de revolución metálica. Elegir Interior no verificado bloqueó procesamiento, Paso 2 y Paso 3.
- **Fachada real:** `images (3).jpeg`, modo exterior, proyección y volumen con paños materiales. No se crearon habitaciones ni muebles.
- **Estructura CAD:** DXF de prueba de 7 barras en S_ESTRUCTURA y una cota separada. Identificación automática, unidades CAD declaradas, selección de capa y 7 barras de perfil I; no se incluyó la cota.
- **Interior real:** `images (2).jpeg`, inferencia local de 53 propuestas de equipamiento y 34 aberturas. Se conservó la referencia aprobada de 2752×1536 y el interior con 8 pisos texturados y 53 muebles ambientados.
- `git diff --exit-code` sobre app.js, architecture.js, components.js, detector.js, appearance-3d.js y appearance-mapping.js confirma que el núcleo interior es idéntico a la v2.5 publicada.

## Límites del resultado

La sección mecánica genera una envolvente exterior hasta que el usuario aporta medias secciones, cavidades o perfiles de piezas; no se reconstruye automáticamente todo el ensamblaje numerado. La fachada produce volumen por profundidad definida y no caras ocultas inferidas de una perspectiva. Son modelos geométricos de revisión; no contienen cálculo estructural ni validación de fabricación. Ninguna imagen fotográfica de referencia se presenta como generación nueva. No se invocó ningún proveedor externo.
