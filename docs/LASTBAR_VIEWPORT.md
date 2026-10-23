# LASTBAR_VIEWPORT — escinco

**Proyecto:** escinco (app financiera web)
**Fecha:** 2026-10-23
**Estado:** Implementado y verificado (tests OK)

---

## 1. Causa del problema

La barra inferior (`lastbar`) se ocultaba o se mostraba de forma inconsistente según el navegador por tres causas:

1. **`100vh` en móvil:** En Safari iOS y Chrome/Edge Android, `100vh` se calcula con la barra de direcciones oculta. Cuando la barra de direcciones se muestra, el área visible es menor que `100vh`, dejando el contenido inferior (lastbar) fuera del área visible o cubierto.

2. **Safe area de iOS:** iOS Safari tiene una barra flotante inferior (indicador de inicio) que cubre elementos con `position: fixed; bottom: 0` si no se usa `env(safe-area-inset-bottom)`. Sin `viewport-fit=cover`, `env(safe-area-inset-bottom)` no funciona en iOS.

3. **Modo por defecto "hide":** El modo por defecto de la lastbar era `"hide"` (auto-hide: los botones aparecen al pasar el mouse), lo que en móviles sin hover hacía que los ítems quedaran colapsados a 12px.

---

## 2. Cambios aplicados

### 2.1 Viewport meta (`viewport-fit=cover`)

**Archivos modificados (9):**
- `index.html`, `dashboard.html`, `demo.html`, `auth.html`
- `404.html`, `eliminar-datos.html`, `privacidad.html`, `terminos.html`, `reset-password.html`

**Cambio:** Se añadió `viewport-fit=cover` al meta viewport:

```html
<meta name='viewport' content='width=device-width, initial-scale=1, viewport-fit=cover'>
```

Esto habilita el uso de `env(safe-area-inset-bottom)` en iOS Safari.

### 2.2 Altura del contenedor raíz (`100dvh` + fallback)

**Archivo:** `css/style.css` (línea ~198, selector `body`)

**Cambio:**

```css
body {
    display: flex;
    flex-direction: column;
    height: 100vh;   /* fallback navegadores antiguos */
    height: 100dvh;  /* navegadores modernos: excluye barras de UI del navegador */
    overflow: hidden;
    ...
}
```

`100dvh` (dynamic viewport height) se ajusta dinámicamente cuando se muestran u ocultan las barras de direcciones/navegación del navegador móvil, evitando que el contenido inferior quede fuera del área visible. Se mantiene `100vh` como fallback para navegadores antiguos que no soportan `dvh`.

El layout usa `display: flex; flex-direction: column` en `body`, con `main { flex: 1 }` y `footer { flex-shrink: 0 }`, por lo que el footer (que contiene la lastbar) siempre queda al final del área visible.

### 2.3 Safe area en lastbar

**Archivo:** `css/navegacion.css` (selector `.lastbar`, línea ~402)

**Cambio:** Se añadió `padding-bottom: env(safe-area-inset-bottom, 0px);`:

