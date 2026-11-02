# Análisis de viabilidad — Integración de librería de Drag & Drop en escinco

Estado: solo análisis, sin modificaciones de código.
Fecha: 01/11/2026

---

## 1. Estado actual del drag & drop

### 1.1 Dónde está desactivado

En `js/pages/dashboard.js`:

- **Línea 958**: `card.draggable = false` — para la card de Patrimonio (siempre fija).
- **Línea 961**: `card.draggable = true` — solo durante el modo edición, para cards que no sean Patrimonio.
- **Línea 979**: `card.draggable = false` — al desactivar el modo edición (`desactivarEdicionCardsDashboard`).

Conclusión: el drag & drop nativo solo está **habilitado temporalmente mientras está activo el modo edición**, y se desactiva al salir de ese modo. La card de Patrimonio nunca es arrastrable.

### 1.2 Funciones del drag & drop nativo existentes

| Función | Línea | Qué hace |
|---|---|---|
| `posicionDeInsercion(evento)` | 753 | Calcula el índice de inserción en un layout multi-column. Agrupa cards por columna (misma coordenada `left`), ordena columnas de izquierda a derecha y, dentro de la columna elegida, ordena por `top`. Devuelve un índice plano de 0 a n. |
| `marcarDestinoInsercion(evento)` | 835 | Pinta una línea de inserción (`dashboard-card-insercion`) entre dos cards para indicar dónde caerá la card arrastrada. Descarta posiciones antes de Patrimonio. |
| `insertarCardDashboard(idOrigen, posicion)` | 885 | Mueve una card dentro del array `cardsOrdenDashboard` (el orden fuente de verdad). Traduce el índice de "cards visibles" a "cardsOrdenDashboard". |
| `configurarEventosReordenamientoDashboard()` | 985 | Conecta los eventos nativos `dragstart`, `dragover`, `drop`, `dragend` al contenedor `.dashboard`. |
| `prepararEdicionCardsDashboard()` | 954 | Activa `draggable = true` en las cards (excepto Patrimonio) y añade el handle de arrastre (ícono grip). |
| `desactivarEdicionCardsDashboard()` | 977 | Pone `draggable = false` en todas las cards y limpia clases de arrastre. |
| `cardsVisiblesEnOrden()` | (helper) | Devuelve las cards visibles ordenadas según `cardsOrdenDashboard` filtrado por las visibles. |

### 1.3 Problemas del drag & drop nativo con el layout multi-column

El dashboard usa **CSS Multi-column** (`css/dashboard.css`, líneas 6-21):

```css
.dashboard {
    display: block;
    column-width: 260px;
    column-gap: var(--gap-card);
    ...
}
.dashboard > * {
    break-inside: avoid;
    display: flex;
    flex-direction: column;
    ...
}
```

Problemas identificados:

1. **Orden column-major vs DOM**: CSS Multi-column rellena las columnas de arriba a abajo, columna por columna. El orden del DOM no coincide necesariamente con el orden visual de lectura (que es column-major). El código nativo compensa esto agrupando por `left` y ordenando por `top` dentro de cada columna (líneas 760-831), lo cual es frágil y difícil de mantener.

2. **Cálculo de posición por filas**: `posicionDeInsercion` hace cálculos manuales de `getBoundingClientRect()`, agrupamiento por `left`, ordenación por `top`, y traducción de índice de columna a índice plano. Es propenso a errores cuando las cards tienen alturas diferentes o cuando el viewport cambia.

3. **Línea de inserción rígida**: `marcarDestinoInsercion` pinta una línea estática basada en el cálculo manual de posición. No hay retroalimentación visual fluida durante el arrastre.

4. **Soporte táctil limitado**: La API nativa de Drag & Drop (`dragstart`, `dragover`, `drop`) no funciona bien en dispositivos móviles/tablets (no hay eventos de toque nativos para Drag & Drop).

---

## 2. Viabilidad de integrar SortableJS

### 2.1 Cómo incluir SortableJS sin npm ni empaquetador

El proyecto usa **ES Modules** (`"type": "module"` en `package.json`) y no tiene dependencias de npm. Las opciones son:

