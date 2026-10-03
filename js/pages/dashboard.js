import { sesion } from "../core/sesion.js"
import { cacheCapa } from "../core/cache.js"
import { activarSpinLogo, desactivarSpinLogo, navigateTo } from "../core/router.js"
import { obtenerCuentas, obtenerMovimientos, obtenerPreferencias, actualizarPreferencias } from "../../firebase/firestore.js"
import { CONFIG_MOVIMIENTOS, TIPOS_MOVIMIENTO } from "../../constants/tiposMovimiento.js"
import {
    registrarSnapshot,
    obtenerPatrimonioParaGrafico,
    calcularPatrimonio
} from "../services/SnapshotServicio.js"
import {
    crearGraficoPatrimonio,
    destruirGraficoPatrimonio
} from "../ui/graficos.js"
import {
    getDivisaPrincipal,
    getFormatoDivisa,
    convertirMonto,
    formatearMonto,
    formatearMontoConDivisa,
    presentarDivisa
} from "../services/DivisaServicio.js"
import { obtenerPosicionesConValor } from "../services/PosicionServicio.js"
import { estadoCicloDe, nivelUsoDe, proximaAnualidad } from "../services/CreditoServicio.js"
import { obtenerPendientes } from "../repositories/PendienteRepositorio.js"
import { obtenerOrdenes } from "../repositories/OrdenRepositorio.js"
import { obtenerEstrategias } from "../repositories/EstrategiaRepositorio.js"
import { calcularProximaEjecucion } from "../services/EstrategiaServicio.js"
import { abrirModal } from "../ui/modal.js"
import { mostrarNotificacion } from "../ui/notificaciones.js"
import { icono, LOGO_ESCINCO_CARGA } from "../core/iconos.js"
import { skeletonMarkup, skeletonText } from "../ui/skeletons.js"

import { obtenerMetas } from "../repositories/MetaRepositorio.js"
import { abrirModalMeta, abrirModalAporteMeta } from "../ui/metas.js"

// ============================================
// ESTADO
// ============================================

let uid = null
let cuentas = []
let posicionesData = []
let instanciasResueltas = false
let divisaActual = getDivisaPrincipal()
let datosGrafico = null
let inversionesData = null
let vencimientosData = null
let favoritosData = []
let metasData = []
let movimientosData = []
let movimientosCompletosData = []
let pendientesData = []
let ordenesData = []
let estrategiasData = []
let analiticaData = null
let cargado = false
let eventosRefreshDashboardListos = false
let timerRefreshDashboard = null
let secuenciaGraficoDashboard = 0

const DIAS_VENCIMIENTO = 7
// Las cards nuevas se añaden por tandas, cada una con su propia marca de
// migración. Una tanda solo se aplica si su marca sigue sin poner: así el
// usuario que ya quitó a mano una card de una tanda anterior no la ve
// reaparecer, y las tandas nuevas sí llegan a todo el mundo.
const NUEVAS_CARDS_V1 = ["flujo-caja", "deudas", "ahorro", "distribucion", "programados", "alertas"]
const NUEVAS_CARDS_V2 = ["gastos-periodo", "ingresos-periodo", "balance-periodo"]
const NUEVAS_CARDS_V3 = ["distribucion-activos", "patrimonio-divisa"]
const DASHBOARD_CARDS = [
    { id: "patrimonio", label: "Patrimonio total" },
    { id: "cuentas", label: "Cuentas" },
    { id: "inversiones", label: "Inversiones" },
    { id: "vencimientos", label: "Próximos vencimientos" },
    { id: "movimientos", label: "Últimos movimientos" },
    { id: "favoritos", label: "Favoritos" },
    { id: "metas", label: "Metas de ahorro" },
    { id: "pendientes", label: "Pendientes" },
    { id: "ordenes", label: "Órdenes" },
    { id: "estrategias", label: "Estrategias" },
    { id: "flujo-caja", label: "Flujo de caja" },
    { id: "gastos-periodo", label: "Gastado" },
    { id: "ingresos-periodo", label: "Ingresado" },
    { id: "balance-periodo", label: "Balance" },
    { id: "deudas", label: "Deudas" },
    { id: "ahorro", label: "Ahorro" },
    { id: "distribucion", label: "Distribución patrimonial" },
    { id: "distribucion-activos", label: "Distribución por tipo de activo" },
    { id: "patrimonio-divisa", label: "Patrimonio por divisa" },
    { id: "programados", label: "Movimientos programados" },
    { id: "alertas", label: "Alertas" },
    { id: "grafico", label: "Evolución patrimonial" }
]

// Orden estable de las tandas: las nuevas se añaden al final de la lista.
const TANDAS_CARDS = [
    ["nuevasCardsV1", NUEVAS_CARDS_V1],
    ["nuevasCardsV2", NUEVAS_CARDS_V2],
    ["nuevasCardsV3", NUEVAS_CARDS_V3]
]

const DEFAULT_CARDS_VISIBLES = DASHBOARD_CARDS
    .map(card => card.id)
    .filter(id => id !== "patrimonio")
const DEFAULT_CARDS_ORDEN = [...DEFAULT_CARDS_VISIBLES]

// ============================================
// CARDS INSTANCIADAS (cuenta / activo)
// ============================================
// A diferencia del catálogo fijo, estas cards no son un id único del catálogo:
// son una instancia por entidad, con id "cuenta:<cuentaId>" o
// "activo:<activoId>". El usuario las elige una a una desde el selector
// ("Añadir/quitar cards") y se guardan en las mismas listas de preferencias
// que el resto, así que sobreviven a recargas y se reordenan igual.

const PREFIJO_CARD_CUENTA = "cuenta:"
const PREFIJO_CARD_ACTIVO = "activo:"
const REGEX_CARD_INSTANCIA = /^(cuenta|activo):[A-Za-z0-9_-]{1,128}$/

const ETIQUETAS_TIPO_CUENTA = {
    banco: "Banco",
    efectivo: "Efectivo",
    broker: "Broker",
    exchange: "Exchange",
    debito: "Tarjeta de débito",
    credito: "Tarjeta de crédito"
}

const ETIQUETAS_TIPO_ACTIVO = {
    accion: "Acción",
    etf: "ETF",
    crypto: "Cripto",
    bono: "Bono"
}

function esCardInstancia(id) {
    return typeof id === "string" && REGEX_CARD_INSTANCIA.test(id)
}

function idCardCuenta(cuentaId) {
    return `${PREFIJO_CARD_CUENTA}${cuentaId}`
}

function idCardActivo(activoId) {
    return `${PREFIJO_CARD_ACTIVO}${activoId}`
}

function entidadDeCardInstancia(id) {
    const [tipo, entidadId] = String(id).split(":")
    return { tipo, entidadId }
}

let cardsVisiblesDashboard = [...DEFAULT_CARDS_VISIBLES]
let cardsOrdenDashboard = [...DEFAULT_CARDS_ORDEN]
let modoEdicionDashboard = false
let cambiosPendientesDashboard = false
let eventosEdicionDashboardListos = false
let eventosLayoutDashboardListos = false
let timerLayoutDashboard = null

function normalizarCardsVisibles(valor) {
    if (!Array.isArray(valor)) return [...DEFAULT_CARDS_VISIBLES]
    const idsConocidos = new Set(DASHBOARD_CARDS.map(card => card.id))
    return [...new Set(valor.filter(id => id !== "patrimonio" && (idsConocidos.has(id) || esCardInstancia(id))))]
}

function normalizarCardsOrden(valor) {
    if (!Array.isArray(valor)) return [...DEFAULT_CARDS_ORDEN]
    const idsConocidos = new Set(DEFAULT_CARDS_ORDEN)
    const validos = [...new Set(valor.filter(id => idsConocidos.has(id) || esCardInstancia(id)))]
    return [...validos, ...DEFAULT_CARDS_ORDEN.filter(id => !validos.includes(id))]
}

// Aplica las tandas de cards nuevas que este usuario todavía no ha recibido.
// Devuelve las listas ya normalizadas y la lista de marcas a guardar.
function aplicarTandasNuevasCards(dashboard, cardsGuardadas) {
    const visibles = normalizarCardsVisibles(cardsGuardadas)
    const marcas = {}

    for (const [marca, cards] of TANDAS_CARDS) {
        if (!Array.isArray(cardsGuardadas) || dashboard?.[marca] === true) continue
        const pendientes = cards.filter(id => !visibles.includes(id))
        if (pendientes.length > 0) visibles.push(...pendientes)
        marcas[marca] = true
    }

    return { visibles: normalizarCardsVisibles(visibles), marcas }
}

function configurarCardsDashboardDesdeSesion() {
    const dashboard = sesion.getPreferencias()?.dashboard
    const { visibles } = aplicarTandasNuevasCards(dashboard, dashboard?.cardsVisibles)
    cardsVisiblesDashboard = visibles
    cardsOrdenDashboard = normalizarCardsOrden(dashboard?.orden)
}

async function cargarCardsVisiblesDashboard() {
    if (!uid) return
    try {
        const preferencias = sesion.getPreferencias() || await obtenerPreferencias(uid)
        const dashboard = preferencias?.dashboard
        const { visibles, marcas } = aplicarTandasNuevasCards(dashboard, dashboard?.cardsVisibles)
        cardsVisiblesDashboard = visibles
        cardsOrdenDashboard = normalizarCardsOrden(dashboard?.orden)
        if (Object.keys(marcas).length > 0) {
            actualizarPreferencias(uid, {
                "dashboard.cardsVisibles": cardsVisiblesDashboard,
                ...Object.fromEntries(Object.entries(marcas).map(([marca]) => [`dashboard.${marca}`, true]))
            }).catch(error => console.warn("No se pudo guardar la migración de cards:", error))
        }
    } catch (error) {
        console.warn("No se pudieron cargar las cards visibles del dashboard:", error)
        cardsVisiblesDashboard = [...DEFAULT_CARDS_VISIBLES]
        cardsOrdenDashboard = [...DEFAULT_CARDS_ORDEN]
    }
}

// Guarda una parte de las preferencias del dashboard en Firestore (con notación
// de punto) y la refleja en la sesión. Sin el reflejo en sesión, al volver a
// entrar al dashboard se leería la copia vieja (cards del catálogo y orden) y
// las cards agregadas o reordenadas desaparecerían hasta recargar.
async function guardarPreferenciasDashboard(dashboard) {
    const cambios = {}
    if (dashboard.cardsVisibles !== undefined) cambios["dashboard.cardsVisibles"] = dashboard.cardsVisibles
    if (dashboard.orden !== undefined) cambios["dashboard.orden"] = dashboard.orden

    // Guardar una selección explícita da por recibidas TODAS las tandas: si no,
    // un usuario que nunca pasó por una migración se volvería a encontrar
    // dentro de un tiempo con cards que había quitado a mano.
    const marcasRecibidas = {}
    for (const [marca] of TANDAS_CARDS) {
        if (dashboard[marca] !== undefined) {
            cambios[`dashboard.${marca}`] = dashboard[marca]
            marcasRecibidas[marca] = dashboard[marca]
        }
    }
    if (dashboard.cardsVisibles !== undefined) {
        for (const [marca] of TANDAS_CARDS) {
            cambios[`dashboard.${marca}`] = true
            marcasRecibidas[marca] = true
        }
    }

    await actualizarPreferencias(uid, cambios)
    const preferencias = sesion.getPreferencias()
    sesion.setPreferencias({
        ...preferencias,
        dashboard: {
            ...(preferencias.dashboard || {}),
            ...dashboard,
            ...marcasRecibidas
        }
    })
}

// ============================================
// INSTANCIAS: RESOLUCIÓN, MONTAJE Y PODA
// ============================================

// Devuelve la entidad (cuenta o posición) a la que apunta una card
// instanciada, o null si ya no existe (cuenta borrada, posición cerrada).
function entidadDeInstancia(id) {
    const { tipo, entidadId } = entidadDeCardInstancia(id)
    if (tipo === "cuenta") {
        const cuenta = cuentas.find(item => item.id === entidadId)
        return cuenta ? { tipo, cuenta } : null
    }
    const posicion = posicionesData.find(item => item.activoId === entidadId)
    return posicion ? { tipo, posicion } : null
}

// Las instancias cuya entidad ya no existe se eliminan de las preferencias
// (una cuenta borrada no debe dejar una card fantasma en el orden). Solo
// cuando los datos ya están cargados: si no, la entidad simplemente aún no
// se conoce y se conservaría por error.
function podarInstanciasInvalidas() {
    if (!instanciasResueltas) return
    const validas = cardsVisiblesDashboard.filter(id => !esCardInstancia(id) || entidadDeInstancia(id))
    if (validas.length === cardsVisiblesDashboard.length) return

    cardsVisiblesDashboard = validas
    cardsOrdenDashboard = normalizarCardsOrden(
        cardsOrdenDashboard.filter(id => !esCardInstancia(id) || validas.includes(id))
    )

    guardarPreferenciasDashboard({
        cardsVisibles: cardsVisiblesDashboard,
        orden: cardsOrdenDashboard
    }).catch(error => console.warn("No se pudo limpiar una card de cuenta/activo:", error))
}

// Crea el nodo de las cards instanciadas que falten y retira las que ya no
// apliquen. Se llama tras cargar los datos y al cambiar la selección; el
// reparto en columnas lo hace después aplicarLayoutDashboard().
function montarCardsInstanciadas() {
    const grid = document.querySelector(".dashboard")
    if (!grid) return

    podarInstanciasInvalidas()

    const requeridas = cardsVisiblesDashboard.filter(esCardInstancia)
    const montadas = new Map()
    grid.querySelectorAll("[data-dashboard-card]").forEach(card => {
        const id = card.dataset.dashboardCard
        if (esCardInstancia(id)) montadas.set(id, card)
    })

    requeridas.forEach(id => {
        if (montadas.has(id)) return
        const nodo = construirCardInstancia(id)
        if (!nodo) return
        grid.appendChild(nodo)
        enlazarCardInstancia(nodo, id)
        montadas.set(id, nodo)
    })

    requeridas.forEach(id => {
        const card = montadas.get(id)
        if (card) pintarCardInstancia(id, card)
    })

    montadas.forEach((card, id) => {
        if (card && !requeridas.includes(id)) card.remove()
    })
}

function construirCardInstancia(id) {
    const entidad = entidadDeInstancia(id)
    if (!entidad) return null
    return entidad.tipo === "cuenta"
        ? plantillaCardCuenta(entidad.cuenta)
        : plantillaCardActivo(entidad.posicion)
}

function cantidadDeActivo(valor) {
    const numero = Number(valor)
    if (!Number.isFinite(numero)) return "0"
    return Math.abs(numero) >= 1000
        ? numero.toLocaleString("es-PE", { maximumFractionDigits: 2 })
        : String(Number(numero.toFixed(4)))
}

function filaDato(etiqueta, valor) {
    if (!valor) return ""
    return `
        <div class="card-dato">
            <span class="card-dato-label">${etiqueta}</span>
            <span class="card-dato-valor">${valor}</span>
        </div>
    `
}

// ============================================
// COMPRIMIR / EXPANDIR UNA CARD
// ============================================
// Cada card instanciada (cuenta o activo) se muestra a tamaño normal, que es
// el estado por defecto: valor grande, subtítulo, barra de uso y el desglose
// de datos. El botón del encabezado la comprime a una fila con solo los
// números en pequeño: la cifra y, si la card lo tiene, el badge de estado. Al
// volver a pulsarlo se despliega otra vez el resumen a tamaño normal.
//
// El estado vive en localStorage (no en Firestore) porque es una preferencia
// de vista, no del perfil: por eso las cards pueden redibujarse por completo
// (esqueletos, refresco, cambio de divisa) sin perderla.

const STORAGE_CARDS_COMPRIMIDAS = "escinco_cards_comprimidas"

function leerCardsComprimidas() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_CARDS_COMPRIMIDAS) || "[]")
        return new Set(Array.isArray(raw) ? raw.filter(esCardInstancia) : [])
    } catch (e) {
        return new Set()
    }
}

let cardsComprimidas = leerCardsComprimidas()

function persistirCardsComprimidas() {
    try {
        localStorage.setItem(STORAGE_CARDS_COMPRIMIDAS, JSON.stringify([...cardsComprimidas]))
    } catch (e) {}
}

const ETIQUETA_COMPRIMIR = "Comprimir tarjeta"
const ETIQUETA_EXPANDIR = "Ver detalle de la tarjeta"

function pintarEstadoCompresion(card, comprimida) {
    card.classList.toggle("card-comprimida", comprimida)
    const boton = card.querySelector("[data-card-comprimir]")
    if (!boton) return
    const etiqueta = comprimida ? ETIQUETA_EXPANDIR : ETIQUETA_COMPRIMIR
    boton.setAttribute("aria-expanded", comprimida ? "false" : "true")
    boton.setAttribute("aria-label", etiqueta)
    boton.title = etiqueta
}

