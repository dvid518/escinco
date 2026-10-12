# Plan · Escala de la interfaz (zoom 90%)

> Estado: **planificado, NO implementado**. Decisión del usuario, confirmada en
> la sesión 1.0.0-beta.27: no tocar el CSS todavía — el `zoom` en un contenedor
> con capas `position: fixed` (modales, notificaciones, lastbar) necesita QA
> visual en navegador antes de activarse, y si se activa debe ser con el
> control en 100% por defecto para no cambiar la app a nadie sin pedirlo.

## Objetivo

Que toda la interfaz se vea como si el navegador estuviera al **90% de zoom**,
de forma consistente y sin romper `position: fixed`, sin depender del zoom del
navegador.

## Restricciones detectadas

- El CSS es **100% px**: no hay `rem` ni `em` en la mayoría de medidas y **no
  existe `box-sizing: border-box` global**. Por eso cambiar el `font-size` del
  `:root` **no escala** el layout.
- El shell usa `height: 100vh` + `body { overflow: hidden }`, con capas
  `position: fixed`: topnav, lastbar, modales (`.modal-overlay`), notificaciones
  (`.notificaciones-container`).
- `transform: scale()` **rompería** el posicionamiento de las capas `fixed` y
  obligaría a compensar tamaños a mano. **Descartado.**

## Opciones evaluadas

| Opción | Cómo | Pros | Contras | Veredicto |
|---|---|---|---|---|
| A. `zoom` CSS | `zoom: 0.9` en un contenedor raíz | Escala layout y paint; mantiene `fixed`; una sola regla | El elemento con `zoom` no llena el viewport (hay que compensar ancho/alto); `svg`/`viewBox` y unidades de viewport requieren QA | **Recomendado** |
| B. `transform: scale` | Wrapper con escala y compensación | — | Rompe `fixed`; hay que recalcular hit-testing/scroll | Descartado |
| C. Reducir px componente a componente | Reescribir medidas | Control total | Enorme, frágil, se desactualiza | Descartado |
| D. Bajar `font-size` raíz | `html { font-size: 90% }` | — | No hay medidas relativas: **no hace nada** | Descartado |

## Diseño propuesto (Opción A)

1. Variable única en `:root`:
   ```css
   :root { --ui-scale: 0.9; }
   ```
2. Aplicar `zoom` en el contenedor raíz del HTML (no en `html`/`body` para no
   pixelar el propio viewport) y **compensar** las dimensiones para que siga
   ocupando el 100%:
   ```css
   #app-root {
       zoom: var(--ui-scale);
       width: calc(100% / var(--ui-scale));
       height: calc(100dvh / var(--ui-scale));
   }
   ```
   Requiere envolver (`wrapper`) el contenido: topnav + main + footer, o aplicar
   `zoom` a `body` y compensar `body { width: calc(100% / var(--ui-scale)) }`.
3. Las capas `position: fixed` que viven fuera del wrapper (`#lastbar`,
   `.notificaciones-container`, `.modal-overlay`) deben decidirse una por una:
   - Mantenerlas **dentro** del contenedor con `zoom` (heredan la escala) y
     verificar que su `fixed` sigue cubriendo el viewport.
   - O dejarlas **fuera** del `zoom` y escalar su tipografía a mano (más trabajo).
4. Control de usuario en **Configuración → Apariencia**: `Escala: 90% · 100% ·
   110%` que setea `document.documentElement.style.setProperty("--ui-scale", …)`
   y persiste en las preferencias (`sesion.getPreferencias()`).

## QA necesario antes de tocar (checklist)

- [ ] Top nav y lastbar: cubren el ancho/alto completos, sin franja sobrante.
- [ ] Modales: centrado correcto con `zoom` en el overlay.
- [ ] Notificaciones: posición `top` correcta.
- [ ] Sidebar: scroll y glow (`::after`) sin recortes.
- [ ] `canvas` del gráfico (inversiones): nitidez y tamaño de ejes.
- [ ] Iconos SVG: sin deformación (usar `vector-effect`/tamaños si hace falta).
- [ ] Landing (`index.html`) y `tester.html`/demo: coherencia si se aplica a
      todo el sitio.
- [ ] Móvil: media queries en px vs `zoom` (puede doble-escalar).

## Preguntas abiertas para la próxima ronda

1. ¿Aplicar a **todo el sitio** (landing incluida) o solo dentro de la app?
2. ¿Valor por defecto 90% fijo o **configurable** por el usuario (recomendado)?
3. ¿Se acepta envolver el shell en un `#app-root` para compensar dimensiones?
