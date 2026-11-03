import { asegurarEstilos } from "../core/estilos.js"
import { sesion } from "../core/sesion.js"
import { cacheCapa } from "../core/cache.js"
import { activarSpinLogo, desactivarSpinLogo, navigateTo } from "../core/router.js"
import { obtenerCuentas, obtenerMovimientos, obtenerPreferencias, actualizarPreferencias } from "../../firebase/firestore.js"
import { tieneHijas, hijasDe, saldoFamilia, cuentasVisibles, esHija, esAbstracta, esSaldoInmovil } from "../core/familiaCuentas.js"
import { CONFIG_MOVIMIENTOS, TIPOS_MOVIMIENTO } from "../../constants/tiposMovimiento.js"
import {
    registrarSnapshot,
    obtenerPatrimonioParaGrafico,
    calcularPatrimonio
} from "../services/SnapshotServicio.js"
import {
    crearGraficoPatrimonio,
    destruirGraficoPatrimonio,
    crearGraficoDistribucion
} from "../ui/graficos.js"
import {
    getDivisaPrincipal,
    getFormatoDivisa,
    convertirMonto,
    formatearMonto,
    formatearMontoConDivisa,
    presentarDivisa,
    etiquetaDivisa
} from "../services/DivisaServicio.js"
import { obtenerPosicionesConValor } from "../services/PosicionServicio.js"
import { estadoCicloDe, nivelUsoDe, proximaAnualidad } from "../services/CreditoServicio.js"
import { esMovimientoPositivo, montoDeMovimiento, compararMovimientosPorFecha } from "../core/movimientos.js"
import { obtenerPendientes } from "../repositories/PendienteRepositorio.js"
import { obtenerOrdenes } from "../repositories/OrdenRepositorio.js"
import { obtenerEstrategias } from "../repositories/EstrategiaRepositorio.js"
import { calcularProximaEjecucion } from "../services/EstrategiaServicio.js"
import { abrirModal, contenidoDesdeTemplate, contenidoDesdeFilas } from "../ui/modal.js"
import { abrirModalPresupuestos, abrirModalEditarPresupuesto } from "../ui/presupuestos.js"
import { mostrarNotificacion } from "../ui/notificaciones.js"
import { icono, LOGO_ESCINCO_CARGA } from "../core/iconos.js"
import { skeletonMarkup, skeletonText, esqueletoContenedor, esqueletoTexto } from "../ui/skeletons.js"
import { rastrearEvento } from "../services/AnalyticsServicio.js"

import { obtenerMetas } from "../repositories/MetaRepositorio.js"
import { abrirModalMeta, abrirModalAporteMeta } from "../ui/metas.js"
import { obtenerPresupuestosConProgreso, eliminarPresupuesto } from "../services/PresupuestoServicio.js"

asegurarEstilos("dashboard")

// Estado vacío de las listas del dashboard: `<p class="card-vacio">`.
function tarjetaVacia(texto) {
    return contenidoDesdeTemplate("tpl-card-vacio", { valores: { texto } })
}

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
const DASHBOARD_CARDS = [
    { id: "patrimonio", label: "Patrimonio total", spanColumnas: 1, spanFilas: 1 },
    { id: "cuentas", label: "Cuentas", spanColumnas: 1, spanFilas: 1 },
    { id: "inversiones", label: "Inversiones", spanColumnas: 1, spanFilas: 1 },
    { id: "vencimientos", label: "Próximos vencimientos", spanColumnas: 1, spanFilas: 1 },
    { id: "movimientos", label: "Últimos movimientos", spanColumnas: 1, spanFilas: 2, scroll: true },
    { id: "favoritos", label: "Favoritos", spanColumnas: 1, spanFilas: 1 },
    { id: "metas", label: "Metas de ahorro", spanColumnas: 1, spanFilas: 1 },
    { id: "presupuestos", label: "Presupuestos", spanColumnas: 1, spanFilas: 1 },
    { id: "pendientes", label: "Pendientes", spanColumnas: 1, spanFilas: 1 },
    { id: "ordenes", label: "Órdenes", spanColumnas: 1, spanFilas: 1 },
    { id: "estrategias", label: "Estrategias", spanColumnas: 1, spanFilas: 1 },
    { id: "flujo-caja", label: "Flujo de caja", spanColumnas: 1, spanFilas: 1 },
    { id: "gastos-periodo", label: "Gastado", spanColumnas: 1, spanFilas: 1 },
    { id: "ingresos-periodo", label: "Ingresado", spanColumnas: 1, spanFilas: 1 },
    { id: "balance-periodo", label: "Balance", spanColumnas: 1, spanFilas: 1 },
    { id: "deudas", label: "Deudas", spanColumnas: 1, spanFilas: 1 },
    { id: "distribucion", label: "Distribución patrimonial", spanColumnas: 1, spanFilas: 2 },
    { id: "patrimonio-divisa", label: "Patrimonio por divisa", spanColumnas: 1, spanFilas: 1 },
    { id: "programados", label: "Movimientos programados", spanColumnas: 1, spanFilas: 1 },
    { id: "alertas", label: "Alertas", spanColumnas: 1, spanFilas: 1 },
    { id: "grafico", label: "Evolución patrimonial", spanColumnas: 2, spanFilas: 1 }
]

// Cards visibles de partida para una cuenta nueva o sin elección guardada.
// "patrimonio" queda fuera: se pinta siempre y no es personalizable.
const DEFAULT_CARDS_VISIBLES = ["cuentas", "movimientos", "inversiones", "metas", "grafico"]

// El orden conserva el catálogo completo: normalizarCardsOrden lo usa como
// lista de ids conocidos, así que recortarlo descartaría del orden las cards
// que el usuario active más adelante.
const DEFAULT_CARDS_ORDEN = DASHBOARD_CARDS
    .map(card => card.id)
    .filter(id => id !== "patrimonio")

// Devuelve las clases CSS de dimensiones para una card dada su id.
// Ejemplo: "card-span-2 card-con-scroll"
// Considera primero las dimensiones personalizadas del usuario, luego las del catálogo.
function clasesCard(id) {
    const personalizada = cardsDimensionesDashboard[id]
    const catalogo = DASHBOARD_CARDS.find(c => c.id === id)
    const spanCol = personalizada?.columnas ?? catalogo?.spanColumnas ?? 1
    const spanFil = personalizada?.filas ?? catalogo?.spanFilas ?? 1
    const scroll = personalizada?.scroll ?? catalogo?.scroll ?? false
    const clases = []
    if (spanCol === 2) clases.push("card-span-2")
    if (spanFil === 2) clases.push("card-span-row-2")
    if (spanCol === 2 && spanFil === 2) clases.push("card-span-2x2")
    if (scroll) clases.push("card-con-scroll")
    return clases.join(" ")
}

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
    plazo: "Depósito a plazo",
    debito: "Tarjeta de débito",
    credito: "Tarjeta de crédito"
}

