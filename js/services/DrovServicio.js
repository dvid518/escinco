// ============================================
// DROV SERVICIO · CAPA DE INFRAESTRUCTURA IA
// ============================================
// Encapsula la llamada a Gemini. Tanto en desarrollo local como en producción
// la llamada se hace a través de un proxy que lee la clave de GEMINI_API_KEY
// sin exponerla al navegador:
//   · Desarrollo local: POST a /api/ia (tools/servir-local.mjs), que lee la
//     clave de .env.local o de la variable de entorno.
//   · Producción: POST a la Cloud Function drovProxy, que lee la clave de
//     Secret Manager.
//
// Para cambiar el backend en el futuro, solo hay que modificar la URL del
// proxy en DROV_PROXY_URL.

const DROV_PROXY_URL =
    "https://us-central1-cinco-96064.cloudfunctions.net/drovProxy"

function esLocalhost() {
    const host = typeof location !== "undefined" ? location.hostname : ""
    return host === "localhost" || host === "127.0.0.1"
}

/**
 * Llama al asistente drov y devuelve el texto de la respuesta.
 *
 * En desarrollo local: POST a /api/ia (proxy local que lee GEMINI_API_KEY
 * de .env.local o del entorno).
 * En producción: POST a la Cloud Function drovProxy.
 *
 * @param {string} prompt - Prompt completo (system instruction + usuario).
 * @returns {Promise<string>} Texto de la respuesta del modelo.
 * @throws {Error} Con mensaje "CUOTA_AGOTADA" si se agotó la cuota (429).
 */
export async function llamarGemini(prompt) {
    const local = esLocalhost()

    try {
        const url = local
            ? "/api/ia"
            : DROV_PROXY_URL

        const respuesta = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ prompt })
        })

        if (!respuesta.ok) {
            if (respuesta.status === 429) {
                throw new Error("CUOTA_AGOTADA")
            }
            const error = await respuesta.json().catch(() => ({}))
            throw new Error(error.error || "Error en el servidor de IA")
        }

        const datos = await respuesta.json()
        return datos.texto || ""
    } catch (error) {
        console.error("[drovServicio]", error.message)
        throw error
    }
}
