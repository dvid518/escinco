# ARQUITECTURA ACTUAL DE ESCINCO

## 2.1 Stack Tecnológico

| Capa | Tecnología | Detalles |
|------|------------|----------|
| **Frontend** | ES Modules (native) | No bundler, no compile step. `type: "module"` en package.json |
| **UI Library** | Ninguna (CSS custom) | Estilos propios en `css/`, templates en HTML |
| **Backend/BD** | Firebase | Auth, Firestore, Hosting, Cloud Functions (drov proxy) |
| **IA** | Google Gemini API | `GEMINI_API_KEY`, proxy en Cloud Function `drovProxy` |
| **Service Worker** | `sw.js` | Estrategias de cache por tipo de recurso |
| **CSS** | Variables CSS custom | `:root`, `[data-theme="dark"]`, `[data-theme="light"]` |

## 2.2 Estructura del Repositorio

```
escinco/
├── AGENTS.md                      ← Reglas para agentes OpenCode
├── DISENO.md                      ← Sistema diseño (tokens, convenciones)
├── package.json                   ← Dependencies, scripts (lint, test, build)
├── firebase/                      ← Configuración Firebase
│   ├── firebase.json              ← Hosting + redirects + rules
│   ├── firestore.rules            ← Reglas de seguridad Firestore
│   ├── firestore.indexes.json     ← Índices compuestos
│   └── config.js                    ← Firebase config (public)
├── constants/                     ← Valores constantes globales
│   ├── version.js                 ← Versionamiento (1.0.0-beta.34)
│   ├── divisas.js                 ← Monedas soportadas (PEN, USD, USDT, EUR)
│   └── tiposMovimiento.js         ← Tipos de movimiento y CONFIG_MOVIMIENTOS
├── .firebaserc                    ← Alias de proyectos Firebase
├── .gitignore                     ← Patrones gitignore
├── js/                            ← Código fuente principal
│   ├── core/                      ← Funciones puras, utilidades
│   │   ├── movimientos.js         ← esMovimientoPositivo, montoDeMovimiento
│   │   ├── cache.js               ← cacheCapa (memoria + localStorage)
│   │   ├── tema.js                ← Tema oscuro/claro/sistema
│   │   ├── fechas.js              ← Utilidades de fecha
│   │   ├── iconos.js              ← Iconos SVG
│   │   └── router.js              ← Enrutamiento SPA
│   ├── services/                  ← Lógica de negocio
│   │   ├── MovimientoServicio.js  ← Operaciones atómicas, saldos
│   │   ├── DivisaServicio.js      ← Formateo, conversión de divisa
│   │   ├── AuthServicio.js        ← Autenticación
│   │   ├── SnapshotServicio.js    ← Snapshots patrimoniales
│   │   ├── CreditoServicio.js     ← Cálculo de créditos
│   │   └── ... (19 servicios total)
│   ├── repositories/              ← Acceso a datos Firestore
│   │   ├── MovimientoRepositorio.js
│   │   ├── CuentaRepositorio.js
│   │   ├── MetaRepositorio.js
│   │   ├── PendienteRepositorio.js
│   │   ├── PosicionRepositorio.js
│   │   ├── PrecioRepositorio.js
│   │   ├── PresupuestoRepositorio.js
│   │   ├── TradeRepositorio.js
│   │   ├── FavoritoRepositorio.js
│   │   ├── ActivoRepositorio.js
│   │   └── SnapshotRepositorio.js
│   ├── models/                    ← Clases de datos con validación
│   │   ├── Movimiento.js
│   │   ├── Meta.js
│   │   ├── Pendiente.js
│   │   ├── Trade.js
│   │   ├── Activo.js
│   │   ├── Favorito.js
│   │   └── Presupuesto.js
│   ├── ui/                        ← Componentes de presentación
│   │   ├── modal.js               ← Modales reutilizables (templates HTML)
│   │   ├── notificaciones.js      ← Centro de notificaciones
│   │   ├── graficos.js            ← Chart.js visualización
│   │   ├── metas.js               ← UI de metas
│   │   ├── presupuestos.js        ← UI de presupuestos
│   │   ├── configuracion.js       ← Preferencias UI
│   │   ├── accionesLista.js       ← Lista de acciones
│   │   ├── seleccion.js           ← Selección de items
│   │   ├── scrollEdges.js         ← Manejo de scroll edges
│   │   ├── doodles.js             ← Animaciones decorativas
│   │   └── ...
│   ├── pages/                     ← Orquestación por página
│   │   ├── dashboard.js           ← 4461 líneas (Dios object - objetivo ETAPA 9)
│   │   ├── cuentas.js             ← 2398 líneas
│   │   ├── movimientos.js         ← 1905 líneas
│   │   ├── inversiones.js         ← 1292 líneas
│   │   ├── trading.js             ← Trading UI
│   │   ├── configuracion.js       ← 1594 líneas
│   │   ├── auth.js                ← Autenticación página
│   │   └── ...
│   ├── core/app.js                ← Punto de entrada app
│   └── core/lastbar.js            ← Barra de navegación inferior
├── css/                           ← Estilos
│   ├── style.css                  ← Tokens globales, :root variables
│   ├── componentes.css            ← Clases reutilizables (.btn, .card, .badge)
│   ├── dashboard.css              ← Estilos página dashboard
│   ├── modal.css                  ← Estilos modales
│   └── ... (18 archivos CSS)
├── docs/                          ← Documentación histórica
│   ├── ESTADO_Y_PROPUESTA.md      ← Diagnóstico actual más completo
│   ├── deuda-tecnica.md           ← 27 ítems deuda técnica
│   ├── pendientes.md              ← 9 pendientes accionables
│   └── ... (15 archivos más)
├── tests/                         ← Suite tests (113 tests, 108 passing)
│   ├── helpers.mjs                ← nuevoReporter, extraerFuncion
│   ├── dashboard.test.mjs
│   ├── modelo.test.mjs
│   └── ... (29 suites)
├── graphify-out/                  ← Análisis arquitectónico generado
│   └── GRAPH_REPORT.md            ← 2865 nodos, 8096 edges, 124 communities
├── tools/                         ← Herramientas de ayuda
│   ├── generar-build.mjs          ← Genera BUILD_ID
│   └── servir-local.mjs           ← Servidor local
├── sw.js                          ← Service Worker con estrategias de cache
├── manifest.webmanifest           ← Configuración PWA
├── index.html                     ← Landing page
├── dashboard.html                 ← Plantilla dashboard
├── demo.html                      ← Plantilla demo
└── scripts/                       ← Módulos pendientes (5 tests fallan por estos)
```