const ETIQUETAS_TIPO_ACTIVO = {
    accion: "Acción",
    etf: "ETF",
    crypto: "Cripto",
    bono: "Bono",
    otros: "Otros"
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
let cardsDimensionesDashboard = {}
let modoEdicionDashboard = false
let cambiosPendientesDashboard = false
let eventosEdicionDashboardListos = false

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

function configurarCardsDashboardDesdeSesion() {
    const dashboard = sesion.getPreferencias()?.dashboard
    cardsVisiblesDashboard = normalizarCardsVisibles(dashboard?.cardsVisibles)
    cardsOrdenDashboard = normalizarCardsOrden(dashboard?.orden)
    cardsDimensionesDashboard = dashboard?.dimensiones || {}
}

async function cargarCardsVisiblesDashboard() {
    if (!uid) return
    try {
        const preferencias = sesion.getPreferencias() || await obtenerPreferencias(uid)
        const dashboard = preferencias?.dashboard
        cardsVisiblesDashboard = normalizarCardsVisibles(dashboard?.cardsVisibles)
        cardsOrdenDashboard = normalizarCardsOrden(dashboard?.orden)
        cardsDimensionesDashboard = dashboard?.dimensiones || {}
    } catch (error) {
        console.warn("No se pudieron cargar las cards visibles del dashboard:", error)
        cardsVisiblesDashboard = [...DEFAULT_CARDS_VISIBLES]
        cardsOrdenDashboard = [...DEFAULT_CARDS_ORDEN]
        cardsDimensionesDashboard = {}
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
    if (dashboard.dimensiones !== undefined) cambios["dashboard.dimensiones"] = dashboard.dimensiones

    await actualizarPreferencias(uid, cambios)
    const preferencias = sesion.getPreferencias()
    sesion.setPreferencias({
        ...preferencias,
        dashboard: {
            ...(preferencias.dashboard || {}),
            ...dashboard
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
        // Una hija no tiene card: su dinero esta en la del padre, que muestra
        // el total de la familia. Si alguna quedo guardada de antes, se ignora
        // para no duplicar el patrimonio.
        if (!cuenta || esHija(cuenta)) return null
        return { tipo, cuenta }
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
// grid CSS coloca las tarjetas automáticamente.
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
        if (!(nodo instanceof Element)) return
        // Animación de entrada: aparece con fade + translateY.
        nodo.classList.add("dashboard-card-entra")
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
    const fragmento = entidad.tipo === "cuenta"
        ? plantillaCardCuenta(entidad.cuenta)
        : plantillaCardActivo(entidad.posicion)
    return fragmento?.firstElementChild || null
}

function cantidadDeActivo(valor) {
    const numero = Number(valor)
    if (!Number.isFinite(numero)) return "0"
    return Math.abs(numero) >= 1000
        ? numero.toLocaleString("es-PE", { maximumFractionDigits: 2 })
        : String(Number(numero.toFixed(4)))
}

function filaDato(etiqueta, valor) {
    if (!valor) return null
    return contenidoDesdeTemplate("tpl-card-dato", { valores: { label: etiqueta, valor } })
}

// Card de una cuenta. No lista movimientos ni cantidades de operación: solo
// el estado del saldo. En tarjetas de crédito cambia por completo (línea de
// crédito, uso, ciclo de facturación y anualidad).
function plantillaCardCuenta(cuenta) {
    const esCredito = cuenta.tipo === "credito"
    const prefijo = `cuenta-card-${cuenta.id}`
    const etiqueta = ETIQUETAS_TIPO_CUENTA[cuenta.tipo] || "Cuenta"

    const uso = esCredito
        ? contenidoDesdeTemplate("tpl-dashboard-card-uso", {
            valores: {
                "barra@id": `${prefijo}-barra`,
                "porcentaje@id": `${prefijo}-porcentaje`
            }
        })
        : null

    return contenidoDesdeTemplate("tpl-dashboard-card-cuenta", {
        valores: {
            "card@id": `card-${prefijo}`,
            "card@data-dashboard-card": idCardCuenta(cuenta.id),
            "card@class": `glass card card-navegable card-cuenta${esCredito ? " card-cuenta-credito" : ""}`,
            "card@aria-label": cuenta.nombre || etiqueta,
            "titulo": etiqueta,
            "estado@id": `${prefijo}-estado`,
            "valor@id": `${prefijo}-valor`,
            "detalle@id": `${prefijo}-detalle`,
            "datos@id": `${prefijo}-datos`
        },
        html: {
            uso
        }
    })
}

// Card de un activo con posición abierta: valor, resultado y desglose de la
// posición (cantidad, precio promedio y último precio).
function plantillaCardActivo(posicion) {
    const prefijo = `activo-card-${posicion.activoId}`

    return contenidoDesdeTemplate("tpl-dashboard-card-activo", {
        valores: {
            "card@id": `card-${prefijo}`,
            "card@data-dashboard-card": idCardActivo(posicion.activoId),
            "nombre@id": `${prefijo}-nombre`,
            "estado@id": `${prefijo}-estado`,
            "valor@id": `${prefijo}-valor`,
            "detalle@id": `${prefijo}-detalle`,
            "datos@id": `${prefijo}-datos`
        }
    })
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
            estadoEl.hidden = true
        }

        const barraEl = card.querySelector(`#${prefijo}-barra`)
        if (barraEl) {
            barraEl.style.setProperty("--barra-ancho", `${Math.min(100, uso.porcentaje).toFixed(1)}%`)
            barraEl.className = "barra-progreso " + uso.nivel
        }
        const porcentajeEl = card.querySelector(`#${prefijo}-porcentaje`)
        if (porcentajeEl) {
            porcentajeEl.textContent = uso.limite > 0 ? `${uso.porcentaje.toFixed(0)}%` : "—"
            porcentajeEl.className = `card-uso-pct ${uso.nivel}`
        }

        if (datosEl) {
            datosEl.replaceChildren(...[
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
            ].filter(Boolean))
        }
        return
    }

// El saldo de una cuenta con subcuentas es el total de la familia, no solo el
// nominal de su propia divisa: si no, la card dejaria fuera el resto del dinero
// de esa cuenta.
const saldo = tieneHijas(cuenta, cuentas)
    ? saldoFamilia(cuenta, cuentas)
    : Number(cuenta.saldoInicial) || 0
valorEl.textContent = formatearMontoConDivisa(saldo, moneda)
valorEl.classList.remove("positive", "negative")
if (saldo > 0) valorEl.classList.add("positive")
else if (saldo < 0) valorEl.classList.add("negative")

if (detalleEl) {
    const monedaDistinta = moneda !== divisaActual
    const nHijas = tieneHijas(cuenta, cuentas) ? hijasDe(cuenta, cuentas).length : 0
    const nSub = esAbstracta(cuenta) ? nHijas : nHijas + 1
    const etiqueta = nHijas > 0 ? `${nSub} subcuentas · saldo disponible` : "Saldo disponible"
    detalleEl.textContent = monedaDistinta
        ? `${etiqueta} · ${formatearMontoConDivisa(convertirMonto(saldo, moneda, divisaActual), divisaActual)}`
        : etiqueta
}

    if (estadoEl) {
        // En una cuenta no crédito el badge queda libre: el estado
        // (activa/archivada) no se muestra. Las archivadas ya ni siquiera
        // llegan aquí, y "activa" es el estado por defecto: solo añadiría ruido.
        estadoEl.textContent = ""
        estadoEl.hidden = true
    }

    if (datosEl) {
        datosEl.replaceChildren(...[
            filaDato("Divisa", presentarDivisa(moneda)),
            filaDato("Alta", cuenta.fechaCreacion ? formatearFecha(cuenta.fechaCreacion) : "")
        ].filter(Boolean))
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
        datosEl.replaceChildren(...[
            filaDato("Cantidad", `${cantidadDeActivo(cantidad)} ${activo.simbolo || ""}`.trim()),
            filaDato("Precio", `${formatearMontoConDivisa(ultimoPrecio, divisa)} · prom. ${formatearMontoConDivisa(precioPromedio, divisa)}`),
            filaDato("Tipo", ETIQUETAS_TIPO_ACTIVO[activo.tipo] || "")
        ].filter(Boolean))
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

}

function reordenarDashboard() {
    const grid = document.querySelector(".dashboard")
    if (!grid) return

    const contenedorScroll = document.getElementById("app-content")
    const scrollAntes = contenedorScroll?.scrollTop ?? 0

    // patrimonio siempre va primero y es fija
    const orden = ["patrimonio", ...cardsOrdenDashboard.filter(id => id !== "patrimonio")]

    const cards = new Map()
    grid.querySelectorAll(":scope > [data-dashboard-card]").forEach(card => {
        cards.set(card.dataset.dashboardCard, card)
    })

    const fragmento = document.createDocumentFragment()
    orden.forEach(id => {
        const card = cards.get(id)
        if (card) {
            fragmento.appendChild(card)
            cards.delete(card.dataset.dashboardCard)
        }
    })
    // Tarjetas no listadas en `orden` van al final, nunca se quedan delante
    cards.forEach(card => fragmento.appendChild(card))
    grid.appendChild(fragmento)

    // Restaurar scroll para que no salte tras reordenar las cards
    if (contenedorScroll) contenedorScroll.scrollTop = scrollAntes
}

// ============================================
// SCROLL FADE DE LAS LISTAS DEL DASHBOARD
// ============================================
// Las listas con `.scroll-fade` muestran un degradado en el borde que tiene
// contenido oculto (arriba y/o abajo). El degradado se controla con las
// clases .scroll-fade-top / .scroll-fade-bottom de navegacion.css, que ajustan
// las variables --scroll-fade-top / --scroll-fade-bottom de la máscara. Cuando
// no hay contenido oculto en ningún lado no se aplica ninguna clase y la
// máscara base queda opaca: sin fade visible.

function actualizarScrollFade(contenedor) {
    if (!(contenedor instanceof HTMLElement)) return
    const scrollTop = contenedor.scrollTop
    const scrollHeight = contenedor.scrollHeight
    const clientHeight = contenedor.clientHeight
    const ocultoArriba = scrollTop > 0
    const ocultoAbajo = scrollTop + clientHeight < scrollHeight - 1
    contenedor.classList.toggle("scroll-fade-top", ocultoArriba)
    contenedor.classList.toggle("scroll-fade-bottom", ocultoAbajo)
}

function configurarScrollFade() {
    // Se ejecuta tras cada render: los nodos se recrean al navegar de página,
    // así que el atributo de datos evita volver a enganchar listeners a un
    // contenedor que ya los tiene (p. ej. recarga de datos sin render).
    document.querySelectorAll(".scroll-fade").forEach(contenedor => {
        if (contenedor.dataset.scrollFadeListo === "1") return
        contenedor.dataset.scrollFadeListo = "1"
        let solicitud = null
        contenedor.addEventListener("scroll", () => {
            if (solicitud) return
            solicitud = requestAnimationFrame(() => {
                solicitud = null
                actualizarScrollFade(contenedor)
            })
        }, { passive: true })
        actualizarScrollFade(contenedor)
    })
}

// ============================================
// SCROLL FADE DEL CONJUNTO DEL DASHBOARD (main)
// ============================================
// Cuando el dashboard supera la altura del viewport, #app-content scrollea
// internamente. El degradado aparece en el borde que tenga contenido oculto
// (arriba y/o abajo), controlado con .scroll-fade-top / .scroll-fade-bottom.

function actualizarScrollFadeApp() {
    const app = document.getElementById("app-content")
    if (!(app instanceof HTMLElement)) return
    const { scrollTop, scrollHeight, clientHeight } = app
    const ocultoArriba = scrollTop > 0
    const ocultoAbajo = scrollTop + clientHeight < scrollHeight - 1
    app.classList.toggle("scroll-fade-top", ocultoArriba)
    app.classList.toggle("scroll-fade-bottom", ocultoAbajo)
}

function configurarScrollFadeApp() {
    const app = document.getElementById("app-content")
    if (!app || app.dataset.scrollFadeApp === "1") return
    app.dataset.scrollFadeApp = "1"
    app.classList.add("scroll-fade")
    let solicitud = null
    app.addEventListener("scroll", () => {
        if (solicitud) return
        solicitud = requestAnimationFrame(() => {
            solicitud = null
            actualizarScrollFadeApp()
        })
    }, { passive: true })
    actualizarScrollFadeApp()
}

// ============================================
// ARRASTRAR Y SOLTAR CON SORTABLEJS
// ============================================
// SortableJS gestiona el drag & drop sobre el grid de celdas uniformes,
// incluyendo el indicador visual de inserción, el auto-scroll y el soporte
// táctil nativo. Al soltar (onEnd), se lee el nuevo orden del DOM y se
// persiste en `cardsOrdenDashboard` y Firestore.

let sortableDashboard = null

/** Cards visibles, en el orden en que se leen (izquierda a derecha, de arriba abajo). */
function cardsVisiblesEnOrden() {
    const grid = document.querySelector(".dashboard")
    if (!grid) return []

    return cardsOrdenDashboard
        .filter(id => {
            const card = grid.querySelector(`[data-dashboard-card="${CSS.escape(id)}"]`)
            return card && !card.hidden && card.isConnected
        })
        .map(id => grid.querySelector(`[data-dashboard-card="${CSS.escape(id)}"]`))
        .filter(Boolean)
}

function moverCardDashboard(id, direccion) {
    const indice = cardsOrdenDashboard.indexOf(id)
    const destino = indice + direccion
    if (indice < 0 || destino < 0 || destino >= cardsOrdenDashboard.length || id === "patrimonio") return
    [cardsOrdenDashboard[indice], cardsOrdenDashboard[destino]] = [cardsOrdenDashboard[destino], cardsOrdenDashboard[indice]]
    cambiosPendientesDashboard = true
    reordenarDashboard()
}

async function quitarCardDashboard(id) {
    if (id === "patrimonio") return
    const indice = cardsOrdenDashboard.indexOf(id)
    if (indice >= 0) {
        cardsOrdenDashboard.splice(indice, 1)
        const idxVis = cardsVisiblesDashboard.indexOf(id)
        if (idxVis >= 0) cardsVisiblesDashboard.splice(idxVis, 1)
        const card = document.querySelector(`[data-dashboard-card="${CSS.escape(id)}"]`)
        if (card) {
            card.classList.add("dashboard-card-sale")
            await new Promise(resolve => setTimeout(resolve, 200))
            card.remove()
        }
        cambiosPendientesDashboard = true
        reordenarDashboard()
    }
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
            controlesExistentes.querySelector("[data-dashboard-drag-handle]")?.setAttribute("draggable", "true")
            return
        }
        const controles = document.createElement("div")
        controles.className = "dashboard-card-edicion"
        controles.append(contenidoDesdeTemplate("tpl-dashboard-card-edicion", {
            valores: {},
            html: { handle: icono("grip", 16), "icono-eliminar": icono("minus", 16) }
        }))
        card.appendChild(controles)
    })
}

function desactivarEdicionCardsDashboard() {
    document.querySelectorAll(".dashboard [data-dashboard-card]").forEach(card => {
        card.draggable = false
        card.classList.remove("dashboard-card-arrastrando", "encajando")
    })
    document.body.classList.remove("dashboard-card-dragging")
    if (sortableDashboard) {
        sortableDashboard.destroy()
        sortableDashboard = null
    }
}

function configurarEventosReordenamientoDashboard() {
    const grid = document.querySelector(".dashboard")
    if (!grid) return

    // Si SortableJS ya está inicializado, destruirlo antes de reiniciar
    if (sortableDashboard) {
        sortableDashboard.destroy()
        sortableDashboard = null
    }

    grid.addEventListener("click", (evento) => {
        const botonMover = evento.target.closest("[data-dashboard-mover]")
        if (!modoEdicionDashboard || !botonMover) return
        evento.stopPropagation()
        moverCardDashboard(botonMover.dataset.id, Number(botonMover.dataset.direccion))
    })

    grid.addEventListener("click", (evento) => {
        const boton = evento.target.closest("[data-dashboard-eliminar]")
        if (!modoEdicionDashboard || !boton) return
        evento.stopPropagation()
        evento.preventDefault()
        const id = boton.dataset.id
        quitarCardDashboard(id)
        cambiosPendientesDashboard = true
        mostrarNotificacion("exito", "Card eliminada del dashboard")
    })
}

function inicializarSortableDashboard() {
    const grid = document.querySelector(".dashboard")
    if (!grid || sortableDashboard) return

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    sortableDashboard = new Sortable(grid, {
        handle: ".dashboard-card-handle",
        draggable: "[data-dashboard-card]",
        animation: reduceMotion ? 0 : 150,
        scroll: true,
        scrollSensitivity: 30,
        scrollSpeed: 10,
        disabled: !modoEdicionDashboard,
        onStart: (evt) => {
            if (!modoEdicionDashboard || evt.item.dataset.dashboardCard === "patrimonio") {
                sortableDashboard.sort(true) // cancelar el drag
                return
            }
            evt.item.classList.add("dashboard-card-arrastrando")
            document.body.classList.add("dashboard-card-dragging")
        },
        onEnd: (evt) => {
            if (!modoEdicionDashboard) return

            const card = evt.item
            card.classList.remove("dashboard-card-arrastrando")
            document.body.classList.remove("dashboard-card-dragging")

            // Leer el nuevo orden del DOM (solo cards visibles)
            const nuevoOrden = []
            grid.querySelectorAll("[data-dashboard-card]").forEach(c => {
                const id = c.dataset.dashboardCard
                if (id && id !== "patrimonio") {
                    nuevoOrden.push(id)
                }
            })

            // Reconstruir cardsOrdenDashboard: las cards que están en el DOM
            // mantienen su orden relativo; las que no están en el DOM van al final
            const ordenActual = cardsOrdenDashboard.filter(id => id !== "patrimonio")
            const nuevoOrdenFiltrado = nuevoOrden.filter(id => ordenActual.includes(id))
            const noEnDOM = ordenActual.filter(id => !nuevoOrden.includes(id))
            const nuevoOrdenCompleto = [...nuevoOrdenFiltrado, ...noEnDOM]

            // Actualizar cardsOrdenDashboard (manteniendo patrimonio primero)
            cardsOrdenDashboard = ["patrimonio", ...nuevoOrdenCompleto]
            cambiosPendientesDashboard = true

            // Guardar en Firestore
            guardarPreferenciasDashboard({
                orden: cardsOrdenDashboard
            }).then(() => {
                cambiosPendientesDashboard = false
            }).catch(error => {
                console.error("Error guardando orden del dashboard:", error)
            })
        }
    })
}

function activarSortableDashboard() {
    if (sortableDashboard) {
        sortableDashboard.option("disabled", !modoEdicionDashboard)
    }
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

    document.getElementById("dashboard-abrir-cards")?.addEventListener("click", () => {
        activarModoEdicionDashboard()
        abrirSelectorCardsDashboard()
    })
    document.getElementById("dashboard-listo")?.addEventListener("click", guardarYSalirEdicionDashboard)
}

function activarModoEdicionDashboard() {
    modoEdicionDashboard = true
    cambiosPendientesDashboard = false
    document.getElementById("dashboard-edicion-bar")?.removeAttribute("hidden")
    document.querySelector(".dashboard")?.classList.add("dashboard-edicion-activo")
    configurarEventosReordenamientoDashboard()
    prepararEdicionCardsDashboard()
    inicializarSortableDashboard()
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
                navigateTo(`/${hacia}`)
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
    // `opciones` es un fragmento (una copia del template de fila por casilla).
    const hayOpciones = opciones.childNodes.length > 0
    return contenidoDesdeTemplate("tpl-dashboard-editor-bloque", {
        valores: { titulo, descripcion, vacio: hayOpciones ? "" : vacio },
        html: { opciones: hayOpciones ? opciones : "" }
    })
}

function opcionesInstanciasCuentas(activas) {
    // Las hijas no se ofrecen: su dinero ya esta en la card del padre, que
    // muestra el total de la familia. Ofrecirlas duplicaria el patrimonio.
    const lista = cuentasVisibles(cuentas)

    return contenidoDesdeFilas("tpl-dashboard-card-instancia", lista, cuenta => {
        const id = idCardCuenta(cuenta.id)
        const etiqueta = ETIQUETAS_TIPO_CUENTA[cuenta.tipo] || "Cuenta"
        const activa = activas.has(id)
        return {
            valores: {
                "instancia@class": `dashboard-card-opcion`,
                "valor@value": id,
                "valor@checked": activa,
                nombre: cuenta.nombre || "Cuenta",
                tipo: etiqueta
            }
        }
    })
}

function opcionesInstanciasActivos(activas) {
    return contenidoDesdeFilas("tpl-dashboard-card-instancia", posicionesData, posicion => {
        const id = idCardActivo(posicion.activoId)
        const activo = posicion.activo || {}
        const activa = activas.has(id)
        return {
            valores: {
                "instancia@class": `dashboard-card-opcion`,
                "valor@value": id,
                "valor@checked": activa,
                nombre: activo.simbolo || activo.nombre || "Activo",
                tipo: ETIQUETAS_TIPO_ACTIVO[activo.tipo] || "Activo"
            }
        }
    })
}

function abrirSelectorCardsDashboard() {
    if (!modoEdicionDashboard) return

    // Estado local del modal (no se persiste hasta pulsar "Guardar")
    let ordenModal = [...cardsOrdenDashboard.filter(id => id !== "patrimonio")]
    let visiblesModal = new Set(cardsVisiblesDashboard)
    let dimensionesModal = { ...cardsDimensionesDashboard }

    const cards = DASHBOARD_CARDS.filter(card => card.id !== "patrimonio")

    // Renderiza el preview gráfico (miniaturas en 2 columnas)
    function renderizarPreview() {
        const cardsEnOrden = ordenModal.filter(id => visiblesModal.has(id))
        const previewHTML = cardsEnOrden.map(id => {
            const cardConfig = DASHBOARD_CARDS.find(c => c.id === id)
            const filas = dimensionesModal[id]?.filas ?? cardConfig?.spanFilas ?? 1
            return `
                <div class="modal-preview-card" data-card-id="${id}" data-filas="${filas}">
                    1×${filas}
                </div>
            `
        }).join('')

        const previewGrid = modal.querySelector(".modal-preview-grid")
        if (!previewGrid) return
        if (previewHTML) {
            previewGrid.hidden = false
            previewGrid.innerHTML = previewHTML
        } else {
            previewGrid.hidden = true
        }
    }

    // Renderiza la lista de filas (checkbox + selector de altura + 4 acciones)
    function renderizarFilas() {
        const opciones = contenidoDesdeFilas("tpl-dashboard-card", cards, card => {
            const filas = dimensionesModal[card.id]?.filas ?? card.spanFilas ?? 1
            return {
                valores: {
                    "card@data-card": card.id,
                    "valor@value": card.id,
                    "valor@checked": visiblesModal.has(card.id),
                    etiqueta: card.label,
                    "filas@data-filas": filas,
                    "acciones@data-id": card.id
                }
            }
        })

        const cardsGrid = modal.querySelector(".dashboard-editor-grid")
        if (!cardsGrid) return
        cardsGrid.innerHTML = ""
        cardsGrid.appendChild(opciones)
    }

    const cuentasBloque = bloqueInstanciasSelector(
        "Tus cuentas en el dashboard",
        "Puedes agregar una card por cada cuenta que tengas.",
        opcionesInstanciasCuentas(visiblesModal),
        "Todavía no tienes cuentas."
    )
    const activosBloque = bloqueInstanciasSelector(
        "Tus activos en el dashboard",
        "Puedes agregar una card por cada activo que tengas.",
        opcionesInstanciasActivos(visiblesModal),
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
        contenido: contenidoDesdeTemplate("tpl-dashboard-editor", {
            html: {
                "preview-grid": "",
                cards: "",
                cuentas: cuentasBloque,
                activos: activosBloque
            }
        }),
        onConfirm: async () => {
            const seleccionadas = [...modal.querySelectorAll(".dashboard-editor input:checked")].map(input => input.value)
            const ordenPrevio = ordenModal.filter(id => seleccionadas.includes(id))
            const nuevas = seleccionadas.filter(id => !ordenPrevio.includes(id))
            const orden = normalizarCardsOrden([...ordenPrevio, ...nuevas])
            const visibles = normalizarCardsVisibles(seleccionadas)

            try {
                await guardarPreferenciasDashboard({
                    cardsVisibles: visibles,
                    orden,
                    dimensiones: dimensionesModal
                })
                cardsVisiblesDashboard = visibles
                cardsOrdenDashboard = orden
                cardsDimensionesDashboard = dimensionesModal
                cambiosPendientesDashboard = false
                montarCardsInstanciadas()
                if (modoEdicionDashboard) prepararEdicionCardsDashboard()
                reordenarDashboard(true)

                for (const cardId of nuevas) {
                    rastrearEvento("dashboard_card_agregada", { card_id: cardId })
                }

                mostrarNotificacion("exito", "Cards del dashboard actualizadas")
                return true
            } catch (error) {
                console.error("Error guardando cards del dashboard:", error)
                mostrarNotificacion("error", "No se pudo guardar la selección de cards")
                return false
            }
        }
    })

    // Renderizar preview y filas tras montar el modal en el DOM
    renderizarPreview()
    renderizarFilas()

    // Inicializar SortableJS en el preview para drag & drop
    const previewGrid = modal.querySelector(".modal-preview-grid")
    if (previewGrid) {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        new Sortable(previewGrid, {
            handle: ".modal-preview-card",
            animation: reduceMotion ? 0 : 150,
            onEnd: (evt) => {
                const id = evt.item.dataset.cardId
                const indexTo = evt.newIndex
                ordenModal = ordenModal.filter(cardId => cardId !== id)
                ordenModal.splice(indexTo, 0, id)
                renderizarPreview()
                renderizarFilas()
                cambiosPendientesDashboard = true
            }
        })
    }

    // Delegación de eventos para botones de acción (↑ ↓ −) y selector de altura
    modal.addEventListener("click", (evento) => {
        // Botones de altura [1] [2] [3]
        const botonAltura = evento.target.closest(".selector-altura button[data-altura]")
        if (botonAltura) {
            const filas = parseInt(botonAltura.dataset.altura, 10)
            const cardOp = botonAltura.closest("[data-tpl='card']")
            const cardId = cardOp?.dataset.card
            if (!cardId) return

            botonAltura.parentElement.querySelectorAll("button").forEach(b => {
                b.classList.toggle("activo", b === botonAltura)
            })
            dimensionesModal[cardId] = { filas }
            renderizarPreview()
            cambiosPendientesDashboard = true
            return
        }

        // Botones de acción (arrastrar, ↑, ↓, −)
        const boton = evento.target.closest("button[data-accion]")
        if (!boton) return

        const accion = boton.dataset.accion
        const accionesDiv = boton.closest(".modal-card-acciones")
        const cardId = accionesDiv?.dataset.id
        if (!cardId) return

        if (accion === "arrastrar") {
            // El handle se gestiona con SortableJS
            return
        }

        if (accion === "subir") {
            const index = ordenModal.indexOf(cardId)
            if (index > 0) {
                ;[ordenModal[index - 1], ordenModal[index]] = [ordenModal[index], ordenModal[index - 1]]
                renderizarPreview()
                renderizarFilas()
                cambiosPendientesDashboard = true
            }
        }

        if (accion === "bajar") {
            const index = ordenModal.indexOf(cardId)
            if (index < ordenModal.length - 1) {
                ;[ordenModal[index], ordenModal[index + 1]] = [ordenModal[index + 1], ordenModal[index]]
                renderizarPreview()
                renderizarFilas()
                cambiosPendientesDashboard = true
            }
        }

        if (accion === "eliminar") {
            visiblesModal.delete(cardId)
            ordenModal = ordenModal.filter(cid => cid !== cardId)
            delete dimensionesModal[cardId]
            renderizarPreview()
            renderizarFilas()
            cambiosPendientesDashboard = true
        }
    })

    // Cambios en checkboxes (activar/desactivar cards)
    modal.addEventListener("change", (evento) => {
        if (!evento.target.matches('input[type="checkbox"][data-tpl="valor"]')) return
        const id = evento.target.value
        if (evento.target.checked) {
            visiblesModal.add(id)
            if (!ordenModal.includes(id)) ordenModal.push(id)
        } else {
            visiblesModal.delete(id)
            ordenModal = ordenModal.filter(cid => cid !== id)
            delete dimensionesModal[id]
        }
        renderizarPreview()
        renderizarFilas()
        cambiosPendientesDashboard = true
    })

    // Botón Restablecer
    modal.querySelector("[data-dashboard-reset]")?.addEventListener("click", () => {
        cambiosPendientesDashboard = true
        ordenModal = [...DEFAULT_CARDS_ORDEN]
        visiblesModal = new Set(DEFAULT_CARDS_VISIBLES)
        dimensionesModal = {}
        modal.querySelectorAll(".dashboard-editor input").forEach(input => {
            input.checked = DEFAULT_CARDS_VISIBLES.includes(input.value)
        })
        renderizarPreview()
        renderizarFilas()
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
    { id: "todo", etiqueta: "Todo", dias: 3650, sub: "Histórico completo" }
]
const PERIODO_POR_DEFECTO = "30d"

let periodoGrafico = PERIODO_POR_DEFECTO

// Series del modal de evolución. "todo" es el patrimonio neto; el resto son
// los mismos bloques de la card de distribución, para poder ver cómo evoluciona
// cada uno sin perder la temporalidad elegida.
const CATEGORIAS_GRAFICO = [
    { id: "todo", etiqueta: "Todo", etiquetaSerie: "Patrimonio" },
    { id: "liquidez", etiqueta: "Liquidez", etiquetaSerie: "Liquidez" },
    { id: "inversiones", etiqueta: "Inversiones", etiquetaSerie: "Inversiones" },
    { id: "inmovil", etiqueta: "Inmovilizado", etiquetaSerie: "Inmovilizado" },
    { id: "deudas", etiqueta: "Deudas", etiquetaSerie: "Deudas" }
]

// Ventana deslizante de las cards Gastado / Ingresado / Balance / Ahorro. Usa
// los mismos cinco periodos que el gráfico de patrimonio para que el toggle se
// lea igual en todas partes y el usuario no tenga que aprender dos escalas.
const PERIODOS_FLUJO = [
    { id: "7d", etiqueta: "7D", dias: 7, sub: "Últimos 7 días" },
    { id: "30d", etiqueta: "30D", dias: 30, sub: "Últimos 30 días" },
    { id: "90d", etiqueta: "90D", dias: 90, sub: "Últimos 90 días" },
    { id: "todo", etiqueta: "Todo", dias: 3650, sub: "Histórico completo" }
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
// GENERADORES DE CARDS (HTML dinámico)
// ============================================
// Cada función recibe el id de la card y devuelve su HTML.
// Se usan para renderizar el dashboard dinámicamente a partir de
// cardsVisiblesDashboard y cardsOrdenDashboard.

function generarCardMetrica(cardId, titulo, subtitulo, valorId, detalleId, claseExtra = "", config = {}) {
    const id = `card-${cardId}`;
    const clasesSpan = clasesCard(cardId)
    return `
        <div class="glass card card-navegable metric-card ${claseExtra} ${clasesSpan}" id="${id}" data-dashboard-card="${cardId}" role="button" tabindex="0" title="${titulo}">
            <div class="card-title">${titulo}</div>
            <div class="card-value" id="${valorId}">${skeletonText("skeleton-value")}</div>
            <div class="card-sub" id="${detalleId}">${skeletonText()}</div>
        </div>
    `;
}

function generarCardListaSimple(cardId, titulo, filas, detalleId = null, subtituloHtml = "", config = {}) {
    const id = `card-${cardId}`;
    const detalle = detalleId ? `<div class="card-sub" id="${detalleId}">${skeletonText()}</div>` : "";
    const clasesSpan = clasesCard(cardId)
    return `
        <div class="glass card card-navegable ${claseExtra(cardId)} ${clasesSpan}" id="${id}" data-dashboard-card="${cardId}" role="button" tabindex="0" title="${titulo}">
            <div class="card-title">${titulo}</div>
            <div class="${cardId}-lista scroll-fade" id="${cardId}-lista">${skeletonMarkup({ rows: filas, className: "skeleton-dashboard-list" })}</div>
            ${detalle}
        </div>
    `;
}

function claseExtra(id) {
    // Mapeo de clases extra por id de card
    const extras = {
        "cuentas": "positive card-navegable",
        "favoritos": "card-navegable favoritos-card",
        "movimientos": "movimientos-card card-navegable",
        "pendientes": "pendientes-card card-navegable",
        "ordenes": "ordenes-card card-navegable",
        "distribucion-activos": "card-navegable distribucion-activos-card",
        "patrimonio-divisa": "card-navegable patrimonio-divisa-card",
        "flujo-caja": "card-navegable metric-card",
        "gastos-periodo": "card-navegable metric-card gastos-periodo-card",
        "ingresos-periodo": "card-navegable metric-card",
        "balance-periodo": "card-navegable metric-card",
        "deudas": "card-navegable metric-card deudas-card",
        "distribucion": "card-navegable distribucion-card",
        "programados": "programados-card",
        "alertas": "alertas-card",
        "estrategias": "estrategias-card",
        "presupuestos": "presupuestos-card",
        "metas": "metas-card",
        "vencimientos": "card-navegable",
        "inversiones": "card-navegable"
    };
    return extras[id] || "";
}

function generarCardPatrimonio(nivelResalte) {
    const resaltado = nivelResalte ? ` resaltado-${nivelResalte}` : "";
    return `
        <div class="glass card primary patrimonio-card${resaltado}" data-dashboard-card="patrimonio" role="button" tabindex="0" aria-haspopup="dialog" aria-label="Patrimonio total, valor actual">
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
    `;
}

function generarCardGrafico(config = {}) {
    const clasesSpan = clasesCard("grafico")
    return `
        <div class="glass card grafico-patrimonio-card ${clasesSpan}" data-dashboard-card="grafico" role="region" tabindex="0" aria-label="Evolución patrimonial">
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
    `;
}

function generarCardDistribucionDona(config = {}) {
    const clasesSpan = clasesCard("distribucion")
    return `
        <div class="glass card card-navegable distribucion-card ${clasesSpan}" id="card-distribucion" data-dashboard-card="distribucion" role="button" tabindex="0" title="Distribución patrimonial">
            <div class="card-header">
                <span class="card-title">Distribución patrimonial</span>
            </div>
            <div class="distribucion-dona" id="distribucion-dona-placeholder"><div class="dona-esqueleto" aria-hidden="true"></div></div>
            <div class="distribucion-lista scroll-fade" id="distribucion-lista">${skeletonMarkup({ rows: 3, className: "skeleton-dashboard-list" })}</div>
        </div>
    `;
}

function generarCardMetas(config = {}) {
    const clasesSpan = clasesCard("metas")
    return `
        <div class="glass card metas-card ${clasesSpan}" id="card-metas" data-dashboard-card="metas" role="region" tabindex="0" aria-label="Metas de ahorro">
            <div class="card-header">
                <span class="card-title">Metas de ahorro</span>
                <button type="button" class="glass-btn btn-meta-nueva" id="btn-nueva-meta">
                    ${icono("plus-circle", 14)} Nueva
                </button>
            </div>
            <div class="metas-lista scroll-fade" id="metas-lista">
                ${skeletonMarkup({ rows: 2, className: "skeleton-dashboard-list" })}
            </div>
        </div>
    `;
}

function generarCardPresupuestos(config = {}) {
    const clasesSpan = clasesCard("presupuestos")
    return `
        <div class="glass card presupuestos-card ${clasesSpan}" id="card-presupuestos" data-dashboard-card="presupuestos" role="region" tabindex="0" aria-label="Presupuestos">
            <div class="card-header">
                <span class="card-title">Presupuestos</span>
                <span class="badge" id="presupuestos-cantidad">${skeletonText("skeleton-badge")}</span>
            </div>
            <div class="presupuestos-lista scroll-fade" id="presupuestos-lista">${skeletonMarkup({ rows: 3, className: "skeleton-dashboard-list" })}</div>
        </div>
    `;
}

// Mapa de generadores por id de card (excepto patrimonio que es fija y va primero)
const GENERADORES_CARD = {
    "grafico": generarCardGrafico,
    "distribucion": generarCardDistribucionDona,
    "metas": generarCardMetas,
    "presupuestos": generarCardPresupuestos,
    "cuentas": () => generarCardMetrica("cuentas", "Cuentas", "Activas y tarjetas", "total-cuentas", null),
    "inversiones": () => generarCardMetrica("inversiones", "Inversiones", null, "inversiones-valor", "inversiones-detalle"),
    "vencimientos": () => generarCardMetrica("vencimientos", "Próximos vencimientos", null, "vencimientos-cantidad", "vencimientos-detalle"),
    "movimientos": () => generarCardListaSimple("movimientos", "Últimos movimientos", 2),
    "favoritos": (config = {}) => {
        const clasesSpan = clasesCard("favoritos")
        return `
        <div class="glass card card-navegable favoritos-card ${clasesSpan}" id="card-favoritos" data-dashboard-card="favoritos" role="button" tabindex="0" title="Favoritos">
            <div class="card-header">
                <span class="card-title">Favoritos</span>
                <span class="badge" id="favoritos-cantidad">${skeletonText("skeleton-badge")}</span>
            </div>
            <div class="favoritos-lista scroll-fade" id="favoritos-lista">
                ${skeletonMarkup({ rows: 2, className: "skeleton-dashboard-list" })}
            </div>
        </div>
    `;
    },
    "pendientes": (config = {}) => {
        const clasesSpan = clasesCard("pendientes")
        return `
        <div class="glass card card-navegable pendientes-card ${clasesSpan}" id="card-pendientes" data-dashboard-card="pendientes" role="button" tabindex="0" title="Pendientes">
            <div class="card-header">
                <span class="card-title">Pendientes</span>
                <span class="badge" id="pendientes-cantidad">${skeletonText("skeleton-badge")}</span>
            </div>
            <div class="pendientes-lista scroll-fade" id="pendientes-lista">${skeletonMarkup({ rows: 2, className: "skeleton-dashboard-list" })}</div>
        </div>
    `;
    },
    "ordenes": (config = {}) => {
        const clasesSpan = clasesCard("ordenes")
        return `
        <div class="glass card card-navegable ordenes-card ${clasesSpan}" id="card-ordenes" data-dashboard-card="ordenes" role="button" tabindex="0" title="Órdenes">
            <div class="card-header">
                <span class="card-title">Órdenes</span>
                <span class="badge" id="ordenes-cantidad">${skeletonText("skeleton-badge")}</span>
            </div>
            <div class="ordenes-lista scroll-fade" id="ordenes-lista">${skeletonMarkup({ rows: 2, className: "skeleton-dashboard-list" })}</div>
            <div class="card-sub" id="ordenes-detalle">${skeletonText()}</div>
        </div>
    `;
    },
    "distribucion-activos": (config = {}) => {
        const clasesSpan = clasesCard("distribucion-activos")
        return `
        <div class="glass card card-navegable distribucion-activos-card ${clasesSpan}" id="card-distribucion-activos" data-dashboard-card="distribucion-activos" role="button" tabindex="0" title="Distribución por tipo de activo">
            <div class="card-header">
                <span class="card-title">Distribución por tipo de activo</span>
            </div>
            <div class="distribucion-dona" id="distribucion-activos-dona-placeholder"><div class="dona-esqueleto" aria-hidden="true"></div></div>
            <div class="distribucion-lista scroll-fade" id="distribucion-activos-lista">${skeletonMarkup({ rows: 3, className: "skeleton-dashboard-list" })}</div>
        </div>
    `;
    },
    "patrimonio-divisa": (config = {}) => {
        const clasesSpan = clasesCard("patrimonio-divisa")
        return `
        <div class="glass card card-navegable patrimonio-divisa-card ${clasesSpan}" id="card-patrimonio-divisa" data-dashboard-card="patrimonio-divisa" role="button" tabindex="0" title="Patrimonio por divisa">
            <div class="card-header">
                <span class="card-title">Patrimonio por divisa</span>
            </div>
            <div class="divisa-dona" id="patrimonio-divisa-dona-placeholder"><div class="dona-esqueleto" aria-hidden="true"></div></div>
            <div class="divisa-lista scroll-fade" id="patrimonio-divisa-lista">${skeletonMarkup({ rows: 3, className: "skeleton-dashboard-list" })}</div>
        </div>
    `;
    },
    "estrategias": (config = {}) => {
        const clasesSpan = clasesCard("estrategias")
        return `
        <div class="glass card estrategias-card ${clasesSpan}" id="card-estrategias" data-dashboard-card="estrategias" role="region" tabindex="0" aria-label="Próximas estrategias">
            <div class="card-header">
                <span class="card-title">Estrategias</span>
                <span class="badge" id="estrategias-cantidad">${skeletonText("skeleton-badge")}</span>
            </div>
            <div class="estrategias-lista scroll-fade" id="estrategias-lista">${skeletonMarkup({ rows: 3, className: "skeleton-dashboard-list skeleton-dashboard-list-estrategias" })}</div>
        </div>
    `;
    },
    "flujo-caja": () => generarCardMetrica("flujo-caja", "Flujo de caja", null, "flujo-caja-valor", "flujo-caja-detalle"),
    "gastos-periodo": (config = {}) => {
        const clasesSpan = clasesCard("gastos-periodo")
        return `
        <div class="glass card card-navegable metric-card gastos-periodo-card ${clasesSpan}" id="card-gastos-periodo" data-dashboard-card="gastos-periodo" role="button" tabindex="0" title="Gastado">
            <div class="card-header">
                <span class="card-title">Gastado</span>
            </div>
            <div class="card-value negative" id="gastos-periodo-valor">${skeletonText("skeleton-value")}</div>
            <div class="card-sub" id="gastos-periodo-detalle">${skeletonText()}</div>
        </div>
    `;
    },
    "ingresos-periodo": (config = {}) => {
        const clasesSpan = clasesCard("ingresos-periodo")
        return `
        <div class="glass card card-navegable metric-card ${clasesSpan}" id="card-ingresos-periodo" data-dashboard-card="ingresos-periodo" role="button" tabindex="0" title="Ingresado">
            <div class="card-header">
                <span class="card-title">Ingresado</span>
            </div>
            <div class="card-value positive" id="ingresos-periodo-valor">${skeletonText("skeleton-value")}</div>
            <div class="card-sub" id="ingresos-periodo-detalle">${skeletonText()}</div>
        </div>
    `;
    },
    "balance-periodo": () => generarCardMetrica("balance-periodo", "Balance", null, "balance-periodo-valor", "balance-periodo-detalle"),
    "deudas": () => generarCardMetrica("deudas", "Deudas", null, "deudas-valor", "deudas-detalle"),
    "programados": (config = {}) => {
        const clasesSpan = clasesCard("programados")
        return `
        <div class="glass card programados-card ${clasesSpan}" id="card-programados" data-dashboard-card="programados" role="button" tabindex="0" title="Movimientos programados">
            <div class="card-header">
                <span class="card-title">Programados</span>
                <span class="badge" id="programados-cantidad">${skeletonText("skeleton-badge")}</span>
            </div>
            <div class="programados-lista scroll-fade" id="programados-lista">${skeletonMarkup({ rows: 2, className: "skeleton-dashboard-list" })}</div>
        </div>
    `;
    },
    "alertas": (config = {}) => {
        const clasesSpan = clasesCard("alertas")
        return `
        <div class="glass card alertas-card ${clasesSpan}" id="card-alertas" data-dashboard-card="alertas" role="button" tabindex="0" title="Alertas">
            <div class="card-header">
                <span class="card-title">Alertas</span>
                <span class="badge" id="alertas-cantidad">${skeletonText("skeleton-badge")}</span>
            </div>
            <div class="alertas-lista scroll-fade" id="alertas-lista">${skeletonMarkup({ rows: 2, className: "skeleton-dashboard-list" })}</div>
        </div>
    `;
    },
};

export function render() {
    configurarCardsDashboardDesdeSesion()
    const nivelResalte = normalizarNivelResalte(sesion.getPreferencias()?.resaltarPatrimonio)

    // Orden de renderizado: patrimonio siempre primero (fija), luego el resto
    // según cardsOrdenDashboard filtrado por las visibles.
    const ordenRender = ["patrimonio", ...cardsOrdenDashboard.filter(id => id !== "patrimonio" && cardsVisiblesDashboard.includes(id))]

    const contenido = `
        <div class="dashboard-edicion-bar" id="dashboard-edicion-bar" hidden>
            <div class="dashboard-edicion-acciones">
                <button type="button" class="glass-btn glass" id="dashboard-abrir-cards">Añadir/quitar cards</button>
                <button type="button" class="glass-btn glass" id="dashboard-listo">Listo</button>
            </div>
        </div>
        <div class="dashboard dashboard-cargando">
            ${generarCardPatrimonio(nivelResalte)}
            ${ordenRender.map(id => {
                const generador = GENERADORES_CARD[id]
                const config = DASHBOARD_CARDS.find(c => c.id === id) || {}
                return generador ? generador(config) : ""
            }).join('')}
        </div>
    `

    const contenedor = document.createElement("div")
    contenedor.innerHTML = contenido
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
    { id: "presupuestos-lista", filas: 3 },
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
    "flujo-caja-valor", "deudas-valor",
    "gastos-periodo-valor", "ingresos-periodo-valor", "balance-periodo-valor"
]

const DETALLES_DASHBOARD = [
    "patrimonio-detalle", "inversiones-detalle", "vencimientos-detalle", "flujo-caja-detalle",
    "deudas-detalle", "gastos-periodo-detalle", "ingresos-periodo-detalle",
    "balance-periodo-detalle", "ordenes-detalle"
]

const CONTADORES_DASHBOARD = [
    "favoritos-cantidad", "pendientes-cantidad", "ordenes-cantidad",
    "estrategias-cantidad", "programados-cantidad", "alertas-cantidad"
]

function limpiarEsqueletosDashboard() {
    const listas = ["movimientos-lista", "favoritos-lista", "metas-lista", "presupuestos-lista",
        "pendientes-lista", "ordenes-lista", "estrategias-lista", "distribucion-lista",
        "distribucion-activos-lista", "patrimonio-divisa-lista", "programados-lista", "alertas-lista"]
    listas.forEach(id => {
        const lista = document.getElementById(id)
        if (lista) {
            lista.replaceChildren()
            actualizarScrollFade(lista)
        }
    })
    const dona = document.getElementById("distribucion-dona-placeholder")
    if (dona) dona.replaceChildren()
    const donaDivisa = document.getElementById("patrimonio-divisa-dona-placeholder")
    if (donaDivisa) donaDivisa.replaceChildren()
    const donaActivos = document.getElementById("distribucion-activos-dona-placeholder")
    if (donaActivos) donaActivos.replaceChildren()
    const valores = ["patrimonio-valor", "total-cuentas", "inversiones-valor", "vencimientos-cantidad",
        "flujo-caja-valor", "deudas-valor", "gastos-periodo-valor", "ingresos-periodo-valor", "balance-periodo-valor"]
    valores.forEach(id => {
        const valor = document.getElementById(id)
        if (valor) valor.replaceChildren()
    })
    const detalles = ["patrimonio-detalle", "inversiones-detalle", "vencimientos-detalle", "flujo-caja-detalle",
        "deudas-detalle", "gastos-periodo-detalle", "ingresos-periodo-detalle", "balance-periodo-detalle",
        "ordenes-detalle"]
    detalles.forEach(id => {
        const detalle = document.getElementById(id)
        if (detalle) detalle.replaceChildren()
    })
    const contadores = ["favoritos-cantidad", "pendientes-cantidad", "ordenes-cantidad",
        "estrategias-cantidad", "programados-cantidad", "alertas-cantidad"]
    contadores.forEach(id => {
        const contador = document.getElementById(id)
        if (contador) contador.replaceChildren()
    })
}

function mostrarEsqueletosDashboard() {
    const dashboard = document.querySelector(".dashboard")
    dashboard?.setAttribute("aria-busy", "true")
    LISTAS_DASHBOARD.forEach(({ id, filas, clase }) => {
        const lista = document.getElementById(id)
        if (lista) lista.replaceChildren(esqueletoContenedor("list", filas, clase || "skeleton-dashboard-list"))
    })
    const dona = document.getElementById("distribucion-dona-placeholder")
    if (dona) {
        dona.replaceChildren()
        const div = document.createElement("div")
        div.className = "dona-esqueleto"
        div.setAttribute("aria-hidden", "true")
        dona.appendChild(div)
    }
    const donaDivisa = document.getElementById("patrimonio-divisa-dona-placeholder")
    if (donaDivisa) {
        donaDivisa.replaceChildren()
        const div = document.createElement("div")
        div.className = "dona-esqueleto"
        div.setAttribute("aria-hidden", "true")
        donaDivisa.appendChild(div)
    }
    const donaActivos = document.getElementById("distribucion-activos-dona-placeholder")
    if (donaActivos) {
        donaActivos.replaceChildren()
        const div = document.createElement("div")
        div.className = "dona-esqueleto"
        div.setAttribute("aria-hidden", "true")
        donaActivos.appendChild(div)
    }
    VALORES_DASHBOARD.forEach(id => {
        const valor = document.getElementById(id)
        if (valor) valor.replaceChildren(esqueletoTexto("skeleton-value"))
    })
    DETALLES_DASHBOARD.forEach(id => {
        const detalle = document.getElementById(id)
        if (detalle) detalle.replaceChildren(esqueletoTexto())
    })
    CONTADORES_DASHBOARD.forEach(id => {
        const contador = document.getElementById(id)
        if (contador) contador.replaceChildren(esqueletoTexto("skeleton-badge"))
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
    reordenarDashboard()
    configurarDivisa()
    configurarPeriodos()
    configurarPeriodoFlujoDashboard()
    configurarCardsNavegacion()
    configurarMetas()
    configurarPresupuestos()
    configurarEdicionDashboard()
    configurarRefreshDashboard()

    try {
        await cargarTodo()
        // Se repite tras cargar los datos reales para que el orden de las
        // tarjetas se ajuste con sus alturas definitivas y no con esqueletos.
        reordenarDashboard()
        void actualizarGraficoPatrimonio()
    } finally {
        const dashboard = document.querySelector(".dashboard")
        dashboard?.classList.remove("dashboard-cargando")
        dashboard?.removeAttribute("aria-busy")
        cargado = true
        configurarScrollFade()
        configurarScrollFadeApp()
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
                reordenarDashboard(true)
            } catch (error) {
                console.error("Error refrescando el dashboard:", error)
            } finally {
                document.querySelector(".dashboard")?.removeAttribute("aria-busy")
            }
        }, 150)
    })
}

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
        reordenarDashboard(true)
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
        limpiarEsqueletosDashboard()
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
    const tarjetas = cuentas.filter(cuenta => cuenta.tipo === "credito" && cuenta.estado !== "archivada" && cuenta.esPatrimonio !== false)
    const deudas = tarjetas.reduce((total, cuenta) => {
        return total + convertirMonto(Math.max(0, Number(cuenta.deuda) || 0), cuenta.moneda || "pen", divisaActual)
    }, 0)
    // El saldo se reparte entre liquidez e inmovil: lo que está en la divisa
    // base de un broker o un exchange no es dinero suelto, aunque esté en la
    // cuenta. Va en su propio bloque para que el reparto patrimonial lo
    // distinga de la liquidez de verdad.
    const saldos = cuentas
        .filter(cuenta => cuenta.tipo !== "credito" && cuenta.estado !== "archivada" && cuenta.esPatrimonio !== false)
        .reduce((acc, cuenta) => {
            const monto = convertirMonto(Number(cuenta.saldoInicial) || 0, cuenta.moneda || "pen", divisaActual)
            if (esSaldoInmovil(cuenta, cuentas)) acc.inmovil += monto
            else acc.liquidez += monto
            return acc
        }, { liquidez: 0, inmovil: 0 })
    const liquidez = saldos.liquidez
    const inmovil = saldos.inmovil
    const inversiones = convertirMonto(
        inversionesData?.valorTotal || 0,
        inversionesData?.divisa || divisaActual,
        divisaActual
    )
    const brutoDistribucion = Math.max(0, liquidez) + Math.max(0, inversiones) + Math.max(0, inmovil) + Math.max(0, deudas)
    const distribucion = [
        { label: "Liquidez", valor: Math.max(0, liquidez), clase: "liquidez" },
        { label: "Inversiones", valor: Math.max(0, inversiones), clase: "inversiones" },
        { label: "Inmovilizado", valor: Math.max(0, inmovil), clase: "inmovil" },
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
        inmovil,
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
            .sort(compararMovimientosPorFecha)
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
    // actualizarMovimientos va primero: si cualquier actualización posterior
    // falla, al menos la lista de movimientos queda pintada y no con esqueleto
    // permanente.
    actualizarMovimientos()
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
    actualizarDistribucion()
    actualizarProgramados()
    actualizarAlertas()
    reordenarDashboard(true)
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
    let stats
    try {
        stats = await obtenerPatrimonioStats()
    } catch (error) {
        console.error("Error cargando cuentas:", error)
        stats = { totalCuentas: 0 }
    }

    const totalEl = document.getElementById("total-cuentas")
    if (totalEl) totalEl.replaceChildren(document.createTextNode(stats.totalCuentas ?? 0))

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
        if (lista) {
            lista.replaceChildren(tarjetaVacia("No se pudieron cargar estos datos."))
            actualizarScrollFade(lista)
        }
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
        lista.replaceChildren(tarjetaVacia("No tienes cobros ni pagos pendientes."))
        actualizarScrollFade(lista)
        return
    }

    lista.replaceChildren(contenidoDesdeFilas("tpl-dashboard-list-item", pendientesData, pendiente => {
        const clase = pendiente.tipo ? "positive" : "negative"
        const signo = pendiente.tipo ? "+" : "−"
        const detalle = pendiente.fechaVencimiento
            ? `Vence ${formatearFecha(pendiente.fechaVencimiento)}`
            : pendiente.tipoTexto
        return {
            valores: {
                "titulo": pendiente.concepto,
                "detalle": detalle,
                "valor@class": `dashboard-list-value ${clase}`,
                "valor-texto": `${signo} ${formatearMontoConDivisa(pendiente.monto, pendiente.divisa)}`
            }
        }
    }))
    actualizarScrollFade(lista)
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
        lista.replaceChildren(tarjetaVacia("No tienes órdenes pendientes."))
        actualizarScrollFade(lista)
        return
    }

    const precios = preciosPorSimbolo()

    const fragmento = contenidoDesdeFilas("tpl-dashboard-list-item", pendientes.slice(0, ORDENES_MAX_FILAS), orden => {
        const precioActual = precios.get(String(orden.activo || "").toUpperCase()) || 0
        const distancia = distanciaAlDisparo(orden, precioActual)
        // Por debajo del 2% la orden está a punto de saltar: se resalta.
        const claseDistancia = distancia === null ? "" : Math.abs(distancia) <= 2 ? "critico" : ""
        const detalle = distancia === null
            ? `${orden.tipoLabel} · ${orden.direccionLabel} · sin precio`
            : `${orden.tipoLabel} · ${orden.direccionLabel} · a ${Math.abs(distancia).toFixed(1)}% del disparo`

        return {
            valores: {
                "titulo": orden.activo,
                "detalle@class": claseDistancia ? `dashboard-list-detail ${claseDistancia}` : "dashboard-list-detail",
                "detalle": detalle,
                "valor-texto": formatearMontoConDivisa(orden.precioDisparo, orden.divisa)
            }
        }
    })
    if (pendientes.length > ORDENES_MAX_FILAS) {
        fragmento.appendChild(tarjetaVacia(`y ${pendientes.length - ORDENES_MAX_FILAS} más…`))
    }
    lista.replaceChildren(fragmento)
    actualizarScrollFade(lista)
}