| Opción | Descripción | Viabilidad |
|---|---|---|
| **A. CDN** | `<script src="https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js"></script>` en `dashboard.html` | **Alta**. El CSP de Firebase permite `'unsafe-inline'` y dominios específicos. Sería necesario añadir `https://cdn.jsdelivr.net` al `script-src` del CSP en `firebase.json`. |
| **B. Autoalojado** | Descargar `Sortable.min.js` a `js/lib/sortable.min.js` e importar con `import()` o `<script type="module">` | **Alta**. Ya existe la carpeta `js/lib/` con caché a largo plazo (`firebase.json`, líneas 94-98). Se puede importar como módulo ES si se usa la versión ESM de SortableJS. |
| **C. Importmap** | No hay `importmap` configurado en el proyecto. Tendría que añadirse. | **Media**. Requeriría crear un archivo de importmap y cargarlo en `dashboard.html`. No está alineado con la arquitectura actual. |

**Recomendación**: Opción B (autoalojado en `js/lib/`), ya que el proyecto ya tiene esa carpeta configurada con caché inmutable y no depende de servicios externos.

### 2.2 Compatibilidad con CSP de Firebase Hosting

El CSP actual (en `firebase.json`, líneas 53 y 151):

```
script-src 'self' 'unsafe-inline' https://www.gstatic.com https://www.googletagmanager.com https://www.google-analytics.com https://identitytoolkit.googleapis.com;
```

- **SortableJS autoalojado**: Se sirve desde `'self'`, así que no requiere cambios en el CSP.
- **SortableJS por CDN**: Requeriría añadir el dominio del CDN (ej. `https://cdn.jsdelivr.net`) al `script-src`.
- **`unsafe-eval`**: No es necesario. SortableJS no usa `eval()` ni `new Function()` en su versión estándar.
- **`unsafe-inline`**: Ya está permitido, pero se recomienda evitarlo para scripts externos.

Conclusión: **SortableJS autoalojado es totalmente compatible con el CSP actual sin modificaciones.**

### 2.3 Soporte táctil en móviles/tablets

SortableJS **sí soporta touch de forma nativa**. Incluye controladores para eventos táctiles (`touchstart`, `touchmove`, `touchend`) y detecta automáticamente el dispositivo. No requiere plugins adicionales para funcionalidad básica de drag & drop táctil.

---

## 3. Compatibilidad con el layout multi-column

### 3.1 ¿SortableJS funciona con CSS Multi-column?

**No de forma óptima.** SortableJS está diseñado para trabajar con contenedores donde los hijos son elementos directos en un flujo lineal (flex, grid, o block simple). Con CSS Multi-column (`column-width`), los elementos se distribuyen automáticamente en columnas por el navegador, y el orden del DOM no refleja el orden visual.

Problemas específicos:

- El orden visual en multi-column es **column-major** (se llena la primera columna de arriba abajo, luego la segunda, etc.).
- El orden del DOM es **filo de lectura** (elemento 1, elemento 2, elemento 3... en el HTML).
- SortableJS reordena elementos moviéndolos en el DOM. Con multi-column, mover un elemento del DOM al final podría hacerlo aparecer al final de la **última** columna, no en la posición visual esperada.

### 3.2 Pregunta clave: ¿orden visual reflejado en el DOM?

**No.** Con CSS Multi-column, el orden del DOM no coincide con el orden visual. SortableJS operaría sobre el orden del DOM, no sobre el orden visual de las columnas.

**Requerimiento:** Para que SortableJS funcione correctamente, habría que cambiar el layout de `.dashboard` de `column-width` a `display: flex` con `flex-wrap: wrap` o `display: grid`. Esto es un cambio significativo que afecta todo el diseño responsivo del dashboard.

---

## 4. Impacto en el código existente

### 4.1 Funciones a eliminar o adaptar

| Función | Acción | Razón |
|---|---|---|
| `posicionDeInsercion()` | **Eliminar** | SortableJS calcula la posición de inserción internamente. |
| `marcarDestinoInsercion()` | **Eliminar** | SortableJS muestra su propia línea de placeholder/ghost. |
| `insertarCardDashboard()` | **Adaptar** | La lógica de splicear en `cardsOrdenDashboard` se movería al evento `onEnd` de SortableJS. |
| `configurarEventosReordenamientoDashboard()` | **Eliminar** | Los eventos nativos de Drag & Drop se reemplazarían por la API de SortableJS. |
| `prepararEdicionCardsDashboard()` | **Adaptar** | Ya no necesitaría setear `draggable = true` manualmente ni añadir el handle de grip (SortableJS lo gestiona con su propia clase). |
| `desactivarEdicionCardsDashboard()` | **Adaptar** | Se usaría `sortable.destroy()` o `sortable.option('disabled', true)`. |
| `card.draggable = false/true` | **Eliminar** | SortableJS gestiona el atributo `draggable` internamente. |

