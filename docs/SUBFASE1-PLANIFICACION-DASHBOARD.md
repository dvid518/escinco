# SUBFASE 1 — Auditoría y planificación de las tarjetas del Dashboard de escinco

**Estado:** Planificación definitiva (sin implementación)
**Alcance:** 22 tarjetas de `DASHBOARD_CARDS` + instancias dinámicas (`cuenta:<id>`, `activo:<id>`)
**Regla clave:** La evaluación se realiza por variante de dimensión, no por tarjeta completa. Se distinguen dos dimensiones independientes: estado de diseño (aprobado por el PO) y estado de implementación (verificada).

---

## A. Inventario completo de tarjetas

| # | ID | Label | Tipo | Dimensiones catálogo | Dimensiones permitidas | Generador | Instanciado dinámicamente |
|---|----|-------|------|---------------------|----------------------|-----------|--------------------------|
| 1 | patrimonio | Patrimonio total | Estática (fija) | 1×1 | 1×1, 1×2 | `generarCardPatrimonio` | No |
| 2 | cuentas | Cuentas | Métrica / instancia | 1×1 | 1×1, 1×2 | `generarCardMetrica` → instancia | Sí (una por cuenta final) |
| 3 | inversiones | Inversiones | Métrica | 1×1 | 1×1, 1×2 | `generarCardMetrica` | No |
| 4 | vencimientos | Próximos vencimientos | Métrica / lista | 1×1 | 1×1, 1×2, 1×3 | `generarCardVencimientos` | No |
| 5 | movimientos | Últimos movimientos | Lista con scroll | 1×2 | 1×1, 1×2, 1×3 | `generarCardMovimientos` | No |

> **Decisión del PO (Subfase 2)** — Movimientos conserva **1×1, 1×2 y 1×3**; no se limita a 1×2. Las demás tarjetas con 1×3 en esta tabla (vencimientos, favoritos, metas, presupuestos, pendientes, ordenes, estrategias, distribucion, distribucion-activos, patrimonio-divisa, programados, alertas) **no quedan ratificadas por esta nota**: su 1×3 sigue siendo una contradicción entre §A y §B pendiente de resolución explícita del PO, y no se implementa sin esa decisión.
| 6 | favoritos | Favoritos | Lista | 1×1 | 1×1, 1×2, 1×3 | `generarCardFavoritos` | No |
| 7 | metas | Metas de ahorro | Métrica / lista | 1×1 | 1×1, 1×2, 1×3 | `generarCardMetas` | No |
| 8 | presupuestos | Presupuestos | Métrica / lista | 1×1 | 1×1, 1×2, 1×3 | `generarCardPresupuestos` | No |
| 9 | pendientes | Pendientes | Lista | 1×1 | 1×1, 1×2, 1×3 | `generarCardPendientes` | No |
| 10 | ordenes | Órdenes | Lista | 1×1 | 1×1, 1×2, 1×3 | `generarCardOrdenes` | No |
| 11 | estrategias | Estrategias | Lista | 1×1 | 1×1, 1×2, 1×3 | `generarCardEstrategias` | No |
| 12 | flujo-caja | Flujo de caja | Métrica | 1×1 | 1×1, 1×2 | `generarCardMetrica` | No |
| 13 | gastos-periodo | Gastado | Métrica | 1×1 | 1×1, 1×2 | `generarCardGastosPeriodo` | No |
| 14 | ingresos-periodo | Ingresado | Métrica | 1×1 | 1×1, 1×2 | `generarCardIngresosPeriodo` | No |
| 15 | balance-periodo | Balance | Métrica | 1×1 | 1×1, 1×2 | `generarCardMetrica` | No |
| 16 | deudas | Deudas | Métrica | 1×1 | 1×1, 1×2 | `generarCardMetrica` | No |
| 17 | distribucion | Distribución patrimonial | Distribución | 1×2 | 1×1, 1×2, 1×3 | `generarCardDistribucionDona` | No |
| 18 | distribucion-activos | Distribución por tipo de activo | Distribución | 1×1 | 1×1, 1×2, 1×3 | `generarCardDistribucionActivos` | No |
| 19 | patrimonio-divisa | Patrimonio por divisa | Distribución | 1×1 | 1×1, 1×2, 1×3 | `generarCardPatrimonioDivisa` | No |
| 20 | programados | Movimientos programados | Lista | 1×1 | 1×1, 1×2, 1×3 | `generarCardProgramados` | No |
| 21 | alertas | Alertas | Lista (píldoras) | 1×1 | 1×1, 1×2, 1×3 | `generarCardAlertas` | No |
| 22 | grafico | Evolución patrimonial | Gráfico (canvas) | 2×2 | 2×2 (fijo) | `generarCardGrafico` | No |

> **Decisión del PO (Subfase 2)** — El Gráfico permanece **fijo en 2×2**. No se habilita 1×2 ni ninguna otra variante. Coincide con §B (fila `grafico`) y no admite reinterpretación a partir de la matriz del inventario de Fase 2A.

**Tarjetas dinámicas adicionales** (no en `DASHBOARD_CARDS`, montadas en `montarCardsInstanciadas()`):
- `cuenta:<id>` — una por cuenta final (plantilla `tpl-dashboard-card-cuenta`)
- `activo:<id>` — una por posición abierta (plantilla `tpl-dashboard-card-activo`)

---

## B. Matriz de estado por variante

> **Resolución de la contradicción §A/§B (decisión del PO, Subfase 2).** La columna "Dimensiones permitidas" de §A y esta matriz discrepan en qué tarjetas admiten 1×3. Solo quedan ratificadas por el PO estas decisiones explícitas: **Movimientos 1×1/1×2/1×3**, **Gráfico 2×2 fijo**, **Patrimonio 1×1** (1×2 pendiente de diseño) y las variantes C1/C2/C3 de distribución, distribución-activos y patrimonio-divisa. Para el resto de tarjetas, el 1×3 de §A **no está aprobado** y su habilitación queda pendiente de decisión explícita del PO; no se implementa ni se modifica la matriz de código por inferencia.

**Dos dimensiones independientes:**

| Estado de diseño | Estado de implementación |
|---|---|
| Aprobado por el PO | Verificada |
| Pendiente de aprobación | Pendiente de corrección |
| No definido | No verificada |
| | No viable |