function alternarCompresionCard(card, id) {
    if (cardsComprimidas.has(id)) cardsComprimidas.delete(id)
    else cardsComprimidas.add(id)
    pintarEstadoCompresion(card, cardsComprimidas.has(id))
    persistirCardsComprimidas()
    // El masonry reparte por altura real: sin forzar el repase, la card
    // seguiría ocupando el hueco que tenía expandida.
    aplicarLayoutDashboard(true)
}

// Botón del encabezado. El chevron apunta a la acción: arriba para comprimir,
// y al girar 180° (CSS) queda abajo para volver a desplegar.
function botonComprimirCard() {
    return `
        <button type="button" class="card-comprimir" data-card-comprimir
            aria-expanded="true" aria-label="${ETIQUETA_COMPRIMIR}" title="${ETIQUETA_COMPRIMIR}">
            ${icono("chevron-up", 14)}
        </button>
    `
}

// Card de una cuenta. No lista movimientos ni cantidades de operación: solo
// el estado del saldo. En tarjetas de crédito cambia por completo (línea de
// crédito, uso, ciclo de facturación y anualidad).
function plantillaCardCuenta(cuenta) {
    const esCredito = cuenta.tipo === "credito"
    const prefijo = `cuenta-card-${cuenta.id}`
    const etiqueta = ETIQUETAS_TIPO_CUENTA[cuenta.tipo] || "Cuenta"

    return `
        <div class="glass card card-navegable card-cuenta${esCredito ? " card-cuenta-credito" : ""}"
            id="card-${prefijo}" data-dashboard-card="${idCardCuenta(cuenta.id)}"
            role="group" tabindex="0" aria-label="${cuenta.nombre || etiqueta}">
            <div class="card-header">
                <span class="card-title">${etiqueta}</span>
                <div class="card-header-controles">
                    <span class="card-badge" id="${prefijo}-estado">${skeletonText("skeleton-badge")}</span>
                    ${botonComprimirCard()}
                </div>
            </div>
            <div class="card-value" id="${prefijo}-valor">${skeletonText("skeleton-value")}</div>
            <div class="card-sub" id="${prefijo}-detalle">${skeletonText()}</div>
            ${esCredito ? `
                <div class="card-uso">
                    <div class="card-uso-barra"><span id="${prefijo}-barra"></span></div>
                    <span class="card-uso-pct" id="${prefijo}-porcentaje"></span>
                </div>
            ` : ""}
            <div class="card-datos" id="${prefijo}-datos"></div>
        </div>
    `
}

// Card de un activo con posición abierta: valor, resultado y desglose de la
// posición (cantidad, precio promedio y último precio).
function plantillaCardActivo(posicion) {
    const prefijo = `activo-card-${posicion.activoId}`

    return `
        <div class="glass card card-navegable card-activo"
            id="card-${prefijo}" data-dashboard-card="${idCardActivo(posicion.activoId)}"
            role="group" tabindex="0">
            <div class="card-header">
                <span class="card-title" id="${prefijo}-nombre"></span>
                <div class="card-header-controles">
                    <span class="card-badge" id="${prefijo}-estado"></span>
                    ${botonComprimirCard()}
                </div>
            </div>
            <div class="card-value" id="${prefijo}-valor">${skeletonText("skeleton-value")}</div>
            <div class="card-sub" id="${prefijo}-detalle">${skeletonText()}</div>
            <div class="card-datos" id="${prefijo}-datos"></div>
        </div>
    `
}

function pintarCardInstancia(id, card) {
    const entidad = entidadDeInstancia(id)
    if (!entidad) {
        card.remove()
        return
    }
    if (entidad.tipo === "cuenta") pintarCardCuenta(entidad.cuenta, card)
    else pintarCardActivo(entidad.posicion, card)
}

function pintarCardCuenta(cuenta, card) {
    const prefijo = `cuenta-card-${cuenta.id}`
    const valorEl = card.querySelector(`#${prefijo}-valor`)
    const detalleEl = card.querySelector(`#${prefijo}-detalle`)
    const estadoEl = card.querySelector(`#${prefijo}-estado`)
    const datosEl = card.querySelector(`#${prefijo}-datos`)
    if (!valorEl || !detalleEl) return

    card.setAttribute("title", `Ver ${cuenta.nombre || "cuenta"}`)
    const moneda = String(cuenta.moneda || cuenta.divisa || "pen").toLowerCase()

    if (cuenta.tipo === "credito") {
        const uso = nivelUsoDe(cuenta)
        const ciclo = estadoCicloDe(cuenta, movimientosCompletosData)
        const anualidad = proximaAnualidad(cuenta)
        const corte = cuenta.diaCorte ? `Corte día ${cuenta.diaCorte}` : ""
        const pago = cuenta.diaPago ? `Pago día ${cuenta.diaPago}` : ""

        valorEl.textContent = formatearMontoConDivisa(uso.deuda, moneda)
        valorEl.classList.remove("positive", "negative")
        if (uso.deuda > 0) valorEl.classList.add("negative")

        if (detalleEl) {
            detalleEl.textContent = uso.limite > 0
                ? `De ${formatearMontoConDivisa(uso.limite, moneda)}`
                : "Sin línea de crédito definida"
        }

        if (estadoEl) {
            estadoEl.classList.remove("aviso", "critico", "positive")
            if (ciclo.pagadoCompleto) {
                estadoEl.textContent = "Pagado"
                estadoEl.classList.add("positive")
            } else if (ciclo.restante > 0) {
                estadoEl.textContent = "Pendiente"
                estadoEl.classList.add(uso.nivel === "critico" ? "critico" : "aviso")
            } else {
                estadoEl.textContent = "Al día"
                estadoEl.classList.add("positive")
            }
        }

        const barraEl = card.querySelector(`#${prefijo}-barra`)
        if (barraEl) {
            barraEl.style.width = `${Math.min(100, uso.porcentaje).toFixed(1)}%`
            barraEl.className = uso.nivel
        }
        const porcentajeEl = card.querySelector(`#${prefijo}-porcentaje`)
        if (porcentajeEl) {
            porcentajeEl.textContent = uso.limite > 0 ? `${uso.porcentaje.toFixed(0)}%` : "—"
            porcentajeEl.className = `card-uso-pct ${uso.nivel}`
        }

        if (datosEl) {
            datosEl.innerHTML = [
                filaDato("Ciclo", [corte, pago].filter(Boolean).join(" · ") || "Sin fechas definidas"),
                filaDato("Por pagar", ciclo.pagadoCompleto
                    ? "Estado de cuenta pagado"
                    : ciclo.restante > 0
                        ? formatearMontoConDivisa(ciclo.restante, moneda)
                        : "Sin saldo pendiente"),
                filaDato("Anualidad", anualidad
                    ? `${formatearMontoConDivisa(anualidad.monto, moneda)} · ${formatearFecha(anualidad.fecha)}`
                    : cuenta.desgravamen
                        ? `Desgravamen ${cuenta.desgravamen}%`
                        : "")
            ].join("")
        }
        return
    }

    const saldo = Number(cuenta.saldoInicial) || 0
    valorEl.textContent = formatearMontoConDivisa(saldo, moneda)
    valorEl.classList.remove("positive", "negative")
    if (saldo > 0) valorEl.classList.add("positive")
    else if (saldo < 0) valorEl.classList.add("negative")

    if (detalleEl) {
        const monedaDistinta = moneda !== divisaActual
        detalleEl.textContent = monedaDistinta
            ? formatearMontoConDivisa(convertirMonto(saldo, moneda, divisaActual), divisaActual)
            : "Saldo disponible"
    }

    if (estadoEl) {
        // En una cuenta no crédito el badge queda libre: el estado
        // (activa/archivada) no se muestra. Las archivadas ya ni siquiera
        // llegan aquí, y "activa" es el estado por defecto: solo añadiría ruido.
        estadoEl.textContent = ""
        estadoEl.hidden = true
    }

    if (datosEl) {
        datosEl.innerHTML = [
            filaDato("Divisa", presentarDivisa(moneda)),
            filaDato("Alta", cuenta.fechaCreacion ? formatearFecha(cuenta.fechaCreacion) : "")
        ].join("")
    }
}

function pintarCardActivo(posicion, card) {
    const activo = posicion.activo || {}
    const prefijo = `activo-card-${posicion.activoId}`
    const nombreEl = card.querySelector(`#${prefijo}-nombre`)
    const estadoEl = card.querySelector(`#${prefijo}-estado`)
    const valorEl = card.querySelector(`#${prefijo}-valor`)
    const detalleEl = card.querySelector(`#${prefijo}-detalle`)
    const datosEl = card.querySelector(`#${prefijo}-datos`)
    if (!valorEl || !detalleEl) return

    const cantidad = Number(posicion.cantidad) || 0
    const precioPromedio = Number(posicion.precioPromedio) || 0
    const ultimoPrecio = Number(activo.ultimoPrecio) || 0
    const valorTotal = cantidad * ultimoPrecio
    const ganancia = (ultimoPrecio - precioPromedio) * cantidad
    const rendimiento = precioPromedio > 0 ? (ultimoPrecio / precioPromedio - 1) * 100 : 0
    const divisa = String(posicion.divisa || "usd").toLowerCase()
    // Sin precio vigente (o sin precio de entrada) no hay nada que valorar:
    // mostrar un -100% inventado sería peor que no mostrar resultado.
    const sinPrecio = ultimoPrecio <= 0 || precioPromedio <= 0

    card.setAttribute("title", `Ver ${activo.nombre || activo.simbolo || "activo"}`)
    if (nombreEl) nombreEl.textContent = activo.nombre || activo.simbolo || "Activo"
    if (estadoEl) estadoEl.textContent = activo.simbolo || ETIQUETAS_TIPO_ACTIVO[activo.tipo] || "Activo"

    valorEl.classList.remove("positive", "negative")

    if (sinPrecio) {
        valorEl.textContent = formatearMontoConDivisa(0, divisaActual)
        detalleEl.textContent = "Sin precio para valorar"
    } else {
        valorEl.textContent = formatearMontoConDivisa(convertirMonto(valorTotal, divisa, divisaActual), divisaActual)
        const signo = ganancia >= 0 ? "+" : ""
        detalleEl.textContent = `${signo}${formatearMontoConDivisa(convertirMonto(ganancia, divisa, divisaActual), divisaActual)} · ${rendimiento >= 0 ? "+" : ""}${rendimiento.toFixed(1)}%`
        if (ganancia > 0) valorEl.classList.add("positive")
        else if (ganancia < 0) valorEl.classList.add("negative")
    }

    if (datosEl) {
        datosEl.innerHTML = [
            filaDato("Cantidad", `${cantidadDeActivo(cantidad)} ${activo.simbolo || ""}`.trim()),
            filaDato("Precio", `${formatearMontoConDivisa(ultimoPrecio, divisa)} · prom. ${formatearMontoConDivisa(precioPromedio, divisa)}`),
            filaDato("Tipo", ETIQUETAS_TIPO_ACTIVO[activo.tipo] || "")
        ].join("")
    }
}

// Navegación de las cards instanciadas: la de cuenta aterriza en /cuentas con
// esa cuenta seleccionada; la de activo, en /inversiones.
function enlazarCardInstancia(card, id) {
    const ir = async () => {
        if (modoEdicionDashboard) return
        const entidad = entidadDeInstancia(id)
        if (!entidad) return
        if (entidad.tipo === "cuenta") {
            const { seleccionarCuentaPorId } = await import("./cuentas.js")
            seleccionarCuentaPorId(entidad.cuenta.id)
            navigateTo("/cuentas")
            return
        }
        navigateTo("/inversiones")
    }

    card.addEventListener("click", ir)
    card.addEventListener("keydown", evento => {
        if (evento.key === "Enter" || evento.key === " ") {
            evento.preventDefault()
            ir()
        }
    })

    // El botón de comprimir vive dentro de una card que navega al hacer clic:
    // sin cortar la propagación, pulsarlo abriría la cuenta o la posición.
    card.querySelector("[data-card-comprimir]")?.addEventListener("click", evento => {
        evento.preventDefault()
        evento.stopPropagation()
        alternarCompresionCard(card, id)
    })

    pintarEstadoCompresion(card, cardsComprimidas.has(id))
}

function cantidadColumnasDashboard() {
    if (window.matchMedia("(max-width: 599px)").matches) return 1
    if (window.matchMedia("(max-width: 899px)").matches) return 2
    if (window.matchMedia("(max-width: 1199px)").matches) return 3
    return 4
}

function alturaMasonryCard(card, gap) {
    const alturaRect = card.getBoundingClientRect().height
    if (alturaRect > 0) return alturaRect

    // Una card oculta o aún sin pintar mide 0. Se estima con su min-height en
    // vez de leer estilos uno a uno: es un fallback, y getComputedStyle en un
    // bucle es de las cosas que más engordan el coste de un reparto.
    const alturaMinima = Number.parseFloat(window.getComputedStyle(card).minHeight) || 0
    return Math.max(alturaMinima, 148) + gap
}

function crearColumnasDashboard(cards, ordenVisible, cantidadColumnas, grid) {
    const columnas = Array.from({ length: cantidadColumnas }, () => {
        const columna = document.createElement("div")
        columna.className = "dashboard-column"
        return columna
    })
    const alturas = Array.from({ length: cantidadColumnas }, () => 0)
    const visibles = new Set(ordenVisible)

    cards.forEach(card => {
        card.hidden = !visibles.has(card.dataset.dashboardCard)
    })

    // Ordenar en dos fases: primero todas las medidas, después todos los
    // appendChild. Intercalarlos (medir, mover, medir, mover…) obligaba al
    // navegador a recalcular la composición sin parar, porque cada append
    // invalida lo medido justo antes: con ~20 cards eran ~20 reflows
    // síncronos por cada reparto. Y se dispara en cada refresco de datos,
    // en cada resize y al comprimir una card.
    //
    // El Map evita además el cards.find() dentro del bucle, que era O(n²).
    const porId = new Map(cards.map(card => [card.dataset.dashboardCard, card]))
    const aColocar = ordenVisible
        .map(id => porId.get(id))
        .filter(Boolean)

    // Única fase de lectura: no se toca el DOM dentro.
    const gap = Number.parseFloat(window.getComputedStyle(grid).rowGap) || 0
    const alturasMedidas = aColocar.map(card => alturaMasonryCard(card, gap))

    // Fase de escritura: solo appendChild, sin volver a leer nada.
    aColocar.forEach((card, indice) => {
        const columna = alturas.indexOf(Math.min(...alturas))
        columnas[columna].appendChild(card)
        alturas[columna] += alturasMedidas[indice]
    })

    cards.filter(card => card.hidden).forEach(card => columnas[columnas.length - 1].appendChild(card))
    return columnas
}

function aplicarLayoutDashboard(forzar = false) {
    const grid = document.querySelector(".dashboard")
    if (!grid) return
    const visibles = new Set(["patrimonio", ...cardsVisiblesDashboard])
    const ordenVisible = ["patrimonio", ...cardsOrdenDashboard.filter(id => visibles.has(id))]
    const cantidadColumnas = cantidadColumnasDashboard()
    const firma = `${cantidadColumnas}|${ordenVisible.join(",")}`
    if (!forzar && grid.dataset.layoutFirma === firma) return

    const cards = [...grid.querySelectorAll("[data-dashboard-card]")]
    const columnas = crearColumnasDashboard(cards, ordenVisible, cantidadColumnas, grid)
    grid.replaceChildren(...columnas)
    grid.dataset.layoutFirma = firma
}

function configurarLayoutDashboard() {
    if (eventosLayoutDashboardListos) return
    eventosLayoutDashboardListos = true
    window.addEventListener("resize", () => {
        clearTimeout(timerLayoutDashboard)
        timerLayoutDashboard = setTimeout(() => aplicarLayoutDashboard(true), 120)
    })
}

function reordenarCardDashboard(idOrigen, idDestino) {
    if (!idOrigen || !idDestino || idOrigen === idDestino || idOrigen === "patrimonio" || idDestino === "patrimonio") return
    const origen = cardsOrdenDashboard.indexOf(idOrigen)
    const destino = cardsOrdenDashboard.indexOf(idDestino)
    if (origen < 0 || destino < 0) return
    cardsOrdenDashboard.splice(origen, 1)
    cardsOrdenDashboard.splice(destino, 0, idOrigen)
    cambiosPendientesDashboard = true
    aplicarLayoutDashboard()
}

function moverCardDashboard(id, direccion) {
    const indice = cardsOrdenDashboard.indexOf(id)
    const destino = indice + direccion
    if (indice < 0 || destino < 0 || destino >= cardsOrdenDashboard.length || id === "patrimonio") return
    [cardsOrdenDashboard[indice], cardsOrdenDashboard[destino]] = [cardsOrdenDashboard[destino], cardsOrdenDashboard[indice]]
    cambiosPendientesDashboard = true
    aplicarLayoutDashboard()
}

