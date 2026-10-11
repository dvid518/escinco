import { CONFIG_MOVIMIENTOS, TIPOS_MOVIMIENTO } from "../../constants/tiposMovimiento.js"
import { obtenerCuentas } from "../../firebase/firestore.js"
import { cuentasOperables } from "../core/familiaCuentas.js"
import { obtenerActivos } from "../repositories/ActivoRepositorio.js"
import { sesion } from "../core/sesion.js"
import { getFechaHoy } from "../core/fechas.js"
import { mostrarNotificacion } from "./notificaciones.js"
import { etiquetaDivisa, formatearMontoConDivisa, getDivisaPrincipal } from "../services/DivisaServicio.js"

// Activos del usuario cargados al abrir el formulario, indexados por símbolo
// en mayúsculas. La página no mantiene el modelo a mano: se rellena cada vez.
let activosPorSimbolo = new Map()

function escaparAtributo(valor) {
    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
}

// ============================================
// GENERAR FORMULARIO SEGÚN TIPO
// ============================================

export async function generarFormularioMovimiento(tipo, divisaPreseleccionada = null) {
    const uid = sesion.uid
    const config = CONFIG_MOVIMIENTOS[tipo]
    const cuentas = await obtenerCuentas(uid)

    // Un padre abstracto no es operable: se ofrecen sus hijas.
    const cuentasActivas = cuentasOperables(cuentas).filter(c => c.estado !== "archivada")

    // Al crear un movimiento con divisa predefinida (p. ej. al consolidar un
    // pendiente), solo se ofrecen cuentas de esa divisa que puedan aportar
    // directamente. Sin divisa predefinida se muestran todas las activas.
    const divisaObjetivo = divisaPreseleccionada ? String(divisaPreseleccionada).toLowerCase() : null
    const comparteDivisa = c => (c.moneda || "pen").toLowerCase() === divisaObjetivo

    // Una tarjeta de crédito no tiene saldo que mover: su deuda vive en el
    // campo `deuda`, no en `saldoInicial`. Ofrecérsela en un select de cuenta
    // que mueve saldos produce un `saldoInicial` basura (BUG-028).
    //
    //   · pagoTarjeta  → el origen es una cuenta con saldo; la tarjeta va en
    //     su propio select (`tarjeta`).
    //   · transferencia → origen y destino son cuentas con saldo. La deuda de
    //     una tarjeta se mueve con `pagoTarjeta` o con `gasto`.
    //   · resto        → solo se excluyen cuando hay divisa predefinida, que es
    //     el caso del consolidado de un pendiente (una compra con tarjeta es
    //     legítima: aumenta su deuda en vez de bajar su saldo).
    const esPagoTarjeta = tipo === TIPOS_MOVIMIENTO.PAGO_TARJETA
    const esTransferencia = tipo === TIPOS_MOVIMIENTO.TRANSFERENCIA
    const excluyeCredito = esPagoTarjeta || esTransferencia || !!divisaObjetivo

    const cuentasElegibles = excluyeCredito
        ? cuentasActivas.filter(c => c.tipo !== "credito" && (!divisaObjetivo || comparteDivisa(c)))
        : cuentasActivas

    const cuentasOptions = cuentasElegibles
        .map(c => `<option value="${c.id}" data-moneda="${(c.moneda || "pen").toLowerCase()}" data-tipo="${c.tipo || "otro"}">${c.nombre} (${etiquetaDivisa(c.moneda || "pen")})</option>`)
        .join("")

    // Las tarjetas solo se filtran por divisa (siguen disponibles para pagar
    // el saldo de una tarjeta concreta de la misma moneda).
    const tarjetas = divisaObjetivo
        ? cuentasActivas.filter(c => c.tipo === "credito" && comparteDivisa(c))
        : cuentasActivas.filter(c => c.tipo === "credito")
    const tarjetasOptions = tarjetas
        .map(c => `<option value="${c.id}" data-moneda="${(c.moneda || "pen").toLowerCase()}">${c.nombre} (deuda: ${formatearMontoConDivisa(c.deuda || 0, c.moneda || "pen")})</option>`)
        .join("")

    const hoy = getFechaHoy()
    const obligatorios = config.camposObligatorios || []
    const opcionales = config.camposOpcionales || []
    const campos = [...new Set([...obligatorios, ...opcionales])]

    // El selector de activo ofrece en un datalist los símbolos que ya existen,
    // mostrando su nombre como descripción.
    let activosDatalist = ""
    if (campos.includes("activo")) {
        activosDatalist = await cargarActivosDatalist(uid)
    }

    let html = `
        <form id="form-movimiento" class="form-movimiento form-movimiento-grid">
    `

    for (const campo of campos) {
        html += generarCampo(campo, { cuentasOptions, tarjetasOptions, activosDatalist, hoy }, !obligatorios.includes(campo))
    }

    // Las etiquetas valen para cualquier tipo de movimiento: van siempre, no
    // dentro de `campos` (que es lo que el servicio valida como obligatorio).
    html += `
        <div class="form-group span-full">
            <label for="campo-etiquetas">Etiquetas</label>
            <input type="text" id="campo-etiquetas" class="form-input" placeholder="Ej: viaje, comida" autocomplete="off">
            <span class="form-hint">Sepáralas con comas. Sirven para filtrar la lista.</span>
        </div>
    `

    html += `</form>`
    return html
}