Una variante solo se marca como **Verificada** si existe evidencia suficiente de: contenido real, composición y dimensiones, estados de carga/vacío/error, interacciones correspondientes, comportamiento responsive, ausencia de desbordamientos y regresiones. Sin esa evidencia, se usa **No verificada**.

| Tarjeta | Diseño 1×1 | Impl. 1×1 | Diseño 1×2 | Impl. 1×2 | Diseño 1×3 | Impl. 1×3 | Diseño 2×2 | Impl. 2×2 | Justificación |
|---|---|---|---|---|---|---|---|---|---|
| patrimonio | Aprobado | No verificada | No definido | No verificada | N/A | N/A | N/A | N/A | 1×1: el ciclo de resaltado del editor no acredita por sí solo verificación completa (falta evidencia de estados carga/vacío/error, responsive y regresiones). 1×2: diseño pendiente de definición y aprobación del PO; no es trabajo de implementación. 1×3: no es dimensión permitida según el inventario A (solo 1×1 y 1×2). |
| cuentas | Pendiente | No verificada | Pendiente | No verificada | N/A | N/A | N/A | N/A | Tarjetas dinámicas: contenido cortado en 160px (ver §F). Ninguna variante verificada. Cuentas permite únicamente 1×1 y 1×2 según el inventario A. |
| inversiones | Aprobado | No verificada | Pendiente | No verificada | Pendiente | No verificada | N/A | N/A | 1×1 tiene especificación pero no evidencia visual completa. Incluida en seguimiento de verificación. |
| vencimientos | No definido | No verificada | No definido | No verificada | No definido | No verificada | N/A | N/A | No existe decisión PO documentada ni especificación C1/C2/C3 que respalde las variantes 1×1, 1×2 y 1×3 de Vencimientos. C1 corresponde exclusivamente a Distribución patrimonial. El diseño y la implementación de Vencimientos permanecen pendientes de aprobación del PO. |
| movimientos | Pendiente | No verificada | Aprobado | No verificada | Aprobado | No verificada | N/A | N/A | 1×1 solo resumen ingresos/egresos sin lista individual; requiere corrección. 1×2/1×3 con lista y scroll, pero sin evidencia visual completa e independiente tras las regresiones reportadas. |
| favoritos | Pendiente | No verificada | Pendiente | No verificada | Pendiente | No verificada | N/A | N/A | 1×1 solo badge, sin contenido de favoritos. |
| metas | Pendiente | No verificada | Pendiente | No verificada | Pendiente | No verificada | N/A | N/A | 1×1 solo valor, sin lista de metas. |
| presupuestos | Pendiente | No verificada | Pendiente | No verificada | Pendiente | No verificada | N/A | N/A | 1×1 solo valor, sin lista de presupuestos. |
| pendientes | Pendiente | No verificada | Pendiente | No verificada | Pendiente | No verificada | N/A | N/A | 1×1 solo contador, sin detalle de pendientes. |
| ordenes | Pendiente | No verificada | Pendiente | No verificada | Pendiente | No verificada | N/A | N/A | 1×1 solo contador de pendientes. |
| estrategias | Pendiente | No verificada | Pendiente | No verificada | Pendiente | No verificada | N/A | N/A | 1×1 solo contador, sin lista de estrategias. |
| flujo-caja | Aprobado | No verificada | Pendiente | No verificada | N/A | N/A | N/A | N/A | Métrica simple 1×1 con especificación; sin evidencia visual completa. |
| gastos-periodo | Aprobado | No verificada | Pendiente | No verificada | N/A | N/A | N/A | N/A | Métrica simple 1×1 con especificación; sin evidencia visual completa. |
| ingresos-periodo | Aprobado | No verificada | Pendiente | No verificada | N/A | N/A | N/A | N/A | Métrica simple 1×1 con especificación; sin evidencia visual completa. |
| balance-periodo | Aprobado | No verificada | Pendiente | No verificada | N/A | N/A | N/A | N/A | Métrica simple 1×1 con especificación; sin evidencia visual completa. |
| deudas | Aprobado | No verificada | Pendiente | No verificada | N/A | N/A | N/A | N/A | Métrica simple 1×1 con especificación; sin evidencia visual completa. |
| distribucion | Aprobado | No verificada | Aprobado | No verificada | Aprobado | No verificada | N/A | N/A | C1 aprueba diseño de 1×1, 1×2 y 1×3, pero no existe evidencia visual completa e independiente de implementación. |
| distribucion-activos | Aprobado | No verificada | Aprobado | No verificada | Aprobado | No verificada | N/A | N/A | C2 aprueba diseño de 1×1, 1×2 y 1×3, pero no existe evidencia visual completa e independiente de implementación. |
| patrimonio-divisa | Aprobado | No verificada | Aprobado | No verificada | Aprobado | No verificada | N/A | N/A | C3 aprueba diseño de 1×1, 1×2 y 1×3, pero no existe evidencia visual completa e independiente de implementación. |
| programados | Pendiente | No verificada | Pendiente | No verificada | Pendiente | No verificada | N/A | N/A | 1×1 solo badge, sin lista de programados. |
| alertas | Pendiente | No verificada | Pendiente | No verificada | Pendiente | No verificada | N/A | N/A | 1×1 solo badge, sin lista de alertas. |
| grafico | N/A | N/A | N/A | N/A | N/A | N/A | Aprobado | No verificada | 2×2 fijo con especificación; sin evidencia visual completa de estados vacío/error. |

**Tarjetas que requieren implementación o corrección:** cuentas, favoritos, metas, presupuestos, pendientes, ordenes, estrategias, distribucion, distribucion-activos, patrimonio-divisa, programados, alertas, movimientos (1×1).

**Tarjetas que requieren verificación adicional:** inversiones, flujo-caja, gastos-periodo, ingresos-periodo, balance-periodo, deudas, grafico, patrimonio (1×1, 1×2), vencimientos (1×1, 1×2, 1×3), movimientos (1×2, 1×3).

**Tarjetas sin intervención pendiente:** ninguna.

---

## C. Decisiones del PO aplicadas (C1–C3)

### C1 — Distribución patrimonial (`distribucion`)

