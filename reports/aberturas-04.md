# Ensayo 04 — auditoría de aberturas

Imagen: 1280 × 749, SHA-256 `9f3f598dd2db7f26fa7374c0b5bbbf7764e70bda9febb9aca65243fe3389f049`. Umbral 0,35. Reproducir con `python backend/opening_reference_review.py` y `node backend/build_opening_audit.mjs`.

Se inspeccionaron visualmente las 15 propuestas sin asociación del método anterior. Las 15 son aberturas reales: nueve puertas y seis ventanas. Se añadieron dos puertas omitidas a la referencia; ambas versiones se comparan contra esa misma referencia corregida. La revisión fue hecha por un agente y sigue pendiente de validación independiente.

| Medida | Anterior | Depurada |
|---|---:|---:|
| Cuerpos de puerta/ventana generados | 21 | 31 |
| Propuestas sin soporte asociado | 15 | 0 |
| Fragmentos conflictivos conocidos que llegan al 3D | 2 | 0 |
| Fragmentos excluidos explícitamente | 0 | 2 |
| Propuestas adicionales agrupadas en un cuerpo | 1 | 4 |

**Se resolvió la asociación de 15/15 propuestas. Esto no equivale a 15 geometrías correctas. Las seis ventanas de la revisión mantienen dudas de extensión, posición de jamba o desplazamiento de máscara.** La ventana vertical de cocina (semantic-8/9, fuera de las 15 iniciales) sigue dividida en dos cuerpos porque la máscara predice un tramo sólido intermedio. No se elimina ese posible machón a partir de la referencia.

## Registro por caso

| Propuesta | Clase | Diagnóstico visual | Asociación actual | Geometría pendiente |
|---|---|---|---|---|
| semantic-3 | Ventana | Fragmentación | Con soporte | Sí |
| semantic-6 | Ventana | Encuentro perpendicular | Con soporte | Sí |
| semantic-13 | Ventana | Fragmentación | Con soporte | Sí |
| semantic-14 | Ventana | Eje / línea fina | Con soporte | Sí |
| semantic-19 | Ventana | Eje / línea fina | Con soporte | Sí |
| semantic-20 | Ventana | Fragmentación / eje | Con soporte | Sí |
| semantic-23 | Puerta | Referencia incompleta / apoyo corto | Con soporte | Revisar antes de uso constructivo |
| semantic-24 | Puerta | Encuentro perpendicular | Con soporte | Revisar antes de uso constructivo |
| semantic-29 | Puerta | Encuentro / extremos | Con soporte | Revisar antes de uso constructivo |
| semantic-30 | Puerta | Encuentro perpendicular | Con soporte | Revisar antes de uso constructivo |
| semantic-32 | Puerta | Apoyo corto / encuentro | Con soporte | Revisar antes de uso constructivo |
| semantic-33 | Puerta | Referencia incompleta / dos encuentros | Con soporte | Revisar antes de uso constructivo |
| semantic-34 | Puerta | Encuentro / extremos | Con soporte | Revisar antes de uso constructivo |
| semantic-35 | Puerta | Encuentro perpendicular | Con soporte | Revisar antes de uso constructivo |
| semantic-37 | Puerta | Línea fina del marco | Con soporte | Revisar antes de uso constructivo |