function actualizarEstrategias() {
    const lista = document.getElementById("estrategias-lista")
    const cantidadEl = document.getElementById("estrategias-cantidad")
    if (!lista) return

    if (cantidadEl) cantidadEl.textContent = estrategiasData.length
    if (estrategiasData.length === 0) {
        lista.replaceChildren(tarjetaVacia("No tienes estrategias activas."))
        actualizarScrollFade(lista)
        return
    }

    lista.replaceChildren(contenidoDesdeFilas("tpl-dashboard-list-item", estrategiasData, estrategia => {
        const cuenta = cuentas.find(item => item.id === estrategia.cuentaId)
        const controlCuenta = cuenta
            ? contenidoDesdeTemplate("tpl-dashboard-estrategia-cuenta", {
                valores: {
                    "btn@data-dashboard-cuenta-estrategia": estrategia.cuentaId,
                    "nombre": cuenta.nombre
                },
                html: { icono: icono("landmark", 11) }
            })
            : null
        return {
            valores: {
                "item@class": "dashboard-list-item estrategia-dashboard-item",
                "titulo": estrategia.nombre,
                "detalle": `${estrategia.activoSimbolo} · ${formatearProximaEjecucion(estrategia.proximaEjecucion)}`,
                "valor-texto": formatearMontoConDivisa(estrategia.montoFijo, estrategia.divisa)
            },
            html: { extra: controlCuenta }
        }
    }))
    actualizarScrollFade(lista)
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

// Misma paleta que las barras de `.distribucion-barra`: el anillo y las
// barras deben contar con los mismos colores. Los cuatro bloques de la
// distribución patrimonial usan una paleta FIJA (la misma en los dos temas);
// el resto de gráficos siguen con las variables del tema.
const COLORES_DISTRIBUCION = {
    liquidez: "--distribucion-liquidez",
    inversiones: "--distribucion-inversiones",
    inmovil: "--distribucion-inmovil",
    deudas: "--distribucion-deudas",
    accion: "--violet",
    etf: "--aqua",
    cripto: "--orange",
    bono: "--piggie",
    otros: "--cappuccino",
    pen: "--orange",
    usd: "--violet",
    eur: "--piggie",
    usdt: "--aqua"
}

// La dona solo se recrea si cambió la composición: comparar huellas evita
// redibujar en cada refresco del dashboard cuando el reparto no varió.
let ultimaDonaDistribucion = ""
let ultimaDonaDivisa = ""

async function dibujarDonaDivisa(items) {
    const contenedor = document.getElementById("patrimonio-divisa-dona-placeholder")
    if (!contenedor) return
    if (!items || items.length === 0) {
        contenedor.replaceChildren()
        return
    }

    const huella = items.map(item => `${item.clave}:${item.valor}`).join("|")
    if (huella === ultimaDonaDivisa && contenedor.querySelector("canvas")) return
    ultimaDonaDivisa = huella

    let canvas = contenedor.querySelector("canvas")
    if (!canvas) {
        contenedor.replaceChildren()
        canvas = document.createElement("canvas")
        canvas.id = "patrimonio-divisa-dona"
        contenedor.appendChild(canvas)
    }

    if (!document.getElementById("patrimonio-divisa-dona")) return

    await crearGraficoDistribucion("patrimonio-divisa-dona", {
        labels: items.map(item => item.etiqueta),
        data: items.map(item => convertirMonto(item.valor, item.clave, divisaActual)),
        colores: items.map(item => COLORES_DISTRIBUCION[item.clave] || "--positive")
    }, {
        chartKey: "patrimonio-divisa-dona",
        formatear: monto => formatearMontoConDivisa(monto, divisaActual)
    })
}

async function dibujarDonaDistribucion(items) {
    const contenedor = document.getElementById("distribucion-dona-placeholder")
    if (!contenedor) return
    if (!items || items.length === 0) {
        contenedor.replaceChildren()
        return
    }

    const huella = items.map(item => `${item.clase}:${item.valor}`).join("|")
    if (huella === ultimaDonaDistribucion && contenedor.querySelector("canvas")) return
    ultimaDonaDistribucion = huella

    let canvas = contenedor.querySelector("canvas")
    if (!canvas) {
        // Quitar el esqueleto antes de pintar: si no, dona y esqueleto se
        // superponen en el mismo contenedor.
        contenedor.replaceChildren()
        canvas = document.createElement("canvas")
        canvas.id = "distribucion-dona"
        contenedor.appendChild(canvas)
    }

    // `limpiarEsqueletosDashboard()` puede borrar el placeholder mientras
    // esperamos a que cargue Chart.js. Verificar que el canvas sigue vivo.
    if (!document.getElementById("distribucion-dona")) return

    await crearGraficoDistribucion("distribucion-dona", {
        labels: items.map(item => item.label),
        data: items.map(item => item.valor),
        colores: items.map(item => COLORES_DISTRIBUCION[item.clase] || "--distribucion-liquidez")
    }, {
        chartKey: "distribucion-dashboard",
        formatear: monto => formatearMontoConDivisa(monto, divisaActual)
    })
}

/* Aplica el ancho de cada barra de distribución vía variable CSS
   (el width vive en .distribucion-barra .barra-progreso). */
function aplicoAnchoBarras(lista, items) {
    // Retrocompatibilidad: llamada con un solo argumento (patrimonio por divisa).
    if (!Array.isArray(items)) {
        items = lista
        lista = document
    }
    const barras = lista.querySelectorAll(".distribucion-barra .barra-progreso")
    barras.forEach((barra, i) => {
        if (!items[i]) return
        const pct = items[i].porcentaje
        barra.style.display = "block"
        barra.style.width = `${pct}%`
    })
}

function actualizarDistribucion() {
    const lista = document.getElementById("distribucion-lista")
    const totalEl = document.getElementById("distribucion-total")
    if (!lista || !analiticaData) return

    // Recalcular porcentajes basándose en los valores reales para que la
    // lista y la dona siempre usen los mismos datos y los porcentajes
    // siempre sumen 100%. Sin esto, a veces la dona y las barras muestran
    // datos inconsistentes (porcentajes que no coinciden con los valores
    // o que no suman 100%).
    const items = analiticaData.distribucion.map(item => ({
        ...item,
        valor: Math.max(0, item.valor)
    }))
    const total = items.reduce((sum, item) => sum + item.valor, 0)
    const itemsConPorcentaje = items.map(item => ({
        ...item,
        porcentaje: total > 0 ? (item.valor / total) * 100 : 0
    }))

    if (totalEl) totalEl.textContent = formatearMontoConDivisa(total, divisaActual)
    lista.replaceChildren(contenidoDesdeFilas("tpl-distribucion-item", itemsConPorcentaje, item => ({
        valores: {
            "etiqueta": item.label,
            "porcentaje": `${item.porcentaje.toFixed(0)}%`,
            "barra-clase@data-clase": item.clase,
            "valor": formatearMontoConDivisa(item.valor, divisaActual)
        }
    })))
    aplicoAnchoBarras(lista, itemsConPorcentaje)
    actualizarScrollFade(lista)

    dibujarDonaDistribucion(itemsConPorcentaje).catch(() => {})
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
    bono: "bono",
    otros: "otros"
}

function actualizarDistribucionActivos() {
    const lista = document.getElementById("distribucion-activos-lista")
    const dona = document.getElementById("distribucion-activos-dona-placeholder")
    if (!lista) return

    if (dona) dona.replaceChildren()

    if (!posicionesData || posicionesData.length === 0) {
        lista.replaceChildren(tarjetaVacia("No tienes posiciones abiertas."))
        actualizarScrollFade(lista)
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
        lista.replaceChildren(tarjetaVacia("No hay nada valorable que repartir."))
        actualizarScrollFade(lista)
        return
    }
    for (const item of items) item.porcentaje = (item.valor / total) * 100

    lista.replaceChildren(contenidoDesdeFilas("tpl-distribucion-item", items, item => ({
        valores: {
            "etiqueta": item.label,
            "porcentaje": `${item.porcentaje.toFixed(0)}%`,
            "barra-clase@data-clase": item.clase,
            "valor": formatearMontoConDivisa(item.valor, divisaActual)
        }
    })))
    aplicoAnchoBarras(lista, items)
    actualizarScrollFade(lista)
}

// ============================================
// PATRIMONIO POR DIVISA
// ============================================
// Desglose del mismo patrimonio que da la card grande, pero en la moneda en la
// que está cada parte, en vez de convertido a una sola. Es la lectura que
// importa cuando hay saldo en varias divisas: cuánto tienes de cada una y qué
// peso tiene cada una. calcularPatrimonio() ya devuelve los tres totales
// convertidos, así que no hace falta ninguna consulta extra.

// `calcularPatrimonio()` devuelve los tres totales en campos con nombre de
// variable (patrimonioPEN/USD/USDT): el campo NO es la clave de divisa en
// minúscula que usaba antes, y leer patrimonioStats["pen"] daba siempre 0
// (BUG-029). El campo y la clave van por separado a propósito.
const ORDEN_DIVISAS_PATRIMONIO = ["pen", "usd", "eur", "usdt"]

function actualizarPatrimonioDivisa() {
    const lista = document.getElementById("patrimonio-divisa-lista")
    if (!lista) return

    if (!patrimonioStats) {
        lista.replaceChildren(tarjetaVacia("No se pudo calcular el patrimonio."))
        actualizarScrollFade(lista)
        return
    }

    // Desglose real por divisa en su propia moneda. Los tres totales
    // convertidos son el mismo patrimonio en tres monedas y siempre darían
    // partes iguales: no sirven para esta card.
    const desglose = patrimonioStats.porDivisa || {}
    const claves = Object.keys(desglose)
        .filter(clave => Math.abs(Number(desglose[clave]) || 0) > 0)
        .sort((a, b) => {
            const ia = ORDEN_DIVISAS_PATRIMONIO.indexOf(a)
            const ib = ORDEN_DIVISAS_PATRIMONIO.indexOf(b)
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (a < b ? -1 : 1)
        })
    const items = claves.map(clave => ({
        etiqueta: etiquetaDivisa(clave),
        clave,
        valor: Number(desglose[clave]) || 0
    }))

    // El peso de cada divisa se mide sobre el total convertido a una moneda
    // común; si no, no serían comparables.
    const total = convertirMonto(
        items.reduce((suma, item) => suma + convertirMonto(item.valor, item.clave, "pen"), 0),
        "pen",
        divisaActual
    )

    if (total <= 0) {
        lista.replaceChildren(tarjetaVacia("Sin patrimonio registrado."))
        actualizarScrollFade(lista)
        return
    }

    lista.replaceChildren(contenidoDesdeFilas("tpl-distribucion-item", items, item => {
        const equivalente = convertirMonto(item.valor, item.clave, divisaActual)
        const porcentaje = Math.max(0, Math.min(100, (equivalente / total) * 100))
        return {
            valores: {
                "etiqueta": item.etiqueta,
                "porcentaje": `${porcentaje.toFixed(0)}%`,
                "barra-clase@data-clase": item.clave,
                "valor": formatearMontoConDivisa(item.valor, item.clave)
            }
        }
    }))
    actualizarScrollFade(lista)
    aplicoAnchoBarras(items.map((item, i) => ({
        ...item,
        porcentaje: Math.max(0, Math.min(100, (convertirMonto(item.valor, item.clave, divisaActual) / total) * 100))
    })))

    dibujarDonaDivisa(items).catch(() => {})
}

function actualizarProgramados() {
    const lista = document.getElementById("programados-lista")
    const cantidadEl = document.getElementById("programados-cantidad")
    if (!lista || !analiticaData) return

    if (cantidadEl) cantidadEl.textContent = analiticaData.programados.length
    if (analiticaData.programados.length === 0) {
        lista.replaceChildren(tarjetaVacia("No hay movimientos programados próximos."))
        actualizarScrollFade(lista)
        return
    }

    lista.replaceChildren(contenidoDesdeFilas("tpl-dashboard-list-item", analiticaData.programados, item => ({
        valores: {
            "titulo": item.titulo,
            "detalle": formatearProximaEjecucion(item.fecha),
            "valor-texto": formatearMontoConDivisa(item.monto, divisaActual)
        }
    })))
    actualizarScrollFade(lista)
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
        lista.replaceChildren(tarjetaVacia("Todo en orden. No hay alertas."))
        actualizarScrollFade(lista)
        return
    }

    lista.replaceChildren(contenidoDesdeFilas("tpl-alerta-item", alertas, alerta => ({
        valores: {
            "alerta@class": `alerta-item ${alerta.nivel}`,
            "titulo": alerta.titulo,
            "detalle": alerta.detalle
        },
        html: { icono: icono("triangle-alert", 14) }
    })))
    actualizarScrollFade(lista)
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
    const detalleEl = document.getElementById("movimientos-detalle")
    if (!lista) return

    if (detalleEl) detalleEl.replaceChildren()

    if (movimientosData.length === 0) {
        lista.replaceChildren(tarjetaVacia("Sin movimientos por ahora."))
        actualizarScrollFade(lista)
        return
    }

    lista.replaceChildren(contenidoDesdeFilas("tpl-dashboard-movimiento", movimientosData, plantillaMovimiento))
    enlazarMovimientos(lista)
    actualizarScrollFade(lista)
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
    let clase = esPositivo ? "positive" : "negative"
    if (m.tipo === "error") clase = "ambar"
    const tipoNombre = CONFIG_MOVIMIENTOS[m.tipo]?.nombre || m.tipo || "Movimiento"
    const etiquetas = (m.etiquetas || []).filter(Boolean)

    const etiquetasFrag = document.createDocumentFragment()
    for (const e of etiquetas) {
        etiquetasFrag.append(" ")
        etiquetasFrag.append(contenidoDesdeTemplate("tpl-badge-etiqueta", { valores: { badge: e } }))
    }

    return {
        valores: {
            "item@data-movimiento-id": m.id,
            "titulo": m.concepto || m.activo || tipoNombre,
            "detalle": formatearFecha(fechaDeMovimiento(m)),
            "monto@class": `movimiento-monto ${clase}`,
            "monto-texto": `${signo} ${formatearMontoConDivisa(Math.abs(monto), m.divisa || "pen")}`
        },
        html: { etiquetas: etiquetasFrag }
    }
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
    bindModalDashboard("card-distribucion", abrirModalDistribucionPatrimonial)
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
        contenido: contenidoDesdeTemplate("tpl-patrimonio-loading", {
            html: { logo: LOGO_ESCINCO_CARGA }
        }),
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
            body.replaceChildren(contenidoDesdeTemplate("tpl-patrimonio", {
                valores: {
                    nombre: nombreUsuario,
                    "total@class": `patrimonio-modal-total ${patrimonioNeto < 0 ? "negative" : "positive"}`,
                    patrimonio: formatearMontoConDivisa(patrimonioNeto, divisaActual),
                    disponible: formatearMontoConDivisa(disponible, divisaActual),
                    invertido: formatearMontoConDivisa(invertido, divisaActual),
                    deudas: formatearMontoConDivisa(deudas, divisaActual)
                }
            }))
        })
        .catch(error => {
            const body = modal?.querySelector(".modal-body")
            if (!body || !modal.isConnected) return
            body.replaceChildren(contenidoDesdeTemplate("tpl-mensaje", {
                valores: {
                    mensaje: `No se pudo calcular el patrimonio: ${error.message || "error desconocido"}`
                }
            }))
        })
}

