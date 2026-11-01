// ============================================
// DROV SERVICIO · CAPA DE INFRAESTRUCTURA IA
// ============================================
// Encapsula la llamada a Gemini. En desarrollo local (localhost) hace fetch
// directo a la API REST con la clave de un archivo local. En producción
// (Firebase Hosting) llama a la Cloud Function drovProxy, que lee la clave
// de Secret Manager y nunca la expone al cliente.
//
// Para cambiar el backend en el futuro, solo hay que modificar la URL del
// proxy en DROV_PROXY_URL.

const GEMINI_API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent"

const DROV_PROXY_URL =
    "https://us-central1-cinco-96064.cloudfunctions.net/drovProxy"

function esLocalhost() {
    const host = typeof location !== "undefined" ? location.hostname : ""
    return host === "localhost" || host === "127.0.0.1"
}

function obtenerApiKeyLocal() {
    // En desarrollo local, la clave puede venir de una variable de entorno
    // inyectada al servidor (process.env.GEMINI_API_KEY) o de un archivo
    // config.local.js que NO se sube al repositorio.
    if (typeof process !== "undefined" && process.env.GEMINI_API_KEY) {
        return process.env.GEMINI_API_KEY
    }
    return window.__DROV_API_KEY__ || ""
}

/**
 * Llama a Gemini y devuelve el texto de la respuesta.
 *
 * En desarrollo local: fetch directo a Gemini con clave local.
 * En producción: POST a la Cloud Function drovProxy.
 *
 * @param {string} prompt - Prompt completo (system instruction + usuario).
 * @returns {Promise<string>} Texto de la respuesta del modelo.
 * @throws {Error} Con mensaje "CUOTA_AGOTADA" si se agotó la cuota (429).
 */
export async function llamarGemini(prompt) {
    const local = esLocalhost()

    try {
        if (local) {
            const apiKey = obtenerApiKeyLocal()
            if (!apiKey) {
                throw new Error(
                    "Falta GEMINI_API_KEY para desarrollo local. Defínela en .env.local o como window.__DROV_API_KEY__."
                )
            }
            const respuesta = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            })

            if (!respuesta.ok) {
                if (respuesta.status === 429) {
                    throw new Error("CUOTA_AGOTADA")
                }
                const error = await respuesta.json().catch(() => ({}))
                throw new Error(error.error?.message || "Error desconocido en Gemini")
            }

            const datos = await respuesta.json()
            return datos.candidates?.[0]?.content?.parts?.[0]?.text || ""
        }

        // Producción: llamar a la Cloud Function proxy
        const respuesta = await fetch(DROV_PROXY_URL, {
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