| Variante | Contenido especificado | Donas | Lista completa |
|---|---|---|---|
| 1×1 | Categoría con mayor participación, nombre y porcentaje | No | No |
| 1×2 | Líneas de progreso con más detalle | No (dona grande) | Resumida |
| 1×3 | Dona y lista completa | Sí | Sí |

**Nota:** 1×1 no es inviable; debe mostrar el bloque dominante con nombre y porcentaje. Las categorías reales son las presentes en los datos de la aplicación; no se asumen como exclusivamente Liquidez, Inversiones, Inmobilizado o Deudas.

### C2 — Distribución por tipo de activo (`distribucion-activos`)

| Variante | Contenido especificado | Donas |
|---|---|---|
| 1×1 | Tipo de activo con mayor valor agregado, nombre y porcentaje | No |
| 1×2 | Líneas o listado sin dona | No |
| 1×3 | Distribución completa con dona y líneas cuando tenga sentido | Sí |

**Selección principal:** Basada en el valor agregado, no en la cantidad de posiciones. Los tipos de activo reales son los presentes en los datos; no se asumen como exclusivamente acción, ETF, cripto, bono u otros.

### C3 — Patrimonio por divisa (`patrimonio-divisa`)

| Variante | Contenido especificado | Donas |
|---|---|---|
| 1×1 | Divisa con mayor participación, nombre/código y porcentaje | No |
| 1×2 | Desglose mediante líneas de progreso o composición equivalente | No (dona no por defecto) |
| 1×3 | Vista completa de divisas existentes | Evaluar si aporta valor |

**Diferenciación:** No confundir con el selector global de divisa del card Patrimonio. Son pantallas distintas. Las divisas reales son las presentes en los datos; no se asumen como exclusivamente PEN, USD, EUR o USDT.

---

## D. Criterios de contenido para tarjetas 1×1

**Regla del PO:** Un contador puede acompañar, pero nunca sustituir el contenido cuando exista información relevante. No frases como "Tienes 0 presupuestos" o "0 metas disponibles". Los números concisos; los textos secundarios aportan contexto.

### Favoritos

**Regla de selección:** Utilizar el primer favorito según el orden actual elegido por el usuario. No comparar directamente importes de distintas divisas. Si se necesita un total, utilizar una conversión válida y disponible; de lo contrario, omitirlo.

1. **Información real:** Lista de cuentas/activos marcados como favoritos con su saldo/valor actual.
2. **Prioridad 1×1:** El primer favorito del orden del usuario, con nombre y monto.
3. **1×1:** Título + nombre del primer favorito + monto + badge con cantidad total.
4. **1×2:** Lista de hasta 3 favoritos con `.dashboard-list-item`.
5. **1×3:** Lista de hasta 6 favoritos.
6. **Sin registros:** card-sub "Sin favoritos" (sin frase tipo "Tienes 0 favoritos").
7. **Sin datos:** badge oculto o "—" según caso.

### Metas

**Regla de selección principal:** La meta activa con fecha de cumplimiento más próxima. Distinguir entre mayor porcentaje de progreso y fecha más próxima; no se mezclan. Metas completadas y pausadas no participan en la selección principal.

- **Sin fecha objetivo:** no participan en la selección principal por proximidad de fecha; se ordenan al final, por fecha de creación descendente.
- **Fecha objetivo ya pasada:** se considera vencida y no participa como "próxima" en la selección principal; se muestra al final si hay espacio, indicada como "Vencida".

**Comportamiento de fallback (pendiente de aprobación del PO):**
- Si no existen metas activas: se muestra el estado vacío "Sin metas activas".
- Si existen metas activas pero ninguna cumple el criterio principal de selección (todas tienen fecha objetivo pasada o ninguna tiene fecha objetivo): el comportamiento de presentación alternativo queda como propuesta pendiente de aprobación del PO. No se presenta "Sin metas activas" cuando existen metas activas.

**Desempate (selección principal):** misma fecha de cumplimiento, se ordena por nombre ascendente.

1. **Información real:** Lista de metas de ahorro con monto ahorrado, monto objetivo y progreso.
2. **Prioridad 1×1:** La meta activa con fecha de cumplimiento más próxima, con nombre, monto ahorrado y porcentaje.
3. **1×1:** Título + nombre de la meta prioritaria + monto + card-sub con progreso "% completado" y fecha (o "Vencida" si la fecha ya pasó).
4. **1×2:** Lista de hasta 3 metas con barra de progreso visual.
5. **1×3:** Lista de hasta 6 metas.
6. **Sin registros:** card-sub "Sin metas activas".
7. **Sin datos:** Valor "—" o badge oculto.

### Presupuestos

**Regla de selección:** "Mayor porcentaje de uso" = gastado / asignado, solo cuando asignado > 0 y los datos son válidos. Presupuestos sin gasto muestran 0% pero no se excluyen. Presupuestos con datos incompletos (asignado nulo o 0) no se seleccionan como prioritario; se usa el primero de la lista.

- **Desempate:** mismo porcentaje de uso, se ordena por nombre ascendente.
- **Presupuestos superados:** se muestran con el porcentaje real (puede superar el 100 %). Si se usa barra de progreso visual, esta se limita al 100 % de su ancho, pero el dato numérico mostrado conserva el porcentaje real (por ejemplo, "125 % usado").
- **Sin gasto:** muestran 0 % y no se excluyen.

1. **Información real:** Lista de presupuestos con monto asignado, gastado y restante.
2. **Prioridad 1×1:** El presupuesto con mayor % de uso válido, o el primero de la lista si no hay datos válidos, con nombre y monto restante.
3. **1×1:** Título + nombre del presupuesto prioritario + monto restante + card-sub con "% usado" solo si es calculable.
4. **1×2:** Lista de hasta 3 presupuestos con barra de progreso de gasto (limitada visualmente al 100 %; el porcentaje real se muestra en el dato).
5. **1×3:** Lista de hasta 6 presupuestos.
6. **Sin registros:** card-sub "Sin presupuestos".
7. **Sin datos:** Valor "—".

### Pendientes

**Regla de selección:** Orden determinista de urgencia:

1. Pendientes vencidos primero, ordenados por fecha de vencimiento descendente: el que lleva menos tiempo vencido aparece primero.
2. Pendientes no vencidos después, ordenados por fecha de vencimiento ascendente: el que vence antes aparece primero.
3. Si las fechas coinciden, desempate por ID ascendente.

