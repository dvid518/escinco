import { IA_CONFIG } from "../core/iaConfig.js"
import { getAuth } from "../../firebase/auth.js"
import { sesion } from "../core/sesion.js"
import { crearPendiente } from "../repositories/PendienteRepositorio.js"
import { obtenerCuentas, obtenerMovimientos } from "../../firebase/firestore.js"
import { getFechaHoy } from "../core/fechas.js"

// ============================================
// ASISTENTE IA · NVIDIA NIM (OpenAI compatible)
// ============================================
// Llamada directa por REST para no añadir dependencias ni pasos de build.
// Soporta Tool Calling (Function Calling): el modelo puede pedir ejecutar
// herramientas (crear pendiente, obtener saldo, obtener movimientos) y el
// servicio las resuelve contra las capas de datos existentes.
//
// En local la petición va al proxy `/api/ia` de tools/servir-local.mjs, que
// reenvía a NVIDIA NIM inyectando la NVIDIA_API_KEY sin exponerla al
// navegador. En producción va a la Cloud Function drovProxy, que lee la clave
// de Secret Manager. Se detecta el entorno por el hostname (el proyecto no
// usa bundler ni import.meta.env). El token de Firebase Auth se envía como
// Authorization: Bearer para que el proxy de producción pueda identificar al
// usuario y aplicar su rate limit.

const PROMPT_BASE = `Eres drov, el asistente integrado de escinco, una aplicación de finanzas personales en español.

Ayudas al usuario a entender y usar la app: dashboard, cuentas, movimientos, presupuestos, metas, pendientes, inversiones, trading y configuración.

Tienes acceso de SOLO LECTURA a un resumen real de los datos financieros del usuario que se incluye más abajo. Úsalo para responder con cifras exactas.

Además cuentas con herramientas para leer datos y crear pendientes:
- obtener_saldo_total: devuelve el saldo total de todas las cuentas.
- obtener_movimientos_recientes: devuelve los últimos movimientos.
- crear_pendiente: crea un pendiente de cobro o pago (acción de escritura).

Reglas:
- Responde en español, de forma breve y directa (4 o 5 frases salvo que pidan más detalle).
- Para destacar una palabra o frase, usa <strong>texto</strong>. No uses ** ni otros formatos Markdown (tablas, enlaces, encabezados).
- Cuando te pregunten por saldos, deudas, inversiones o movimientos, responde con las cifras del resumen. No digas que no puedes acceder a los datos: sí puedes consultarlos.
- Si te piden "cuánto dinero tengo", aclara si hablas de dinero en cuentas o de patrimonio neto (que incluye inversiones y resta deudas), y di siempre la divisa.
- Para el patrimonio neto, cita la cifra ya calculada del resumen; no la reconstruyas sumando bloques por tu cuenta.
- Siempre confirma con el usuario antes de ejecutar una acción de escritura (crear pendiente). No ejecutes escrituras sin que el usuario haya aceptado claramente.
- No des consejos de inversión personalizados ni predicciones de mercado.
- No pidas contraseñas, datos bancarios ni información sensible.
- Si la pregunta no tiene relación con escinco, responde en una frase y vuelve a ofrecer ayuda con la app.`

// --------------------------------------------
// HERRAMIENTAS (OpenAI function calling)
// --------------------------------------------