/**
 * Carga los activos del usuario y devuelve el HTML del datalist. Deja también
 * el índice símbolo→nombre en `activosPorSimbolo` para el nombre bloqueado.
 */
async function cargarActivosDatalist(uid) {
    try {
        const activos = await obtenerActivos(uid)
        activosPorSimbolo = new Map()
        activos.forEach(activo => {
            const simbolo = (activo.simbolo || "").toUpperCase()
            if (!simbolo) return
            activosPorSimbolo.set(simbolo, activo.nombre || activo.simbolo)
        })
        return [...activosPorSimbolo.entries()]
            .map(([simbolo, nombre]) =>
                `<option value="${escaparAtributo(simbolo)}" label="${escaparAtributo(nombre)}"></option>`
            )
            .join("")
    } catch (error) {
        console.warn("No se pudieron cargar los activos para el selector:", error)
        activosPorSimbolo = new Map()
        return ""
    }
}

// ============================================
// ETIQUETAS
// ============================================

export const MAX_ETIQUETAS = 20
export const MAX_LARGO_ETIQUETA = 24

/** Convierte "viaje, comida, viaje" en ["viaje", "comida"]: sin vacíos, sin
    duplicados (comparando sin distinguir mayúsculas) y recortada cada una. */
export function normalizarEtiquetas(valor) {
    const partes = Array.isArray(valor) ? valor : String(valor || "").split(",")
    const vistas = new Set()
    const resultado = []
    for (const parte of partes) {
        const etiqueta = String(parte || "").trim().slice(0, MAX_LARGO_ETIQUETA)
        if (!etiqueta) continue
        const clave = etiqueta.toLowerCase()
        if (vistas.has(clave)) continue
        vistas.add(clave)
        resultado.push(etiqueta)
        if (resultado.length >= MAX_ETIQUETAS) break
    }
    return resultado
}

// ============================================
// GENERADOR DE CAMPO
// ============================================

const CAMPOS_ANCHO_COMPLETO = [
    "cuenta",
    "cuentaOrigen",
    "cuentaDestino",
    "tarjeta",
    "activo",
    "concepto",
    "tasa",
    "exchange",
    "nombreVendedor",
    "nombreComprador",
    "cuentaPago",
    "cuentaCobro",
    "comision",
    "fechaRealizacion"
]

function claseAncho(campo) {
    return CAMPOS_ANCHO_COMPLETO.includes(campo) ? " span-full" : ""
}