Distinguir cobros (importe positivo) de pagos (importe negativo) sin perder el signo ni la naturaleza del importe.

1. **Información real:** Lista de cobros y pagos pendientes con monto, concepto y fecha de vencimiento.
2. **Prioridad 1×1:** El pendiente más urgente (vencido o más próximo), con concepto, monto y días restantes.
3. **1×1:** Título + concepto del pendiente más urgente + monto con signo + card-sub con fecha de vencimiento.
4. **1×2:** Lista de hasta 3 pendientes con monto y fecha.
5. **1×3:** Lista de hasta 6 pendientes.
6. **Sin registros:** card-sub "Sin cobros ni pagos pendientes".
7. **Sin datos:** Badge "0" o "—".

### Órdenes

**Regla de selección:** La distancia porcentual respecto al precio de disparo = (precio actual − precio de disparo) / precio de disparo × 100 indica la proximidad al disparador, pero por sí sola no determina si la orden está próxima a ejecutarse. También debe considerarse si el precio actual está del lado esperado del disparador:

- Orden de compra: se ejecuta cuando el precio actual baja hasta o por debajo del precio de disparo. Está del lado esperado cuando precio actual ≤ precio de disparo.
- Orden de venta: se ejecuta cuando el precio actual sube hasta o por encima del precio de disparo. Está del lado esperado cuando precio actual ≥ precio de disparo.

**Criterio de prioridad:** una orden que ya está del lado esperado del disparador tiene prioridad sobre una que aún no lo está, independientemente de la distancia porcentual. Entre órdenes del mismo estado (ambas del lado esperado o ambas no), se ordena por menor distancia absoluta al disparo.

**Incertidumbre (§J):** el comportamiento real del modelo y la dirección de ejecución de las órdenes de compra y venta no se han podido confirmar. Los campos `tipoLabel` y `direccionLabel` no se ha verificado que representen correctamente compra/venta. El criterio definitivo de prioridad queda pendiente de aprobación del PO.

- **Excluir del cálculo:** precios de disparo nulos, no numéricos o menores o iguales a cero.
- **Precio actual ausente:** la orden no participa en la selección de prioridad; se muestra al final si hay espacio.
- **Criterio de desempate:** misma distancia absoluta, se ordena por fecha de creación ascendente (la más antigua primero).
- **No utilizar diferencias absolutas de precio** para comparar activos distintos.
- No se introduce la clase `.critico` ni el umbral del 2%.

1. **Información real:** Órdenes pendientes con activo, precio de disparo, tipo (compra/venta) y dirección.
2. **Prioridad 1×1:** La orden pendiente con menor distancia porcentual al precio de disparo, con activo y distancia.
3. **1×1:** Título + nombre del activo + precio de disparo + card-sub con "% al disparo" o distancia.
4. **1×2:** Lista de órdenes pendientes con distancia al disparo.
5. **1×3:** **Propuesta pendiente de aprobación del PO:** si el número de órdenes pendientes supera el espacio disponible, se muestran hasta 3 con `.dashboard-list-item` y se indica "y N más…" al final. Esta indicación es informativa (texto estático, sin interacción ni navegación asociada). No se introduce scroll interno sin comprobar que encaja con el comportamiento existente. Respetar flujo, padding y dimensiones. Esta propuesta no está aprobada por el PO y no debe convertirse en requisito de implementación sin su autorización.
6. **Sin registros:** card-sub "Sin órdenes registradas".
7. **Sin datos:** Badge oculto cuando 0 (ya implementado).

### Estrategias

**Regla de selección principal:** Priorizar estrategias activas con próxima ejecución válida. Estrategias pausadas se excluyen.

**Desempate (selección principal):** cuando dos o más estrategias activas tienen exactamente la misma próxima fecha de ejecución, se ordenan por fecha de creación ascendente (la más antigua primero). Si también coincide o falta la fecha de creación, se ordenan por ID ascendente.

**Fallback (selección principal):** si ninguna estrategia activa tiene próxima ejecución válida, seleccionar la estrategia activa más recientemente creada. Si tampoco existe fecha de creación, utilizar ID ascendente.

1. **Información real:** Estrategias con nombre, activo, monto fijo y próxima ejecución.
2. **Prioridad 1×1:** La estrategia activa con próxima ejecución más cercana (o la activa más recientemente creada si ninguna tiene fecha válida), con nombre y monto.
3. **1×1:** Título + nombre de la estrategia prioritaria + monto fijo + card-sub con próxima fecha (o "Sin próxima ejecución" si no aplica).
4. **1×2:** Lista de hasta 3 estrategias con activo y próxima ejecución.
5. **1×3:** Lista de hasta 6 estrategias.
6. **Sin registros:** card-sub "Sin estrategias activas".
7. **Sin datos:** Badge "0" o "—".

### Programados

**Regla de selección:** El siguiente movimiento programado futuro (fecha posterior a hoy). Movimientos vencidos, cancelados o sin fecha válida no participan como "próximo".

**Fallback (propuesta pendiente de aprobación del PO):** Si no hay movimientos futuros, se podría mostrar el más reciente vencido como referencia histórica, identificado explícitamente como "Vencido" y nunca presentado como próximo. Esta alternativa no es un requisito aprobado y no debe convertirse en comportamiento obligatorio de implementación sin la autorización del PO.

- **Desempate:** misma fecha de ejecución, se ordena por concepto ascendente.

1. **Información real:** Movimientos programados con concepto, monto, divisa y fecha.
2. **Prioridad 1×1:** El próximo programado más cercano, con concepto y monto.
3. **1×1:** Título + concepto del próximo programado + monto + card-sub con fecha de ejecución.
4. **1×2:** Lista de hasta 3 programados.
5. **1×3:** Lista de hasta 6 programados.
6. **Sin registros:** card-sub "Sin programados".
7. **Sin datos:** Badge "0" o "—".

### Alertas

**Regla de selección:** La alerta no resuelta con mayor severidad; entre igual severidad, la más reciente. Alertas resueltas o descartadas no participan.

