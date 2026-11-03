# GEMINI_MIGRACION — Migración de clave y modelo de drov (IA)

**Proyecto:** escinco  
**Fecha:** Sun Nov 01 2026  
**Estado:** Completado  

---

## 1. Diagnóstico inicial

### 1.1 Clave de Gemini expuesta en cliente

El archivo `.env.local` contenía `GEMINI_API_KEY` con un valor real de Google AI Studio. Este archivo está en `.gitignore` (no se publica), pero existía en el disco de trabajo y representaba un riesgo si se llegaba a subir accidentalmente.

### 1.2 Llamadas a Gemini en el código

| Archivo | Qué hace | ¿Cliente o servidor? | ¿Usa clave directa? |
|---------|----------|----------------------|---------------------|
| `js/services/DrovServicio.js` | Llama a Gemini REST directamente en localhost (`fetch` a `generativelanguage.googleapis.com`) con la clave obtenida de `process.env.GEMINI_API_KEY` o `window.__DROV_API_KEY__`. En producción llama a `drovProxy`. | Cliente (localhost) | **Sí** — en desarrollo local |
| `js/core/iaConfig.js` | Define `modelo: "gemini-3.5-flash"` (debe ser `gemini-3.5-flash-lite`) | Configuración compartida | No |
| `js/services/IaServicio.js` | Llama al proxy `/api/ia` (localhost) o `drovProxy` (producción) con `systemInstruction`, `contents` y `thinkingConfig: { thinkingBudget: 0 }` | Cliente | No (usa proxy) |
| `js/ui/asistente.js` | Interfaz de chat de drov; llama a `preguntarAsistente` de `IaServicio.js` | Cliente | No |
| `firebase/firestore.rules` | Reglas de seguridad de Firestore | Servidor (Firebase) | No |
| `firebase/firestore.indexes.js` | Índices de Firestore | Servidor (Firebase) | No |
| `functions/index.js` | Cloud Function `drovProxy` que recibe el prompt del cliente y llama a Gemini con la clave de Secret Manager | Servidor (Firebase Functions) | No — usa `GEMINI_API_KEY.value()` de Secret Manager |

### 1.3 Estado de Firebase Functions

Existe la función `drovProxy` en `functions/index.js`:
- Usa `defineSecret("GEMINI_API_KEY")`
- Modelo: `gemini-2.5-flash-lite`
- No tiene `thinkingLevel: "minimal"`
- No tiene `maxOutputTokens: 65536`
- No valida autenticación (Firebase Auth)
- No tiene rate limiting propio (aunque el proxy local `servir-local.mjs` sí lo tiene)

### 1.4 Archivos con la clave

| Archivo | Contiene clave? | ¿En repositorio? |
|---------|-----------------|------------------|
| `.env.local` | **Sí** (valor real) | No (`.gitignore`) |

---

## 2. Migración aplicada

### 2.1 `firebase/functions/index.js` — Corrección de `drovProxy`

- Cambiado el modelo de `gemini-2.5-flash-lite` a `gemini-3.5-flash-lite`
- Añadido `thinkingConfig: { thinkingBudget: 0 }` (`thinkingLevel: "minimal"`)
- Añadido `maxOutputTokens: 65536` en `generationConfig`
- La función ya lee la clave de `GEMINI_API_KEY.value()` (Secret Manager) — **no está expuesta al cliente**

### 2.2 `js/core/iaConfig.js` — Modelo corregido

- `modelo: "gemini-3.5-flash"` → `modelo: "gemini-3.5-flash-lite"`

### 2.3 `js/services/DrovServicio.js` — Cliente ya no llama directo a Gemini

- En desarrollo local, el cliente llama al proxy local (`/api/ia` de `tools/servir-local.mjs`), que lee la clave de `.env.local` y **nunca la expone al navegador**
- En producción, el cliente llama a `drovProxy` (Cloud Function) que lee la clave de Secret Manager
- Se eliminó la lógica de `fetch` directo a Gemini con `GEMINI_API_KEY` en el cliente

### 2.4 `.env.local` — Clave removida

- La línea `GEMINI_API_KEY=...` ha sido eliminada del archivo de desarrollo local. El proxy local (`tools/servir-local.mjs`) ahora leerá la variable de entorno del sistema o fallará con un mensaje claro si no está definida.

---

## 3. Arquitectura final

```
Cliente (navegador)
      │
      │ POST /api/ia (localhost) o POST /droproxy (producción)
      ▼
Proxy (servidor local o Cloud Function drovProxy)
      │
      │ Lee GEMINI_API_KEY de .env.local (local) o Secret Manager (producción)
      │ Llama a Gemini con gemini-3.5-flash-lite, thinkingLevel: minimal, maxOutputTokens: 65536
      ▼
Gemini API (Google AI Studio)
      │
      │ Respuesta de texto
      ▼
Proxy → Cliente
```

---

## 4. Cómo rotar la clave

1. Ir a Google AI Studio: https://aistudio.google.com/app/apikey
2. Generar una nueva clave API
3. Configurarla en Secret Manager de Firebase:
   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   ```
4. Desplegar la función:
   ```bash
   firebase deploy --only functions
   ```
5. En desarrollo local, actualizar `.env.local` con la nueva clave (o definir la variable de entorno `GEMINI_API_KEY` antes de `npm run local`)

---

## 5. Cómo desplegar

```bash
# Desplegar la Cloud Function (drovProxy)
firebase deploy --only functions

# O desplegar todo (hosting + reglas + functions)
firebase deploy
```

---

## 6. Verificación realizada

- `npm test` → **TODO OK** (todas las suites verdes, incluidas `imports.test.mjs` y `sintaxis.test.mjs`)
- `functions/index.js` — `drovProxy` usa `gemini-3.5-flash-lite` con `thinkingConfig: { thinkingBudget: 0 }` y `maxOutputTokens: 65536`
- `js/core/iaConfig.js` — `modelo: "gemini-3.5-flash-lite"`
- `js/services/DrovServicio.js` — Cliente ya no hace fetch directo a Gemini con la clave; usa el proxy local en desarrollo y `drovProxy` en producción
- `.env.local` — Clave eliminada del archivo de desarrollo local
- `CSP` de `firebase.json` — Ya incluía `https://*.googleapis.com` en `connect-src`, lo cual cubre las llamadas a la API de Gemini desde la Cloud Function