### 4.2 Pregunta clave: ¿reemplazo total o conjunto?

**Reemplazo total para la interacción visual.** SortableJS manejaría el drag visual, el placeholder, el ghost y el reordenamiento del DOM. Las funciones existentes para **persistir el orden en Firestore** (`guardarPreferenciasDashboard`, `cardsOrdenDashboard`) se mantendrían, pero se llamarían desde el evento `onEnd` de SortableJS en lugar de desde los eventos nativos de Drag & Drop.

---

## 5. Persistencia del orden en Firestore

### 5.1 Integración con `cardsOrdenDashboard`

SortableJS tiene el evento **`onEnd`** que se dispara cuando se suelta una card. Proporciona:

- `evt.from`: contenedor origen
- `evt.to`: contenedor destino
- `evt.item`: elemento arrastrado
- `evt.oldIndex`: índice anterior
- `evt.newIndex`: nuevo índice

Flujo propuesto:

1. Usuario suelta la card → `onEnd` se dispara.
2. Se lee el nuevo orden del DOM (los hijos de `.dashboard` en su nuevo orden).
3. Se actualiza `cardsOrdenDashboard` según ese orden.
4. Se llama a `guardarPreferenciasDashboard({ orden: cardsOrdenDashboard })` para persistir en Firestore.

Esto es **manual** (SortableJS no guarda automáticamente en Firestore), pero el evento `onEnd` es el punto de integración natural.

---

## 6. Accesibilidad y fallback

### 6.1 Soporte de teclado

SortableJS **no soporta navegación por teclado de forma nativa** para el reordenamiento. No hay eventos de teclado para mover elementos con flechas.

**Fallback necesario:** Mantener los botones de "subir/bajar" (↑/↓) que ya existan o se añadan como alternativa accesible. Estos llamarían a la misma lógica de `insertarCardDashboard` para persistir en Firestore.

### 6.2 `prefers-reduced-motion`

SortableJS **no respeta automáticamente** `prefers-reduced-motion`. Tendría que desactivarse la animación manualmente en el modo de edición o usar CSS para anular las transiciones cuando el usuario prefiera menos movimiento.

```css
@media (prefers-reduced-motion: reduce) {
    .sortable-ghost,
    .sortable-chosen {
        transition: none !important;
        animation: none !important;
    }
}
```

---

## 7. Alternativas a SortableJS

| Librería | Tamaño | ESM nativo | Touch | Multi-column | Teclado | CSP-friendly | Recomendación |
|---|---|---|---|---|---|---|---|
| **SortableJS** | ~40KB | Sí (v1.15+) | Sí nativo | Problemas | No | Sí (autoalojado) | **Recomendada** |
| **Dragee** | ~5KB | Sí | Sí | Problemas | No | Sí | Alternativa ligera |
| **Dragula** | ~10KB | No (UMD/CommonJS) | Sí | Problemas | No | Sí (pero sin ESM nativo) | Menos ideal (no es ESM) |
| **Sortable (vanilla)** | N/A | N/A | No | N/A | No | N/A | No aplica |

**Recomendación:** **SortableJS** es la mejor opción por su madurez, soporte táctil nativo, disponibilidad en ESM, y comunidad activa. Dragee es una alternativa más ligera si el tamaño es una preocupación crítica.

---

## 8. Plan de integración propuesto

### 8.1 Archivos a modificar

| Archivo | Cambio |
|---|---|
| `js/lib/sortable.min.js` | **Nuevo**: librería SortableJS (versión ESM o UDM adaptada). |
| `js/pages/dashboard.js` | Eliminar `posicionDeInsercion`, `marcarDestinoInsercion`, `configurarEventosReordenamientoDashboard`. Adaptar `prepararEdicionCardsDashboard` y `desactivarEdicionCardsDashboard` para usar SortableJS. Añadir inicialización de Sortable en `onEnd` para persistir en Firestore. |
| `css/dashboard.css` | Cambiar `.dashboard` de `column-width` a `display: flex` con `flex-wrap: wrap` (o `grid`). Ajustar `.dashboard > *` en consecuencia. |
| `firebase.json` | No requiere cambios si SortableJS se aloja en `js/lib/`. |
| `dashboard.html` | No requiere cambios si se importa por JS. |