- **Jerarquía de severidad:** investigar si el modelo ya define una jerarquía. Si existe, documentarla y reutilizarla. Si no existe o no se puede verificar, dejar la jerarquía pendiente de definición del PO. No inventar niveles ni valores.
- **Desempate:** misma severidad y misma fecha, se ordena por ID ascendente.

1. **Información real:** Alertas con tipo, mensaje, severidad y fecha.
2. **Prioridad 1×1:** La alerta no resuelta con mayor severidad y, entre iguales, la más reciente, con mensaje corto y severidad.
3. **1×1:** Título + mensaje de la alerta prioritaria + card-sub con fecha u hora.
4. **1×2:** Lista de hasta 3 alertas con `.alerta-item` (píldora específica).
5. **1×3:** Lista de hasta 6 alertas.
6. **Sin registros:** card-sub "Sin alertas".
7. **Sin datos:** Badge "0" o "—".

---

## E. Especificación concreta por variante — tarjetas pendientes

Cada variante detalla los elementos concretos, su jerarquía y distribución. No se usan descripciones genéricas.

### E.1. Favoritos

**1×1 (Pendiente):**
- Header: título "Favoritos" + badge con cantidad total.
- Cuerpo: nombre del primer favorito del orden del usuario + monto formateado (divisa de la cuenta).
- card-sub: omitido cuando el badge ya muestra la cantidad (evitar redundancia); si se usa, mostrar información distinta (por ejemplo, divisa principal).
- Sin scroll, sin lista.
- No sumar importes de distintas divisas sin conversión válida; si no hay conversión, omitir el resumen de importes.

**1×2 (Pendiente):**
- Header: título "Favoritos" + badge.
- Cuerpo: hasta 3 items con `.dashboard-list-item` (título = nombre del favorito, detalle = divisa, valor = monto).
- card-sub opcional: solo si aporta información distinta al badge; no repetir la cantidad.

**1×3 (Pendiente):**
- Header: título "Favoritos" + badge.
- Cuerpo: hasta 6 items con `.dashboard-list-item`.
- card-sub: solo si aporta información adicional no cubierta por el badge ni la lista.

**Estado vacío:** card-sub "Sin favoritos" (sin "Tienes 0 favoritos").
**Dimensión mínima recomendada:** 1×2 para lista; 1×1 solo con resumen del principal.

### E.2. Metas

**1×1 (Pendiente):**
- Header: título "Metas de ahorro" + badge con cantidad.
- Cuerpo: nombre de la meta con fecha de cumplimiento más próxima + monto ahorrado.
- card-sub: "XX% completada · fecha objetivo" (una línea, truncada si es largo).

**1×2 (Pendiente):**
- Header: título "Metas de ahorro" + badge. El botón "Nueva meta" se deja como **propuesta pendiente de aprobación del PO**: investigar si esa interacción ya existe y corresponde a estas variantes; si no se puede confirmar, no se convierte en requisito nuevo.
- Cuerpo: hasta 3 items con `.dashboard-list-item` (título = nombre meta, detalle = progreso %, valor = monto ahorrado / objetivo).

**1×3 (Pendiente):**
- Header: título + badge. El botón "Nueva" se deja como **propuesta pendiente de aprobación del PO** (mismo criterio que 1×2).
- Cuerpo: hasta 6 items.

**Estado vacío:** card-sub "Sin metas activas".
**Dimensión mínima recomendada:** 1×2 para lista con progreso.

### E.3. Presupuestos

**1×1 (Pendiente):**
- Header: título "Presupuestos" + badge.
- Cuerpo: nombre del presupuesto con mayor % de uso válido + monto restante.
- card-sub: "XX% del presupuesto usado" (una línea, solo si calculable).

**1×2 (Pendiente):**
- Header: título "Presupuestos" + badge.
- Cuerpo: hasta 3 items con `.dashboard-list-item` (título = nombre, detalle = categoría, valor = gastado / asignado).
- Barra de progreso de gasto por item (opcional, si cabe).

**1×3 (Pendiente):**
- Header: título + badge.
- Cuerpo: hasta 6 items con barra de progreso.

**Estado vacío:** card-sub "Sin presupuestos".
**Dimensión mínima recomendada:** 1×2.

### E.4. Pendientes

**1×1 (Pendiente):**
- Header: título "Pendientes" + badge.
- Cuerpo: concepto del pendiente más urgente + monto con signo + o −.
- card-sub: fecha de vencimiento o "Vence en X días".

**1×2 (Pendiente):**
- Header: título + badge.
- Cuerpo: hasta 3 items con `.dashboard-list-item` (título = concepto, detalle = fecha, valor = monto con signo + o −).

**1×3 (Pendiente):**
- Header: título + badge.
- Cuerpo: hasta 6 items.

**Estado vacío:** card-sub "Sin cobros ni pagos pendientes".
**Dimensión mínima recomendada:** 1×2.

### E.5. Órdenes

**1×1 (Pendiente):**
- Header: título "Órdenes" + badge (oculto si 0 pendientes).
- Cuerpo: símbolo del activo + precio de disparo.
- card-sub: distancia porcentual al disparo (con signo según tipo de orden).

**1×2 (Pendiente):**
- Header: título + badge.
- Cuerpo: hasta 3 items con `.dashboard-list-item` (título = activo, detalle = tipo + dirección + distancia %, valor = precio de disparo).
- Clase `.critico` y umbral 2%: propuestas pendientes de verificación, no implementar sin confirmación.

**1×3 (Pendiente):**
- Header: título + badge.
- Cuerpo: **propuesta pendiente de aprobación del PO:** si el número de órdenes pendientes supera el espacio disponible, se muestran hasta 3 con `.dashboard-list-item` y se indica "y N más…" al final (indicación informativa, sin interacción ni navegación asociada). No se introduce scroll interno sin comprobar que encaja con el comportamiento existente. Respetar flujo, padding y dimensiones.
- card-sub con resumen "X ejecutadas, Y canceladas".

**Estado vacío:** card-sub "Sin órdenes registradas".
**Dimensión mínima recomendada:** 1×2.

### E.6. Estrategias

**1×1 (Pendiente):**
- Header: título "Estrategias" + badge.
- Cuerpo: nombre de la estrategia activa con próxima ejecución válida más cercana (o la estrategia activa más recientemente creada si ninguna tiene fecha válida) + monto fijo.
- card-sub: próxima fecha de ejecución (una línea) o "Sin próxima ejecución" si no aplica.