function abrirModalDistribucionPatrimonial() {
    if (modoEdicionDashboard) return
    if (!analiticaData) return

    const wrapper = contenidoDesdeTemplate("tpl-distribucion-patrimonial")

    const categorias = [
        { etiqueta: "Liquidez", valor: analiticaData.liquidez },
        { etiqueta: "Inversiones", valor: analiticaData.inversiones },
        { etiqueta: "Inmovilizado", valor: analiticaData.inmovil },
        { etiqueta: "Deudas", valor: analiticaData.deudas }
    ]
        .filter(item => Math.abs(Number(item.valor) || 0) > 0)
        .map(item => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: item.etiqueta,
                valor: formatearMontoConDivisa(item.valor, divisaActual)
            }
        }))

    const porTipo = new Map()
    for (const posicion of posicionesData || []) {
        const activo = posicion.activo || {}
        const tipo = String(activo.tipo || "accion").toLowerCase()
        const cantidad = Number(posicion.cantidad) || 0
        const ultimoPrecio = Number(activo.ultimoPrecio) || 0
        if (cantidad <= 0 || ultimoPrecio <= 0) continue
        const valor = convertirMonto(cantidad * ultimoPrecio, posicion.divisa || "usd", divisaActual)
        porTipo.set(tipo, (porTipo.get(tipo) || 0) + valor)
    }
    const tiposActivo = [...porTipo.entries()]
        .filter(([, valor]) => valor > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([tipo, valor]) => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: ETIQUETAS_TIPO_ACTIVO[tipo] || "Otros",
                valor: formatearMontoConDivisa(valor, divisaActual)
            }
        }))

    const desgloseDivisa = patrimonioStats?.porDivisa || {}
    const divisas = Object.keys(desgloseDivisa)
        .filter(clave => Math.abs(Number(desgloseDivisa[clave]) || 0) > 0)
        .sort((a, b) => {
            const ia = ORDEN_DIVISAS_PATRIMONIO.indexOf(a)
            const ib = ORDEN_DIVISAS_PATRIMONIO.indexOf(b)
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (a < b ? -1 : 1)
        })
        .map(clave => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: etiquetaDivisa(clave),
                valor: formatearMontoConDivisa(desgloseDivisa[clave], clave)
            }
        }))

    const cuentasInvolucradas = (cuentas || [])
        .filter(cuenta => {
            if (cuenta.estado === "archivada") return false
            if (cuenta.esPatrimonio === false) return false
            if (esHija(cuenta)) return false
            if (cuenta.tipo === "credito") return Number(cuenta.deuda) > 0
            if (esAbstracta(cuenta)) return true
            if (esSaldoInmovil(cuenta, cuentas)) return Number(cuenta.saldoInicial) !== 0
            return Number(cuenta.saldoInicial) !== 0
        })
        .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")))
        .map(cuenta => {
            const esCredito = cuenta.tipo === "credito"
            const moneda = String(cuenta.moneda || cuenta.divisa || "pen").toLowerCase()
            const monto = esCredito ? Math.max(0, Number(cuenta.deuda) || 0) : Number(cuenta.saldoInicial) || 0
            const etiqueta = esCredito ? "Deuda" : (esSaldoInmovil(cuenta, cuentas) ? "Inmovilizado" : "Liquidez")
            return contenidoDesdeTemplate("tpl-distribucion-modal-item", {
                valores: {
                    etiqueta: `${cuenta.nombre} · ${etiqueta}`,
                    valor: esCredito
                        ? formatearMontoConDivisa(convertirMonto(monto, moneda, divisaActual), divisaActual)
                        : formatearMontoConDivisa(convertirMonto(monto, moneda, divisaActual), divisaActual),
                    detalle: etiquetaDivisa(moneda)
                }
            })
        })

    const contenedorCategorias = wrapper.querySelector('[data-tpl="categorias"]')
    const contenedorTipos = wrapper.querySelector('[data-tpl="tipos-activo"]')
    const contenedorDivisas = wrapper.querySelector('[data-tpl="divisas"]')
    const contenedorCuentas = wrapper.querySelector('[data-tpl="cuentas"]')

    if (contenedorCategorias) contenedorCategorias.replaceChildren(...categorias)
    if (contenedorTipos) contenedorTipos.replaceChildren(...tiposActivo)
    if (contenedorDivisas) contenedorDivisas.replaceChildren(...divisas)
    if (contenedorCuentas) contenedorCuentas.replaceChildren(...cuentasInvolucradas)

    abrirModal({
        titulo: "Distribución patrimonial",
        contenido: wrapper,
        variante: "wide",
        confirmText: "Cerrar",
        onConfirm: () => true
    })
}