const TOOLS = [
    {
        type: "function",
        function: {
            name: "crear_pendiente",
            description: "Crea un pendiente (cobro o pago) para el usuario.",
            parameters: {
                type: "object",
                properties: {
                    descripcion: { type: "string", description: "Descripción del pendiente." },
                    monto: { type: "number", description: "Monto del pendiente, mayor a cero." },
                    tipo: { type: "string", enum: ["cobro", "pago"], description: "Tipo: cobro o pago." },
                    fecha: { type: "string", description: "Fecha de vencimiento en formato YYYY-MM-DD." }
                },
                required: ["descripcion", "monto", "tipo"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "obtener_saldo_total",
            description: "Obtiene el saldo total de todas las cuentas del usuario.",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "obtener_movimientos_recientes",
            description: "Obtiene los movimientos más recientes del usuario.",
            parameters: {
                type: "object",
                properties: {
                    limite: { type: "number", description: "Cantidad máxima de movimientos a devolver.", default: 10 }
                }
            }
        }
    }
]

// --------------------------------------------
// URL DEL PROXY Y TOKEN DE AUTH
// --------------------------------------------

/**
 * Devuelve la URL del proxy de IA según el entorno.
 * - Localhost → /api/ia (proxy de tools/servir-local.mjs).
 * - Cualquier otro host → Cloud Function drovProxy de producción.
 */
function rutaProxy() {
    const host = typeof location !== "undefined" ? location.hostname : ""
    if (host === "localhost" || host === "127.0.0.1") {
        return IA_CONFIG.rutaProxy // "/api/ia" en local
    }
    return "https://us-central1-cinco-96064.cloudfunctions.net/drovProxy"
}

/**
 * Obtiene el ID token de Firebase Auth del usuario actual, si lo hay.
 * Se envía al proxy como Authorization: Bearer para identificar al usuario
 * y aplicar su rate limit en producción. En local el proxy no lo valida.
 * @returns {Promise<string|null>}
 */
async function obtenerIdToken() {
    try {
        const auth = getAuth()
        const user = auth?.currentUser
        if (!user) return null
        return await user.getIdToken()
    } catch {
        return null
    }
}

// --------------------------------------------
// EJECUCIÓN DE HERRAMIENTAS
// --------------------------------------------
// Usa los servicios/repositorios existentes. Nunca escribe directo a Firestore
// desde este módulo.

/**
 * Ejecuta una herramienta solicitada por el modelo.
 * @param {string} nombre - Nombre de la función.
 * @param {Object} args - Argumentos pasados por el modelo.
 * @param {string} uid - UID del usuario autenticado.
 * @returns {Promise<Object>} Resultado de la herramienta.
 */
async function ejecutarHerramienta(nombre, args, uid) {
    if (!uid) throw new Error("No hay sesión de usuario activa.")

    switch (nombre) {
        case "crear_pendiente": {
            const { descripcion, monto, tipo, fecha } = args
            if (!descripcion || String(descripcion).trim() === "") {
                throw new Error("Falta la descripción del pendiente.")
            }
            if (!monto || Number(monto) <= 0) {
                throw new Error("El monto debe ser mayor a 0.")
            }
            const tipoBooleano = String(tipo).toLowerCase() === "cobro" // true = cobrar, false = pagar
            const datos = {
                concepto: String(descripcion).trim(),
                monto: Number(monto),
                tipo: tipoBooleano,
                divisa: "pen",
                fechaRegistro: getFechaHoy(),
                fechaVencimiento: fecha ? new Date(fecha) : null,
                pendiente: true
            }
            const id = await crearPendiente(uid, datos)
            return {
                ok: true,
                id,
                concepto: datos.concepto,
                monto: datos.monto,
                tipo: datos.tipo ? "cobrar" : "pagar",
                divisa: "pen"
            }
        }

        case "obtener_saldo_total": {
            const cuentas = await obtenerCuentas(uid)
            const total = cuentas.reduce((suma, cuenta) => suma + (Number(cuenta.saldoInicial) || 0), 0)
            return { ok: true, total, cuentas: cuentas.length, divisa: "pen" }
        }

        case "obtener_movimientos_recientes": {
            const limite = Number(args.limite) || 10
            const movimientos = await obtenerMovimientos(uid)
            return {
                ok: true,
                movimientos: movimientos.slice(0, limite).map(m => ({
                    id: m.id,
                    concepto: m.concepto,
                    monto: m.monto,
                    tipo: m.tipo,
                    fecha: m.fechaRealizacion
                }))
            }
        }

        default:
            throw new Error(`Herramienta desconocida: ${nombre}`)
    }
}

// --------------------------------------------
// HISTORIAL Y PETICIÓN A GEMINI
// --------------------------------------------

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
 * Soporta Tool Calling: si el modelo pide ejecutar una función, la resuelve
 * y envía el resultado de vuelta hasta obtener una respuesta de texto final.
 *
 * @param {Array<{rol: "user"|"model", texto: string}>} mensajes
 * @param {{nombre?: string, pagina?: string, contexto?: string}} [opciones]
 * @returns {Promise<string>}
 */
export async function preguntarAsistente(mensajes, { nombre, pagina, contexto } = {}) {
    const uid = sesion.uid
    const historial = recortarHistorial(mensajes)
    if (historial.length === 0) {
        throw new Error("Escribe una pregunta para empezar.")
    }

    // Turno de conversación que se amplía con funciónCall/functionResponse.
    const turno = historial.map(m => ({ rol: m.rol, texto: m.texto }))

    const controlador = new AbortController()
    const temporizador = setTimeout(() => controlador.abort(), IA_CONFIG.tiempoMaximoMs)

    const token = await obtenerIdToken()
    const headers = {
        "Content-Type": "application/json"
    }
    if (token) {
        headers["Authorization"] = `Bearer ${token}`
    }

    let intentos = 0
    const MAX_INTENTOS = 10 // evita bucles infinitos de herramientas

    while (intentos++ < MAX_INTENTOS) {
        try {
            let respuesta
            try {
                respuesta = await fetch(rutaProxy(), {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        model: IA_CONFIG.modelo,
                        messages: [
                            { role: "system", content: promptSistema({ nombre, pagina, contexto }) },
                            ...turnoAMensajesOpenAI(turno)
                        ],
                        temperature: 0.6,
                        max_tokens: 2048,
                        thinking: { type: "disabled" },
                        tools: TOOLS,
                        tool_choice: "auto"
                    }),
                    signal: controlador.signal
                })
            } catch (error) {
                if (error?.name === "AbortError") {
                    throw new Error("El asistente tardó demasiado en responder. Inténtalo de nuevo.")
                }
                throw new Error("No se pudo conectar con el asistente. Revisa tu conexión.")
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

            if (datos?.error) {
                throw new Error(datos.error.message || "Error del asistente.")
            }

            const mensaje = datos?.choices?.[0]?.message || {}
            const parteTexto = mensaje.content
            const toolCalls = mensaje.tool_calls || []

            // Agregar la respuesta del modelo al turno
            const mensajeModelo = { rol: "assistant", texto: parteTexto || "" }
            if (toolCalls.length > 0) {
                mensajeModelo.toolCalls = toolCalls.map(tc => ({
                    id: tc.id,
                    type: tc.type,
                    function: { name: tc.function.name, arguments: tc.function.arguments }
                }))
            }
            turno.push(mensajeModelo)

            if (toolCalls.length > 0) {
                for (const tc of toolCalls) {
                    const toolName = tc.function?.name
                    const argsRaw = tc.function?.arguments
                    let args = {}
                    try {
                        args = argsRaw ? JSON.parse(typeof argsRaw === "string" ? argsRaw : JSON.stringify(argsRaw)) : {}
                    } catch {
                        args = {}
                    }
                    try {
                        const resultado = await ejecutarHerramienta(toolName, args, uid)
                        turno.push({
                            rol: "tool",
                            toolCallId: tc.id,
                            name: toolName,
                            texto: JSON.stringify(resultado)
                        })
                    } catch (error) {
                        turno.push({
                            rol: "tool",
                            toolCallId: tc.id,
                            name: toolName,
                            texto: JSON.stringify({ error: error.message })
                        })
                    }
                }
                continue
            }

            // Respuesta de texto final
            if (parteTexto && String(parteTexto).trim() !== "") {
                return String(parteTexto).trim()
            }

            throw new Error("El asistente no devolvió ninguna respuesta. Inténtalo de nuevo.")
        } finally {
            clearTimeout(temporizador)
        }
    }

    throw new Error("El asistente tardó demasiado en procesar las herramientas. Inténtalo de nuevo.")
}

function promptSistema({ nombre, pagina, contexto } = {}) {
    const usuario = nombre ? `El usuario se llama ${nombre}.` : ""
    const ubicacion = pagina ? `Ahora está en la página "${pagina}".` : ""
    const datos = contexto
        ? `RESUMEN DE DATOS DEL USUARIO (solo lectura, cifras reales):\n${contexto}`
        : "RESUMEN DE DATOS DEL USUARIO: no disponible en este momento."
    return `${PROMPT_BASE}\n\n${usuario} ${ubicacion}\n\n${datos}`.trim()
}

/**
 * Convierte el turno interno (que puede incluir tool_calls y tool)
 * al formato `messages` que espera la API OpenAI / NVIDIA NIM.
 */
function turnoAMensajesOpenAI(turno) {
    return turno.map(m => {
        if (m.rol === "tool") {
            return {
                role: "tool",
                tool_call_id: m.toolCallId,
                name: m.name,
                content: m.texto
            }
        }
        const mensaje = {
            role: m.rol === "assistant" ? "assistant" : "user",
            content: m.texto || ""
        }
        if (m.toolCalls) {
            mensaje.tool_calls = m.toolCalls.map(tc => ({
                id: tc.id,
                type: "function",
                function: { name: tc.function.name, arguments: JSON.stringify(tc.function.arguments) }
            }))
        }
        return mensaje
    })
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