function prepararEdicionCardsDashboard() {
    document.querySelectorAll(".dashboard [data-dashboard-card]").forEach(card => {
        const id = card.dataset.dashboardCard
        if (id === "patrimonio") {
            card.draggable = false
            return
        }
        card.draggable = true
        const controlesExistentes = card.querySelector(".dashboard-card-edicion")
        if (controlesExistentes) {
            controlesExistentes.querySelector("[data-dashboard-drag-handle]")?.removeAttribute("draggable")
            return
        }
        const controles = document.createElement("div")
        controles.className = "dashboard-card-edicion"
        controles.innerHTML = `
            <span class="dashboard-card-handle" data-dashboard-drag-handle role="button" tabindex="0" aria-label="Arrastrar card">${icono("grip", 16)}</span>
            <button type="button" class="dashboard-card-mover" data-dashboard-mover data-id="${id}" data-direccion="-1" aria-label="Mover card hacia arriba">↑</button>
            <button type="button" class="dashboard-card-mover" data-dashboard-mover data-id="${id}" data-direccion="1" aria-label="Mover card hacia abajo">↓</button>
        `
        card.appendChild(controles)
    })
}

function desactivarEdicionCardsDashboard() {
    document.querySelectorAll(".dashboard [data-dashboard-card]").forEach(card => {
        card.draggable = false
        card.classList.remove("dashboard-card-arrastrando")
    })
    document.body.classList.remove("dashboard-card-dragging")
}

function configurarEventosReordenamientoDashboard() {
    const grid = document.querySelector(".dashboard")
    if (!grid || grid.dataset.reordenamientoListos === "1") return
    grid.dataset.reordenamientoListos = "1"

    grid.addEventListener("dragstart", (evento) => {
        const card = evento.target.closest("[data-dashboard-card]")
        if (!modoEdicionDashboard || !card || card.dataset.dashboardCard === "patrimonio") {
            evento.preventDefault()
            return
        }
        evento.dataTransfer?.setData("text/plain", card.dataset.dashboardCard)
        if (evento.dataTransfer) {
            evento.dataTransfer.effectAllowed = "move"
            evento.dataTransfer.setDragImage(card, 24, 24)
        }
        card.classList.add("dashboard-card-arrastrando")
        document.body.classList.add("dashboard-card-dragging")
    })

    grid.addEventListener("dragover", (evento) => {
        const card = evento.target.closest("[data-dashboard-card]")
        if (!modoEdicionDashboard || !card || card.dataset.dashboardCard === "patrimonio") return
        evento.preventDefault()
        if (evento.dataTransfer) evento.dataTransfer.dropEffect = "move"
    })

    grid.addEventListener("drop", (evento) => {
        const destino = evento.target.closest("[data-dashboard-card]")
        if (!modoEdicionDashboard || !destino || destino.dataset.dashboardCard === "patrimonio") return
        evento.preventDefault()
        const origen = evento.dataTransfer?.getData("text/plain")
        reordenarCardDashboard(origen, destino.dataset.dashboardCard)
    })

    grid.addEventListener("dragend", (evento) => {
        evento.target.closest("[data-dashboard-card]")?.classList.remove("dashboard-card-arrastrando")
        document.body.classList.remove("dashboard-card-dragging")
    })

    grid.addEventListener("click", (evento) => {
        const boton = evento.target.closest("[data-dashboard-mover]")
        if (!modoEdicionDashboard || !boton) return
        evento.stopPropagation()
        moverCardDashboard(boton.dataset.id, Number(boton.dataset.direccion))
    })
}

async function manejarTeclaEdicionDashboard(evento) {
    if ((evento.key !== "Escape" && evento.key !== "Enter") || !modoEdicionDashboard) return
    if (document.querySelector(".modal-overlay")) return
    if (evento.target instanceof Element && evento.target.closest("button, a, input, select, textarea, [contenteditable='true']")) return
    evento.preventDefault()
    if (evento.key === "Enter" || cambiosPendientesDashboard) {
        await guardarYSalirEdicionDashboard()
        return
    }
    salirModoEdicionDashboard()
}

function configurarEdicionDashboard() {
    if (!eventosEdicionDashboardListos) {
        eventosEdicionDashboardListos = true
        document.addEventListener("pagina-cambiando", manejarCambioPaginaDashboard)
        document.addEventListener("keydown", manejarTeclaEdicionDashboard)
    }

    document.getElementById("dashboard-abrir-cards")?.addEventListener("click", abrirSelectorCardsDashboard)
    document.getElementById("dashboard-listo")?.addEventListener("click", guardarYSalirEdicionDashboard)
}

function activarModoEdicionDashboard() {
    modoEdicionDashboard = true
    cambiosPendientesDashboard = false
    document.getElementById("dashboard-edicion-bar")?.removeAttribute("hidden")
    document.querySelector(".dashboard")?.classList.add("dashboard-edicion-activo")
    configurarEventosReordenamientoDashboard()
    prepararEdicionCardsDashboard()
    mostrarNotificacion("info", "Modo edición del dashboard activo")
}

function salirModoEdicionDashboard(forzar = false) {
    if (!modoEdicionDashboard) return
    if (cambiosPendientesDashboard && !forzar) {
        mostrarNotificacion("warning", "Guarda o reinicia los cambios antes de salir")
        return
    }
    modoEdicionDashboard = false
    cambiosPendientesDashboard = false
    document.getElementById("dashboard-edicion-bar")?.setAttribute("hidden", "")
    document.querySelector(".dashboard")?.classList.remove("dashboard-edicion-activo")
    desactivarEdicionCardsDashboard()
}

async function guardarOrdenDashboard() {
    try {
        await guardarPreferenciasDashboard({ orden: cardsOrdenDashboard })
        cambiosPendientesDashboard = false
        return true
    } catch (error) {
        console.error("Error guardando orden del dashboard:", error)
        mostrarNotificacion("error", "No se pudo guardar el orden del dashboard")
        return false
    }
}

async function guardarYSalirEdicionDashboard() {
    if (!cambiosPendientesDashboard) {
        salirModoEdicionDashboard()
        return
    }
    if (!await guardarOrdenDashboard()) return
    salirModoEdicionDashboard(true)
    mostrarNotificacion("exito", "Orden del dashboard guardado")
}

function manejarCambioPaginaDashboard(evento) {
    if (evento.detail?.desde !== "dashboard") return
    if (!modoEdicionDashboard || !cambiosPendientesDashboard) {
        salirModoEdicionDashboard(true)
        return
    }

    evento.preventDefault()
    const hacia = evento.detail.hacia
    mostrarNotificacion("warning", "Hay cambios sin guardar en el dashboard", 0, [
        {
            texto: "Guardar y salir",
            primaria: true,
            alClick: async () => {
                if (!await guardarOrdenDashboard()) return
                salirModoEdicionDashboard(true)
                navigateTo(hacia === "dashboard" ? "/" : `/${hacia}`)
            }
        },
        {
            texto: "Cancelar",
            clase: "cancel",
            alClick: () => {}
        }
    ])
}

// Bloque de cards instanciadas dentro del selector: una casilla por cuenta y
// otra por activo con posición abierta.
function bloqueInstanciasSelector(titulo, descripcion, opciones, vacio) {
    return `
        <div class="dashboard-editor-bloque">
            <span class="dashboard-editor-titulo">${titulo}</span>
            <p class="dashboard-editor-hint">${descripcion}</p>
            ${opciones.length > 0
                ? `<div class="dashboard-editor-grid">${opciones.join("")}</div>`
                : `<p class="dashboard-editor-hint">${vacio}</p>`}
        </div>
    `
}

function opcionesInstanciasCuentas(activas) {
    return cuentas.map(cuenta => {
        const id = idCardCuenta(cuenta.id)
        const etiqueta = ETIQUETAS_TIPO_CUENTA[cuenta.tipo] || "Cuenta"
        return `
            <label class="dashboard-card-opcion">
                <input type="checkbox" value="${id}" ${activas.has(id) ? "checked" : ""}>
                <span>
                    ${cuenta.nombre || "Cuenta"}
                    <small>${etiqueta}</small>
                </span>
            </label>
        `
    })
}

function opcionesInstanciasActivos(activas) {
    return posicionesData.map(posicion => {
        const id = idCardActivo(posicion.activoId)
        const activo = posicion.activo || {}
        return `
            <label class="dashboard-card-opcion">
                <input type="checkbox" value="${id}" ${activas.has(id) ? "checked" : ""}>
                <span>
                    ${activo.simbolo || activo.nombre || "Activo"}
                    <small>${ETIQUETAS_TIPO_ACTIVO[activo.tipo] || "Activo"}</small>
                </span>
            </label>
        `
    })
}

function abrirSelectorCardsDashboard() {
    if (!modoEdicionDashboard) return
    const cards = DASHBOARD_CARDS.filter(card => card.id !== "patrimonio")
    const activas = new Set(cardsVisiblesDashboard)
    const opciones = cards.map(card => `
        <label class="dashboard-card-opcion">
            <input type="checkbox" value="${card.id}" ${activas.has(card.id) ? "checked" : ""}>
            <span>${card.label}</span>
        </label>
    `).join("")

    const cuentasBloque = bloqueInstanciasSelector(
        "Tus cuentas",
        "Una card por cuenta, con su saldo. Las tarjetas de crédito muestran además línea de crédito, uso y ciclo de facturación.",
        opcionesInstanciasCuentas(activas),
        "Todavía no tienes cuentas."
    )
    const activosBloque = bloqueInstanciasSelector(
        "Tus activos",
        "Una card por activo en el que tengas una posición abierta.",
        opcionesInstanciasActivos(activas),
        "No tienes posiciones abiertas todavía."
    )

    const cambiosPendientesAntesModal = cambiosPendientesDashboard
    const modal = abrirModal({
        titulo: "Elegir cards del dashboard",
        variante: "form",
        confirmText: "Guardar",
        cancelText: "Cancelar",
        onCancel: () => { cambiosPendientesDashboard = cambiosPendientesAntesModal },
        footerExtra: '<button type="button" class="modal-btn modal-btn-secondary" data-dashboard-reset>Restablecer</button>',
        contenido: `
            <div class="dashboard-editor">
                <div class="dashboard-editor-grid">${opciones}</div>
                ${cuentasBloque}
                ${activosBloque}
            </div>
        `,
        onConfirm: async () => {
            const seleccionadas = [...modal.querySelectorAll(".dashboard-editor input:checked")].map(input => input.value)
            // El orden se conserva para las cards que siguen activas; las
            // nuevas entran al final hasta que el usuario las mueva.
            const ordenPrevio = cardsOrdenDashboard.filter(id => seleccionadas.includes(id))
            const nuevas = seleccionadas.filter(id => !ordenPrevio.includes(id))
            const orden = normalizarCardsOrden([...ordenPrevio, ...nuevas])
            const visibles = normalizarCardsVisibles(seleccionadas)

            try {
                await guardarPreferenciasDashboard({
                    cardsVisibles: visibles,
                    orden
                })
                cardsVisiblesDashboard = visibles
                cardsOrdenDashboard = orden
                cambiosPendientesDashboard = false
                montarCardsInstanciadas()
                if (modoEdicionDashboard) prepararEdicionCardsDashboard()
                aplicarLayoutDashboard(true)
                mostrarNotificacion("exito", "Cards del dashboard actualizadas")
                return true
            } catch (error) {
                console.error("Error guardando cards del dashboard:", error)
                mostrarNotificacion("error", "No se pudo guardar la selección de cards")
                return false
            }
        }
    })

    modal.querySelector("[data-dashboard-reset]")?.addEventListener("click", () => {
        cambiosPendientesDashboard = true
        modal.querySelectorAll(".dashboard-editor input").forEach(input => { input.checked = true })
    })
    modal.querySelectorAll(".dashboard-editor input").forEach(input => {
        input.addEventListener("change", () => { cambiosPendientesDashboard = true })
    })
}

export function abrirEditorDashboard() {
    activarModoEdicionDashboard()
}

// Periodos del gráfico de patrimonio. "todo" usa un tope alto de días.
const PERIODOS_GRAFICO = [
    { id: "7d", etiqueta: "7D", dias: 7, sub: "Últimos 7 días" },
    { id: "30d", etiqueta: "30D", dias: 30, sub: "Últimos 30 días" },
    { id: "90d", etiqueta: "90D", dias: 90, sub: "Últimos 90 días" },
    { id: "1a", etiqueta: "1A", dias: 365, sub: "Último año" },
    { id: "todo", etiqueta: "Todo", dias: 3650, sub: "Histórico completo" }
]
const PERIODO_POR_DEFECTO = "30d"

let periodoGrafico = PERIODO_POR_DEFECTO

// Ventana deslizante de las cards Gastado / Ingresado / Balance. A diferencia
// de PERIODOS_GRAFICO no necesita "1A" ni "Todo": son cifras de flujo, y un
// histórico completo no aporta contexto. El toggle vive en la card "Gastado"
// y gobierna las tres.
const PERIODOS_FLUJO = [
    { id: "7d", etiqueta: "7D", dias: 7, sub: "Últimos 7 días" },
    { id: "30d", etiqueta: "30D", dias: 30, sub: "Últimos 30 días" },
    { id: "90d", etiqueta: "90D", dias: 90, sub: "Últimos 90 días" }
]
const PERIODO_FLUJO_POR_DEFECTO = "30d"

let periodoFlujo = PERIODO_FLUJO_POR_DEFECTO

function normalizarNivelResalte(valor) {
    const nivel = Number(valor)
    return [0, 1, 2].includes(nivel) ? nivel : 0
}

function obtenerPeriodo(id) {
    return PERIODOS_GRAFICO.find(p => p.id === id) || PERIODOS_GRAFICO[1]
}

function obtenerPeriodoFlujo(id) {
    return PERIODOS_FLUJO.find(p => p.id === id) || PERIODOS_FLUJO[1]
}

// ============================================
// RENDER
// ============================================

