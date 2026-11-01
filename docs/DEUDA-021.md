# DEUDA-021 — Sin CI / lint / typecheck

**Estado:** Documentado (no corregido en esta sesión)  
**Archivo:** `package.json` — sin `devDependencies` ni script de lint

## Resumen

El proyecto no tiene integración continua ni linter. Esto permite que regresiones silenciosas (variables no usadas, imports muertos, funciones async sin `await`, uso de `Function` constructor en tests) lleguen a producción sin ser detectadas.

## Qué se hizo en esta sesión

1. **`.github/workflows/ci.yml`** — Workflow de GitHub Actions que corre en `push` a `main` y en `pull_request`:
   - Checkout del código
   - Setup Node 20 con caché de npm
   - `npm ci` (instala dependencias)
   - `npm test` (suite completa de tests estáticos)
   - `npm run lint` (ESLint con reglas de corrección)

2. **`package.json`** — Añadido:
   - `"type": "module"`
   - `devDependencies.eslint` (última estable)
   - `devDependencies.globals` (para globals de browser/node en ESLint 9)
   - Script `"lint": "eslint ."`

3. **`eslint.config.js`** — Configuración flat de ESLint 9 con:
   - `ignores`: `node_modules/`, `dist/`, `coverage/`, `tests/fixtures/`, `*.md`
   - `languageOptions`: `ecmaVersion: latest`, `sourceType: module`, globals de browser y node
   - Reglas de corrección (no estilo de formateo): `no-console` (solo `error` permitido), `no-eval`, `no-new-func`, `no-undef`, `require-await`, `no-unused-vars`, `prefer-const`, `no-var`, `radix`, `yoda`, y ~40 reglas más de `eslint:recommended`

4. **`docs/CI.md`** — Documentación del workflow y cómo ejecutarlo localmente

## Qué queda pendiente (deuda documentada)

`npm run lint` encuentra **~7600 errores preexistentes** en el código actual. La inmensa mayoría son:

| Categoría | Ejemplo | Archivos afectados |
|-----------|---------|-------------------|
| `no-console` | `console.log` / `console.warn` en código y tests | 35+ archivos JS |
| `require-await` | Funciones `async` sin expresión `await` | Repositorios, servicios, tests |
| `no-new-func` | `new Function(...)` en tests para extraer funciones | `tests/favoritoServicio.test.mjs`, `tests/bug029.test.mjs`, `tests/reglas.test.mjs` |
| `no-unused-vars` | Imports o variables no usadas | `js/pages/inversiones.js`, `js/models/Presupuesto.js`, tests |
| `prefer-const` | `let` que nunca se reasigna | Varios archivos |
| `no-shadow` | Variable en scope interno sombrea externa | `js/pages/cuentas.js`, `js/pages/dashboard.js` |
| `no-use-before-define` | Variable usada antes de su declaración | `js/pages/movimientos.js`, `js/ui/modal.js` |
| `radix` | `parseInt` sin base | `js/pages/cuentas.js` |

## Plan de corrección (post-beta)

1. Ejecutar `npm run lint -- --fix` para autocorregir ~465 errores (prefer-const, no-var, etc.)
2. Revisar manualmente los errores restantes en archivos JS propios (no tests)
3. Dejar los tests con `// eslint-disable` en líneas específicas si es necesario, o corregir gradualmente
4. Considerar subir `no-console` a `warn` en lugar de `error` para reducir ruido en desarrollo

## Cómo ejecutar localmente

```bash
# Instalar dependencias (incluye eslint y globals)
npm install

# Ejecutar tests
npm test

# Ejecutar lint
npm run lint

# Autocorregir errores de estilo que --fix soporta
npm run lint -- --fix
```