async function abrirModalEvolucionDashboard() {
    if (modoEdicionDashboard) return

    let cancelado = false
    let secuenciaModal = 0
    let categoriaEvolucion = "todo"
    let datosModal = null

    const opcionesGrafico = categoria => {
        const item = CATEGORIAS_GRAFICO.find(c => c.id === categoria) || CATEGORIAS_GRAFICO[0]
        return {
            divisa: divisaActual,
            etiquetaDivisa: presentarDivisa(divisaActual),
            chartKey: "evolucion-modal",
            categoria: item.id,
            etiqueta: item.etiquetaSerie
        }
    }

    const dibujarModal = async (datos, categoria = categoriaEvolucion) => {
        datosModal = datos
        return crearGraficoPatrimonio(
            "grafico-patrimonio-modal",
            datos,
            opcionesGrafico(categoria)
        )
    }

    const restaurarGrafico = () => {
        cancelado = true
        secuenciaModal++
        destruirGraficoPatrimonio("evolucion-modal")
        if (datosGrafico?.labels?.length) dibujarGrafico()
    }

    const modal = abrirModal({
        titulo: "Evolución patrimonial",
        contenido: contenidoDesdeTemplate("tpl-patrimonio-loading", {
            html: { logo: LOGO_ESCINCO_CARGA }
        }),
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

        const categorias = contenidoDesdeFilas("tpl-categoria-grafico", CATEGORIAS_GRAFICO, c => ({
            valores: { "categoria@data-categoria": c.id, etiqueta: c.etiqueta }
        }))
        const periodos = contenidoDesdeFilas("tpl-periodo-grafico", PERIODOS_GRAFICO, p => ({
            valores: { "periodo@data-periodo": p.id, etiqueta: p.etiqueta }
        }))
        const contenido = contenidoDesdeTemplate("tpl-evolucion", {
            html: { categorias, periodos }
        })
        body.replaceChildren(contenido)

        // El selector de categoría no vuelve a leer Firestore: todas las
        // series vienen en los mismos snapshots. Solo cambia la línea que se
        // dibuja, y el periodo elegido sigue intacto.
        const opcionesCategoria = body.querySelectorAll("#grafico-categorias-modal .toggle-option")
        const marcarCategoria = () => {
            opcionesCategoria.forEach(opt => {
                opt.classList.toggle("active", opt.dataset.categoria === categoriaEvolucion)
            })
        }
        opcionesCategoria.forEach(opt => {
            opt.addEventListener("click", async () => {
                if (!modal?.isConnected || cancelado) return
                if (opt.dataset.categoria === categoriaEvolucion) return
                categoriaEvolucion = opt.dataset.categoria
                marcarCategoria()
                await dibujarModal(datosModal || datos, categoriaEvolucion)
            })
        })
        marcarCategoria()

        configurarPeriodos(body.querySelector("#grafico-periodos-modal"), async () => {
            if (!modal?.isConnected || cancelado) return
            const secuencia = ++secuenciaModal
            const datosPeriodo = await obtenerPatrimonioParaGrafico(uid, obtenerPeriodo(periodoGrafico).dias)
            if (!modal.isConnected || cancelado || secuencia !== secuenciaModal) return
            datosGrafico = datosPeriodo
            await dibujarModal(datosPeriodo, categoriaEvolucion)
        })
        await dibujarModal(datos, categoriaEvolucion)
        if (cancelado && datosGrafico?.labels?.length) dibujarGrafico()
    } catch (error) {
        const body = modal?.querySelector(".modal-body")
        if (!body || !modal.isConnected || cancelado) return
        const parrafo = document.createElement("p")
        parrafo.className = "modal-message-desc"
        parrafo.textContent = `No se pudo cargar la evolución: ${error.message || "error desconocido"}`
        body.replaceChildren(parrafo)
    }
}

function abrirModalProgramados() {
    const items = analiticaData?.programados || []

    let contenido
    if (items.length === 0) {
        contenido = contenidoDesdeTemplate("tpl-modal-mensaje", {
            valores: { texto: "No hay movimientos programados próximos." }
        })
    } else {
        const wrapper = document.createElement("div")
        wrapper.className = "modal-lista-dashboard"
        wrapper.append(contenidoDesdeFilas("tpl-dashboard-list-item", items, item => ({
            valores: {
                "titulo": item.titulo,
                "detalle": formatearFecha(item.fecha),
                "valor-texto": formatearMontoConDivisa(item.monto, divisaActual)
            }
        })))
        contenido = wrapper
    }

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

    let contenido
    if (items.length === 0) {
        contenido = contenidoDesdeTemplate("tpl-modal-mensaje", {
            valores: { texto: "Todo en orden. No hay alertas." }
        })
    } else {
        const wrapper = document.createElement("div")
        wrapper.className = "modal-lista-dashboard"
        wrapper.append(contenidoDesdeFilas("tpl-alerta-item", items, alerta => ({
            valores: {
                "alerta@class": `alerta-item ${alerta.nivel}`,
                "titulo": alerta.titulo,
                "detalle": alerta.detalle
            },
            html: { icono: icono("triangle-alert", 16) }
        })))
        contenido = wrapper
    }

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
        contenido = contenidoDesdeTemplate("tpl-vencimientos-vacio", {
            valores: { dias: DIAS_VENCIMIENTO }
        })
    } else {
        const wrapper = document.createElement("div")
        wrapper.className = "lista-cards vencimientos-lista"
        wrapper.append(contenidoDesdeFilas("tpl-dashboard-vencimiento", items, plantillaVencimiento))
        contenido = wrapper
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

    return {
        valores: {
            "item@class": `card-item vencimiento-item${v.vencido ? " vencido" : ""}${accionable ? " clickeable" : ""}`,
            "item@data-tipo": v.tipo,
            "item@data-id": v.id,
            "titulo": `${v.titulo}${v.vencido ? " · VENCIDO" : ""}`,
            "detalle": `${v.subtitulo} · ${textoDias(v.diasRestantes)}`,
            "valor@class": `card-item-valor ${claseValor}`.trim(),
            "valor-texto": `${signo ? `${signo} ` : ""}${formatearMontoConDivisa(v.monto, v.divisa)}`
        }
    }
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
        lista.replaceChildren(tarjetaVacia("Marca activos con la estrella en Inversiones."))
        actualizarScrollFade(lista)
        return
    }

    lista.replaceChildren(contenidoDesdeFilas("tpl-dashboard-favorito", favoritosData, plantillaFavorito))
    enlazarFavoritos(lista)
    actualizarScrollFade(lista)
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

    return {
        valores: {
            "item@data-activo-id": posicion.activoId,
            "nombre": activo.nombre || posicion.activoId,
            "simbolo": activo.simbolo || "",
            "precio": formatearMontoConDivisa(precio, posicion.divisa)
        }
    }
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

function configurarPresupuestos() {
    actualizarPresupuestos()
    instalarSincronizacionPresupuestos()
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
        reordenarDashboard(true)
    })
}