export function render() {
    configurarCardsDashboardDesdeSesion()
    const nivelResalte = normalizarNivelResalte(sesion.getPreferencias()?.resaltarPatrimonio)
    const contenido = `
        <div class="dashboard-edicion-bar" id="dashboard-edicion-bar" hidden>
            <div class="dashboard-edicion-acciones">
                <button type="button" class="glass-btn glass" id="dashboard-abrir-cards">Añadir/quitar cards</button>
                <button type="button" class="glass-btn glass" id="dashboard-listo">Listo</button>
            </div>
        </div>
        <div class="dashboard dashboard-cargando">
            <div class="glass card primary patrimonio-card${nivelResalte ? ` resaltado-${nivelResalte}` : ""}" data-dashboard-card="patrimonio" role="button" tabindex="0" aria-haspopup="dialog" aria-label="Patrimonio total, valor actual">
                <div class="card-header">
                    <span class="card-title">Patrimonio Total</span>
                    <select class="divisa-select" id="divisa-select" aria-label="Divisa">
                         <option value="pen">${getFormatoDivisa() === "codigo" ? "PEN" : presentarDivisa("pen")}</option>
                         <option value="usd">${getFormatoDivisa() === "codigo" ? "USD" : presentarDivisa("usd")}</option>
                         <option value="usdt">${getFormatoDivisa() === "codigo" ? "USDT" : presentarDivisa("usdt")}</option>
                    </select>
                </div>
                <div class="card-value" id="patrimonio-valor" aria-live="polite">${skeletonText("skeleton-value-large")}</div>
                <div class="card-sub" id="patrimonio-detalle">${skeletonText()}</div>
            </div>

            <div class="glass card card-navegable positive" id="card-cuentas" data-dashboard-card="cuentas" role="button" tabindex="0" title="Ver cuentas">
                <div class="card-title">Cuentas</div>
                <div class="card-value" id="total-cuentas">${skeletonText("skeleton-value")}</div>
                <div class="card-sub">Activas y tarjetas</div>
            </div>

            <div class="glass card card-navegable" id="card-inversiones" data-dashboard-card="inversiones" role="button" tabindex="0" title="Ver inversiones">
                <div class="card-title">Inversiones</div>
                <div class="card-value" id="inversiones-valor">${skeletonText("skeleton-value")}</div>
                <div class="card-sub" id="inversiones-detalle">${skeletonText()}</div>
            </div>

            <div class="glass card card-navegable" id="card-vencimientos" data-dashboard-card="vencimientos" role="button" tabindex="0" title="Ver pendientes">
                <div class="card-title">Próximos vencimientos</div>
                <div class="card-value" id="vencimientos-cantidad">${skeletonText("skeleton-value")}</div>
                <div class="card-sub" id="vencimientos-detalle">${skeletonText()}</div>
            </div>

            <div class="glass card card-navegable movimientos-card" id="card-movimientos" data-dashboard-card="movimientos" role="button" tabindex="0" title="Ver movimientos">
                <div class="card-title">Últimos movimientos</div>
                <div class="movimientos-lista" id="movimientos-lista">
                    ${skeletonMarkup({ rows: 2, className: "skeleton-dashboard-list" })}
                </div>
            </div>

            <div class="glass card card-navegable favoritos-card" id="card-favoritos" data-dashboard-card="favoritos" role="button" tabindex="0" title="Ver inversiones">
                <div class="card-header">
                    <span class="card-title">Favoritos</span>
                    <span class="card-badge" id="favoritos-cantidad">${skeletonText("skeleton-badge")}</span>
                </div>
                <div class="favoritos-lista" id="favoritos-lista">
                    ${skeletonMarkup({ rows: 2, className: "skeleton-dashboard-list" })}
                </div>
            </div>

            <div class="glass card metas-card" id="card-metas" data-dashboard-card="metas" role="region" tabindex="0" aria-label="Metas de ahorro">
                <div class="card-header">
                    <span class="card-title">Metas de ahorro</span>
                    <button type="button" class="glass-btn btn-meta-nueva" id="btn-nueva-meta">
                        ${icono("plus-circle", 14)} Nueva
                    </button>
                </div>
                <div class="metas-lista" id="metas-lista">
                    ${skeletonMarkup({ rows: 2, className: "skeleton-dashboard-list" })}
                </div>
            </div>

            <div class="glass card card-navegable pendientes-card" id="card-pendientes" data-dashboard-card="pendientes" role="button" tabindex="0" title="Ver pendientes">
                <div class="card-header">
                    <span class="card-title">Pendientes</span>
                    <span class="card-badge" id="pendientes-cantidad">${skeletonText("skeleton-badge")}</span>
                </div>
                <div class="pendientes-lista" id="pendientes-lista">${skeletonMarkup({ rows: 2, className: "skeleton-dashboard-list" })}</div>
            </div>

            <div class="glass card card-navegable ordenes-card" id="card-ordenes" data-dashboard-card="ordenes" role="button" tabindex="0" title="Ver órdenes">
                <div class="card-header">
                    <span class="card-title">Órdenes</span>
                    <span class="card-badge" id="ordenes-cantidad">${skeletonText("skeleton-badge")}</span>
                </div>
                <div class="ordenes-lista" id="ordenes-lista">${skeletonMarkup({ rows: 2, className: "skeleton-dashboard-list" })}</div>
                <div class="card-sub" id="ordenes-detalle">${skeletonText()}</div>
            </div>

            <div class="glass card card-navegable distribucion-activos-card" id="card-distribucion-activos" data-dashboard-card="distribucion-activos" role="button" tabindex="0" title="Ver inversiones">
                <div class="card-header">
                    <span class="card-title">Distribución por tipo de activo</span>
                </div>
                <div class="distribucion-lista" id="distribucion-activos-lista">${skeletonMarkup({ rows: 3, className: "skeleton-dashboard-list" })}</div>
            </div>

            <div class="glass card card-navegable patrimonio-divisa-card" id="card-patrimonio-divisa" data-dashboard-card="patrimonio-divisa" role="button" tabindex="0" title="Ver cuentas">
                <div class="card-header">
                    <span class="card-title">Patrimonio por divisa</span>
                </div>
                <div class="divisa-lista" id="patrimonio-divisa-lista">${skeletonMarkup({ rows: 3, className: "skeleton-dashboard-list" })}</div>
            </div>

            <div class="glass card estrategias-card" id="card-estrategias" data-dashboard-card="estrategias" role="region" tabindex="0" aria-label="Próximas estrategias">
                <div class="card-header">
                    <span class="card-title">Estrategias</span>
                    <span class="card-badge" id="estrategias-cantidad">${skeletonText("skeleton-badge")}</span>
                </div>
                <div class="estrategias-lista" id="estrategias-lista">${skeletonMarkup({ rows: 3, className: "skeleton-dashboard-list skeleton-dashboard-list-estrategias" })}</div>
            </div>

            <div class="glass card card-navegable metric-card" id="card-flujo-caja" data-dashboard-card="flujo-caja" role="button" tabindex="0" title="Ver movimientos">
                <div class="card-title">Flujo de caja</div>
                <div class="card-value" id="flujo-caja-valor">${skeletonText("skeleton-value")}</div>
                <div class="card-sub" id="flujo-caja-detalle">${skeletonText()}</div>
            </div>

            <div class="glass card card-navegable metric-card" id="card-gastos-periodo" data-dashboard-card="gastos-periodo" role="button" tabindex="0" title="Ver movimientos">
                <div class="card-header">
                    <span class="card-title">Gastado</span>
                </div>
                <div class="toggle-group grafico-periodos" id="periodo-flujo" role="group" aria-label="Periodo del flujo de caja">
                    ${PERIODOS_FLUJO.map(p => `
                        <span class="toggle-option" data-periodo-flujo="${p.id}">${p.etiqueta}</span>
                    `).join('')}
                </div>
                <div class="card-value negative" id="gastos-periodo-valor">${skeletonText("skeleton-value")}</div>
                <div class="card-sub" id="gastos-periodo-detalle">${skeletonText()}</div>
            </div>

            <div class="glass card card-navegable metric-card" id="card-ingresos-periodo" data-dashboard-card="ingresos-periodo" role="button" tabindex="0" title="Ver movimientos">
                <div class="card-title">Ingresado</div>
                <div class="card-value positive" id="ingresos-periodo-valor">${skeletonText("skeleton-value")}</div>
                <div class="card-sub" id="ingresos-periodo-detalle">${skeletonText()}</div>
            </div>

            <div class="glass card card-navegable metric-card" id="card-balance-periodo" data-dashboard-card="balance-periodo" role="button" tabindex="0" title="Ver movimientos">
                <div class="card-title">Balance</div>
                <div class="card-value" id="balance-periodo-valor">${skeletonText("skeleton-value")}</div>
                <div class="card-sub" id="balance-periodo-detalle">${skeletonText()}</div>
            </div>

            <div class="glass card card-navegable metric-card" id="card-deudas" data-dashboard-card="deudas" role="button" tabindex="0" title="Ver cuentas">
                <div class="card-title">Deudas</div>
                <div class="card-value" id="deudas-valor">${skeletonText("skeleton-value")}</div>
                <div class="card-sub" id="deudas-detalle">${skeletonText()}</div>
            </div>

            <div class="glass card card-navegable metric-card" id="card-ahorro" data-dashboard-card="ahorro" role="button" tabindex="0" title="Ver movimientos">
                <div class="card-title">Ahorro</div>
                <div class="card-value" id="ahorro-valor">${skeletonText("skeleton-value")}</div>
                <div class="card-sub" id="ahorro-detalle">${skeletonText()}</div>
            </div>

            <div class="glass card card-navegable distribucion-card" id="card-distribucion" data-dashboard-card="distribucion" role="button" tabindex="0" title="Ver cuentas">
                <div class="card-header">
                    <span class="card-title">Distribución patrimonial</span>
                </div>
                <div class="distribucion-lista" id="distribucion-lista">${skeletonMarkup({ rows: 3, className: "skeleton-dashboard-list" })}</div>
            </div>

            <div class="glass card programados-card" id="card-programados" data-dashboard-card="programados" role="button" tabindex="0" title="Ver movimientos programados">
                <div class="card-header">
                    <span class="card-title">Programados</span>
                    <span class="card-badge" id="programados-cantidad">${skeletonText("skeleton-badge")}</span>
                </div>
                <div class="programados-lista" id="programados-lista">${skeletonMarkup({ rows: 2, className: "skeleton-dashboard-list" })}</div>
            </div>

            <div class="glass card alertas-card" id="card-alertas" data-dashboard-card="alertas" role="button" tabindex="0" title="Ver alertas">
                <div class="card-header">
                    <span class="card-title">Alertas</span>
                    <span class="card-badge" id="alertas-cantidad">${skeletonText("skeleton-badge")}</span>
                </div>
                <div class="alertas-lista" id="alertas-lista">${skeletonMarkup({ rows: 2, className: "skeleton-dashboard-list" })}</div>
            </div>

            <div class="glass card grafico-patrimonio-card" data-dashboard-card="grafico" role="region" tabindex="0" aria-label="Evolución patrimonial">
                <div class="card-header">
                    <span class="card-title">Evolución patrimonial</span>
                </div>
                <div class="toggle-group grafico-periodos" id="grafico-periodos">
                    ${PERIODOS_GRAFICO.map(p => `
                        <span class="toggle-option" data-periodo="${p.id}">${p.etiqueta}</span>
                    `).join('')}
                </div>
                <div class="grafico-container-dashboard" role="button" tabindex="0" aria-label="Abrir evolución patrimonial">
                    <canvas id="grafico-patrimonio"></canvas>
                    <div class="grafico-estado" id="grafico-estado">${skeletonMarkup({ variant: "chart", label: "Cargando gráfico" })}</div>
                </div>
            </div>
        </div>
    `

    const contenedor = document.createElement("div")
    contenedor.innerHTML = contenido
    const grid = contenedor.querySelector(".dashboard")
    const cards = [...grid.querySelectorAll("[data-dashboard-card]")]
    const visibles = new Set(["patrimonio", ...cardsVisiblesDashboard])
    const ordenVisible = ["patrimonio", ...cardsOrdenDashboard.filter(id => visibles.has(id))]
    const columnas = crearColumnasDashboard(cards, ordenVisible, cantidadColumnasDashboard(), grid)
    grid.replaceChildren(...columnas)
    return contenedor.innerHTML
}

// ============================================
// INIT
// ============================================

// Qué listas del dashboard se vacían al mostrar esqueletos y al fallar la
// carga, y con cuántas filas. Se declara una sola vez porque las dos rutas
// (esqueleto y error) tienen que usar exactamente la misma lista: si una se
// olvidara, esa card se quedaría con los datos del ciclo anterior.
const LISTAS_DASHBOARD = [
    { id: "movimientos-lista", filas: 2 },
    { id: "favoritos-lista", filas: 2 },
    { id: "metas-lista", filas: 2 },
    { id: "pendientes-lista", filas: 2 },
    { id: "ordenes-lista", filas: 2 },
    { id: "estrategias-lista", filas: 3, clase: "skeleton-dashboard-list skeleton-dashboard-list-estrategias" },
    { id: "distribucion-lista", filas: 3 },
    { id: "distribucion-activos-lista", filas: 3 },
    { id: "patrimonio-divisa-lista", filas: 3 },
    { id: "programados-lista", filas: 2 },
    { id: "alertas-lista", filas: 2 }
]

const VALORES_DASHBOARD = [
    "patrimonio-valor", "total-cuentas", "inversiones-valor", "vencimientos-cantidad",
    "flujo-caja-valor", "deudas-valor", "ahorro-valor",
    "gastos-periodo-valor", "ingresos-periodo-valor", "balance-periodo-valor"
]

const DETALLES_DASHBOARD = [
    "patrimonio-detalle", "inversiones-detalle", "vencimientos-detalle", "flujo-caja-detalle",
    "deudas-detalle", "ahorro-detalle", "gastos-periodo-detalle", "ingresos-periodo-detalle",
    "balance-periodo-detalle", "ordenes-detalle"
]

const CONTADORES_DASHBOARD = [
    "favoritos-cantidad", "pendientes-cantidad", "ordenes-cantidad",
    "estrategias-cantidad", "programados-cantidad", "alertas-cantidad"
]

function mostrarEsqueletosDashboard() {
    const dashboard = document.querySelector(".dashboard")
    dashboard?.setAttribute("aria-busy", "true")
    LISTAS_DASHBOARD.forEach(({ id, filas, clase }) => {
        const lista = document.getElementById(id)
        if (lista) lista.innerHTML = skeletonMarkup({ rows: filas, className: clase || "skeleton-dashboard-list" })
    })
    VALORES_DASHBOARD.forEach(id => {
        const valor = document.getElementById(id)
        if (valor) valor.innerHTML = skeletonText("skeleton-value")
    })
    DETALLES_DASHBOARD.forEach(id => {
        const detalle = document.getElementById(id)
        if (detalle) detalle.innerHTML = skeletonText()
    })
    CONTADORES_DASHBOARD.forEach(id => {
        const contador = document.getElementById(id)
        if (contador) contador.innerHTML = skeletonText("skeleton-badge")
    })
    mostrarEstadoGrafico("cargando", "")
}

export async function init() {
    uid = sesion.uid
    const barraEdicion = document.getElementById("dashboard-edicion-bar")
    if (barraEdicion && barraEdicion.parentElement !== document.body) {
        document.body.appendChild(barraEdicion)
    }
    // Divisiva reactiva: se relee al entrar, no solo al importar el módulo.
    divisaActual = getDivisaPrincipal()
    periodoGrafico = obtenerPeriodo(sesion.getPreferencias()?.periodoEvolucion || PERIODO_POR_DEFECTO).id
    periodoFlujo = obtenerPeriodoFlujo(sesion.getPreferencias()?.periodoFlujo || PERIODO_FLUJO_POR_DEFECTO).id
    console.log("[INFO] Dashboard iniciado para UID:", uid)

    await cargarCardsVisiblesDashboard()
    mostrarEsqueletosDashboard()
    configurarLayoutDashboard()
    aplicarLayoutDashboard()
    configurarDivisa()
    configurarPeriodos()
    configurarPeriodoFlujoDashboard()
    configurarCardsNavegacion()
    configurarMetas()
    configurarEdicionDashboard()
    configurarRefreshDashboard()

    try {
        await cargarTodo()
        // El reparto del masonry se hizo en aplicarLayoutDashboard() con las
        // cards aún en esqueleto. Sin este repase, las columnas se calculan
        // con alturas falsas y quedan muy descompensadas.
        aplicarLayoutDashboard(true)
        void actualizarGraficoPatrimonio()
    } finally {
        const dashboard = document.querySelector(".dashboard")
        dashboard?.classList.remove("dashboard-cargando")
        dashboard?.removeAttribute("aria-busy")
        cargado = true
    }
}

function configurarRefreshDashboard() {
    if (eventosRefreshDashboardListos) return
    eventosRefreshDashboardListos = true
    window.addEventListener("movimientos-actualizados", () => {
        if (!document.getElementById("dashboard") && !document.querySelector(".dashboard")) return
        clearTimeout(timerRefreshDashboard)
        timerRefreshDashboard = setTimeout(async () => {
            // SIN invalidar la caché a propósito.
            //
            // Antes esto hacía cacheCapa.limpiar(uid), y era un error: al
            // escribir, cada repositorio ya invalida su propia clave
            // (movimientos, cuentas, posiciones, metas, snapshots). El
            // limpiar global no aportaba nada nuevo, pero sí tiraba las
            // colecciones que un movimiento NO toca —pendientes, órdenes,
            // estrategias, activos, trades, historial— obligando a releerlas
            // de Firestore en cada movimiento registrado, y en cada edición.
            //
            // Los datos se repintan sin esqueletos: el refresco ya solo pide
            // red para `movimientos` y `cuentas`, y vaciar las 24 cards para
            // enseñar un esqueleto un instante era lo que se notaba, no la
            // lectura.
            document.querySelector(".dashboard")?.setAttribute("aria-busy", "true")
            try {
                await cargarTodo()
                aplicarLayoutDashboard(true)
            } catch (error) {
                console.error("Error refrescando el dashboard:", error)
            } finally {
                document.querySelector(".dashboard")?.removeAttribute("aria-busy")
            }
        }, 150)
    })
}

// ============================================
// RECARGAR (invocado por "Actualizar" del lastbar)
// ============================================

export async function recargarDatos() {
    activarSpinLogo()
    mostrarEsqueletosDashboard()
    try {
        // Aquí el limpiar SÍ es correcto, y es la excepción deliberada al
        // camino de `movimientos-actualizados`: el usuario pidió recargar a
        // propósito, para traerse cambios hechos en otro dispositivo. Eso no
        // se puede deducir de ninguna invalidación granular porque aquí no
        // hubo ninguna escritura.
        cacheCapa.limpiar(uid)
        await Promise.all([
            cargarTodo(),
            actualizarGraficoPatrimonio()
        ])
    } catch (error) {
        console.error("Error recargando dashboard:", error)
    } finally {
        aplicarLayoutDashboard(true)
        document.querySelector(".dashboard")?.removeAttribute("aria-busy")
        desactivarSpinLogo()
    }
}

// ============================================
// CARGA GLOBAL
// ============================================

async function cargarTodo() {
    try {
        const [cuentasResp, movimientosResp] = await Promise.all([
            obtenerCuentas(uid),
            cargarMovimientos()
        ])
        const [inversionesResp, vencimientosResp, metasResp, pendientesResp, ordenesResp, estrategiasResp] = await Promise.all([
            cargarInversiones(),
            cargarVencimientos(cuentasResp, movimientosResp),
            cargarMetas(),
            cargarPendientes(),
            cargarOrdenes(),
            cargarEstrategias()
        ])

        // Las cuentas archivadas no se muestran en el dashboard: ni en las
        // cards, ni en el selector para añadirlas, ni en los cálculos. Sus
        // movimientos se conservan y vuelven a aparecer al restaurarlas.
        cuentas = cuentasResp.filter(cuenta => cuenta.estado !== "archivada")
        inversionesData = inversionesResp
        posicionesData = inversionesResp.posiciones || []
        vencimientosData = vencimientosResp
        favoritosData = inversionesResp.favoritos || []
        metasData = metasResp
        movimientosCompletosData = movimientosResp
        movimientosData = movimientosResp.slice(0, cantidadMovimientosRecientes())
        pendientesData = pendientesResp
        ordenesData = ordenesResp
        estrategiasData = estrategiasResp
        analiticaData = construirAnaliticaDashboard(movimientosResp)
        // Ya hay datos: a partir de aquí se puede saber qué cards de
        // cuenta/activo siguen apuntando a algo real.
        instanciasResueltas = true
        // El patrimonio se invalida aquí para que el próximo ciclo lo vuelva a
        // calcular: si no, tras un movimiento seguiría mostrando las cifras
        // de la carga anterior.
        patrimonioStats = null

        await actualizarUI()
    } catch (error) {
        console.error("Error cargando dashboard:", error)
        mostrarErrorCarga()
    }
}

