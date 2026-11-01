const { onRequest } = require("firebase-functions/v2/https")
const { defineSecret } = require("firebase-functions/params")

// Secreto que se configura con: firebase functions:secrets:set GEMINI_API_KEY
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY")

/**
 * Cloud Function drovProxy.
 *
 * Actúa como intermediario entre el cliente y la API de Gemini para que la
 * API Key nunca viaje al navegador. En producción, la clave vive en Secret
 * Manager y solo la función tiene acceso a ella.
 *
 * Endpoint: POST https://<region>-<project>.cloudfunctions.net/drovProxy
 * Body: { "prompt": "..." }
 * Respuesta: { "texto": "..." } o { "error": "..." }
 */
exports.drovProxy = onRequest(
    {
        secrets: [GEMINI_API_KEY],
        cors: true,
        timeoutSeconds: 60,
    },
    async (req, res) => {
        // Solo permitir peticiones POST
        if (req.method !== "POST") {
            res.set("Allow", "POST")
            return res.status(405).json({ error: "Método no permitido" })
        }

        const { prompt } = req.body || {}
        if (!prompt || typeof prompt !== "string") {
            return res.status(400).json({ error: "Falta el prompt" })
        }

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY.value()}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                    }),
                }
            )

            if (!response.ok) {
                if (response.status === 429) {
                    return res.status(429).json({ error: "CUOTA_AGOTADA" })
                }
                const error = await response.json().catch(() => ({}))
                return res.status(response.status).json({
                    error: error.error?.message || "Error en Gemini",
                })
            }

            const data = await response.json()
            const texto =
                data.candidates?.[0]?.content?.parts?.[0]?.text || ""
            return res.status(200).json({ texto })
        } catch (error) {
            console.error("Error en drovProxy:", error)
            return res.status(500).json({ error: "Error interno" })
        }
    }
)