### 8.2 Funciones a eliminar

1. `posicionDeInsercion(evento)` — línea 753
2. `marcarDestinoInsercion(evento)` — línea 835
3. `configurarEventosReordenamientoDashboard()` — línea 985 (y sus listeners de `dragstart`, `dragover`, `drop`, `dragend`)
4. `insertarCardDashboard(idOrigen, posicion)` — línea 885 (su lógica se mueve al `onEnd` de SortableJS)

### 8.3 Funciones a adaptar

1. `prepararEdicionCardsDashboard()` — quitar `card.draggable = true` y el handle de grip manual; inicializar SortableJS en su lugar.
2. `desactivarEdicionCardsDashboard()` — llamar a `sortable.destroy()` o deshabilitar Sortable.
3. `actualizarUI()` o el flujo de carga — inicializar SortableJS después de montar las cards.

### 8.4 Cómo cargar la librería

Opción recomendada (autoalojado):

```js
// js/pages/dashboard.js
import Sortable from '../lib/sortable.min.js';
```

O si se prefiere cargar dinámicamente:

```js
const Sortable = (await import('../lib/sortable.min.js')).default;
```

### 8.5 Cómo persistir el orden en Firestore

```js
const sortable = new Sortable(document.querySelector('.dashboard'), {
    animation: 150,
    ghostClass: 'dashboard-card-arrastrando',
    chosenClass: 'dashboard-card-elegido',
    dragClass: 'dashboard-card-dragging',
    onEnd: (evt) => {
        const nuevoOrden = Array.from(document.querySelectorAll('.dashboard [data-dashboard-card]'))
            .map(card => card.dataset.dashboardCard)
            .filter(id => id !== 'patrimonio'); // Patrimonio siempre primero y fijo
        cardsOrdenDashboard = ['patrimonio', ...nuevoOrden];
        await guardarPreferenciasDashboard({ orden: cardsOrdenDashboard });
        reordenarDashboard(true);
    },
    // Deshabilitar en móviles si se prefiere el orden táctil nativo
    // fallbackOnBody: true,
    // scroll: true,
});
```

### 8.6 Verificación

- **Tests**: Ejecutar `npm test` (debe quedar TODO OK).
- **Visual**: Verificar que las cards se puedan arrastrar en modo edición, que aparezca el placeholder, que el orden se mantenga al recargar, y que Patrimonio no sea arrastrable.
- **Táctil**: Probar en un dispositivo móvil o emulador de Chrome DevTools.
- **Accesibilidad**: Verificar que los botones de subir/bajar (fallback por teclado) sigan funcionando.
- **Reduced motion**: Verificar que no haya animaciones cuando `prefers-reduced-motion: reduce` está activo.

### 8.7 Riesgos identificados

| Riesgo | Severidad | Mitigación |
|---|---|---|
| **Cambio de layout multi-column a flex/grid** puede romper el diseño responsivo existente (cards de altura variable, columnas desiguales). | Alta | Probar exhaustivamente en distintos tamaños de pantalla. Considerar mantener multi-column y usar SortableJS con `forceFallback: true` (arrastre por el handle en lugar de la card completa). |
| **Orden del DOM vs orden visual** con multi-column. | Alta | Cambiar a flex/grid es casi obligatorio para consistencia. |
| **SortableJS no respeta `prefers-reduced-motion`**. | Media | Añadir CSS personalizado para desactivar animaciones en modo reducido. |
| **Falta de soporte de teclado** en SortableJS. | Media | Mantener botones de subir/bajar como fallback accesible. |
| **CSP bloquea CDN** si se elige la opción de CDN sin modificar `firebase.json`. | Baja | Usar autoalojado en `js/lib/` (no requiere cambios en CSP). |
| **Tamaño de librería** (~40KB) en una aplicación sin bundler. | Baja | Aceptable dado que se sirve con caché inmutable (`js/lib/`). |

---

## Conclusión

**SortableJS es viable** para reemplazar el drag & drop nativo en escinco, pero requiere:

1. Cambiar el layout de `.dashboard` de CSS Multi-column a Flexbox o Grid (cambio significativo de CSS).
2. Eliminar ~4 funciones nativas de cálculo de posición.
3. Añadir la librería autoalojada en `js/lib/`.
4. Integrar el evento `onEnd` con `guardarPreferenciasDashboard`.

El mayor desafío es el cambio de layout, no la integración de la librería en sí.