**1×2 (Pendiente):**
- Header: título + badge.
- Cuerpo: hasta 3 items con `.dashboard-list-item` (título = nombre estrategia, detalle = activo + próxima ejecución, valor = monto fijo).

**1×3 (Pendiente):**
- Header: título + badge.
- Cuerpo: hasta 6 items.

**Estado vacío:** card-sub "Sin estrategias activas".
**Dimensión mínima recomendada:** 1×2.

### E.7. Distribución patrimonial (`distribucion`) — según C1

**1×1 (Pendiente):**
- Header: título "Distribución patrimonial".
- Cuerpo: nombre de la categoría con mayor participación (según datos reales, no asumir categorías fijas) + porcentaje grande.
- Sin dona, sin lista completa.

**1×2 (Pendiente):**
- Header: título.
- Cuerpo: líneas de progreso para las categorías presentes en los datos con barra `.distribucion-barra` y porcentaje.
- Sin dona grande.

**1×3 (Pendiente):**
- Header: título.
- Cuerpo: dona `.distribucion-dona` + lista completa de las categorías con nombre, porcentaje y barra.

**Estado vacío:** card-sub "Sin datos de distribución".
**Dimensión mínima recomendada:** 1×1 (solo categoría mayor).

### E.8. Distribución por tipo de activo (`distribucion-activos`) — según C2

**1×1 (Pendiente):**
- Header: título "Distribución por tipo de activo".
- Cuerpo: nombre del tipo con mayor valor agregado (según datos reales, no asumir tipos fijos) + porcentaje.
- Sin dona, sin listado.

**1×2 (Pendiente):**
- Header: título.
- Cuerpo: listado de tipos activos con líneas de progreso (barras de color por tipo, según datos reales).
- Sin dona.

**1×3 (Pendiente):**
- Header: título.
- Cuerpo: dona `.distribucion-dona` + listado completo con barras y porcentajes.

**Estado vacío:** card-sub "Sin activos distribuidos".
**Dimensión mínima recomendada:** 1×1 (solo tipo mayor).

### E.9. Patrimonio por divisa (`patrimonio-divisa`) — según C3

**1×1 (Pendiente):**
- Header: título "Patrimonio por divisa".
- Cuerpo: código o nombre de la divisa con mayor participación (según datos reales, no asumir divisas fijas) + porcentaje.
- Sin dona, sin desglose completo.

**1×2 (Pendiente):**
- Header: título.
- Cuerpo: líneas de progreso por divisa existente con nombre/código y porcentaje.
- Sin dona por defecto.

**1×3 (Pendiente):**
- Header: título.
- Cuerpo: vista completa de todas las divisas con valores y porcentajes. Dona solo si aporta valor visual.

**Estado vacío:** card-sub "Sin patrimonio por divisa".
**Dimensión mínima recomendada:** 1×1 (solo divisa mayor).

### E.10. Programados

**1×1 (Pendiente):**
- Header: título "Movimientos programados" + badge.
- Cuerpo: concepto del próximo programado + monto.
- card-sub: fecha de ejecución (una línea).

**1×2 (Pendiente):**
- Header: título + badge.
- Cuerpo: hasta 3 items con `.dashboard-list-item` (título = concepto, detalle = fecha, valor = monto con divisa).

**1×3 (Pendiente):**
- Header: título + badge.
- Cuerpo: hasta 6 items.

**Estado vacío:** card-sub "Sin programados".
**Dimensión mínima recomendada:** 1×2.

### E.11. Alertas

**1×1 (Pendiente):**
- Header: título "Alertas" + badge.
- Cuerpo: mensaje de la alerta con mayor severidad (o más reciente entre iguales) truncado si es largo.
- card-sub: fecha u hora (una línea).
- Usar `.alerta-item` si cabe, de lo contrario simplificar.

**1×2 (Pendiente):**
- Header: título + badge.
- Cuerpo: hasta 3 items con `.alerta-item` (máxima coherencia visual; no forzar `.dashboard-list-item` si no encaja).

**1×3 (Pendiente):**
- Header: título + badge.
- Cuerpo: hasta 6 items con `.alerta-item`.

**Estado vacío:** card-sub "Sin alertas".
**Dimensión mínima recomendada:** 1×2.

---

## F. Cuentas y activos: planificación diferenciada (propuesta de diseño pendiente de verificación)

Esta sección presenta una **propuesta de diseño**, no una implementación aprobada. Cada composición debe verificarse contra los datos reales y la altura de 160px antes de aprobarse.

### F.1. Qué contiene realmente `.card-datos`

No se ha inspeccionado el contenido completo de `.card-datos` en las tarjetas dinámicas. Se sabe que incluye pares etiqueta/valor (divisa, fecha de alta, ciclo, por pagar, anualidad para crédito), pero no se ha verificado qué campos están siempre presentes, cuáles son opcionales y cuáles pueden estar vacíos. Esta verificación es requisito previo antes de decidir qué ocultar o mostrar en 1×1.

### F.2. Tipos de cuenta y datos esenciales

| Tipo de cuenta | Datos potencialmente disponibles | Prioridad en 1×1 (propuesta) |
|---|---|---|
| Bancaria / Ahorro | Saldo, divisa, fecha de alta | Saldo principal |
| Efectivo | Monto, divisa | Monto |
| Tarjeta de crédito | Deuda actual, límite, % uso, ciclo, pago mínimo, anualidad | Deuda actual + % uso |
| Otros (inversión, etc.) | Saldo, divisa | Saldo principal |

**Tarjetas de crédito — elementos a evaluar:**
- Deuda actual: siempre visible (valor principal).
- Límite de crédito: card-sub si cabe.
- % de utilización: barra de uso o porcentaje en card-sub.
- Ciclo de facturación y pago próximo: solo si espacio lo permite (secundario).

### F.3. Tipos de activo y datos esenciales

| Tipo de activo | Datos potencialmente disponibles | Prioridad en 1×1 (propuesta) |
|---|---|---|
| Acciones | Cantidad, precio actual, valor total, ganancia/pérdida | Valor total + rentabilidad |
| ETF | Cantidad, precio actual, valor total, ganancia/pérdida | Valor total + rentabilidad |
| Cripto | Cantidad, precio actual, valor total, ganancia/pérdida | Valor total + rentabilidad |
| Bonos | Cantidad, precio, valor total | Valor total |
| Otros | Valor total | Valor total |

