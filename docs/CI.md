# CI — Integración continua de escinco

## Qué hace el workflow

El archivo `.github/workflows/ci.yml` se ejecuta en:
- **Push** a la rama `main`
- **Pull request** hacia `main`

Pasos del workflow:

| Paso | Qué hace |
|------|----------|
| Checkout | Descarga el código del repositorio |
| Setup Node | Instala Node 20 con caché de npm |
| Install dependencies | `npm ci` (instala dependencias desde `package-lock.json`) |
| Run tests | `npm test` — ejecuta las 30 suites de tests estáticos |
| Run lint | `npm run lint` — ejecuta ESLint con reglas de corrección |

Si cualquier paso falla, el workflow termina con error y el PR no debería merguearse.

## Cómo ejecutar localmente

### Prerrequisitos

Node.js 20 o superior.

### Instalar dependencias

```bash
npm install
```

Esto instala `eslint`, `globals` y crea `package-lock.json`.

### Ejecutar tests

```bash
npm test
```

Ejecuta todas las suites de `tests/`. Debe mostrar `TODO OK` y salir con código 0.

### Ejecutar lint

```bash
npm run lint
```

Ejecuta ESLint sobre todos los archivos `.js` y `.mjs` del proyecto (excepto `node_modules/`, `dist/`, `coverage/`, `tests/fixtures/`, `*.md`).

### Autocorregir errores de estilo

```bash
npm run lint -- --fix
```

Corrige automáticamente ~465 errores de reglas que soportan `--fix` (principalmente `prefer-const`, `no-var`, `vars-on-top`).

## Reglas de lint aplicadas

Se usan reglas de **corrección** (no de estilo de formateo). Algunas reglas clave:

| Regla | Qué detecta |
|-------|-------------|
| `no-console` | `console.log` / `info` / `debug` (solo `warn` y `error` están permitidos) |
| `no-eval` / `no-implied-eval` / `no-new-func` | Uso de `eval()` o `new Function()` |
| `no-undef` | Variables globales no definidas |
| `no-unused-vars` | Variables o imports no usados |
| `prefer-const` | `let` que nunca se reasigna |
| `no-var` | Uso de `var` en lugar de `let`/`const` |
| `require-await` | Funciones `async` sin expresión `await` |
| `radix` | `parseInt` sin base |
| `yoda` | Comparaciones tipo `if ("valor" === x)` en lugar de `if (x === "valor")` |
| `no-shadow` | Variable en scope interno que sombrea externa |
| `no-use-before-define` | Variable usada antes de ser declarada |

## Deuda pendiente

`npm run lint` encuentra ~7600 errores preexistentes (ver `docs/DEUDA-021.md`). La mayoría están en tests y código legacy. El workflow de CI fallará hasta que se corrijan o se añadan excepciones. Se recomienda:

1. Ejecutar `npm run lint -- --fix` para autocorregir ~465 errores
2. Corregir gradualmente los errores restantes en archivos JS propios
3. No agregar `--max-warnings` ni deshabilitar reglas para ocultar la deuda