async function cargarInversiones() {
    try {
        const data = await obtenerPosicionesConValor(uid)
        const posiciones = data.posiciones || []
        return {
            valorTotal: data.valorTotal || 0,
            gananciaTotal: data.gananciaTotal || 0,
            cantidad: data.cantidad || 0,
            // Las posiciones con su activo, para las cards de activo
            posiciones,
            // La divisa a la que ya fueron convertidos los totales
            divisa: data.divisa || "pen",
            // Posiciones cuyo activo está marcado como favorito
            favoritos: posiciones.filter(p => p.activo?.favorito === true)
        }
    } catch (error) {
        console.error("Error cargando inversiones:", error)
        return { valorTotal: 0, gananciaTotal: 0, cantidad: 0, posiciones: [], divisa: "pen", favoritos: [] }
    }
}

async function cargarMetas() {
    try {
        return await obtenerMetas(uid)
    } catch (error) {
        console.error("Error cargando metas:", error)
        return []
    }
}

async function cargarPendientes() {
    try {
        return await obtenerPendientes(uid, true)
    } catch (error) {
        console.error("Error cargando pendientes:", error)
        return []
    }
}

async function cargarOrdenes() {
    try {
        const ordenes = await obtenerOrdenes(uid)
        return ordenes.filter(orden => orden.estaPendiente)
    } catch (error) {
        console.error("Error cargando órdenes:", error)
        return []
    }
}

async function cargarEstrategias() {
    try {
        const estrategias = await obtenerEstrategias(uid)
        return estrategias
            .filter(estrategia => estrategia.activa)
            .map(estrategia => ({
                ...estrategia,
                proximaEjecucion: estrategia.proximaEjecucion ||
                    calcularProximaEjecucion(estrategia.frecuencia, estrategia.diaPreferido)
            }))
            .sort((a, b) => new Date(a.proximaEjecucion) - new Date(b.proximaEjecucion))
    } catch (error) {
        console.error("Error cargando estrategias:", error)
        return []
    }
}

/**
 * Acumula ingresos y gastos de una ventana deslizante de `dias` días.
 * El corte es a medianoche local y va hasta hoy incluido, así que "30D"
 * son los 30 días calendario que terminan hoy.
 */
function acumularFlujoDeslizante(movimientos, dias) {
    const limite = new Date()
    limite.setHours(0, 0, 0, 0)
    limite.setDate(limite.getDate() - (dias - 1))

    let ingresos = 0
    let gastos = 0
    let movimientosIngresos = 0
    let movimientosGastos = 0

    for (const movimiento of movimientos) {
        if (movimiento.tipo !== TIPOS_MOVIMIENTO.INGRESO && movimiento.tipo !== TIPOS_MOVIMIENTO.GASTO) continue
        const fecha = fechaDeMovimiento(movimiento)
        if (!fecha || Number.isNaN(fecha.getTime()) || fecha < limite) continue
        const monto = convertirMonto(
            Math.abs(montoDeMovimiento(movimiento)),
            divisaDeMovimiento(movimiento),
            divisaActual
        )
        if (movimiento.tipo === TIPOS_MOVIMIENTO.INGRESO) {
            ingresos += monto
            movimientosIngresos++
        } else {
            gastos += monto
            movimientosGastos++
        }
    }

    return {
        ingresos,
        gastos,
        balance: ingresos - gastos,
        movimientosIngresos,
        movimientosGastos,
        total: movimientosIngresos + movimientosGastos
    }
}

function construirAnaliticaDashboard(movimientos) {
    const ahora = new Date()
    const anio = ahora.getFullYear()
    const mes = ahora.getMonth()
    let ingresos = 0
    let gastos = 0

    for (const movimiento of movimientos) {
        if (movimiento.tipo !== TIPOS_MOVIMIENTO.INGRESO && movimiento.tipo !== TIPOS_MOVIMIENTO.GASTO) continue
        const fecha = fechaDeMovimiento(movimiento)
        if (!fecha || fecha.getFullYear() !== anio || fecha.getMonth() !== mes) continue
        const monto = convertirMonto(
            Math.abs(montoDeMovimiento(movimiento)),
            divisaDeMovimiento(movimiento),
            divisaActual
        )
        if (movimiento.tipo === TIPOS_MOVIMIENTO.INGRESO) ingresos += monto
        else gastos += monto
    }

    const balance = ingresos - gastos
    const tarjetas = cuentas.filter(cuenta => cuenta.tipo === "credito" && cuenta.estado !== "archivada")
    const deudas = tarjetas.reduce((total, cuenta) => {
        return total + convertirMonto(Math.max(0, Number(cuenta.deuda) || 0), cuenta.moneda || "pen", divisaActual)
    }, 0)
    const liquidez = cuentas
        .filter(cuenta => cuenta.tipo !== "credito" && cuenta.estado !== "archivada" && cuenta.esPatrimonio !== false)
        .reduce((total, cuenta) => {
            return total + convertirMonto(Number(cuenta.saldoInicial) || 0, cuenta.moneda || "pen", divisaActual)
        }, 0)
    const inversiones = convertirMonto(
        inversionesData?.valorTotal || 0,
        inversionesData?.divisa || divisaActual,
        divisaActual
    )
    const brutoDistribucion = Math.max(0, liquidez) + Math.max(0, inversiones) + Math.max(0, deudas)
    const distribucion = [
        { label: "Liquidez", valor: Math.max(0, liquidez), clase: "liquidez" },
        { label: "Inversiones", valor: Math.max(0, inversiones), clase: "inversiones" },
        { label: "Deudas", valor: Math.max(0, deudas), clase: "deudas" }
    ].map(item => ({
        ...item,
        porcentaje: brutoDistribucion > 0 ? (item.valor / brutoDistribucion) * 100 : 0
    }))

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const programados = (vencimientosData?.items || []).map(item => {
        const fecha = new Date(hoy)
        fecha.setDate(fecha.getDate() + Number(item.diasRestantes || 0))
        const cuenta = item.cuenta
        const divisa = item.divisa || cuenta?.moneda || "pen"
        const monto = convertirMonto(Math.abs(Number(item.monto) || 0), divisa, divisaActual)
        const titulo = item.tipo === "pendiente"
            ? item.titulo
            : item.tipo === "meta"
                ? item.titulo
                : item.tipo === "anualidad"
                    ? `Anualidad · ${item.titulo}`
                    : `Pago de tarjeta · ${item.titulo}`
        return { titulo, fecha, monto, tipo: item.tipo }
    })

    estrategiasData.forEach(estrategia => {
        const fecha = new Date(estrategia.proximaEjecucion)
        if (Number.isNaN(fecha.getTime())) return
        programados.push({
            titulo: `${estrategia.nombre} · ${estrategia.activoSimbolo}`,
            fecha,
            monto: convertirMonto(estrategia.montoFijo, estrategia.divisa, divisaActual),
            tipo: "estrategia"
        })
    })
    programados.sort((a, b) => a.fecha - b.fecha)

    const alertas = []
    ;(vencimientosData?.items || []).filter(item => item.vencido).forEach(item => {
        alertas.push({ titulo: `${item.titulo} está vencido`, detalle: item.subtitulo, nivel: "critico" })
    })
    tarjetas.forEach(cuenta => {
        const uso = nivelUsoDe(cuenta)
        if (uso.nivel !== "normal") {
            alertas.push({
                titulo: `${cuenta.nombre} · uso ${uso.porcentaje.toFixed(0)}%`,
                detalle: uso.nivel === "critico" ? "Uso crítico del límite" : "Uso elevado del límite",
                nivel: uso.nivel
            })
        }
    })
    cuentas
        .filter(cuenta => cuenta.tipo !== "credito" && cuenta.estado !== "archivada" && Number(cuenta.saldoInicial) < 0)
        .forEach(cuenta => {
            alertas.push({ titulo: `${cuenta.nombre} tiene saldo negativo`, detalle: "Revisa los movimientos de la cuenta", nivel: "aviso" })
        })
    estrategiasData.forEach(estrategia => {
        const fecha = new Date(estrategia.proximaEjecucion)
        if (!Number.isNaN(fecha.getTime()) && fecha < hoy) {
            alertas.push({ titulo: `${estrategia.nombre} está atrasada`, detalle: "Revisa la próxima ejecución", nivel: "critico" })
        }
    })

    return {
        ingresos,
        gastos,
        balance,
        tasaAhorro: ingresos > 0 ? (balance / ingresos) * 100 : null,
        tarjetasConDeuda: tarjetas.filter(cuenta => Number(cuenta.deuda) > 0).length,
        deudas,
        liquidez,
        inversiones,
        brutoDistribucion,
        distribucion,
        programados,
        alertas,
        flujoPorPeriodo: PERIODOS_FLUJO.reduce((acumulado, periodo) => {
            acumulado[periodo.id] = acumularFlujoDeslizante(movimientos, periodo.dias)
            return acumulado
        }, {})
    }
}

function divisaDeMovimiento(movimiento) {
    if (movimiento.divisa) return String(movimiento.divisa).toLowerCase()
    const cuentaId = movimiento.cuenta || movimiento.cuentaOrigen
    const cuenta = cuentas.find(item => item.id === cuentaId)
    return cuenta?.moneda || "pen"
}

async function cargarMovimientos() {
    try {
        const lista = await obtenerMovimientos(uid)
        return lista
            .slice()
            .sort((a, b) => {
                const fa = (fechaDeMovimiento(a)?.getTime?.()) || 0
                const fb = (fechaDeMovimiento(b)?.getTime?.()) || 0
                return fb - fa
            })
    } catch (error) {
        console.error("Error cargando movimientos:", error)
        return []
    }
}

// Cantidad de "últimos movimientos" a mostrar, desde Configuración (2-5).
function cantidadMovimientosRecientes() {
    const prefs = sesion.getPreferencias()
    const n = Number.parseInt(prefs?.movimientosRecientes, 10)
    if (!Number.isFinite(n)) return 5
    return Math.min(5, Math.max(2, n))
}

async function cargarVencimientos(cuentasDeUsuario, movimientos = []) {
    try {
        const [pendientes, tarjetas, metas] = await Promise.all([
            obtenerPendientesConVencimiento(),
            obtenerTarjetasConPagoProximo(cuentasDeUsuario, movimientos),
            obtenerMetasConVencimiento()
        ])

        // Combinar y ordenar por días restantes ascendente
        const anualidades = obtenerAnualidadesConVencimiento(cuentasDeUsuario)
        const todos = [...pendientes, ...tarjetas, ...anualidades, ...metas]
        todos.sort((a, b) => a.diasRestantes - b.diasRestantes)

        return {
            items: todos,
            total: todos.length,
            vencidos: todos.filter(v => v.vencido).length
        }
    } catch (error) {
        console.error("Error cargando vencimientos:", error)
        return { items: [], total: 0, vencidos: 0 }
    }
}

async function obtenerPendientesConVencimiento() {
    const pendientes = await obtenerPendientes(uid, true)

    return pendientes
        .filter(p => p.fechaVencimiento)
        .map(p => {
            const dias = diasHasta(p.fechaVencimiento)
            return {
                tipo: "pendiente",
                id: p.id,
                titulo: p.concepto,
                subtitulo: p.tipo ? "Cobrar" : "Pagar",
                esCobrar: p.tipo,
                monto: p.monto,
                divisa: p.divisa,
                diasRestantes: dias,
                vencido: dias < 0,
                icono: "",
                pendiente: p
            }
        })
        .filter(v => v.diasRestantes <= DIAS_VENCIMIENTO)
}

async function obtenerMetasConVencimiento() {
    const metas = await obtenerMetas(uid)

    return metas
        .filter(m => m.fechaLimite && m.activa !== false && !m.completada)
        .map(m => {
            const dias = diasHasta(m.fechaLimite)
            return {
                tipo: "meta",
                id: m.id,
                titulo: m.nombre,
                subtitulo: "Meta de ahorro",
                monto: m.montoRestante,
                divisa: m.divisa,
                diasRestantes: dias,
                vencido: dias < 0,
                icono: "",
                meta: m
            }
        })
        .filter(v => v.diasRestantes <= DIAS_VENCIMIENTO)
}

function obtenerAnualidadesConVencimiento(listaCuentas) {
    return (listaCuentas || [])
        .filter(c => c.tipo === "credito" && c.estado !== "archivada")
        .map(c => ({ cuenta: c, proxima: proximaAnualidad(c) }))
        .filter(item => item.proxima)
        .map(item => ({
            tipo: "anualidad",
            id: `${item.cuenta.id}-anualidad`,
            titulo: item.cuenta.nombre,
            subtitulo: "Anualidad de tarjeta",
            monto: item.proxima.monto,
            divisa: item.cuenta.moneda || "pen",
            diasRestantes: diasHasta(item.proxima.fecha),
            vencido: false,
            icono: "",
            cuenta: item.cuenta
        }))
        .filter(v => v.diasRestantes <= DIAS_VENCIMIENTO)
}

function obtenerTarjetasConPagoProximo(listaCuentas, movimientos = []) {
    return (listaCuentas || [])
        .filter(c => c.tipo === "credito" && c.estado !== "archivada" && c.diaPago)
        .map(t => {
            const ciclo = estadoCicloDe(t, movimientos)
            return {
                tipo: "tarjeta",
                id: t.id,
                titulo: t.nombre,
                subtitulo: "Pago tarjeta",
                monto: Math.max(0, Number(t.deuda) || 0),
                divisa: t.moneda || "pen",
                diasRestantes: diasHastaDiaDelMes(t.diaPago),
                vencido: false,
                icono: "",
                cuenta: t,
                ciclo
            }
        })
        .filter(v => !v.ciclo.pagadoCompleto && v.monto > 0 && v.diasRestantes <= DIAS_VENCIMIENTO)
}

// ============================================
// UTILIDADES DE FECHAS
// ============================================