**Nota:** No todos los activos tienen precio de compra o rentabilidad calculable. Si faltan precios o datos de compra, no se inventa rentabilidad; se muestra "Sin precio para valorar" o similar.

### F.4. Composición diferenciada para 1×1 (propuesta)

**Cuenta bancaria / ahorro / efectivo:**
```
┌─────────────────────────┐
│ Nombre cuenta     [activa]│
│                         │
│   S/ 1 234,56           │
│                         │
│ Saldo disponible        │
└─────────────────────────┘
```

**Tarjeta de crédito:**
```
┌─────────────────────────┐
│ Tarjeta X     [crédito]   │
│                         │
│   S/ 450,00             │
│                         │
│ Límite S/ 1 000,00 · 45% │
└─────────────────────────┘
```
(Barra de uso solo si cabe sin cortar; de lo contrario omitir.)

**Activo:**
```
┌─────────────────────────┐
│ BTC            [BTC]      │
│                         │
│   S/ 45 000,00          │
│                         │
│ +12,50% (ganancia)      │
└─────────────────────────┘
```
Si no hay precio: "Sin precio para valorar" en card-sub.

### F.5. Restricciones comunes (aprobadas)

- Tarjetas dinámicas de cuentas y activos en 1×1.
- Altura de una fila (160px).
- Sin scroll interno.
- Sin contenido cortado.
- Respeto del padding interno.
- Título e importe siempre visibles.
- `.card-datos` no se oculta universalmente sin conocer sus contenidos; se evalúa campo por campo.
- En móvil (≤599px), las cards ocupan 1 columna; el contenido debe seguir siendo legible.
- Si un dato no cabe, se omite con justificación técnica, no se reduce la fuente indiscriminadamente.
- No inventar rentabilidades cuando falten precios o datos de compra.
- Verificar que las composiciones propuestas caben realmente en 160px de altura; si no caben, documentar alternativa y justificación.

---

## G. Sistema visual compartido

### Componentes existentes reutilizables

| Componente | Uso | Ubicación CSS |
|---|---|---|
| `.dashboard-list-item` | Píldora de lista con título/detalle/valor (44px) | `css/dashboard.css:1126` |
| `.dashboard-list-info` | Contenedor de título/detalle | `css/dashboard.css:1140` |
| `.dashboard-list-title` | Título del ítem | `css/dashboard.css:1155` |
| `.dashboard-list-detail` | Detalle secundario | `css/dashboard.css:1161` |
| `.dashboard-list-value` | Valor numérico (derecha) | `css/dashboard.css:1166` |
| `.card-sub` | Texto secundario discreto | `css/dashboard.css:411` |
| `.card-value` | Valor numérico principal | `css/dashboard.css:394` |
| `.card-title` | Título de la card | `css/dashboard.css:384` |
| `.badge` | Contador pequeño en header | `css/componentes.css` |
| `.alerta-item` | Píldora de alerta específica | `css/dashboard.css:1303` |
| `.distribucion-barra` | Barra de progreso para distribución | `css/dashboard.css:1212` |

### Reglas de reutilización

1. **Pills:** Favoritos, Programados, Últimos movimientos, Estrategias, Órdenes, Pendientes y Metas usan `.dashboard-list-item` (o `.alerta-item` para Alertas) para presentar registros.
2. **Textos secundarios:** Usar `card-sub` o equivalente existente. Nunca como relleno artificial.
3. **No crear `card-lista` global:** La similitud visual no implica misma arquitectura. Cada tarjeta define su propio alcance y validación.
4. **Alertas:** Determinar si adaptar `.dashboard-list-item` o mantener `.alerta-item`, sin perder coherencia visual.

### Duplicaciones identificadas (no eliminar aún, solo documentar)

- Las clases `.favoritos-card`, `.metas-card`, `.presupuestos-card`, etc. repiten reglas de `.card-header` (flex, space-between, gap: 8px).
- Cada lista de tarjetas repite estructura: header con título+badge + lista `.scroll-fade` + `tpl-dashboard-list-item`.

---

## H. Orden individual de implementación

Implementación **tarjeta por tarjeta**, sin agrupar por tipo. Cada tarjeta tiene su propio alcance, especificación y criterios de aceptación. Cada tarjeta debe tener su propia aprobación antes de pasar a la siguiente.

### Grupo 1 — Tarjetas que requieren implementación o corrección

| Orden | Tarjeta | Variantes a trabajar | Complejidad | Dependencias |
|---|---------|---------------------|-------------|--------------|
| 1 | movimientos | 1×1 (lista individual) | Media | Datos de movimientos |
| 2 | distribucion | 1×1, 1×2 (según C1) | Media | Datos de distribución |
| 3 | distribucion-activos | 1×1, 1×2, 1×3 (según C2) | Media | Datos de activos |
| 4 | patrimonio-divisa | 1×1, 1×2, 1×3 (según C3) | Media | Datos por divisa |
| 5 | cuentas (dinámicas) | 1×1 (todos los tipos) | Alta | Datos de cuentas |
| 6 | activos (dinámicos) | 1×1 (todos los tipos) | Alta | Datos de posiciones |
| 7 | favoritos | 1×1, 1×2, 1×3 | Media | Datos de favoritos |
| 8 | metas | 1×1, 1×2, 1×3 | Media | Datos de metas |
| 9 | presupuestos | 1×1, 1×2, 1×3 | Media | Datos de presupuestos |
| 10 | pendientes | 1×1, 1×2, 1×3 | Media | Datos de pendientes |
| 11 | ordenes | 1×1, 1×2, 1×3 | Media | Datos de órdenes |
| 12 | estrategias | 1×1, 1×2, 1×3 | Media | Datos de estrategias |
| 13 | programados | 1×1, 1×2, 1×3 | Media | Datos de programados |
| 14 | alertas | 1×1, 1×2, 1×3 | Media | Datos de alertas |

**Patrimonio:** no figura en este grupo porque su variante 1×2 tiene diseño pendiente de definición y aprobación del PO (no es trabajo de implementación), y 1×3 no es dimensión permitida. 1×1 requiere verificación, no implementación.