- **semantic-3:** Propuesta parcial de la ventana del baño. Se agrupa con semantic-4; la máscara de muro ocupa parte del extremo izquierdo, por lo que el ancho total sigue pendiente.
- **semantic-6:** Ventana real próxima a un encuentro en T. Hay soporte estructural, pero la posición de la jamba izquierda necesita revisar la máscara.
- **semantic-13:** Ventana real con un fragmento adicional semantic-15. La unión evita un segundo marco; el extremo derecho y el eje de muro requieren comprobación.
- **semantic-14:** Ventana real. El método anterior elegía una línea fina del marco; se usan las jambas del muro. La máscara queda desplazada respecto al trazo original.
- **semantic-19:** Ventana real del salón. Se corrige la selección de apoyos; persiste un desplazamiento del contorno exterior del muro respecto a la imagen.
- **semantic-20:** Ventana real del salón con fragmento semantic-21. Se evita duplicar el marco; la máscara exterior conserva un desplazamiento que necesita revisión.
- **semantic-23:** Puerta real del vestidor. Faltaba en la referencia y sus apoyos cortos no se resolvían en la asociación anterior.
- **semantic-24:** Puerta real del baño. Una jamba coincide con el muro perpendicular exterior; no hay dos tramos collineales.
- **semantic-29:** Puerta real al pasillo. Los extremos detectados no alcanzaban los encuentros de muro; se utilizan caras interiores de las jambas.
- **semantic-30:** Puerta real junto a cocina. El apoyo superior es un encuentro perpendicular.
- **semantic-32:** Puerta real del baño pequeño. El encuentro con el tabique izquierdo requiere tolerancia de rasterización y apoyo corto.
- **semantic-33:** Puerta real junto a cocina, omitida en la referencia. Se apoya en dos jambas perpendiculares.
- **semantic-34:** Puerta doble real entre recibidor y salón. Se ajusta el extremo superior al encuentro del muro.
- **semantic-35:** Puerta real al porche. La jamba derecha pertenece al muro perpendicular.
- **semantic-37:** Puerta doble real al porche. Una línea fina dentro del vano era seleccionada en lugar de los apoyos de muro.

## Coincidencia de las huellas con la referencia

El criterio se mantiene en IoU de caja ≥ 0,50, con emparejamiento uno a uno. «Sin coincidencia» no significa automáticamente una abertura falsa: puede indicar extensión parcial, grosor diferente o desplazamiento del muro. Las métricas de detección de la IA se conservan por separado.

| Clase | Cuerpos antes → después | Coincidencias antes → después | Sin coincidencia antes → después |
|---|---:|---:|---:|
| door | 6 → 14 | 4 → 9 | 2 → 5 |
| window | 15 → 17 | 7 → 10 | 8 → 7 |

## Cambios del método

- Evalúa pares de jambas compatibles y encuentros perpendiculares, incluyendo apoyos cortos de la máscara; no selecciona únicamente la primera línea más próxima.
- Evita usar líneas de un píxel del marco como espesor de muro y limita el desplazamiento transversal para no trasladar una puerta a otra estructura.
- Agrupa propuestas de la misma clase dentro de un vano apoyado. No fusiona puertas con ventanas ni atraviesa automáticamente un machón sólido.
- Exige dos apoyos independientes; una propuesta dentro de una pared continua no basta para cortarla. Los casos sin soporte siguen pendientes.
- Guarda los dos apoyos, el origen de cada propuesta y los motivos de exclusión. El resultado original del detector no se modifica.

## Evidencia visual

[Casos 1–6](../docs/images/openings-audit/pendientes-1.png) · [Casos 7–12](../docs/images/openings-audit/pendientes-2.png) · [Casos 13–15](../docs/images/openings-audit/pendientes-3.png) · [Puertas omitidas](../docs/images/openings-audit/puertas-faltantes.png) · [Revisión de ventanas](../docs/images/openings-audit/revision-ventanas.png).

[Resultado de casos 1–6](../docs/images/openings-audit/resultado-1.png) · [Resultado de casos 7–12](../docs/images/openings-audit/resultado-2.png) · [Resultado de casos 13–15](../docs/images/openings-audit/resultado-3.png).

[Visor anterior](../docs/images/aberturas-04-anterior.png) · [Visor depurado](../docs/images/aberturas-04-depurado.png) · [Puerta recuperada](../docs/images/aberturas-04-caso23.png) · [Ventana con geometría pendiente](../docs/images/aberturas-04-ventana3.png).