function diasHasta(fecha) {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const objetivo = new Date(fecha)
    objetivo.setHours(0, 0, 0, 0)
    const diff = objetivo - hoy
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function diasHastaDiaDelMes(diaMes) {
    if (!diaMes || diaMes < 1 || diaMes > 31) return null
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const crear = (anio, mes) => {
        const ultimo = new Date(anio, mes + 1, 0).getDate()
        return new Date(anio, mes, Math.min(diaMes, ultimo))
    }
    let objetivo = crear(hoy.getFullYear(), hoy.getMonth())
    if (objetivo < hoy) objetivo = crear(hoy.getFullYear(), hoy.getMonth() + 1)
    return Math.round((objetivo - hoy) / 86400000)
}

// ============================================
// PATRIMONIO (fuente única: SnapshotServicio.calcularPatrimonio)
// ============================================

// ============================================
// ACTUALIZAR UI
// ============================================

async function actualizarUI() {
    // Las cards de cuenta/ activo se crean y pintan aquí: dependen de datos
    // que acaban de cargar, así que no pueden vivir en el render().
    montarCardsInstanciadas()
    await actualizarCuentas()
    await actualizarPatrimonio()
    actualizarPatrimonioDivisa()
    actualizarInversiones()
    actualizarDistribucionActivos()
    actualizarVencimientos()
    actualizarFavoritos()
    actualizarMetas()
    actualizarPendientes()
    actualizarOrdenes()
    actualizarEstrategias()
    actualizarFlujoCaja()
    actualizarFlujoPeriodo()
    actualizarDeudas()
    actualizarAhorro()
    actualizarDistribucion()
    actualizarProgramados()
    actualizarAlertas()
    actualizarMovimientos()
    aplicarLayoutDashboard(true)
}

// calcularPatrimonio() ya devuelve los totales por divisa, y tres cards los
// necesitan. Antes cada una llamaba por su cuenta y se leían las cuentas tres
// veces por refresco; se resuelve una vez por ciclo y se invalida al recargar.
let patrimonioStats = null

async function obtenerPatrimonioStats() {
    if (!patrimonioStats) patrimonioStats = await calcularPatrimonio(uid)
    return patrimonioStats
}

async function actualizarCuentas() {
    const stats = await obtenerPatrimonioStats()

    const totalEl = document.getElementById("total-cuentas")
    if (totalEl) totalEl.textContent = stats.totalCuentas

    const detalleEl = document.getElementById("patrimonio-detalle")
    if (detalleEl) {
        const activos = convertirMonto(stats.totalActivos, "pen", divisaActual)
        let detalle = `Activos: ${formatearMontoConDivisa(activos, divisaActual)}`
        if (stats.tieneDeuda) {
            detalle += ` | Deuda: -${formatearMontoConDivisa(convertirMonto(stats.totalDeuda, "pen", divisaActual), divisaActual)}`
        }
        detalleEl.textContent = detalle
    }
}

async function actualizarPatrimonio() {
    const stats = await obtenerPatrimonioStats()
    const valorEl = document.getElementById("patrimonio-valor")

    if (!valorEl) return

    const valor = convertirMonto(stats.patrimonio, "pen", divisaActual)
    valorEl.textContent = formatearMontoConDivisa(valor, divisaActual)

    valorEl.classList.remove("positive", "negative")
    if (valor > 0) valorEl.classList.add("positive")
    else if (valor < 0) valorEl.classList.add("negative")
}

function actualizarInversiones() {
    const valorEl = document.getElementById("inversiones-valor")
    const detalleEl = document.getElementById("inversiones-detalle")
    const cardEl = document.getElementById("card-inversiones")

    if (!valorEl || !inversionesData) return

    if (inversionesData.cantidad === 0) {
        valorEl.textContent = formatearMonto(0, divisaActual)
        if (detalleEl) detalleEl.textContent = "Sin posiciones"
        cardEl?.classList.remove("positive", "negative")
        return
    }

    // `valorTotal` ya viene convertido a `inversionesData.divisa`; una sola
    // conversión hasta la divisa elegida en el selector (nada de doble).
    const valorConvertido = convertirMonto(
        inversionesData.valorTotal,
        inversionesData.divisa,
        divisaActual
    )

    valorEl.textContent = formatearMontoConDivisa(valorConvertido, divisaActual)

    if (detalleEl) {
        const signo = inversionesData.gananciaTotal >= 0 ? "+" : ""
        detalleEl.textContent =
            `${signo}${formatearMontoConDivisa(inversionesData.gananciaTotal, inversionesData.divisa)}` +
            ` · ${inversionesData.cantidad} posici${inversionesData.cantidad === 1 ? "ón" : "ones"}`
    }

    cardEl?.classList.remove("positive", "negative")
    if (inversionesData.gananciaTotal > 0) cardEl?.classList.add("positive")
    else if (inversionesData.gananciaTotal < 0) cardEl?.classList.add("negative")
}

function actualizarVencimientos() {
    const cantidadEl = document.getElementById("vencimientos-cantidad")
    const detalleEl = document.getElementById("vencimientos-detalle")
    const cardEl = document.getElementById("card-vencimientos")

    if (!cantidadEl || !vencimientosData) return

    cantidadEl.textContent = vencimientosData.total

    if (detalleEl) {
        if (vencimientosData.total === 0) {
            detalleEl.textContent = `Sin vencimientos en los próximos ${DIAS_VENCIMIENTO} días`
        } else {
            const vencidos = vencimientosData.vencidos
            let resumen = `${vencimientosData.total} en los próximos ${DIAS_VENCIMIENTO} días`
            if (vencidos > 0) {
                resumen += ` · ${vencidos} vencido${vencidos === 1 ? "" : "s"}`
            }
            detalleEl.textContent = resumen
        }
    }

    cardEl?.classList.remove("positive", "negative")
    if (vencimientosData.vencidos > 0) cardEl?.classList.add("negative")
}

function mostrarErrorCarga() {
    const detalleEl = document.getElementById("patrimonio-detalle")
    if (detalleEl) detalleEl.textContent = "Error al cargar datos"
    LISTAS_DASHBOARD.forEach(({ id }) => {
        const lista = document.getElementById(id)
        if (lista) lista.innerHTML = `<p class="card-vacio">No se pudieron cargar estos datos.</p>`
    })
    VALORES_DASHBOARD.forEach(id => {
        const valor = document.getElementById(id)
        if (valor) valor.textContent = "—"
    })
    DETALLES_DASHBOARD.forEach(id => {
        const detalle = document.getElementById(id)
        if (detalle) detalle.textContent = "—"
    })
    CONTADORES_DASHBOARD.forEach(id => {
        const contador = document.getElementById(id)
        if (contador) contador.textContent = "—"
    })
}

function actualizarPendientes() {
    const lista = document.getElementById("pendientes-lista")
    const cantidadEl = document.getElementById("pendientes-cantidad")
    if (!lista) return

    if (cantidadEl) cantidadEl.textContent = pendientesData.length
    if (pendientesData.length === 0) {
        lista.innerHTML = `<p class="card-vacio">No tienes cobros ni pagos pendientes.</p>`
        return
    }

    lista.innerHTML = pendientesData.map(pendiente => {
        const clase = pendiente.tipo ? "positive" : "negative"
        const signo = pendiente.tipo ? "+" : "−"
        const detalle = pendiente.fechaVencimiento
            ? `Vence ${formatearFecha(pendiente.fechaVencimiento)}`
            : pendiente.tipoTexto
        return `
            <div class="dashboard-list-item">
                <div class="dashboard-list-info">
                    <span class="dashboard-list-title">${pendiente.concepto}</span>
                    <span class="dashboard-list-detail">${detalle}</span>
                </div>
                <span class="dashboard-list-value ${clase}">${signo} ${formatearMontoConDivisa(pendiente.monto, pendiente.divisa)}</span>
            </div>
        `
    }).join("")
}

// ============================================
// ÓRDENES
// ============================================
// Antes la card mezclaba las tres estados en la lista y el badge contaba
// todas, así que no se distinguía lo accionable de lo histórico. Ahora:
//   · el badge cuenta solo las PENDIENTES (las que vigilan un precio),
//   · la lista muestra las pendientes con lo lejos que está el precio actual
//     del precio de disparo —que es lo único accionable de una orden—,
//   · el pie resume cuántas hay ejecutadas y canceladas.
// Si no hay pendientes, la lista lo dice y el pie da el resumen.

const ORDENES_MAX_FILAS = 3

// Último precio conocido por símbolo, tomado de las posiciones abiertas. Una
// orden puede apuntar a un activo del que no se tiene posición, y entonces no
// hay contra qué medir la distancia.
function preciosPorSimbolo() {
    const mapa = new Map()
    for (const posicion of posicionesData) {
        const simbolo = String(posicion.activo?.simbolo || posicion.activo?.nombre || "").toUpperCase()
        if (!simbolo) continue
        mapa.set(simbolo, Number(posicion.activo.ultimoPrecio) || 0)
    }
    return mapa
}

// Distancia porcentual entre el precio actual y el de disparo, en valor
// absoluto y con signo que indique hacia dónde se mueve el precio. Un 0
// significa "en el precio de disparo": la orden debería disparar ya.
function distanciaAlDisparo(orden, precioActual) {
    if (!precioActual || precioActual <= 0 || !orden.precioDisparo) return null
    return ((precioActual - orden.precioDisparo) / orden.precioDisparo) * 100
}

function actualizarOrdenes() {
    const lista = document.getElementById("ordenes-lista")
    const cantidadEl = document.getElementById("ordenes-cantidad")
    const detalleEl = document.getElementById("ordenes-detalle")
    if (!lista) return

    const pendientes = ordenesData.filter(orden => orden.estaPendiente)
    const ejecutadas = ordenesData.filter(orden => orden.fueEjecutada).length
    const canceladas = ordenesData.length - pendientes.length - ejecutadas

    if (cantidadEl) {
        cantidadEl.textContent = pendientes.length
        cantidadEl.hidden = pendientes.length === 0
    }

    const resumen = [ejecutadas > 0 ? `${ejecutadas} ejecutada${ejecutadas === 1 ? "" : "s"}` : "",
        canceladas > 0 ? `${canceladas} cancelada${canceladas === 1 ? "" : "s"}` : ""]
        .filter(Boolean)
        .join(" · ")
    if (detalleEl) {
        detalleEl.textContent = resumen
            || (pendientes.length === 0 ? "Sin órdenes registradas" : "Todas las órdenes están pendientes")
    }

    if (pendientes.length === 0) {
        lista.innerHTML = `<p class="card-vacio">No tienes órdenes pendientes.</p>`
        return
    }

    const precios = preciosPorSimbolo()

    lista.innerHTML = pendientes.slice(0, ORDENES_MAX_FILAS).map(orden => {
        const precioActual = precios.get(String(orden.activo || "").toUpperCase()) || 0
        const distancia = distanciaAlDisparo(orden, precioActual)
        // Por debajo del 2% la orden está a punto de saltar: se resalta.
        const claseDistancia = distancia === null ? "" : Math.abs(distancia) <= 2 ? "critico" : ""
        const detalle = distancia === null
            ? `${orden.tipoLabel} · ${orden.direccionLabel} · sin precio`
            : `${orden.tipoLabel} · ${orden.direccionLabel} · a ${Math.abs(distancia).toFixed(1)}% del disparo`

        return `
        <div class="dashboard-list-item">
            <div class="dashboard-list-info">
                <span class="dashboard-list-title">${orden.activo}</span>
                <span class="dashboard-list-detail ${claseDistancia}">${detalle}</span>
            </div>
            <span class="dashboard-list-value">${formatearMontoConDivisa(orden.precioDisparo, orden.divisa)}</span>
        </div>
    `
    }).join("") + (pendientes.length > ORDENES_MAX_FILAS
        ? `<p class="card-vacio">y ${pendientes.length - ORDENES_MAX_FILAS} más…</p>`
        : "")
}

function actualizarEstrategias() {
    const lista = document.getElementById("estrategias-lista")
    const cantidadEl = document.getElementById("estrategias-cantidad")
    if (!lista) return

    if (cantidadEl) cantidadEl.textContent = estrategiasData.length
    if (estrategiasData.length === 0) {
        lista.innerHTML = `<p class="card-vacio">No tienes estrategias activas.</p>`
        return
    }

    lista.innerHTML = estrategiasData.map(estrategia => {
        const cuenta = cuentas.find(item => item.id === estrategia.cuentaId)
        const controlCuenta = cuenta ? `
            <button type="button" class="estrategia-cuenta" data-dashboard-cuenta-estrategia="${estrategia.cuentaId}">
                ${icono("landmark", 11)} ${cuenta.nombre}
            </button>
        ` : ""
        return `
            <div class="dashboard-list-item estrategia-dashboard-item">
                <div class="dashboard-list-info">
                    <span class="dashboard-list-title">${estrategia.nombre}</span>
                    <span class="dashboard-list-detail">${estrategia.activoSimbolo} · ${formatearProximaEjecucion(estrategia.proximaEjecucion)}</span>
                    ${controlCuenta}
                </div>
                <span class="dashboard-list-value">${formatearMontoConDivisa(estrategia.montoFijo, estrategia.divisa)}</span>
            </div>
        `
    }).join("")
}

function pluralizarMovimientos(cantidad) {
    return `${cantidad} movimiento${cantidad === 1 ? "" : "s"}`
}

function actualizarFlujoPeriodo() {
    const datos = analiticaData?.flujoPorPeriodo?.[periodoFlujo]
    const periodo = obtenerPeriodoFlujo(periodoFlujo)
    const gastosEl = document.getElementById("gastos-periodo-valor")
    const gastosDetalle = document.getElementById("gastos-periodo-detalle")
    const ingresosEl = document.getElementById("ingresos-periodo-valor")
    const ingresosDetalle = document.getElementById("ingresos-periodo-detalle")
    const balanceEl = document.getElementById("balance-periodo-valor")
    const balanceDetalle = document.getElementById("balance-periodo-detalle")
    if (!datos || !gastosEl || !ingresosEl || !balanceEl) return

    gastosEl.textContent = formatearMontoConDivisa(datos.gastos, divisaActual)
    if (gastosDetalle) gastosDetalle.textContent = datos.movimientosGastos > 0
        ? `${periodo.sub} · ${pluralizarMovimientos(datos.movimientosGastos)}`
        : periodo.sub

    ingresosEl.textContent = formatearMontoConDivisa(datos.ingresos, divisaActual)
    if (ingresosDetalle) ingresosDetalle.textContent = datos.movimientosIngresos > 0
        ? `${periodo.sub} · ${pluralizarMovimientos(datos.movimientosIngresos)}`
        : periodo.sub

    balanceEl.textContent = formatearMontoConDivisa(datos.balance, divisaActual)
    if (balanceDetalle) balanceDetalle.textContent = datos.total > 0
        ? `${pluralizarMovimientos(datos.total)} en total`
        : "Sin movimientos"

    document.getElementById("card-balance-periodo")?.classList.toggle("positive", datos.balance > 0)
    document.getElementById("card-balance-periodo")?.classList.toggle("negative", datos.balance < 0)
}

function actualizarFlujoCaja() {
    const valorEl = document.getElementById("flujo-caja-valor")
    const detalleEl = document.getElementById("flujo-caja-detalle")
    const cardEl = document.getElementById("card-flujo-caja")
    if (!valorEl || !analiticaData) return

    valorEl.textContent = formatearMontoConDivisa(analiticaData.balance, divisaActual)
    if (detalleEl) {
        detalleEl.textContent = `+${formatearMontoConDivisa(analiticaData.ingresos, divisaActual)} · −${formatearMontoConDivisa(analiticaData.gastos, divisaActual)}`
    }
    cardEl?.classList.toggle("positive", analiticaData.balance > 0)
    cardEl?.classList.toggle("negative", analiticaData.balance < 0)
}

function actualizarDeudas() {
    const valorEl = document.getElementById("deudas-valor")
    const detalleEl = document.getElementById("deudas-detalle")
    const cardEl = document.getElementById("card-deudas")
    if (!valorEl || !analiticaData) return

    valorEl.textContent = formatearMontoConDivisa(analiticaData.deudas, divisaActual)
    if (detalleEl) {
        const proximo = analiticaData.programados.find(item => item.tipo === "tarjeta")
        detalleEl.textContent = proximo
            ? `Próximo pago ${formatearProximaEjecucion(proximo.fecha)}`
            : `${analiticaData.tarjetasConDeuda} tarjeta${analiticaData.tarjetasConDeuda === 1 ? "" : "s"} con deuda`
    }
    cardEl?.classList.toggle("negative", analiticaData.deudas > 0)
}

function actualizarAhorro() {
    const valorEl = document.getElementById("ahorro-valor")
    const detalleEl = document.getElementById("ahorro-detalle")
    const cardEl = document.getElementById("card-ahorro")
    if (!valorEl || !analiticaData) return

    valorEl.textContent = formatearMontoConDivisa(analiticaData.balance, divisaActual)
    if (detalleEl) {
        detalleEl.textContent = analiticaData.tasaAhorro === null
            ? "Sin ingresos registrados este mes"
            : `${analiticaData.tasaAhorro.toFixed(0)}% de los ingresos`
    }
    cardEl?.classList.toggle("positive", analiticaData.balance > 0)
    cardEl?.classList.toggle("negative", analiticaData.balance < 0)
}

function actualizarDistribucion() {
    const lista = document.getElementById("distribucion-lista")
    const totalEl = document.getElementById("distribucion-total")
    if (!lista || !analiticaData) return

    if (totalEl) totalEl.textContent = formatearMontoConDivisa(analiticaData.brutoDistribucion, divisaActual)
    lista.innerHTML = analiticaData.distribucion.map(item => `
        <div class="distribucion-item">
            <div class="distribucion-cabecera">
                <span>${item.label}</span>
                <strong>${item.porcentaje.toFixed(0)}%</strong>
            </div>
            <div class="distribucion-barra">
                <span class="${item.clase}" style="width: ${Math.max(0, Math.min(100, item.porcentaje))}%"></span>
            </div>
            <span class="distribucion-valor">${formatearMontoConDivisa(item.valor, divisaActual)}</span>
        </div>
    `).join("")
}

// ============================================
// DISTRIBUCIÓN POR TIPO DE ACTIVO
// ============================================
// Complementa a "Distribución patrimonial", que reparte el total entre
// liquidez / inversiones / deudas. Esta reparte solo la cartera: qué clase de
// activo se lleva cada parte de lo invertido. Se agrupa por `activo.tipo` de
// las posiciones abiertas, que es el dato que ya trae la card de cada activo.

const CLASES_TIPO_ACTIVO = {
    accion: "accion",
    etf: "etf",
    crypto: "cripto",
    bono: "bono"
}

function actualizarDistribucionActivos() {
    const lista = document.getElementById("distribucion-activos-lista")
    if (!lista) return

    if (!posicionesData || posicionesData.length === 0) {
        lista.innerHTML = `<p class="card-vacio">No tienes posiciones abiertas.</p>`
        return
    }

    // Se agrupa por tipo y se convierte todo a la divisa del selector UNA sola
    // vez, como en las demás cards: convertir y luego volver a convertir
    // deformaba los porcentajes.
    const porTipo = new Map()
    for (const posicion of posicionesData) {
        const activo = posicion.activo || {}
        const tipo = String(activo.tipo || "accion").toLowerCase()
        const cantidad = Number(posicion.cantidad) || 0
        const ultimoPrecio = Number(activo.ultimoPrecio) || 0
        if (cantidad <= 0 || ultimoPrecio <= 0) continue

        const valor = convertirMonto(
            cantidad * ultimoPrecio,
            posicion.divisa || "usd",
            divisaActual
        )
        porTipo.set(tipo, (porTipo.get(tipo) || 0) + valor)
    }

    const items = [...porTipo.entries()]
        .filter(([, valor]) => valor > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([tipo, valor]) => ({
            label: ETIQUETAS_TIPO_ACTIVO[tipo] || "Otros",
            valor,
            clase: CLASES_TIPO_ACTIVO[tipo] || "otros",
            porcentaje: 0
        }))

    const total = items.reduce((suma, item) => suma + item.valor, 0)
    if (items.length === 0 || total <= 0) {
        lista.innerHTML = `<p class="card-vacio">No hay nada valorable que repartir.</p>`
        return
    }
    for (const item of items) item.porcentaje = (item.valor / total) * 100

    lista.innerHTML = items.map(item => `
        <div class="distribucion-item">
            <div class="distribucion-cabecera">
                <span>${item.label}</span>
                <strong>${item.porcentaje.toFixed(0)}%</strong>
            </div>
            <div class="distribucion-barra">
                <span class="${item.clase}" style="width: ${Math.max(0, Math.min(100, item.porcentaje))}%"></span>
            </div>
            <span class="distribucion-valor">${formatearMontoConDivisa(item.valor, divisaActual)}</span>
        </div>
    `).join("")
}

// ============================================
// PATRIMONIO POR DIVISA
// ============================================
// Desglose del mismo patrimonio que da la card grande, pero en la moneda en la
// que está cada parte, en vez de convertido a una sola. Es la lectura que
// importa cuando hay saldo en varias divisas: cuánto tienes de cada una y qué
// peso tiene cada una. calcularPatrimonio() ya devuelve los tres totales
// convertidos, así que no hace falta ninguna consulta extra.

const DIVISAS_PATRIMONIO = [
    { clave: "pen", etiqueta: "Soles" },
    { clave: "usd", etiqueta: "Dólares" },
    { clave: "usdt", etiqueta: "USDT" }
]

function actualizarPatrimonioDivisa() {
    const lista = document.getElementById("patrimonio-divisa-lista")
    if (!lista) return

    if (!patrimonioStats) {
        lista.innerHTML = `<p class="card-vacio">No se pudo calcular el patrimonio.</p>`
        return
    }

    // Cada cifra va en su propia moneda (no en la del selector): el objeto de
    // la card es ver cuánto hay de cada divisa, no cuánto vale en total.
    const items = DIVISAS_PATRIMONIO.map(({ clave, etiqueta }) => ({
        etiqueta,
        clave,
        valor: Number(patrimonioStats[clave]) || 0
    }))

    // El peso de cada divisa se mide sobre el total convertido a una moneda
    // común; si no, no serían comparables.
    const total = convertirMonto(
        items.reduce((suma, item) => suma + convertirMonto(item.valor, item.clave, "pen"), 0),
        "pen",
        divisaActual
    )

    if (total <= 0) {
        lista.innerHTML = `<p class="card-vacio">Sin patrimonio registrado.</p>`
        return
    }

    lista.innerHTML = items.map(item => {
        const equivalente = convertirMonto(item.valor, item.clave, divisaActual)
        const porcentaje = Math.max(0, Math.min(100, (equivalente / total) * 100))
        return `
        <div class="distribucion-item">
            <div class="distribucion-cabecera">
                <span>${item.etiqueta}</span>
                <strong>${porcentaje.toFixed(0)}%</strong>
            </div>
            <div class="distribucion-barra">
                <span class="${item.clave}" style="width: ${porcentaje}%"></span>
            </div>
            <span class="distribucion-valor">${formatearMontoConDivisa(item.valor, item.clave)}</span>
        </div>
    `
    }).join("")
}

function actualizarProgramados() {
    const lista = document.getElementById("programados-lista")
    const cantidadEl = document.getElementById("programados-cantidad")
    if (!lista || !analiticaData) return

    if (cantidadEl) cantidadEl.textContent = analiticaData.programados.length
    if (analiticaData.programados.length === 0) {
        lista.innerHTML = `<p class="card-vacio">No hay movimientos programados próximos.</p>`
        return
    }

    lista.innerHTML = analiticaData.programados.map(item => `
        <div class="dashboard-list-item">
            <div class="dashboard-list-info">
                <span class="dashboard-list-title">${item.titulo}</span>
                <span class="dashboard-list-detail">${formatearProximaEjecucion(item.fecha)}</span>
            </div>
            <span class="dashboard-list-value">${formatearMontoConDivisa(item.monto, divisaActual)}</span>
        </div>
    `).join("")
}

function actualizarAlertas() {
    const lista = document.getElementById("alertas-lista")
    const cantidadEl = document.getElementById("alertas-cantidad")
    const cardEl = document.getElementById("card-alertas")
    if (!lista || !analiticaData) return

    const alertas = analiticaData.alertas
    if (cantidadEl) cantidadEl.textContent = alertas.length
    cardEl?.classList.toggle("negative", alertas.some(alerta => alerta.nivel === "critico"))
    cardEl?.classList.toggle("positive", alertas.length === 0)

    if (alertas.length === 0) {
        lista.innerHTML = `<p class="card-vacio">Todo en orden. No hay alertas.</p>`
        return
    }

    lista.innerHTML = alertas.map(alerta => `
        <div class="alerta-item ${alerta.nivel}">
            ${icono("triangle-alert", 14)}
            <div>
                <span>${alerta.titulo}</span>
                <small>${alerta.detalle}</small>
            </div>
        </div>
    `).join("")
}

function formatearProximaEjecucion(fecha) {
    if (!fecha) return "Sin próxima ejecución"
    const proxima = new Date(fecha)
    if (Number.isNaN(proxima.getTime())) return "Sin próxima ejecución"
    const dias = diasHasta(proxima)
    const momento = dias === 0 ? "hoy" : dias === 1 ? "mañana" : proxima.toLocaleDateString("es-PE", { day: "2-digit", month: "short" })
    return `Próxima: ${momento}`
}

// ============================================
// ÚLTIMOS MOVIMIENTOS
// ============================================

function actualizarMovimientos() {
    const lista = document.getElementById("movimientos-lista")
    if (!lista) return

    if (movimientosData.length === 0) {
        lista.innerHTML = `<p class="card-vacio">Sin movimientos por ahora.</p>`
        return
    }

    lista.innerHTML = movimientosData.map(plantillaMovimiento).join("")
    enlazarMovimientos(lista)
}

function enlazarMovimientos(lista) {
    lista.querySelectorAll(".movimiento-item").forEach(item => {
        const abrir = async (evento) => {
            evento?.preventDefault?.()
            evento?.stopPropagation?.()
            const m = movimientosData.find(x => x.id === item.dataset.movimientoId)
            if (!m) return
            const { abrirFormularioDetalle } = await import("./movimientos.js")
            abrirFormularioDetalle(m)
        }
        item.addEventListener("click", abrir)
        item.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") abrir(e)
        })
    })
}