// Select con buscador: un input de texto filtra las opciones del <select>, que
// sigue siendo la fuente del id. Así todos los lectores actuales
// (.selectedOptions) siguen funcionando sin cambios.
function plantillaSelectBuscable({ id, etiqueta, opciones, req, placeholderSelect, placeholderBuscar }) {
    return `
        <div class="form-group span-full">
            <label for="${id}">${etiqueta}</label>
            <input type="text" class="form-input form-buscador" data-select="${id}" placeholder="${placeholderBuscar}" autocomplete="off" spellcheck="false">
            <select id="${id}" class="form-input"${req}>
                <option value="">${placeholderSelect}</option>
                ${opciones}
            </select>
        </div>
    `
}

function generarCampo(campo, contexto, opcional) {
    const { cuentasOptions, tarjetasOptions, activosDatalist, hoy } = contexto
    const ancho = claseAncho(campo)
    const req = opcional ? "" : " required"

    switch (campo) {
        case "cuenta":
            return plantillaSelectBuscable({
                id: "campo-cuenta",
                etiqueta: "Cuenta",
                opciones: cuentasOptions,
                req,
                placeholderSelect: "Seleccionar cuenta",
                placeholderBuscar: "Buscar cuenta..."
            })
        case "cuentaOrigen":
            return plantillaSelectBuscable({
                id: "campo-cuentaOrigen",
                etiqueta: "Cuenta origen",
                opciones: cuentasOptions,
                req,
                placeholderSelect: "Seleccionar cuenta",
                placeholderBuscar: "Buscar cuenta..."
            })
        case "cuentaDestino":
            return plantillaSelectBuscable({
                id: "campo-cuentaDestino",
                etiqueta: "Cuenta destino",
                opciones: cuentasOptions,
                req,
                placeholderSelect: "Seleccionar cuenta",
                placeholderBuscar: "Buscar cuenta..."
            })
        case "tarjeta":
            return plantillaSelectBuscable({
                id: "campo-tarjeta",
                etiqueta: "Tarjeta de crédito",
                opciones: tarjetasOptions,
                req,
                placeholderSelect: "Seleccionar tarjeta",
                placeholderBuscar: "Buscar tarjeta..."
            })
        case "activo":
            return `
                <div class="form-group${ancho}">
                    <label for="campo-activo">Activo</label>
                    <input type="text" id="campo-activo" class="form-input" list="lista-activos" placeholder="Ej: VOO, BTC..." autocomplete="off" spellcheck="false"${req}>
                    <datalist id="lista-activos">${activosDatalist || ""}</datalist>
                    <input type="text" id="campo-activo-nombre" class="form-input form-input-bloqueado" placeholder="Nombre del activo" readonly tabindex="-1">
                </div>
            `
        case "concepto":
            return `
                <div class="form-group${ancho}">
                    <label for="campo-concepto">Concepto</label>
                    <input type="text" id="campo-concepto" class="form-input" placeholder="Descripción"${req}>
                </div>
            `
        case "monto":
            return `
                <div class="form-group${ancho}">
                    <label for="campo-monto">Monto (<span id="simbolo-monto" class="simbolo-divisa">S/</span>)</label>
                    <input type="number" id="campo-monto" class="form-input" step="0.01" min="0.01" placeholder="0.00"${req}>
                </div>
            `
        case "operacion":
            return `
                <div class="form-group${ancho}">
                    <label for="campo-operacion">Operación</label>
                    <select id="campo-operacion" class="form-input"${req}>
                        <option value="sumar">Suma al saldo (+)</option>
                        <option value="restar">Resta del saldo (−)</option>
                    </select>
                </div>
            `
        case "montoOrigen":
            return `
                <div class="form-group${ancho}">
                    <label for="campo-montoOrigen">Monto origen</label>
                    <input type="number" id="campo-montoOrigen" class="form-input" step="0.01" min="0.01" placeholder="0.00"${req}>
                </div>
            `
        case "montoDestino":
            return `
                <div class="form-group${ancho}">
                    <label for="campo-montoDestino">Monto destino</label>
                    <input type="number" id="campo-montoDestino" class="form-input" step="0.01" min="0.01" placeholder="0.00"${req}>
                </div>
            `
        case "cantidad":
            return `
                <div class="form-group${ancho}">
                    <label for="campo-cantidad">Cantidad</label>
                    <input type="number" id="campo-cantidad" class="form-input" step="0.0001" min="0.0001" placeholder="0"${req}>
                </div>
            `
        case "precio":
            return `
                <div class="form-group${ancho}">
                    <label for="campo-precio">Precio unitario</label>
                    <input type="number" id="campo-precio" class="form-input" step="0.01" min="0.01" placeholder="0.00"${req}>
                </div>
            `
        case "comision":
            return `
                <div class="form-group${ancho}">
                    <label for="campo-comision">Comisión</label>
                    <input type="number" id="campo-comision" class="form-input" step="0.01" min="0" placeholder="0.00" value="0">
                </div>
            `
        case "divisa":
            return ""
        case "tasa":
            return `
                <div class="form-group${ancho}">
                    <label for="campo-tasa">Tasa de cambio</label>
                    <input type="number" id="campo-tasa" class="form-input" step="0.0001" min="0.0001" placeholder="0.00"${req}>
                    <span class="form-hint">Se calcula automáticamente al completar montos</span>
                </div>
            `
        case "exchange":
            return `
                <div class="form-group${ancho}">
                    <label for="campo-exchange">Exchange</label>
                    <input type="text" id="campo-exchange" class="form-input" placeholder="Ej: Binance, Kraken"${req}>
                </div>
            `
        case "nombreVendedor":
            return `
                <div class="form-group${ancho}">
                    <label for="campo-nombreVendedor">Nombre del vendedor</label>
                    <input type="text" id="campo-nombreVendedor" class="form-input" placeholder="Nombre"${req}>
                </div>
            `
        case "nombreComprador":
            return `
                <div class="form-group${ancho}">
                    <label for="campo-nombreComprador">Nombre del comprador</label>
                    <input type="text" id="campo-nombreComprador" class="form-input" placeholder="Nombre"${req}>
                </div>
            `
        case "cuentaPago":
            return `
                <div class="form-group${ancho}">
                    <label for="campo-cuentaPago">Cuenta de pago</label>
                    <input type="text" id="campo-cuentaPago" class="form-input" placeholder="Número de cuenta"${req}>
                </div>
            `
        case "cuentaCobro":
            return `
                <div class="form-group${ancho}">
                    <label for="campo-cuentaCobro">Cuenta de cobro</label>
                    <input type="text" id="campo-cuentaCobro" class="form-input" placeholder="Número de cuenta"${req}>
                </div>
            `
        case "fechaRealizacion":
            return `
                <div class="form-group${ancho}">
                    <label for="campo-fecha">Fecha de realización</label>
                    <div class="campo-fecha">
                        <input type="date" id="campo-fecha" class="form-input" value="${hoy}" max="${hoy}"${req}>
                        <button type="button" class="btn-calendario" aria-label="Abrir calendario">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar-days preview-icon">
                                <path d="M8 2v4"/>
                                <path d="M16 2v4"/>
                                <rect width="18" height="18" x="3" y="4" rx="2"/>
                                <path d="M3 10h18"/>
                                <path d="M8 14h.01"/>
                                <path d="M12 14h.01"/>
                                <path d="M16 14h.01"/>
                                <path d="M8 18h.01"/>
                                <path d="M12 18h.01"/>
                                <path d="M16 18h.01"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `
        default:
            return `
                <div class="form-group${ancho}">
                    <label for="campo-${campo}">${campo}</label>
                    <input type="text" id="campo-${campo}" class="form-input" placeholder="${campo}"${req}>
                </div>
            `
    }
}

