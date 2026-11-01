// ============================================
// CONFIGURACIÓN DEL ASISTENTE IA
// ============================================
// Integración con Google AI Studio (Gemini API).
//
// La clave NO vive en el cliente. El navegador llama al proxy local
// (`tools/servir-local.mjs`), que lee `GEMINI_API_KEY` de `.env.local` y añade
// la cabecera al hablar con Gemini. Así el JavaScript publicado no contiene
// ningún secreto.
//
// ⚠️ Esto vale para desarrollo local. Al desplegar, `/api/ia` tiene que ser una
// Cloud Function o Firebase AI Logic: el hosting estático no ejecuta el proxy.

export const IA_CONFIG = {
    // Rutas del proxy. En producción deben apuntar a la función/backend.
    rutaProxy: "/api/ia",
    rutaEstado: "/api/ia/estado",

    // Modelo de Gemini. El alias "gemini-flash-latest" apunta hoy a modelos que
    // tardan más de 45 s en responder; "gemini-3.5-flash" responde en ~2 s.
    modelo: "gemini-3.5-flash",

    endpoint: "https://generativelanguage.googleapis.com/v1beta",

    // Límites del cliente (no son cuotas de la API).
    tiempoMaximoMs: 45000,
    maxMensajesHistorial: 20,
    maxCaracteresMensaje: 2000
}
