# Importación de dibujos mecánicos · v3.1

La lámina adicional de una pletina curva se abría correctamente, pero se reconstruía con revolución, mezclando vistas, cotas y líneas auxiliares. La selección manual de ingeniería conservaba además el mensaje de la sugerencia de fachada. Esto explica el modelo vacío o ajeno al contorno; no era un problema de extensión JPEG.

## Cambios

- Análisis de trazos neutros y recuperación de trazos coloreados próximos a la geometría. Se conserva la imagen original y su sistema de coordenadas.
- Separación de contornos cerrados, exclusión de bordes de papel y elección de una vista. Las vistas complementarias pueden relacionarse por alto o por ancho; se admiten láminas giradas.
- Operación automática: los contornos de sección y los perfiles CAD dispersos usan extrusión; el flujo de revolución sigue disponible para los cortes axiales anteriores.
- Profundidad proporcional a una vista complementaria, con alternativa de profundidad manual. Se usa la mediana del ancho de la vista para reducir la influencia de flechas y cotas salientes.
- Círculos observados en la vista complementaria pueden proponerse como taladros cuando coinciden con un tramo recto de la sección. Son aberturas geométricas del modelo, no manchas de una textura. La opción puede desactivarse.
- Suavizado opcional de contornos finos de imagen, con ajuste de los bordes limitado a 1,25 píxeles y conservación del contorno original. Normales suavizadas en superficies curvas, con conservación de esquinas y caras planas. El frente sigue alineado con la fuente; la perspectiva usa un encuadre propio para evitar recortes al cambiar de presentación.
- DXF usa perfiles cerrados y excluye capas auxiliares conocidas cuando hay geometría disponible. La selección explícita de una capa conserva el control del usuario.
- Análisis invalidado al cambiar de archivo, preparación, región o sensibilidad. Los datos JSON indican la vista y las inferencias de extrusión.

## Validación

La lámina adicional produce dos vistas separadas. La sección curva se modela por extrusión con ancho proporcional a la otra vista y dos taladros propuestos en los extremos. No se incluyó el archivo del usuario en el repositorio.

Las pruebas nuevas generan láminas sintéticas independientes: varias curvaturas, tamaños, desplazamientos y rotación; círculos neutros y coloreados; geometría completamente coloreada; selección de vistas; profundidad manual; hojas vacías y trazos abiertos; filtrado de capas DXF. Rayos contra el modelo comprueban que los centros de los taladros están vacíos y que el material contiguo sigue siendo sólido. Se conserva la clasificación de las muestras anteriores de mecánica y fachada.

`npm run build` verifica la entrega estática y las versiones visibles. `npm test` pasa las 147 pruebas: las 129 regresiones anteriores y 18 pruebas nuevas de importación.

## Límites de interpretación

El sistema no reconoce universalmente cualquier plano ni lee automáticamente los números de sus cotas. Relacionar dos vistas supone proyecciones compatibles y una escala relativa uniforme; la calibración y la revisión siguen siendo necesarias. Las medidas iniciales son provisionales.

La detección de círculos no identifica por sí sola una operación de mecanizado, una rosca ni una tolerancia. Los taladros se proponen únicamente donde hay una correspondencia geométrica sencilla; en superficies curvas, vistas incompatibles o trazos ambiguos se conserva el perfil sin perforación. Los pequeños detalles por debajo de la resolución de la imagen pueden requerir trazado manual. Las uniones de los tramos extruidos y su topología requieren revisión antes de usar el STL para fabricar.

Se mantienen los formatos PNG, JPG, WEBP, PDF y DXF. No se agregó importación DWG o STEP. Los modelos no contienen validación dimensional, resistente ni de fabricación.