## 2.3 Responsabilidades por Capa

| Capa | Responsabilidad | Limitaciones |
|------|----------------|--------------|
| **pages** | Coordinación de flujos de página, orquestación de datos + UI | No contener lógica de negocio pura |
| **ui** | Componentes, interacción, presentación | No tener lógica de negocio ni acceso a datos |
| **services** | Lógica de negocio, operaciones Firestore | No depender de DOM, CSS classes |
| **repositories** | Acceso y persistencia de datos | No tener lógica de negocio, solo CRUD + normalización |
| **models** | Representación de datos, validación | No tener dependencias Firestore directas |
| **core** | Funciones puras, utilidades matemáticas, formateo | No dependir de Firestore, DOM, window |
| **firebase** | Configuración e integración con servicios Firebase | No contener lógica de negocio |

## 2.4 Flujos de Ejecución y Datos

### Flujo de Registro de Movimiento

1. **UI**: Usuario completa formulario en `js/pages/movimientos.js` o `js/pages/cuentas.js`
2. **Validación**: `validarCamposMovimiento` en firestore.rules + validación en servicio
3. **Persistencia**: `firebase/firestore.js` → `addDoc()` en colección `movimientos`
4. **Cache**: `cacheCapa.parchear()` actualiza caché en memoria + localStorage
5. **Saldos**: `MovimientoServicio.js` actualiza saldos/deudas en cuentas via batch
6. **Notificación**: `publicarNotificacion()` opcional dependiendo del flujo

### Flujo de Carga de Cuentas