function plantillaMovimiento(m) {
    const monto = montoDeMovimiento(m)
    const esPositivo = esMovimientoPositivo(m)
    const signo = esPositivo ? "+" : "-"
    const clase = esPositivo ? "positive" : "negative"
    const tipoNombre = CONFIG_MOVIMIENTOS[m.tipo]?.nombre || m.tipo || "Movimiento"

    return `
        <div class="movimiento-item" data-movimiento-id="${m.id}" role="button" tabindex="0" title="Ver movimiento">
            <div class="movimiento-info">
                <span class="movimiento-titulo">${m.concepto || m.activo || tipoNombre}</span>
                <span class="movimiento-detalle">${formatearFecha(fechaDeMovimiento(m))}</span>
            </div>
            <span class="movimiento-monto ${clase}">${signo} ${formatearMontoConDivisa(Math.abs(monto), m.divisa || "pen")}</span>
        </div>
    `
}

function esMovimientoPositivo(m, cuentaId = null) {
    if (m?.tipo === TIPOS_MOVIMIENTO.ERROR) {
        return m.operacion === "sumar"
    }
    if (m?.tipo === TIPOS_MOVIMIENTO.TRANSFERENCIA) {
        return cuentaId ? m.cuentaDestino === cuentaId : false
    }
    if (!m?.tipo) return false
    return (
        m.tipo === "ingreso" ||
        m.tipo === "ventaActivo" ||
        m.tipo === "p2pVenta"
    )
}

function montoDeMovimiento(m) {
    if (m.monto !== undefined && m.monto !== null && m.monto !== "") {
        return Number(m.monto) || 0
    }
    if (m.cantidad && m.precio) {
        const total = Number(m.cantidad) * Number(m.precio)
        const comision = Number(m.comision) || 0
        return esMovimientoPositivo(m) ? (total - comision) : (total + comision)
    }
    if (m.montoOrigen) return Number(m.montoOrigen) || 0
    if (m.montoDestino) return Number(m.montoDestino) || 0
    return 0
}

function fechaDeMovimiento(m) {
    const valor = m.fechaRealizacion || m.fechaRegistro
    if (!valor) return null
    if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
        const [anio, mes, dia] = valor.split("-").map(Number)
        return new Date(anio, mes - 1, dia)
    }
    if (valor?.toDate) return valor.toDate()
    if (valor?.seconds) return new Date(valor.seconds * 1000)
    return new Date(valor)
}

// ============================================
// CARDS NAVEGABLES
// ============================================

function configurarCardsNavegacion() {
    const bindNavegacion = (id, ruta) => {
        const el = document.getElementById(id)
        if (!el) return
        const ir = () => {
            if (modoEdicionDashboard) return
            navigateTo(ruta)
        }
        el.addEventListener("click", ir)
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                ir()
            }
        })
    }

    bindNavegacion("card-cuentas", "/cuentas")
    bindNavegacion("card-inversiones", "/inversiones")
    bindNavegacion("card-favoritos", "/inversiones")
    bindNavegacion("card-ordenes", "/trading")
    bindNavegacion("card-estrategias", "/inversiones")
    bindNavegacion("card-movimientos", "/movimientos")
    bindNavegacion("card-flujo-caja", "/movimientos")
    bindNavegacion("card-gastos-periodo", "/movimientos")
    bindNavegacion("card-ingresos-periodo", "/movimientos")
    bindNavegacion("card-balance-periodo", "/movimientos")
    bindNavegacion("card-deudas", "/cuentas")
    bindNavegacion("card-ahorro", "/movimientos")
    bindNavegacion("card-distribucion", "/cuentas")
    bindNavegacion("card-distribucion-activos", "/inversiones")
    bindNavegacion("card-patrimonio-divisa", "/cuentas")

    const vencimientos = document.getElementById("card-vencimientos")
    vencimientos?.addEventListener("click", () => {
        if (modoEdicionDashboard) return
        abrirModalVencimientos()
    })
    vencimientos?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            if (modoEdicionDashboard) return
            abrirModalVencimientos()
        }
    })

    const pendientes = document.getElementById("card-pendientes")
    const abrirPendientes = async () => {
        if (modoEdicionDashboard) return
        const { mostrarPendientes } = await import("../ui/pendientes.js")
        await mostrarPendientes()
    }
    pendientes?.addEventListener("click", abrirPendientes)
    pendientes?.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter" || evento.key === " ") {
            evento.preventDefault()
            abrirPendientes()
        }
    })

    const bindModalDashboard = (id, abrir) => {
        const card = document.getElementById(id)
        card?.addEventListener("click", () => {
            if (!modoEdicionDashboard) abrir()
        })
        card?.addEventListener("keydown", evento => {
            if (evento.key === "Enter" || evento.key === " ") {
                evento.preventDefault()
                if (!modoEdicionDashboard) abrir()
            }
        })
    }
    bindModalDashboard("card-programados", abrirModalProgramados)
    bindModalDashboard("card-alertas", abrirModalAlertas)

    const patrimonio = document.querySelector('[data-dashboard-card="patrimonio"]')
    const abrirPatrimonio = () => {
        if (modoEdicionDashboard) return
        abrirModalPatrimonioDashboard()
    }
    patrimonio?.addEventListener("click", evento => {
        if (evento.target.closest("#divisa-select")) return
        abrirPatrimonio()
    })
    patrimonio?.addEventListener("keydown", evento => {
        if (evento.key === "Enter" || evento.key === " ") {
            evento.preventDefault()
            abrirPatrimonio()
        }
    })

    const grafico = document.querySelector('[data-dashboard-card="grafico"] .grafico-container-dashboard')
    grafico?.addEventListener("click", abrirModalEvolucionDashboard)
    grafico?.addEventListener("keydown", evento => {
        if (evento.key === "Enter" || evento.key === " ") {
            evento.preventDefault()
            abrirModalEvolucionDashboard()
        }
    })

    document.getElementById("estrategias-lista")?.addEventListener("click", async evento => {
        const botonCuenta = evento.target.closest("[data-dashboard-cuenta-estrategia]")
        if (!botonCuenta || modoEdicionDashboard) return
        evento.preventDefault()
        evento.stopPropagation()
        const { seleccionarCuentaPorId } = await import("./cuentas.js")
        seleccionarCuentaPorId(botonCuenta.dataset.dashboardCuentaEstrategia)
        navigateTo("/cuentas")
    })
}

function abrirModalPatrimonioDashboard() {
    if (modoEdicionDashboard) return

    const modal = abrirModal({
        titulo: "Patrimonio total",
        contenido: `<div class="patrimonio-modal-loading">${LOGO_ESCINCO_CARGA}</div>`,
        variante: "form",
        confirmText: "Cerrar",
        cancelText: null,
        onConfirm: () => true
    })

    calcularPatrimonio(uid)
        .then(stats => {
            const body = modal?.querySelector(".modal-body")
            if (!body || !modal.isConnected) return
            const activos = convertirMonto(stats.totalActivos, "pen", divisaActual)
            const deudas = convertirMonto(stats.totalDeuda, "pen", divisaActual)
            const invertido = convertirMonto(inversionesData?.valorTotal || 0, inversionesData?.divisa || divisaActual, divisaActual)
            const disponible = Math.max(0, activos - invertido)
            const patrimonioNeto = activos - deudas
            const nombreUsuario = sesion.nombre?.trim() || "Tú"
            body.innerHTML = `
                <p class="patrimonio-modal-caption patrimonio-modal-owner">${nombreUsuario}, posees</p>
                <div class="patrimonio-modal-total ${patrimonioNeto < 0 ? "negative" : "positive"}">
                    ${formatearMontoConDivisa(patrimonioNeto, divisaActual)}
                </div>
                <div class="patrimonio-modal-stats">
                    <div class="patrimonio-modal-stat">
                        <span>Disponible</span>
                        <strong>${formatearMontoConDivisa(disponible, divisaActual)}</strong>
                    </div>
                    <div class="patrimonio-modal-stat">
                        <span>Inmovil / invertido</span>
                        <strong>${formatearMontoConDivisa(invertido, divisaActual)}</strong>
                    </div>
                    <div class="patrimonio-modal-stat">
                        <span>Deudas</span>
                        <strong>${formatearMontoConDivisa(deudas, divisaActual)}</strong>
                    </div>
                </div>
            `
        })
        .catch(error => {
            const body = modal?.querySelector(".modal-body")
            if (!body || !modal.isConnected) return
            body.innerHTML = `<p class="modal-message-desc">No se pudo calcular el patrimonio: ${error.message || "error desconocido"}</p>`
        })
}

async function abrirModalEvolucionDashboard() {
    if (modoEdicionDashboard) return

    let cancelado = false
    let secuenciaModal = 0
    const restaurarGrafico = () => {
        cancelado = true
        secuenciaModal++
        destruirGraficoPatrimonio("evolucion-modal")
        if (datosGrafico?.labels?.length) dibujarGrafico()
    }

    const modal = abrirModal({
        titulo: "Evolución patrimonial",
        contenido: `<div class="patrimonio-modal-loading">${LOGO_ESCINCO_CARGA}</div>`,
        variante: "wide",
        confirmText: "Cerrar",
        cancelText: null,
        onConfirm: () => {
            restaurarGrafico()
            return true
        },
        onCancel: restaurarGrafico
    })

    try {
        const periodo = obtenerPeriodo(periodoGrafico)
        const datos = datosGrafico?.labels?.length
            ? datosGrafico
            : await obtenerPatrimonioParaGrafico(uid, periodo.dias)
        const body = modal?.querySelector(".modal-body")
        if (!body || !modal.isConnected || cancelado) return

        body.innerHTML = `
            <div class="evolucion-modal-grafico">
                <canvas id="grafico-patrimonio-modal"></canvas>
            </div>
            <div class="toggle-group grafico-periodos-modal" id="grafico-periodos-modal">
                ${PERIODOS_GRAFICO.map(p => `
                    <span class="toggle-option" data-periodo="${p.id}">${p.etiqueta}</span>
                `).join('')}
            </div>
        `
        configurarPeriodos(body.querySelector("#grafico-periodos-modal"), async () => {
            if (!modal?.isConnected || cancelado) return
            const secuencia = ++secuenciaModal
            const datosPeriodo = await obtenerPatrimonioParaGrafico(uid, obtenerPeriodo(periodoGrafico).dias)
            if (!modal.isConnected || cancelado || secuencia !== secuenciaModal) return
            datosGrafico = datosPeriodo
            await crearGraficoPatrimonio("grafico-patrimonio-modal", datosPeriodo, {
                divisa: divisaActual.toUpperCase(),
                etiquetaDivisa: presentarDivisa(divisaActual),
                chartKey: "evolucion-modal"
            })
        })
        await crearGraficoPatrimonio("grafico-patrimonio-modal", datos, {
            divisa: divisaActual.toUpperCase(),
            etiquetaDivisa: presentarDivisa(divisaActual),
            chartKey: "evolucion-modal"
        })
        if (cancelado && datosGrafico?.labels?.length) dibujarGrafico()
    } catch (error) {
        const body = modal?.querySelector(".modal-body")
        if (!body || !modal.isConnected || cancelado) return
        body.innerHTML = `<p class="modal-message-desc">No se pudo cargar la evolución: ${error.message || "error desconocido"}</p>`
    }
}