```css
.lastbar {
    display: flex;
    justify-content: center;
    gap: 10px;
    width: fit-content;
    padding: 0 50px;
    height: 50px;
    padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

Esto empuja la lastbar hacia arriba en iOS para que no quede cubierta por el indicador de inicio. En navegadores que no soportan `env()`, el valor por defecto es `0px`.

**Nota:** La lastbar **no usa `position: fixed`**; está dentro del `<footer id="app-footer">`, que forma parte del flujo del documento (flex column). Esto evita problemas de posición fija cubierta por barras del navegador. El footer tiene `flex-shrink: 0` y `position: relative`.

### 2.4 Modo por defecto de lastbar: `"show"`

**Archivos modificados:**
- `js/ui/configuracion.js` (línea 20): `let lastbarModo = "show"`
- `js/core/router.js` (línea 376): `const modo = localStorage.getItem("escinco_lastbar_mode") || "show"`

El valor por defecto cambió de `"hide"` a `"show"`. Esto significa que, salvo que el usuario haya guardado explícitamente `"hide"` en localStorage, la lastbar arranca en modo "siempre visible" (ítems a 40px, siempre visibles). La preferencia del usuario se respeta si ya existe en localStorage.

### 2.5 Sin cambios de diseño visual

No se modificaron colores, iconos, orden ni tamaño de los ítems de la lastbar. El diseño visual se preserva exactamente.

---

## 3. Verificación por navegador

| Navegador | Qué verificar | Resultado esperado |
|-----------|--------------|-------------------|
| **Safari iOS** | Lastbar visible en la parte inferior, sin quedar cubierta por el indicador de inicio ni por la barra de direcciones al hacer scroll | Lastbar visible con `env(safe-area-inset-bottom)` aplicado; `viewport-fit=cover` habilita safe area |
| **Chrome Android** | Lastbar visible, sin quedar cubierta por la barra de navegación inferior de Chrome ni por la barra de direcciones | `100dvh` ajusta la altura cuando aparecen/desaparecen las barras de Chrome |
| **Edge Android** | Same as Chrome Android | `100dvh` ajusta la altura correctamente |
| **Escritorio** | Lastbar visible en la parte inferior | `100vh` fallback funciona correctamente |

**Cómo verificar manualmente:**
1. Abrir la app en un dispositivo móvil o en el modo responsive de las herramientas de desarrollador.
2. Hacer scroll hacia abajo: la lastbar debe permanecer visible en la parte inferior, sin quedar cortada.
3. En Safari iOS: rotar el dispositivo y volver; la lastbar debe seguir visible.
4. En Chrome/Edge Android: mostrar y ocultar la barra de direcciones (hacer scroll hacia arriba/abajo); la lastbar debe ajustarse.

---

## 4. Reglas que NO ocultan la lastbar

Se buscó en todo el proyecto (CSS y JS) cualquier regla que oculte la lastbar según viewport, orientación o navegador:

- **CSS:** No hay media queries que pongan `display: none` o `visibility: hidden` en `.lastbar`. Las media queries existentes (`@media (max-width: 768px)` y `@media (max-width: 420px)`) solo ajustan tamaños y espaciado, nunca ocultan la barra.
- **JS:** No hay detección de User Agent ni clases condicionales que oculten la lastbar por navegador.
- **HTML:** No hay atributos `hidden` ni `style="display: none"` en el elemento lastbar.

**Conclusión:** No se eliminó ninguna regla porque no existe ninguna que oculte la lastbar por navegador/viewport.

---

## 5. Usos de `100vh` en el proyecto (reportados, no todos cambiados)

| Archivo | Línea | Uso | ¿Afecta layout raíz/lastbar? |
|---------|-------|-----|------------------------------|
| `css/style.css` | 198 | `body { height: 100vh }` | ✅ Sí — cambiado a `100vh` + `100dvh` |
| `css/index.css` | 9 | `.login-section { min-height: 100vh }` | No — solo página de login |
| `css/home.css` | 22 | `.home-scroll { height: 100vh }` | No — solo landing pública |
| `css/cuentas.css` | 93 | `max-height: calc(100vh - 200px)` | No — componente interno de cuentas |
| `css/configuracion.css` | 221 | `max-height: calc(100vh - 220px)` | No — componente interno de configuración |

Solo se cambió el del layout raíz (`body` en `style.css`), que es el que envuelve a lastbar. Los demás son específicos de páginas/componentes y no afectan al contenedor raíz ni a la lastbar.

---

## 6. Tests

**Nuevo test:** `tests/viewport.test.mjs` (11 verificaciones)

Verifica:
1. Los 9 archivos HTML incluyen `viewport-fit=cover` en el meta viewport.
2. `css/navegacion.css`: `.lastbar` usa `env(safe-area-inset-bottom`.
3. `css/style.css`: `body` usa `100vh` + `100dvh`.

**Ejecución:** `npm test` (o `node tests/run.mjs`)

Resultado: **TODO OK** (todos los tests pasan, incluido el nuevo).

---

## 7. Limitaciones conocidas

- **iOS 26:** No se dispone de información sobre cambios en iOS 26 que puedan afectar `100dvh` o `env(safe-area-inset-bottom)`. Si Apple cambia el comportamiento de safe area o dynamic viewport en versiones futuras, podría ser necesario revisar.
- **Navegadores muy antiguos:** Los que no soporten `100dvh` caerán al fallback `100vh`, lo cual puede causar que la lastbar quede ligeramente desajustada en aquellos casos específicos cuando las barras del navegador se muestran/ocultan.
- **Preferencia de usuario guardada:** Si un usuario había seleccionado previamente `"hide"` en localStorage, su preferencia se respeta y la lastbar arrancará en modo auto-hide. Solo el valor por defecto (usuarios nuevos o sin localStorage) es `"show"`.
- **JS `visualViewport`:** No se implementó ajuste con `visualViewport` en JavaScript porque no fue imprescindible; `100dvh` + `viewport-fit=cover` + `env(safe-area-inset-bottom)` resuelven el problema de forma declarativa en CSS.

---

## 8. Criterio de cierre (verificado)

- ✅ `viewport-fit=cover` presente en las 9 plantillas HTML.
- ✅ Contenedor raíz (`body`) con `100dvh` + fallback `100vh`.
- ✅ `lastbar` con `env(safe-area-inset-bottom)` (no usa `position: fixed`).
- ✅ Ninguna regla que oculte lastbar por navegador/viewport.
- ✅ `docs/LASTBAR_VIEWPORT.md` creado con verificación por navegador.
- ✅ Tests pasando (`npm test` → TODO OK).

---

**Fin del documento.**