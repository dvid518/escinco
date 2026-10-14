# escinco · Roadmap

- **Versión objetivo**: 1.0.0 estable
- **Estado actual**: v1.0.0-beta.5 (≈86 % del ideal)

## Fase 1 — Estabilización (desbloquea v1)

1. **Unificar Firebase** — `firebaseClient.js` importa la config desde
   `firebase/config.js`; `tema.js` usa `updateDoc` re-exportado por
   `firebase/firestore.js` (punto único de acceso; se mantiene CDN).
   - `firebase/firebaseClient.js`, `firebase/firestore.js`, `js/core/tema.js`
2. **Reactivar `orderBy` en pendientes** — el índice ya está desplegado;
   eliminar el sort manual y el comentario temporal.
   - `js/repositories/PendienteRepositorio.js`, `firebase/firestore.indexes.json`
3. **Comisión en ventas** — verificado: ya se resta del saldo recibido
   (`saldo += (cantidad × precio) − comisión`) en `MovimientoServicio.actualizarSaldos`
   para ventaActivo y p2pVenta; sin cambios adicionales.
4. **Documentación** — este `roadmap.md`, `requisitos.md` y `modelo-datos.md`.
5. **404 con marca + higiene** — página de error con los estilos de escinco;
   eliminar `firebase-debug.log` y `firestore-debug.log`.
   - `404.html`, `css/404.css`, raíz del proyecto

## Fase 2 — Funcionalidad media

| # | Tarea | Área | Prioridad |
|---|---|---|---|
| 6 | Tasa de cambio automática (modo `auto` con API + fallback manual) | `DivisaServicio`, `configuracion` | Alta |
| 7 | Módulo de órdenes (límite/stop) ligado a trades | `repositories`/`services` nuevos, trading | Media |
| 8 | Consolidar pendientes en lote (multiselección) | `ui/pendientes`, `PendienteServicio` | Media |
| 9 | Dashboard: selector de periodos (distancia entre días / 2nd timing) | `dashboard`, `graficos` | Media |
| 10 | Favoritos y metas de ahorro | nuevo modelo `metas` + sección | Media |
| 11 | Estrategias de compra (plantillas DCA / compra programada) | `formularioMovimiento`, servicio | Media |
| 12 | Renta variable (acciones/ETFs) dentro de trading/posiciones + carga de precios diarios | `ActivoRepositorio`, `HistorialServicio`, `trading` | Media |

## Fase 3 — Pulido ✅ (completada)

| # | Tarea | Área | Estado |
|---|---|---|---|
| 13 | Desduplicar CSS y cargar solo los estilos de cada página | `css/*` | Hecha |
| 14 | Probar reglas y caché (tests `reglas`, `css`, `estilos`, `cache`) | `firestore.rules`, `cache` | Hecha |

- **13a · Desduplicar**: eliminados los selectores idénticos que vivían en dos
  hojas (`.panel-header`, `.lista-vacia*`, `.config-hint` y el `#panel` de
  `inversiones.css`, que duplicaba/fijaba el layout de `navegacion.css`). El
  test `tests/css.test.mjs` impide que vuelvan.
- **13b · CSS por página**: `dashboard.html` solo enlaza las hojas del armazón
  (`style`, `componentes`, `navegacion`, `configuracion`, `modal`, `pendientes`,
  `iconos`). Las de cada página las inyecta `js/core/estilos.js` al importar su
  módulo (`js/pages/*.js`), y están en el precache. El test
  `tests/estilos.test.mjs` lo vigila.
- **14a · Reglas**: `tests/reglas.test.mjs` valida offline los invariantes de
  `firestore.rules` (hasOnly en create, paridad create/update, `esPropietario`
  en toda operación, `snapshots` sin `hasOnly` en update). El smoke con
  emulador (`tests/rules.test.mjs`, `npm run test:rules`) queda opcional: se
  salta si no hay Firestore/Auth emulando. `test-cache.html` se retiró.
- **14b · Caché**: `tests/cache.test.mjs` cubre TTL, dedupe en vuelo,
  `invalidar`/`invalidarPrefijo`/`limpiar`, `parchear` y estadísticas.

## Modo demo ✅

La demo (`/demo/<página>`, servida por `tester.html`) reutiliza el armazón, el
router y las páginas reales; solo se cambia la capa de datos por `localStorage`:

- `tester.html`: mismo shell que `dashboard.html` + banner + `<base href="/">`
  + un `<script type="importmap">` que redirige el SDK de Firebase a mocks.
- `firebase/demo/{app,auth,firestore}.js`: mocks del subconjunto de la API que
  usa la app (sin tiempo real ni transacciones).
- `firebase/demo/store.js`: "Firestore falso" plano por ruta (`escinco_demo_db_v1`).
- `js/demo/fixture.js`: datos de ejemplo completos; `js/demo/demo.js`: arranque.
- `js/core/router.js` antepone `/demo` a las rutas cuando `window.__ESCINCO_DEMO__`.
- El demo antiguo (`js/pages/tester.js`, `css/tester.css`) se retiró.

## Orden de ejecución

Fase 1 completa en una sesión (1→2→3→5 en bloque; 4 en paralelo). Luego
6, 8, 9 (rápidas), y 7/11/12 como paquete de inversiones. Ninguna tarea borra
datos; `EliminarServicio` ya exige confirmación doble.