// ============================================
// PRESUPUESTOS EN EL DASHBOARD
// ============================================
// La card "Presupuestos" muestra todos los presupuestos con su progreso.
// Al hacer clic en uno se abre el modal de presupuestos con ese presupuesto
// activado (se abre el mismo modal que usa la lastbar persistente).

let sincronizacionPresupuestosInstalada = false
function instalarSincronizacionPresupuestos() {
    if (sincronizacionPresupuestosInstalada) return
    sincronizacionPresupuestosInstalada = true
    window.addEventListener("presupuestos-actualizados", async () => {
        await actualizarPresupuestos()
        reordenarDashboard(true)
    })
}

async function actualizarPresupuestos() {
    const lista = document.getElementById("presupuestos-lista")
    if (!lista) return

    const contador = document.getElementById("presupuestos-cantidad")

    let presupuestos
    try {
        presupuestos = await obtenerPresupuestosConProgreso(uid)
    } catch (error) {
        console.error("[ERROR] Error cargando presupuestos para dashboard:", error)
        return
    }

    if (contador) contador.textContent = String(presupuestos.length)

    if (presupuestos.length === 0) {
        lista.replaceChildren(tarjetaVacia("Crea tu primer presupuesto."))
        actualizarScrollFade(lista)
        return
    }

    lista.replaceChildren(contenidoDesdeFilas("tpl-presupuesto-card", presupuestos, plantillaPresupuestoDashboard))
    enlazarListaPresupuestos(lista)
    actualizarScrollFade(lista)
}