function abrirModalProgramados() {
    const items = analiticaData?.programados || []
    const contenido = items.length > 0
        ? `<div class="modal-lista-dashboard">${items.map(item => `
            <div class="dashboard-list-item">
                <div class="dashboard-list-info">
                    <span class="dashboard-list-title">${item.titulo}</span>
                    <span class="dashboard-list-detail">${formatearFecha(item.fecha)}</span>
                </div>
                <span class="dashboard-list-value">${formatearMontoConDivisa(item.monto, divisaActual)}</span>
            </div>
        `).join("")}</div>`
        : `<div class="modal-message"><p class="modal-message-desc">No hay movimientos programados próximos.</p></div>`

    abrirModal({
        titulo: "Movimientos programados",
        contenido,
        variante: "info",
        confirmText: "Cerrar",
        onConfirm: () => true
    })
}

function abrirModalAlertas() {
    const items = analiticaData?.alertas || []
    const contenido = items.length > 0
        ? `<div class="modal-lista-dashboard">${items.map(alerta => `
            <div class="alerta-item ${alerta.nivel}">
                ${icono("triangle-alert", 16)}
                <div>
                    <span>${alerta.titulo}</span>
                    <small>${alerta.detalle}</small>
                </div>
            </div>
        `).join("")}</div>`
        : `<div class="modal-message"><p class="modal-message-desc">Todo en orden. No hay alertas.</p></div>`

    abrirModal({
        titulo: "Alertas",
        contenido,
        variante: "info",
        confirmText: "Cerrar",
        onConfirm: () => true
    })
}

async function abrirModalVencimientos() {
    const items = vencimientosData?.items || []

    let contenido
    if (items.length === 0) {
        contenido = `
            <div class="modal-message">
                <p class="modal-message-desc">
                    Sin vencimientos en los próximos ${DIAS_VENCIMIENTO} días.
                </p>
            </div>
        `
    } else {
        contenido = `<div class="lista-cards vencimientos-lista">
            ${items.map(plantillaVencimiento).join("")}
        </div>`
    }

    const modalEl = abrirModal({
        titulo: "Próximos vencimientos",
        contenido,
        variante: "info",
        confirmText: "Cerrar",
        onConfirm: () => true
    })

    // Click en una tarjeta abre el modal específico: aporte para metas,
    // vista detalle para pendientes. Sin botones dentro de las tarjetas.
    const lista = modalEl?.querySelector(".vencimientos-lista")
    lista?.addEventListener("keydown", (evento) => {
        if (evento.key !== "Enter" && evento.key !== " ") return
        const card = evento.target.closest(".card-item")
        if (!card) return
        evento.preventDefault()
        card.click()
    })
    lista?.addEventListener("click", async (evento) => {
        const card = evento.target.closest(".card-item")
        if (!card) return

        const opcion = vencimientosData.items.find(
            v => v.tipo === card.dataset.tipo && v.id === card.dataset.id
        )
        if (!opcion) return

        if (opcion.tipo === "meta") {
            const { abrirModalAporteMeta } = await import("../ui/metas.js")
            abrirModalAporteMeta(opcion.meta)
            return
        }

        if (opcion.tipo === "pendiente") {
            const { abrirVistaPendiente } = await import("../ui/pendientes.js")
            abrirVistaPendiente(opcion.pendiente, uid)
            return
        }

        if (opcion.tipo === "tarjeta") {
            const { abrirPagarTarjeta } = await import("./cuentas.js")
            await abrirPagarTarjeta(opcion.cuenta)
        }
    })
}

function plantillaVencimiento(v) {
    const esPendiente = v.tipo === "pendiente"
    const accionable = esPendiente || v.tipo === "meta" || v.tipo === "tarjeta"
    const signo = esPendiente ? (v.esCobrar ? "+" : "-") : ""
    const claseValor = esPendiente
        ? (v.esCobrar ? "positive" : "negative")
        : (v.vencido ? "negative" : "")

    return `
        <div class="card-item vencimiento-item ${v.vencido ? "vencido" : ""} ${accionable ? "clickeable" : ""}"
            data-tipo="${v.tipo}" data-id="${v.id}" role="button" tabindex="0">
            <div class="card-item-info">
                <span class="card-item-titulo">${v.titulo} ${v.vencido ? "· VENCIDO" : ""}</span>
                <span class="card-item-detalle">
                    ${v.subtitulo} · ${textoDias(v.diasRestantes)}
                </span>
            </div>
            <span class="card-item-valor ${claseValor}">
                ${signo ? `${signo} ` : ""}${formatearMontoConDivisa(v.monto, v.divisa)}
            </span>
        </div>
    `
}

function textoDias(dias) {
    if (dias < 0) return "vencido"
    if (dias === 0) return "hoy"
    if (dias === 1) return "mañana"
    return `en ${dias} días`
}

// ============================================
// FAVORITOS
// ============================================

function actualizarFavoritos() {
    const lista = document.getElementById("favoritos-lista")
    const cantidadEl = document.getElementById("favoritos-cantidad")
    if (!lista) return

    if (cantidadEl) cantidadEl.textContent = favoritosData.length

    if (favoritosData.length === 0) {
        lista.innerHTML = `<p class="card-vacio">Marca activos con la estrella en Inversiones.</p>`
        return
    }

    lista.innerHTML = favoritosData.map(plantillaFavorito).join("")
    enlazarFavoritos(lista)
}

function enlazarFavoritos(lista) {
    lista.querySelectorAll(".favorito-item").forEach(item => {
        const abrir = async (evento) => {
            evento?.preventDefault?.()
            evento?.stopPropagation?.()
            const posicion = favoritosData.find(p => p.activoId === item.dataset.activoId)
            const activo = posicion?.activo
            if (!posicion || !activo) return
            const { mostrarGraficoActivo } = await import("./inversiones.js")
            await mostrarGraficoActivo(activo.id, activo, posicion)
        }
        item.addEventListener("click", abrir)
        item.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") abrir(e)
        })
    })
}

function plantillaFavorito(posicion) {
    const activo = posicion.activo || {}
    const precio = (activo.ultimoPrecio || 0).toFixed(2)

    return `
        <div class="favorito-item" data-activo-id="${posicion.activoId}" role="button" tabindex="0" title="Ver historial de precios">
            <div class="favorito-info">
                <span class="favorito-nombre">${activo.nombre || posicion.activoId}</span>
                <span class="favorito-simbolo">${activo.simbolo || ""}</span>
            </div>
            <span class="favorito-precio">${formatearMontoConDivisa(precio, posicion.divisa)}</span>
        </div>
    `
}

// ============================================
// METAS DE AHORRO
// ============================================

function configurarMetas() {
    document.getElementById("btn-nueva-meta")
        ?.addEventListener("click", () => {
            if (modoEdicionDashboard) return
            abrirModalMeta()
        })

    instalarSincronizacionMetas()
}

// Cuando las metas cambian desde el modal del lastbar (metas.js), refresca
// la sección del dashboard sin recargar. Se instala una sola vez.
let sincronizacionMetasInstalada = false
function instalarSincronizacionMetas() {
    if (sincronizacionMetasInstalada) return
    sincronizacionMetasInstalada = true
    window.addEventListener("metas-actualizadas", async () => {
        metasData = await cargarMetas()
        actualizarMetas()
        aplicarLayoutDashboard(true)
    })
}

function actualizarMetas() {
    const lista = document.getElementById("metas-lista")
    if (!lista) return

    if (metasData.length === 0) {
        lista.innerHTML = `<p class="card-vacio">Crea tu primera meta de ahorro.</p>`
        return
    }

    lista.innerHTML = metasData.map(plantillaMeta).join("")
    enlazarListaMetas(lista)
}

// Tarjeta al estilo de "Últimos movimientos"/"Favoritos": el nombre con el
// monto acumulado como información secundaria y el porcentaje a la derecha.
function plantillaMeta(meta) {
    const clases = [
        "meta-item",
        meta.completada ? "completada" : "",
        meta.activa ? "" : "pausada"
    ].filter(Boolean).join(" ")

    return `
        <div class="${clases}" data-meta-id="${meta.id}" role="button" tabindex="0" title="Aportar a la meta">
            <div class="meta-info">
                <span class="meta-nombre">${meta.nombre}</span>
                <span class="meta-cantidad">${formatearMontoConDivisa(meta.montoActual, meta.divisa)}</span>
            </div>
            <span class="meta-porcentaje">${meta.porcentaje.toFixed(0)}%</span>
        </div>
    `
}

function enlazarListaMetas(lista) {
    lista.querySelectorAll(".meta-item").forEach(item => {
        const abrir = (evento) => {
            evento?.preventDefault?.()
            evento?.stopPropagation?.()
            const meta = metasData.find(m => m.id === item.dataset.metaId)
            if (meta) abrirModalAporteMeta(meta)
        }
        item.addEventListener("click", abrir)
        item.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") abrir(e)
        })
    })
}

function formatearFecha(fecha) {
    if (!fecha) return "—"
    const d = new Date(fecha)
    if (isNaN(d.getTime())) return "—"
    return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" })
}

// ============================================
// SELECTOR DE DIVISA
// ============================================

function configurarDivisa() {
    const select = document.getElementById("divisa-select")
    if (!select) return

    select.value = divisaActual

    select.addEventListener("change", async () => {
        divisaActual = select.value

        await actualizarPatrimonio()
        actualizarPatrimonioDivisa()
        actualizarInversiones()
        actualizarDistribucionActivos()
        montarCardsInstanciadas()
        analiticaData = construirAnaliticaDashboard(movimientosCompletosData)
        actualizarFlujoCaja()
        actualizarFlujoPeriodo()
        actualizarDeudas()
        actualizarAhorro()
        actualizarDistribucion()
        actualizarProgramados()
        actualizarAlertas()
        aplicarLayoutDashboard(true)

        // Redibujar el gráfico manteniendo el periodo actual
        if (datosGrafico?.labels?.length) {
            await crearGraficoPatrimonio("grafico-patrimonio", datosGrafico, {
                divisa: divisaActual.toUpperCase(),
                etiquetaDivisa: presentarDivisa(divisaActual)
            })
        }
    })
}

// ============================================
// SELECTOR DE PERIODO
// ============================================

function configurarPeriodos(contenedor = document.getElementById("grafico-periodos"), alCambiar = cargarGraficoPatrimonio) {
    if (!contenedor) return

    const opciones = contenedor.querySelectorAll(".toggle-option")

    const marcarActivo = () => {
        opciones.forEach(opt => {
            opt.classList.toggle("active", opt.dataset.periodo === periodoGrafico)
        })
    }

    opciones.forEach(opt => {
        opt.addEventListener("click", async () => {
            if (opt.dataset.periodo === periodoGrafico) return
            periodoGrafico = opt.dataset.periodo
            marcarActivo()
            sesion.setPreferencias({ periodoEvolucion: periodoGrafico })
            actualizarPreferencias(uid, { periodoEvolucion: periodoGrafico }).catch(error => {
                console.warn("No se pudo guardar el periodo del gráfico:", error)
            })
            await alCambiar()
        })
    })

    marcarActivo()
}

// Toggle compartido por las cards Gastado / Ingresado / Balance. Solo
// redibuja texto: los totales de cada ventana ya vienen calculados en
// `analiticaData.flujoPorPeriodo`, así que no hace falta releer Firestore.
function configurarPeriodoFlujoDashboard() {
    const contenedor = document.getElementById("periodo-flujo")
    if (!contenedor || contenedor.dataset.eventosListos === "1") return
    contenedor.dataset.eventosListos = "1"

    const opciones = contenedor.querySelectorAll(".toggle-option")

    const marcarActivo = () => {
        opciones.forEach(opt => {
            opt.classList.toggle("active", opt.dataset.periodoFlujo === periodoFlujo)
        })
    }

    opciones.forEach(opt => {
        opt.addEventListener("click", event => {
            // La card es clicable y navega a /movimientos: sin esto, el
            // toggle se dispararía y la navegación también.
            event.stopPropagation()
            if (opt.dataset.periodoFlujo === periodoFlujo) return
            periodoFlujo = opt.dataset.periodoFlujo
            marcarActivo()
            actualizarFlujoPeriodo()
            sesion.setPreferencias({ periodoFlujo })
            actualizarPreferencias(uid, { periodoFlujo }).catch(error => {
                console.warn("No se pudo guardar el periodo del flujo:", error)
            })
        })
    })

    marcarActivo()
}

// ============================================
// GRÁFICO DE PATRIMONIO
// ============================================

async function actualizarGraficoPatrimonio() {
    if (!document.querySelector('[data-dashboard-card="grafico"]')?.isConnected) return
    try {
        await registrarSnapshot(uid)
    } catch (error) {
        console.warn("No se pudo registrar snapshot:", error)
    }
    return cargarGraficoPatrimonio()
}

async function cargarGraficoPatrimonio() {
    const secuencia = ++secuenciaGraficoDashboard
    const periodo = obtenerPeriodo(periodoGrafico)
    const card = document.querySelector('[data-dashboard-card="grafico"]')
    if (!card?.isConnected) return
    mostrarEstadoGrafico("cargando", "")

    try {
        const datos = await obtenerPatrimonioParaGrafico(uid, periodo.dias)
        if (secuencia !== secuenciaGraficoDashboard || !card.isConnected) return
        datosGrafico = datos

        if (!datos?.labels?.length) {
            mostrarEstadoGrafico("vacio", "Sin datos para este periodo", "Los datos se registran automáticamente cada día")
            ocultarCanvas()
            return
        }

        mostrarCanvas()
        const instancia = await dibujarGrafico(datos, secuencia)
        if (!instancia) throw new Error("No se pudo crear el gráfico")
        if (secuencia === secuenciaGraficoDashboard && card.isConnected) ocultarEstadoGrafico()
    } catch (error) {
        if (secuencia !== secuenciaGraficoDashboard || !card.isConnected) return
        console.error("Error cargando gráfico de patrimonio:", error)
        mostrarEstadoGrafico("vacio", "No se pudo cargar el gráfico", error.message)
        ocultarCanvas()
    }
}

async function dibujarGrafico(datos = datosGrafico, secuencia = secuenciaGraficoDashboard) {
    const card = document.querySelector('[data-dashboard-card="grafico"]')
    const canvas = document.getElementById("grafico-patrimonio")
    if (!card?.isConnected || !canvas?.isConnected || secuencia !== secuenciaGraficoDashboard) return null
    return crearGraficoPatrimonio("grafico-patrimonio", datos, {
        divisa: divisaActual.toUpperCase(),
        etiquetaDivisa: presentarDivisa(divisaActual)
    })
}

function mostrarEstadoGrafico(tipo, texto, hint = "") {
    const estado = document.getElementById("grafico-estado")
    if (!estado) return

    estado.innerHTML = tipo === "cargando"
        ? skeletonMarkup({ variant: "chart", label: "Cargando gráfico" })
        : `
            <div class="grafico-vacio">
                <p class="grafico-vacio-texto">${texto}</p>
                ${hint ? `<p class="grafico-vacio-hint">${hint}</p>` : ""}
            </div>
        `
    estado.hidden = false
}

function ocultarEstadoGrafico() {
    const estado = document.getElementById("grafico-estado")
    if (!estado) return
    estado.hidden = true
    estado.innerHTML = ""
}

function mostrarCanvas() {
    const canvas = document.getElementById("grafico-patrimonio")
    if (canvas) canvas.hidden = false
}

function ocultarCanvas() {
    const canvas = document.getElementById("grafico-patrimonio")
    if (canvas) canvas.hidden = true
}

// ============================================
// LIMPIEZA
// ============================================

export function destroy() {
    secuenciaGraficoDashboard++
    destruirGraficoPatrimonio()
    destruirGraficoPatrimonio("evolucion-modal")
}