// ============================================
// SÍMBOLO DE DIVISA SEGÚN CUENTA
// ============================================

const SIMBOLO_MONEDA = { pen: "S/", usd: "$", usdt: "₮", eur: "€" }

// Para cada tipo, qué select de cuenta define la divisa del movimiento.
const CUENTA_FUENTE_DIVISA = {
    ingreso: "campo-cuenta",
    gasto: "campo-cuenta",
    transferencia: "campo-cuentaOrigen",
    compraActivo: "campo-cuenta",
    ventaActivo: "campo-cuenta",
    p2pCompra: "campo-cuenta",
    p2pVenta: "campo-cuenta",
    compraTarjeta: "campo-cuenta",
    pagoTarjeta: "campo-cuentaOrigen",
    error: "campo-cuenta"
}

/**
 * Normaliza texto para buscar sin acentos ni mayúsculas.
 */
function normalizarBusqueda(valor) {
    return (valor || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
}

/**
 * Obtiene solo el nombre de la cuenta del texto de la opción (ej. "BCP"
 * de "BCP (S/ 1234)"). Si no hay paréntesis, devuelve el texto completo.
 */
function obtenerNombreCuenta(textoOpcion) {
    const match = textoOpcion?.match(/^(.+?)\s*\(/);
    return match ? match[1].trim() : (textoOpcion || "").trim()
}

/**
 * Activa los buscadores de los <select> de cuenta/tarjeta. El input filtra las
 * opciones por texto combinándolo con la disponibilidad (`data-disponible`) que
 * marcan los filtros de compatibilidad (pago de tarjeta, transferencias).
 * El <select> sigue siendo la fuente del id elegido.
 */
export function activarSelectsBuscables(raiz = document) {
    raiz.querySelectorAll(".form-buscador[data-select]").forEach(entrada => {
        if (entrada.dataset.buscableListo === "1") return
        entrada.dataset.buscableListo = "1"

        const select = document.getElementById(entrada.dataset.select)
        if (!select) return

        const aplicar = () => {
            const texto = normalizarBusqueda(entrada.value)
            Array.from(select.options).forEach((opcion, indice) => {
                if (indice === 0) return
                const disponible = opcion.dataset.disponible !== "0"
                const coincide = !texto || normalizarBusqueda(opcion.textContent).includes(texto)
                const visible = disponible && coincide
                opcion.hidden = !visible
                opcion.disabled = !visible
            })
            // Si la opción seleccionada se volvió invisible/deshabilitada,
            // elegimos "Todas las cuentas" en lugar de borrar en silencio.
            if (select.selectedOptions[0] && select.selectedOptions[0].disabled) {
                select.value = ""
            }
        }

        // Los filtros de compatibilidad llaman a esto tras marcar disponibilidad.
        select._aplicarBusqueda = aplicar

        const sincronizarEntrada = () => {
            const elegida = select.selectedOptions[0]
            // Mostrar solo el nombre de la cuenta, sin "(S/ ...)" ni "(deuda: ...)"
            if (elegida && elegida.value) {
                entrada.value = obtenerNombreCuenta(elegida.textContent)
            } else {
                entrada.value = ""
            }
        }

        entrada.addEventListener("input", () => {
            aplicar()
            const visibles = Array.from(select.options).filter((o, i) => i > 0 && !o.hidden)
            if (normalizarBusqueda(entrada.value) && visibles.length === 1) {
                select.value = visibles[0].value
            }
            // Si no hay opciones visibles, no borrar la selección en silencio:
            // el usuario puede borrar el texto manualmente para elegir "Todas".
        })

        entrada.addEventListener("keydown", evento => {
            if (evento.key === "Enter") {
                evento.preventDefault()
                select.focus()
            }
        })

        select.addEventListener("change", sincronizarEntrada)

        // Estado inicial coherente (incluye el caso de edición, donde el select
        // ya viene con un valor puesto por rellenarFormulario).
        aplicar()
        sincronizarEntrada()
    })
}

/**
 * Sincroniza el nombre bloqueado del activo con el símbolo escrito. Si ya
 * existe se muestra su nombre; si no, se anuncia que se creará.
 */
export function vincularSelectActivo() {
    const entrada = document.getElementById("campo-activo")
    const nombre = document.getElementById("campo-activo-nombre")
    if (!entrada || !nombre) return

    const actualizar = () => {
        const simbolo = (entrada.value || "").trim().toUpperCase()
        if (!simbolo) {
            nombre.value = ""
            return
        }
        nombre.value = activosPorSimbolo.get(simbolo) || `Nuevo activo (${simbolo})`
    }

    entrada.addEventListener("input", actualizar)
    actualizar()
}

/**
 * Vincula el cambio de cuenta con el símbolo que acompaña al label Monto
 * y actualiza la divisa guardada. Llamar justo después de abrir el modal.
 * También activa los buscadores de los selectores de cuenta.
 */
export function vincularSimboloDivisa() {
    activarSelectsBuscables()
    vincularSelectActivo()
    const ids = [...new Set(Object.values(CUENTA_FUENTE_DIVISA))]

    const actualizar = () => {
        const objetivo = document.getElementById("simbolo-monto")
        if (!objetivo) return

        for (const id of ids) {
            const select = document.getElementById(id)
            if (!select) continue
            const moneda = select.selectedOptions?.[0]?.dataset?.moneda
            if (moneda) {
                objetivo.textContent = SIMBOLO_MONEDA[moneda] || "$"
            }
        }
    }

    ids.forEach(id => {
        const select = document.getElementById(id)
        select?.addEventListener("change", actualizar)
    })

    actualizar()
}

// ============================================
// RECOGER DATOS DEL FORMULARIO
// ============================================

export function recogerDatosFormulario(tipo) {
    const config = CONFIG_MOVIMIENTOS[tipo]
    const obligatorios = config.camposObligatorios || []
    const opcionales = config.camposOpcionales || []
    const campos = [...new Set([...obligatorios, ...opcionales])]
    const datos = {}
    const errores = []

    for (const campo of campos) {
        const input = document.getElementById(`campo-${campo}`)
        if (!input) continue

        const esObligatorio = obligatorios.includes(campo)
        const valor = input.value.trim()

        if (!valor) {
            if (esObligatorio) {
                errores.push(campo)
                input.classList.add("input-error")
            }
            continue
        }

        input.classList.remove("input-error")
        datos[campo] = input.type === "number" ? parseFloat(valor) : valor
    }

    const comisionInput = document.getElementById("campo-comision")
    if (comisionInput && comisionInput.value) {
        datos.comision = parseFloat(comisionInput.value) || 0
    }

    // Las etiquetas van siempre (aunque quede lista vacía): así un movimiento
    // editado puede quedarse sin ninguna.
    datos.etiquetas = normalizarEtiquetas(document.getElementById("campo-etiquetas")?.value)

    // La divisa no se elige: se deriva de la cuenta seleccionada.
    const idFuente = CUENTA_FUENTE_DIVISA[tipo]
    if (idFuente) {
        const selectCuenta = document.getElementById(idFuente)
        const moneda = selectCuenta?.selectedOptions?.[0]?.dataset?.moneda
        if (moneda) datos.divisa = moneda
    }

    // Compra/venta de activo sin cuenta (regalo, aportación): no hay moneda de
    // la que derivarla, así que se usa la divisa principal del usuario.
    if (!datos.divisa && (tipo === TIPOS_MOVIMIENTO.COMPRA_ACTIVO || tipo === TIPOS_MOVIMIENTO.VENTA_ACTIVO)) {
        datos.divisa = getDivisaPrincipal()
    }

    if (errores.length > 0) {
        mostrarNotificacion("error", `Campos obligatorios faltantes: ${errores.join(", ")}`)
        return null
    }

    return datos
}