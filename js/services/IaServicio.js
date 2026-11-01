import { IA_CONFIG } from "../core/iaConfig.js"

// ============================================
// ASISTENTE IA · GEMINI API (Google AI Studio)
// ============================================
// Llamada directa por REST para no añadir dependencias ni pasos de build.
// El historial se manda tal cual: el servicio no guarda estado.

const PROMPT_BASE = `Eres drov, el asistente integrado de escinco, una aplicación de finanzas personales en español.

Ayudas al usuario a entender y usar la app: dashboard, cuentas, movimientos, presupuestos, metas, pendientes, inversiones, trading y configuración.

Tienes acceso de SOLO LECTURA a un resumen real de los datos financieros del usuario que se incluye más abajo. Úsalo para responder con cifras exactas.

Reglas:
- Responde en español, de forma breve y directa (4 o 5 frases salvo que pidan más detalle).
- Para destacar una palabra o frase, usa <strong>texto</strong>. No uses ** ni otros formatos Markdown (tablas, enlaces, encabezados).
- Cuando te pregunten por saldos, deudas, inversiones o movimientos, responde con las cifras del resumen. No digas que no puedes acceder a los datos: sí puedes consultarlos.
- Si te piden "cuánto dinero tengo", aclara si hablas de dinero en cuentas o de patrimonio neto (que incluye inversiones y resta deudas), y di siempre la divisa.
- Para el patrimonio neto, cita la cifra ya calculada del resumen; no la reconstruyas sumando bloques por tu cuenta.
- No inventes cifras ni funciones que la app no tenga. Si un dato no aparece en el resumen, di que no lo tienes.
- No des consejos de inversión personalizados ni predicciones de mercado.
- No pidas contraseñas, datos bancarios ni información sensible.
- No puedes modificar datos: para crear o editar algo, indica al usuario qué botón o página usar.
- Si la pregunta no tiene relación con escinco, responde en una frase y vuelve a ofrecer ayuda con la app.`

/**
 * Comprueba si el proxy de IA responde y tiene clave configurada. En hosting
 * estático la ruta no existe y devuelve false, así que el chat se desactiva
 * en vez de fallar en cada pregunta.
 *
 * @returns {Promise<boolean>}
 */
export async function asistenteDisponible() {
    const controlador = new AbortController()
    const temporizador = setTimeout(() => controlador.abort(), 5000)

    try {
        const respuesta = await fetch(IA_CONFIG.rutaEstado, {
            headers: { Accept: "application/json" },
            signal: controlador.signal
        })
        if (!respuesta.ok) return false
        const datos = await respuesta.json()
        return datos?.disponible === true
    } catch {
        return false
    } finally {
        clearTimeout(temporizador)
    }
}

/**
 * Pregunta al asistente y devuelve el texto de la respuesta.
 *
 * @param {Array<{rol: "user"|"model", texto: string}>} mensajes
 * @param {{nombre?: string, pagina?: string, contexto?: string}} [opciones]
 * @returns {Promise<string>}
 */
export async function preguntarAsistente(mensajes, { nombre, pagina, contexto } = {}) {
    const historial = recortarHistorial(mensajes)
    if (historial.length === 0) {
        throw new Error("Escribe una pregunta para empezar.")
    }

    const controlador = new AbortController()
    const temporizador = setTimeout(() => controlador.abort(), IA_CONFIG.tiempoMaximoMs)

    let respuesta
    try {
        respuesta = await fetch(IA_CONFIG.rutaProxy, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: promptSistema({ nombre, pagina, contexto }) }]
                },
                contents: historial.map(mensaje => ({
                    role: mensaje.rol === "model" ? "model" : "user",
                    parts: [{ text: mensaje.texto }]
                })),
                generationConfig: {
                    temperature: 0.6,
                    maxOutputTokens: 2048,
                    // Gemini 3 razona por defecto y esos tokens cuentan en el
                    // presupuesto de salida: con el límite justo, la respuesta
                    // visible se cortaba a media frase.
                    thinkingConfig: { thinkingBudget: 0 }
                }
            }),
            signal: controlador.signal
        })
    } catch (error) {
        if (error?.name === "AbortError") {
            throw new Error("El asistente tardó demasiado en responder. Inténtalo de nuevo.")
        }
        throw new Error("No se pudo conectar con el asistente. Revisa tu conexión.")
    } finally {
        clearTimeout(temporizador)
    }

    if (!respuesta.ok) {
        throw new Error(mensajeDeError(respuesta.status))
    }

    let datos
    try {
        datos = await respuesta.json()
    } catch {
        throw new Error("El asistente devolvió una respuesta que no se pudo leer.")
    }

    if (datos?.promptFeedback?.blockReason) {
        throw new Error("No puedo responder a esa pregunta. Prueba a reformularla.")
    }

    const texto = (datos?.candidates?.[0]?.content?.parts || [])
        .map(parte => parte?.text || "")
        .join("")
        .trim()

    if (!texto) {
        const motivo = datos?.candidates?.[0]?.finishReason
        if (motivo === "SAFETY" || motivo === "PROHIBITED_CONTENT") {
            throw new Error("No puedo responder a esa pregunta. Prueba a reformularla.")
        }
        throw new Error("El asistente no devolvió ninguna respuesta. Inténtalo de nuevo.")
    }

    return texto
}

function promptSistema({ nombre, pagina, contexto } = {}) {
    const usuario = nombre ? `El usuario se llama ${nombre}.` : ""
    const ubicacion = pagina ? `Ahora está en la página "${pagina}".` : ""
    const datos = contexto
        ? `RESUMEN DE DATOS DEL USUARIO (solo lectura, cifras reales):\n${contexto}`
        : "RESUMEN DE DATOS DEL USUARIO: no disponible en este momento."
    return `${PROMPT_BASE}\n\n${usuario} ${ubicacion}\n\n${datos}`.trim()
}

// Deja solo los últimos mensajes y empieza por uno del usuario: Gemini espera
// una conversación que arranque por turno humano.
function recortarHistorial(mensajes) {
    const lista = (Array.isArray(mensajes) ? mensajes : [])
        .filter(mensaje => mensaje && typeof mensaje.texto === "string" && mensaje.texto.trim())
        .slice(-IA_CONFIG.maxMensajesHistorial)
        .map(mensaje => ({
            rol: mensaje.rol,
            texto: mensaje.texto.slice(0, IA_CONFIG.maxCaracteresMensaje)
        }))

    while (lista.length > 0 && lista[0].rol === "model") {
        lista.shift()
    }

    return lista
}

function mensajeDeError(estado) {
    if (estado === 400) return "La pregunta no se pudo procesar. Prueba a reformularla."
    if (estado === 401 || estado === 403) return "La clave del asistente no es válida o no tiene permisos."
    if (estado === 404) return "El modelo de IA configurado no está disponible."
    if (estado === 429) return "Has hecho muchas consultas seguidas. Espera un momento y vuelve a intentarlo."
    if (estado >= 500) return "El servicio de IA no está disponible ahora mismo. Inténtalo más tarde."
    return "No se pudo obtener respuesta del asistente."
}