### Grupo 2 — Tarjetas que requieren verificación adicional

| Tarjeta | Variantes a verificar | Motivo |
|---|---|---|
| inversiones | 1×1 | Tiene especificación pero no evidencia visual completa de estados vacío/error/responsive. |
| flujo-caja | 1×1 | Métrica simple con especificación; sin evidencia visual completa. |
| gastos-periodo | 1×1 | Métrica simple con especificación; sin evidencia visual completa. |
| ingresos-periodo | 1×1 | Métrica simple con especificación; sin evidencia visual completa. |
| balance-periodo | 1×1 | Métrica simple con especificación; sin evidencia visual completa. |
| deudas | 1×1 | Métrica simple con especificación; sin evidencia visual completa. |
| grafico | 2×2 | Tiene especificación; sin evidencia visual completa de estados vacío/error. |
| patrimonio | 1×1 | 1×1: el ciclo de resaltado del editor no acredita verificación completa; falta evidencia de estados carga/vacío/error, responsive y regresiones. |
| vencimientos | 1×1, 1×2, 1×3 | No existe decisión PO documentada ni especificación C1/C2/C3 que respalde las variantes. Pendiente de aprobación del diseño antes de cualquier verificación. |
| movimientos | 1×2, 1×3 | 1×2/1×3 con lista y scroll, pero sin evidencia visual completa e independiente tras las regresiones reportadas. |

### Grupo 3 — Tarjetas sin intervención pendiente

| Tarjeta | Motivo |
|---|---|
| Ninguna | Todas las tarjetas tienen al menos una variante que requiere implementación, corrección o verificación. |

**Notas:**
- Ninguna tarjeta está exenta de intervención: vencimientos y movimientos requieren verificación adicional tras las regresiones reportadas.
- `inversiones` se incluye en el grupo de verificación aunque su variante 1×1 tenga especificación, porque falta evidencia visual completa.
- Ninguna tarjeta se implementa junto a otra por compartir clases o estructura.
- Componentes compartidos (pills, card-sub) se ajustan según necesidad real de cada tarjeta, no se crean anticipadamente.

---

## I. Criterios de aceptación por tarjeta

Para considerar una tarjeta terminada en una variante, todos los siguientes puntos deben cumplirse:

1. **Contenido:** Muestra título + información específica (no solo contador o badge cuando exista dato relevante).
2. **Composición:** Ningún elemento cortado, desbordado o fuera del flujo. Respeta padding interno.
3. **Jerarquía:** Título → contenido principal → texto secundario (`card-sub`).
4. **Estados de carga:** Adaptados a la dimensión (esqueleto apropiado para 1×1, 1×2, 1×3).
5. **Estados vacíos y de error:** Comprobados visualmente; mensajes específicos, no genéricos.
6. **Estados de datos:** Contenido real, no esqueletos permanentes.
7. **Interacciones:** Identificar la acción real de cada tarjeta; no asumir que todas navegan o abren modales.
8. **Teclado y foco:** Comprobar activación con Enter/Space, foco visible cuando corresponda.
9. **No usar hover como única prueba de interacción.**
10. **Responsive:** Validar móvil y los puntos de ruptura relevantes, no solamente ≤599px.
11. **Temas:** Comprobar tema claro y oscuro.
12. **Dimensiones:** Verificar que las variantes 1×1, 1×2 y 1×3 respeten sus dimensiones declaradas.
13. **Pruebas automatizadas:** Ejecutar `npm test` y ESLint en archivos tocados.
14. **Comprobación visual independiente:** No declarar una tarjeta terminada únicamente porque `npm test` y ESLint pasen; se requiere verificación visual en navegador.

---

## J. Problemas que no se pueden resolver por falta de información

1. **Datos reales de demostración:** No se verificó visualmente el contenido real de cada tarjeta con datos de demo.
2. **Estructura exacta de `vencimientosData`, `ordenesData`, `estrategiasData`, etc.:** Se infiere del código de actualización pero no se confirmó el shape completo de cada objeto.
3. **Comportamiento real de `tarjetaVacia()`:** Se asume que muestra un mensaje específico, pero no se inspeccionó su implementación completa.
4. **Colores y tokens CSS en tema claro vs oscuro:** No se verificó visualmente el contraste en ambos temas.
5. **Altura real de 160px vs contenido de cuentas de crédito:** No se midió si la barra de uso + porcentaje caben junto al valor y detalle.
6. **Contenido real de `.card-datos`:** No se ha inspeccionado qué campos contiene realmente para cada tipo de cuenta.
7. **Jerarquía de severidad de alertas:** No se verificó si el modelo ya define una jerarquía de severidad; queda pendiente de investigación o de definición del PO.
8. **Tipo y dirección de orden en el modelo:** No se confirmó que `tipoLabel`/`direccionLabel` correspondan a compra/venta reales; queda como incertidumbre.
9. **Comportamiento de fallback de Metas:** Cuando no existen metas activas, se muestra "Sin metas activas". Cuando existen metas activas pero ninguna cumple el criterio principal de selección, el comportamiento de presentación alternativo queda pendiente de aprobación del PO.
10. **Diseño de Vencimientos:** No existe decisión PO documentada ni especificación C1/C2/C3 que respalde las variantes 1×1, 1×2 y 1×3 de Vencimientos; queda pendiente de aprobación del PO.
11. **Diseño de Patrimonio 1×2:** Pendiente de definición y aprobación del PO; no es trabajo de implementación.

---

## K. Alcance y separación

Este documento corresponde exclusivamente a la planificación de las tarjetas del Dashboard. No se mezcla con:
- Fase 9 (limpieza de archivos y documentación obsoleta).
- Fase 10 (Movimientos).
- Selección funcional de movimientos, inversiones o activos para otras operaciones.
- Mejoras generales de arquitectura.
- Nuevas funcionalidades ajenas a las tarjetas.

---

**Nota final:** Esta subfase es exclusivamente de planificación. No se ha modificado ningún archivo de implementación (JavaScript, CSS, HTML, pruebas, servicios, base de datos, preferencias). Todas las implementaciones deben esperar la aprobación del PO antes de iniciar la Subfase 2.