function plantillaPresupuestoDashboard(p) {
    const pp = p.presupuesto
    const estadoClase = `estado-${p.estado}`
    return {
        valores: {
            "presupuesto@data-id": pp.id,
            "presupuesto@class": `presupuesto-item ${estadoClase}`,
            nombre: pp.nombre,
            estado: p.estadoTexto,
            detalle: `${formatearMontoConDivisa(p.gastoReal, pp.divisa)} de ${formatearMontoConDivisa(pp.monto, pp.divisa)}`,
            valor: `${p.porcentaje.toFixed(0)}%`
        },
        html: {
            "icono-activar": icono("play", 16),
            "icono-editar": icono("pencil", 16),
            "icono-eliminar": icono("trash", 16)
        }
    }
}

function enlazarListaPresupuestos(lista) {
    lista?.addEventListener("click", async (e) => {
        const btn = e.target.closest(".card-action-btn")
        if (!btn) return
        const accion = btn.dataset.accion
        const card = btn.closest(".card-item")
        const id = card?.dataset.id
        if (!id) return

        if (accion === "activar-presupuesto") {
            abrirModalPresupuestos(id)
        } else if (accion === "editar-presupuesto") {
            await abrirModalEditarPresupuesto(id)
        } else if (accion === "eliminar-presupuesto") {
            if (!confirm("¿Eliminar este presupuesto?")) return
            try {
                await eliminarPresupuesto(uid, id)
                window.dispatchEvent(new CustomEvent("presupuestos-actualizados"))
            } catch (error) {
                console.error("[ERROR] No se pudo eliminar el presupuesto:", error)
                mostrarNotificacion("error", "No se pudo eliminar el presupuesto")
            }
        }
    })
}