1. **Página**: `js/pages/cuentas.js` llama a `obtenerCuentas(uid)`
2. **Cache**: `cacheCapa.obtener()` revisa memoria y localStorage primero
3. **Firestore**: Si caché expirado o vacío, `getDocs()` en colección `usuarios/{uid}/cuentas`
4. **Normalización**: `resolverNombresCuentas()` desde `js/core/familiaCuentas.js`
5. **Formato**: Aplicar `formatoDivisa` preferencia del usuario
6. **Render**: UI actualizada con los datos formateados

### Flujo de Tema (Tema Oscuro/Claro)

1. **Local**: `tema.js` `getTemaLocal()` → `localStorage`
2. **Aplicar**: `aplicarTema()` → `document.documentElement.setAttribute("data-theme", ...)`
3. **Sincronizar**: `sincronizarTemaFirestore()` → Firestore si hay uid
4. **Sistema**: `prefers-color-scheme` media query como fallback

## 2.5 Persistencia

| Tipo | Almacenamiento | TTL / Comportamiento |
|------|---------------|----------------------|
| **Caché memoria** | `Map` en `js/core/cache.js` | TTL default 5 min, deducción de peticiones concurrentes |
| **Caché localStorage** | `localStorage` prefijado con `escinco_cache:` | Sobrevive recargas y cambio de pestaña, persiste entre sesiones |
| **Firestore** | `usuarios/{uid}/{colección}/{doc}` | Datos estructurados, reglas de seguridad, timestamps |
| **Service Worker** | `CacheStorage` del navegador | Estrategias por tipo: JS/CSS red-first, fuentes cache-first, icons SWR |

## 2.6 Integraciones

- **Firebase Auth**: Autenticación de usuarios con email/y proveedores
- **Firebase Firestore**: Base de datos NoSQL estructurada por usuario
- **Firebase Hosting**: Despliegue de la app web (SPA)
- **Google Gemini API**: IA transversal (`drov`), acceso desde Cloud Function `drovProxy`
- **Chart.js**: Visualización de gráficos (versión local `js/lib/chart.umd.min.js`)

## 2.7 Dependencias de Importación (Dirección)

```
Capa superior                          Capa inferior
Pages  ←→  Services  ←→  Repositories  ←→  Firestore
   ↑               ↑               ↑               ↑
Core (solo lectura)  Utilidades       Constantes     Lint/Tests
```

**Reglas estrictas:**
1. **Pages** pueden importar: Services, Core (lectura), Constants
2. **Services** pueden importar: Repositorios, Core (lectura), Constants
3. **Repositorios** pueden importar: Core (solo funciones puras), Constants
4. **Core** NO puede importar: Pages, Services, Repositorios
5. **UI** puede importar: Core (solo funciones puras), Components itself

**Prohibido**: importar `firebase/firestore.js` directamente en páginas o core. Siempre través del punto único en `js/services/` o `js/repositories/`.

## 2.8 Problemas Estructurales Identificados

1. **`dashboard.js` (4461 líneas)**: "Dios object" que concentra orquestación, datos, rendering y eventos. Objetivo de la ETAPA 9 es split en 3 módulos.
2. **5 ciclos de importación**: Todos giran alrededor de `js/ui/notificaciones.js`. Patrones detectados: 2-file, 3-file, 4-file, 5-file cycles.
3. **`cacheCapa` es nodo de alta betweenness**: Conecta múltiples comunidades (ActivoRepositorio, OrdenRepositorio, dashboard.js, ui/etiquetas.js, firebase/firestore.js, etc.)
4. **18 exports sin llamador** (DEUDA-006): ~600 líneas muertas en 13 archivos
5. **218 `console.*` sin limpiar** (DEUDA-010): Ruido que entierra errores importantes

## 2.9 Métricas de Calidad Actual

| Métrica | Valor | Referencia |
|---------|-------|------------|
| Tests passing | 108/113 | `npm test` |
| Lint errors | 13 | `npm run lint`, 7 auto-correctibles |
| God nodes (Graphify) | `contenidoDesdeTemplate()` (160 edges), `mostrarNotificacion()` (128 edges), `abrirModal()` (101 edges) | `graphify-out/GRAPH_REPORT.md` |
| Import cycles | 5 (todos por notificaciones.js) | Graphify analysis |
| Communities | 124 | Graphify analysis |
| Cohesión modular | Baja-moderada (0.03-0.07 en módulos débiles) | Graphify analysis |