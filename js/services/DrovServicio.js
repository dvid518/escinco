// ============================================
// DROV SERVICIO · CAPA DE INFRAESTRUCTURA IA
// ============================================
// Encapsula la llamada a Gemini. Por ahora hace fetch directo a la API REST
// (desarrollo local), pero la URL y la clave están separadas para que, en
// producción, solo haya que cambiar la URL a una Cloud Function o Firebase AI
// Logic sin tocar el resto del código.
//
// ⚠️ La API Key NO va hardcodeada aquí en producción. En desarrollo local se
// lee de una variable de entorno o se inyecta desde fuera del repositorio.

const GEMINI_API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent"

function obtenerApiKey() {
    // En desarrollo local, la clave puede inyectarse via variable de entorno
    // del proceso o de un archivo .env.local que NO se sube a git.
    // En producción, esta función debe delegar en una Cloud Function.
    return process.env.GEMINI_API_KEY || ""
}

/**
 * Llama a Gemini y devuelve el texto de la respuesta.
 *
 * @param {string} prompt - Prompt completo (system instruction + usuario).
 * @returns {Promise<string>} Texto de la respuesta del modelo.
 * @throws {Error} Con mensaje "CUOTA_AGOTADA" si se agotó la cuota (429).
 */
export async function llamarGemini(prompt) {
    const apiKey = obtenerApiKey()

    if (!apiKey) {
        throw new Error("Falta GEMINI_API_KEY en el entorno.")
    }

    try {
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
            const error = await respuesta.json().catch(() => ({}))
            if (respuesta.status === 429) {
                throw new Error("CUOTA_AGOTADA")
            }
            throw new Error(error.error?.message || "Error desconocido en Gemini")
        }

        const datos = await respuesta.json()
        return datos.candidates?.[0]?.content?.parts?.[0]?.text || ""
    } catch (error) {
        console.error("[DrovServicio]", error.message)
        throw error
    }
}