function actualizarMetas() {
    const lista = document.getElementById("metas-lista")
    if (!lista) return

    if (metasData.length === 0) {
        lista.replaceChildren(tarjetaVacia("Crea tu primera meta de ahorro."))
        actualizarScrollFade(lista)
        return
    }

    lista.replaceChildren(contenidoDesdeFilas("tpl-dashboard-meta", metasData, plantillaMeta))
    enlazarListaMetas(lista)
    actualizarScrollFade(lista)
}

// Tarjeta al estilo de "Últimos movimientos"/"Favoritos": el nombre con el
// monto acumulado como información secundaria y el porcentaje a la derecha.
function plantillaMeta(meta) {
    const clases = [
        "meta-item",
        meta.completada ? "completada" : "",
        meta.activa ? "" : "pausada"
    ].filter(Boolean).join(" ")

    const monto = Number(meta.montoActual) || 0
    const pct = Number(meta.porcentaje) || 0
    return {
        valores: {
            "item@class": clases,
            "item@data-meta-id": meta.id,
            "nombre": meta.nombre,
            "cantidad": formatearMontoConDivisa(monto, meta.divisa),
            "porcentaje": `${pct.toFixed(0)}%`
        }
    }
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
        actualizarDistribucion()
        actualizarProgramados()
        actualizarAlertas()
        reordenarDashboard(true)

        // Redibujar el gráfico manteniendo el periodo actual
        if (datosGrafico?.labels?.length) {
            await crearGraficoPatrimonio("grafico-patrimonio", datosGrafico, {
                divisa: divisaActual,
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

// Toggle compartido por las cards Gastado / Ingresado / Balance, y ahora
// también el de Ingresado: cada card con métricas lleva su propio grupo con
// `data-periodo-flujo`, porque todas comparten el MISMO `periodoFlujo`.
// Solo redibuja texto: los totales de cada ventana ya vienen calculados en
// `analiticaData.flujoPorPeriodo`, así que no hace falta releer Firestore.
function configurarPeriodoFlujoDashboard() {
    const contenedores = document.querySelectorAll("#periodo-flujo-gastos, #periodo-flujo-ingresos")

    contenedores.forEach(contenedor => {
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
    })
}

// ============================================
// GRÁFICO DE PATRIMONIO
// ============================================

async function actualizarGraficoPatrimonio() {
    if (!document.querySelector('[data-dashboard-card="grafico"]')?.isConnected) return
    if (!uid) return
    try {
        await registrarSnapshot(uid)
    } catch (error) {
        console.warn("No se pudo registrar snapshot:", error?.code, error?.message)
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
        divisa: divisaActual,
        etiquetaDivisa: presentarDivisa(divisaActual)
    })
}

function mostrarEstadoGrafico(tipo, texto, hint = "") {
    const estado = document.getElementById("grafico-estado")
    if (!estado) return

    estado.replaceChildren(tipo === "cargando"
        ? contenidoDesdeTemplate("tpl-grafico-cargando")
        : contenidoDesdeTemplate("tpl-grafico-vacio", { valores: { texto, hint } }))
    estado.hidden = false
}

function ocultarEstadoGrafico() {
    const estado = document.getElementById("grafico-estado")
    if (!estado) return
    estado.hidden = true
    estado.replaceChildren()
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
    const app = document.getElementById("app-content")
    if (app) {
        app.classList.remove("scroll-fade", "scroll-fade-top", "scroll-fade-bottom")
    }
}

