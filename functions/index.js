const { onRequest } = require("firebase-functions/v2/https")
const { defineSecret } = require("firebase-functions/params")

// Secreto que se configura con: firebase functions:secrets:set GEMINI_API_KEY
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY")

// firebase-admin es opcional en este repo (no esta instalado por defecto). Si
// esta disponible, se usa para verificar el ID token de Firebase y el token de
// App Check. Si no (entorno de desarrollo sin instalar), se valida el formato
// del JWT y se acepta por best-effort, pero siempre se exige la cabecera
// Authorization: Bearer.
let admin
try {
    admin = require("firebase-admin")
    if (!admin.apps.length) {
        admin.initializeApp()
    }
} catch {
    admin = null
}

/**
 * Limite de peticiones del proxy por usuario y minuto. Evita que un mismo uid
 * agote la cuota de Gemini enviando peticiones en bucle.
 */
const LIMITE_POR_MINUTO = 60
const rateLimit = new Map() // uid -> { cuenta, ventanaInicio }

function verificarRateLimit(uid) {
    const ahora = Date.now()
    let entrada = rateLimit.get(uid)
    if (!entrada || ahora - entrada.ventanaInicio > 60 * 1000) {
        entrada = { cuenta: 0, ventanaInicio: ahora }
        rateLimit.set(uid, entrada)
    }
    if (entrada.cuenta >= LIMITE_POR_MINUTO) return false
    entrada.cuenta++
    return true
}

/**
 * Longitud maxima de prompt permitida. Evita prompts enormes que consuman
 * cuota innecesaria.
 */
const MAX_PROMPT_LONGITUD = 2000

/**
 * Verifica la cabecera Authorization: Bearer <Firebase ID token>.
 * Devuelve el uid del token o null si no es valido.
 */
async function verificarAutorizacion(req, adminInst) {
    const authHeader = req.get("Authorization") || req.headers.authorization
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null
    }
    const token = authHeader.slice("Bearer ".length)
    if (!token) return null

    if (adminInst) {
        try {
            const decoded = await adminInst.auth().verifyIdToken(token)
            return decoded.uid || null
        } catch {
            return null
        }
    }

    // Sin firebase-admin: aceptar solo por formato JWT (best-effort, desarrollo).
    // Se extrae el uid del payload decodificado para el rate limit.
    const partes = token.split(".")
    if (partes.length !== 3) return null
    let payload
    try {
        payload = JSON.parse(
            Buffer.from(partes[1], "base64url").toString("utf8")
        )
    } catch {
        return null
    }
    return payload.uid || payload.sub || null
}

/**
 * Verifica el token de App Check (cabecera X-Firebase-AppCheck) cuando
 * firebase-admin esta disponible. En desarrollo sin admin solo se informa.
 */
async function verificarAppCheck(req, adminInst) {
    const appCheckToken = req.get("X-Firebase-AppCheck") || req.headers["x-firebase-appcheck"]
    if (!appCheckToken) {
        // No bloquear si no se envia: App Check se activa progresivamente.
        return true
    }
    if (adminInst) {
        try {
            await adminInst.appCheck().verifyToken(appCheckToken)
            return true
        } catch {
            return false
        }
    }
    return true
}

/**
 * Cloud Function drovProxy.
 *
 * Actua como intermediario entre el cliente y la API de Gemini para que la
 * API Key nunca viaje al navegador. En produccion, la clave vive en Secret
 * Manager y solo la funcion tiene acceso a ella.
 *
 * Endpoint: POST https://<region>-<project>.cloudfunctions.net/drovProxy
 * Body: { "prompt": "..." }
 * Cabeceras: Authorization: Bearer <Firebase ID token>
 *            X-Firebase-AppCheck: <token de App Check>
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
            return res.status(405).json({ error: "Metodo no permitido" })
        }

        // Autenticacion obligatoria: sin token valido, 401.
        const uid = await verificarAutorizacion(req, admin)
        if (!uid) {
            return res.status(401).json({ error: "No autenticado" })
        }

        // App Check (si esta configurado).
        if (!(await verificarAppCheck(req, admin))) {
            return res.status(401).json({ error: "App Check invalido" })
        }

        // Rate limit por uid: evita agotar la cuota de Gemini.
        if (!verificarRateLimit(uid)) {
            return res.status(429).json({ error: "Demasiadas peticiones" })
        }

        const { prompt } = req.body || {}
        if (!prompt || typeof prompt !== "string") {
            return res.status(400).json({ error: "Falta el prompt" })
        }

        // Limitar el tamano del prompt y los tokens de salida.
        if (prompt.length > MAX_PROMPT_LONGITUD) {
            return res.status(400).json({ error: "Prompt demasiado largo" })
        }

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY.value()}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.6,
                            maxOutputTokens: 4096,
                            thinkingConfig: { thinkingBudget: 0 },
                        },
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
