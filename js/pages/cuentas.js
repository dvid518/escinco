import { asegurarEstilos } from "../core/estilos.js"
import { sesion } from "../core/sesion.js"
import { icono } from "../core/iconos.js"
import { esqueletoContenedor, skeletonMarkup } from "../ui/skeletons.js"
import {
    obtenerCuentas,
    obtenerMovimientos,
    crearCuenta,
    actualizarCuenta,
    eliminarCuenta,
    normalizarOrdenCuentas,
    reordenarCuentas,
    restaurarDocumento,
    actualizarMovimientoDoc,
    deleteField,
    aplicarPreferenciasDiff
} from "../../firebase/firestore.js"
import { CONFIG_MOVIMIENTOS, TIPOS_MOVIMIENTO } from "../../constants/tiposMovimiento.js"
import { DIVISAS_LABELS, DIVISAS_SYMBOLS, compararDivisas } from "../../constants/divisas.js"
import { convertirMonto, etiquetaDivisa } from "../services/DivisaServicio.js"
import { calcularPatrimonio } from "../services/SnapshotServicio.js"
import {
    esHija,
    familiaDe,
    cuentasVisibles,
    esAbstracta,
    normalizarNombre
} from "../core/familiaCuentas.js"
import { abrirModal, cerrarModal, estaAbierto, contenidoDesdeTemplate, contenidoDesdeFilas } from "../ui/modal.js"
import { mostrarNotificacion } from "../ui/notificaciones.js"
import { ofrecerDeshacer } from "../services/DeshacerServicio.js"
import { eliminarMovimiento, restaurarMovimiento } from "../services/MovimientoServicio.js"
import { abrirModalEducativoCredito, estadoCicloDe, nivelUsoDe, notificarCruces, proximaAnualidad } from "../services/CreditoServicio.js"
import { esMovimientoPositivo, montoDeMovimiento, compararMovimientosPorFecha } from "../core/movimientos.js"
import { envolverSidebar } from "../ui/colapsoSidebar.js"
import { expandirSeleccion } from "../ui/seleccion.js"

asegurarEstilos("cuentas")

// La card de movimiento lleva el botón de favoritos a la izquierda (Paso 2.1),
// pero en la lista de una cuenta no tiene sentido: ahí la lista es de consulta
// (texto, fecha, etiquetas y valor), no de gestión de favoritos. Se quita el
// nodo del fragmento en vez de duplicar el template, para que las dos listas no
// se desincronicen cuando cambie la card.
function sinBotonFavorito(fragmento) {
    fragmento.querySelectorAll(".movimiento-favorito").forEach(boton => boton.remove())
    return fragmento
}

let cuentas = []
// Las cuentas archivadas no se listan ni se seleccionan, pero no se borran:
// siguen en Firestore y se pueden recuperar desde Configuración › Datos.
let cuentasArchivadas = []
let cuentaSeleccionada = null
// Que miembro de la familia se esta viendo en las tabs del panel. Es una
// cuenta real, no una "vista": al cambiar de tab se repinta con el render
// estandar de esa cuenta.
let miembroFamiliaVisto = null
let cuentaSolicitadaId = null
let uid = null

function estaArchivada(cuenta) {
    return cuenta?.estado === "archivada"
}

/**
 * Lado en el que se dibuja la columna de información de la cuenta.
 * Única fuente de la lateralidad: la usan tanto el esqueleto de carga como el
 * detalle real, para que no se separen. Sin esto el esqueleto aparecía siempre
 * con la info a la izquierda y al cargar el contenido saltaba al otro lado.
 */
function lateralidadInfo() {
    return sesion.getPreferencias()?.accesibilidad?.lateralidadCuentaInfo === "izquierda"
        ? "info-izquierda"
        : "info-derecha"
}

// Interacción con las cards de movimientos de la cuenta seleccionada.
let movimientosCuentaActivos = []
const seleccionadosCuenta = new Set()
const ordenSeleccionCuenta = []
let cardConAccionesCuenta = null
let clickTimerCuenta = null
let supresorClickCuenta = false
let supresorClickTimerCuenta = null
let eventosCardsCuentaListos = false
let eventosRefreshCuentaListos = false
// Última vista para el modal temporal (duplica sin quitar del sidebar).
let ultimaVistaCuenta = null

// ============================================
// ÍCONOS POR TIPO DE CUENTA
// ============================================

const ICONOS_POR_TIPO = {
    efectivo: "banknote",
    broker: "trending-up",
    exchange: "arrow-left-right",
    plazo: "landmark",
    credito: "credit-card",
    debito: "credit-card"
}

function formatearMontoConDivisa(monto, moneda = "pen") {
    const importe = Number(monto || 0).toFixed(2)
    const clave = String(moneda || "pen").toLowerCase()
    const formato = sesion.getPreferencias()?.formatoDivisa
    if (formato === "codigo") return `${importe} ${DIVISAS_LABELS[clave] || clave.toUpperCase()}`
    return `${DIVISAS_SYMBOLS[clave] || "S/"} ${importe}`
}

// Solo dígitos: números de cuenta, CCI y tarjetas se guardan sin guiones,
// espacios ni letras.
function soloDigitos(valor) {
    return String(valor || "").replace(/\D/g, "")
}

// Muestra un número de tarjeta en grupos de 4 ("12345678" → "1234 5678").
// El dato en Firestore queda unido; solo se separa al pintar.
function agruparTarjeta(valor) {
    const digitos = soloDigitos(valor)
    return digitos.replace(/(\d{4})(?=\d)/g, "$1 ")
}

function iconoPorTipo(tipo) {
    return ICONOS_POR_TIPO[tipo] || "wallet"
}

function campoSaldosPorDivisa(divisaActiva = null) {
    const monedas = [["pen", "S/"], ["usd", "$"], ["eur", "€"], ["usdt", "₮"]]
    const bloques = contenidoDesdeFilas("tpl-saldo-divisa", monedas, ([divisa, simbolo]) => ({
        valores: {
            "bloque@data-divisa": divisa,
            "bloque@hidden": divisa !== divisaActiva,
            "label@for": `campo-saldo-${divisa}`,
            "label": simbolo,
            "input@id": `campo-saldo-${divisa}`
        }
    }))
    return contenidoDesdeTemplate("tpl-campo-saldos", { html: { saldos: bloques } })
}

// Saldos introducidos, indexados por divisa, solo de las visibiles.
function leerSaldosPorDivisa(raiz) {
    const saldos = {}
    raiz?.querySelectorAll(".saldo-divisa").forEach(bloque => {
        if (bloque.hidden) return
        const input = bloque.querySelector("input")
        if (!input) return
        saldos[bloque.dataset.divisa] = Number(input.value) || 0
    })
    return saldos
}

/**
 * Crea la familia de cuentas de una vez.
 *
 * El padre es una clase abstracta: no tiene divisa propia ni saldo, solo
 * sostiene a sus hijas. Las instancias son las subcuentas, cada una con su
 * `moneda`, `saldoInicial`, número y CCI propios.
 *
 * Con N divisas salen N+1 documentos (1 padre abstracto + N hijas). Las
 * familias legacy (padre con su propia moneda y saldo) siguen leyéndose igual.
 * Si el padre no es patrimonial, las hijas tampoco lo son.
 */
async function crearCuentaConSubcuentas(uidActual, datosPadre, saldos, { esCredito = false } = {}) {
    // `divisasExtras` es solo de paso: no forma parte del documento del padre.
    const { divisasExtras = [], ...datosLimpios } = datosPadre
    const esPatrimonial = datosPadre.esPatrimonio !== false

    // Cuenta simple o tarjeta: sin familia, el documento es la instancia.
    const todasDivisas = [datosLimpios.moneda, ...divisasExtras]
    if (esCredito || divisasExtras.length === 0) {
        return crearCuenta(uidActual, {
            ...datosLimpios,
            nombre: normalizarNombre(datosLimpios.nombre),
            saldoInicial: saldos[datosLimpios.moneda] ?? 0,
            esPatrimonio: esPatrimonial
        })
    }

    // Familia: padre abstracto sin saldo ni divisa operativa.
    const cuentaPadre = await crearCuenta(uidActual, {
        ...datosLimpios,
        nombre: normalizarNombre(datosLimpios.nombre),
        moneda: todasDivisas[0],
        saldoInicial: 0,
        esAbstracta: true,
        esPatrimonio: esPatrimonial
    })

    for (let i = 0; i < todasDivisas.length; i++) {
        const divisa = todasDivisas[i]
        await crearCuenta(uidActual, {
            // Sin `nombre`: se deriva del padre al leer (resolverNombresCuentas).
            tipo: datosPadre.tipo,
            moneda: divisa,
            saldoInicial: saldos[divisa] ?? 0,
            padreId: cuentaPadre.id,
            estado: "activa",
            esPatrimonio: esPatrimonial,
            orden: (datosPadre.orden ?? 0) + i + 1
        })
    }

    return cuentaPadre
}

/**
 * Mueve todas las referencias de una cuenta a otra: movimientos (cuenta,
 * origen y destino), estrategias, trades y órdenes. Sin esto, convertir una
 * cuenta simple en familia huérfana su historial: los movimientos seguirían
 * apuntando al padre abstracto y la subcuenta se vería vacía.
 */
async function migrarReferenciasCuenta(uidActual, origenId, destinoId) {
    const movimientos = await obtenerMovimientos(uidActual).catch(() => [])
    for (const m of movimientos) {
        const parcial = {}
        if (m.cuenta === origenId) parcial.cuenta = destinoId
        if (m.cuentaOrigen === origenId) parcial.cuentaOrigen = destinoId
        if (m.cuentaDestino === origenId) parcial.cuentaDestino = destinoId
        if (Object.keys(parcial).length > 0) {
            await actualizarMovimientoDoc(uidActual, m.id, parcial)
        }
    }
    try {
        const { obtenerEstrategias, actualizarEstrategia } = await import("../repositories/EstrategiaRepositorio.js")
        for (const e of await obtenerEstrategias(uidActual).catch(() => [])) {
            if (e.cuentaId === origenId) await actualizarEstrategia(uidActual, e.id, { cuentaId: destinoId })
        }
    } catch { /* sin estrategias que migrar */ }
    try {
        const { obtenerTrades, actualizarTrade } = await import("../repositories/TradeRepositorio.js")
        for (const t of await obtenerTrades(uidActual).catch(() => [])) {
            if (t.cuenta === origenId) await actualizarTrade(uidActual, t.id, { cuenta: destinoId })
        }
    } catch { /* sin trades que migrar */ }
    try {
        const { obtenerOrdenes, actualizarOrden } = await import("../repositories/OrdenRepositorio.js")
        for (const o of await obtenerOrdenes(uidActual).catch(() => [])) {
            if (o.cuenta === origenId) await actualizarOrden(uidActual, o.id, { cuenta: destinoId })
        }
    } catch { /* sin órdenes que migrar */ }
}

/**
 * Convierte una cuenta simple en padre abstracto: crea la hija de su propia
 * divisa con su saldo, número y CCI, le traspasa todo el historial y vacía
 * al padre. Devuelve la hija creada.
 */
async function migrarPadreASubcuenta(uidActual, cuenta, ordenBase = 0) {
    const hija = await crearCuenta(uidActual, {
        tipo: cuenta.tipo,
        moneda: (cuenta.moneda || "pen").toLowerCase(),
        saldoInicial: cuenta.saldoInicial || 0,
        numeroCuenta: cuenta.numeroCuenta || cuenta.num || "",
        cci: cuenta.cci || "",
        padreId: cuenta.id,
        estado: "activa",
        esPatrimonio: cuenta.esPatrimonio !== false,
        orden: ordenBase
    })
    await migrarReferenciasCuenta(uidActual, cuenta.id, hija.id)
    await actualizarCuenta(uidActual, cuenta.id, {
        esAbstracta: true,
        saldoInicial: 0,
        num: "",
        numeroCuenta: "",
        cci: ""
    })
    return hija
}

// ============================================
// VENCIMIENTO DE TARJETA · MES Y AÑO
// ============================================
// Dos campos en vez de un "MM/AA" de texto libre: el mes se rellena solo al
// llegar a 2 dígitos y el foco salta al año, y la "/" del medio la pone el
// propio control. Así nadie tiene que acordarse de escribirla.
//
// El valor guardado sigue siendo "MM/AA": esto solo cambia cómo se teclea.

/** Divide un "MM/AA" guardado en las partes de los dos inputs. */
function partesVencimiento(valor) {
    const m = /^(\d{2})\/(\d{2})$/.exec(String(valor || "").trim())
    return m ? { mes: m[1], anio: m[2] } : { mes: "", anio: "" }
}



/** Lee el par de inputs y devuelve "MM/AA", o "" si falta alguna parte. */
function leerVencimiento(raiz, prefijo) {
    const mes = raiz?.querySelector(`#${prefijo}-mes`)?.value.trim() || ""
    const anio = raiz?.querySelector(`#${prefijo}-anio`)?.value.trim() || ""
    if (!mes || !anio) return ""
    return `${mes}/${anio}`
}

/**
 * Conecta el par mes/año: solo dígitos, máximo 2 por campo, salto automático
 * del foco al año al llenar el mes, y borrado del campo completo al pulsar
 * Backspace sobre un campo ya vacío.
 * @param {Element} raiz - el modal o el formulario
 * @param {string} prefijo - "campo" o "edit"
 */
function conectarVencimiento(raiz, prefijo) {
    const inputMes = raiz?.querySelector(`#${prefijo}-mes`)
    const inputAnio = raiz?.querySelector(`#${prefijo}-anio`)
    if (!inputMes || !inputAnio) return

    const soloDigitos = evento => {
        evento.target.value = evento.target.value.replace(/\D/g, "").slice(0, 2)
    }

    inputMes.addEventListener("input", evento => {
        soloDigitos(evento)
        // Al completar el mes el foco salta al año: no hace falta tabular ni
        // hacer clic para seguir escribiendo.
        if (inputMes.value.length === 2) inputAnio.focus()
    })

    inputAnio.addEventListener("input", soloDigitos)

    // Backspace sobre un campo vacío borra el anterior: es lo que se espera
    // al corregir el mes sin tener que volver a seleccionar.
    inputAnio.addEventListener("keydown", evento => {
        if (evento.key !== "Backspace" || inputAnio.value) return
        evento.preventDefault()
        inputMes.focus()
        inputMes.value = ""
    })

    inputMes.addEventListener("keydown", evento => {
        if (evento.key !== "Backspace" || inputMes.value) return
        evento.preventDefault()
        inputMes.value = ""
    })
}

/** Markup del par mes/año con la "/" dibujada entre los dos. */
function campoVencimiento(prefijo, valor = "") {
    const { mes, anio } = partesVencimiento(valor)
    return contenidoDesdeTemplate("tpl-campo-vencimiento", {
        valores: {
            "lbl-mes@for": `${prefijo}-mes`,
            "mes@id": `${prefijo}-mes`,
            "mes@value": mes,
            "anio@id": `${prefijo}-anio`,
            "anio@value": anio
        }
    })
}

// ============================================
// TOGGLE DE DIVISAS (subcuentas)
// ============================================
// Los `.toggle-option` del formulario de cuenta eligen en qué divisas vive
// esa cuenta: una sola divisa deja la cuenta simple, varias crean subcuentas.
// El marcado y la lectura del estado ya existian, pero faltaba el clic: sin
// este listener los botones no cambiaban de estado, `divisasSeleccionadas`
// salia siempre vacio y toda cuenta acababa en PEN sin subcuentas.
//
// `bloqueadas` son las divisas que ya existen en la cuenta y no se pueden
// quitar: se mantienen encendidas y el clic no las apaga.
function conectarToggleDivisas(raiz, bloqueadas = []) {
    raiz?.querySelectorAll(".toggle-option").forEach(opcion => {
        const divisa = opcion.dataset.divisa
        const bloqueada = bloqueadas.includes(divisa)

        // El input de saldo de esa divisa aparece y desaparece con el toggle:
        // mostrar una divisa esplerla a crear una subcuenta con ese saldo.
        const sincronizarSaldo = () => {
            const bloque = raiz.querySelector(`.saldo-divisa[data-divisa="${divisa}"]`)
            if (bloque) bloque.hidden = !opcion.classList.contains("active")
        }
        sincronizarSaldo()

        if (bloqueada) {
            opcion.classList.add("active")
            opcion.setAttribute("aria-disabled", "true")
            opcion.title = "Esta divisa ya existe y no se puede quitar"
            sincronizarSaldo()
            return
        }

        opcion.addEventListener("click", () => {
            const opciones = [...raiz.querySelectorAll(".toggle-option")]

            if (opcion.classList.contains("active")) {
                // Tocar de nuevo deselecciona. Solo queda bloqueado el último
                // caso: una cuenta sin ninguna divisa no se puede crear, así que
                // la última activa no se apaga (si es la única, avisa).
                if (opciones.filter(o => o.classList.contains("active")).length === 1) {
                    mostrarNotificacion("info", "La cuenta necesita al menos una divisa")
                    return
                }
                opcion.classList.remove("active")
                sincronizarSaldo()
                return
            }

            opcion.classList.add("active")
            opcion.title = ""
            opcion.removeAttribute("aria-disabled")
            sincronizarSaldo()
        })
    })
}

// ============================================
// RENDER
// ============================================

export function render() {
    return `
        ${envolverSidebar(`
            <section id="sidebar">
                ${skeletonMarkup({ variant: "sidebar", rows: 4 })}
            </section>
        `)}
        <section id="panel" class="glass" aria-busy="true">
            ${skeletonMarkup({ variant: "panel", rows: 3, className: lateralidadInfo() })}
        </section>
    `
}

// ============================================
// INIT
// ============================================

export async function init() {
    uid = sesion.uid
    console.log("[INFO] Cuentas iniciado para UID:", uid)

    // Siempre recargar al navegar: los saldos/deudas cambian al registrar
    // movimientos desde otros modales y no deben quedar desactualizados.
    await cargarCuentas()

    configurarEventos()
    configurarRefreshCuentas()
}

function configurarRefreshCuentas() {
    if (eventosRefreshCuentaListos) return
    eventosRefreshCuentaListos = true
    window.addEventListener("movimientos-actualizados", () => {
        if (document.getElementById("lista-movimientos-cuenta")) cargarCuentas()
    })
    // Configuración › Datos restaura cuentas archivadas. Esta página tiene su
    // propia copia en memoria, así que hay que recargarla para que las cuentas
    // recuperadas vuelvan al sidebar.
    window.addEventListener("cuentas-actualizadas", () => {
        if (!document.getElementById("sidebar")) return
        cargarCuentas()
    })
}

// ============================================
// CARGA
// ============================================

function mostrarEsqueletosCuentas() {
    const sidebar = document.getElementById("sidebar")
    const panel = document.getElementById("panel")
    sidebar?.setAttribute("aria-busy", "true")
    panel?.setAttribute("aria-busy", "true")
    // Reemplazar solo los hijos, no el contenedor, para no perder
    // otros elementos que puedan vivir dentro de sidebar o panel.
    if (sidebar) {
        sidebar.replaceChildren(esqueletoContenedor("sidebar", 4))
    }
    if (panel) {
        panel.replaceChildren(esqueletoContenedor("panel", 3, lateralidadInfo()))
    }
}

async function cargarCuentas() {
    mostrarEsqueletosCuentas()
    try {
        let todas = await obtenerCuentas(uid)
        await normalizarOrdenCuentas(uid, todas)
        if (todas.some(c => !Number.isFinite(Number(c.orden)))) {
            // normalizarOrdenCuentas acaba de escribir `orden` con
            // serverTimestamp: hay que releer para tener los valores reales.
            todas = await obtenerCuentas(uid)
        }

        // Separar antes de ordenar por `orden`: las archivadas conservan el
        // hueco que tenían, así al restaurarlas vuelven a su sitio.
        cuentasArchivadas = todas.filter(estaArchivada)
        cuentas = todas.filter(c => !estaArchivada(c))
        cuentas.sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0))

        await notificarCruces(cuentas, uid)

        renderizarSidebar()

        if (cuentaSolicitadaId) {
            await seleccionarCuenta(cuentaSolicitadaId)
            cuentaSolicitadaId = null
        }

        if (cuentaSeleccionada) {
            cuentaSeleccionada = cuentas.find(c => c.id === cuentaSeleccionada.id) || null
        }

        if (!cuentaSeleccionada && cuentas.length > 0) {
            await seleccionarCuenta(cuentas[0].id)
        } else if (cuentas.length === 0) {
            mostrarVacio()
        } else {
            await mostrarDetalleCuenta()
        }

        // El router reinyecta el footer en cada navegación y la plantilla
        // llega con "Editar"/"Archivar" marcados como desact. Hay que
        // reevaluar el estado SIEMPRE al terminar de cargar: si no, al
        // reentrar con una cuenta ya seleccionada (rama `else` de arriba,
        // que no pasa por seleccionarCuenta) los dos botones se quedan
        // apagados y sin poder pulsarse.
        actualizarLastbar()
    } catch (error) {
        console.error("Error cargando cuentas:", error)
        const panel = document.getElementById("panel")
        const sidebar = document.getElementById("sidebar")
        if (sidebar) sidebar.replaceChildren(contenidoDesdeTemplate("tpl-lista-vacio", {
            valores: { texto: "No se pudieron cargar las cuentas." }
        }))
        if (panel) panel.replaceChildren(contenidoDesdeTemplate("tpl-lista-error", {
            valores: { texto: "Error al cargar cuentas" }
        }))
        mostrarNotificacion("error", "No se pudieron cargar las cuentas")
    } finally {
        document.getElementById("sidebar")?.removeAttribute("aria-busy")
        document.getElementById("panel")?.removeAttribute("aria-busy")
    }
}

// ============================================
// SIDEBAR
// ============================================

function renderizarSidebar() {
    const sidebar = document.getElementById("sidebar")
    if (!sidebar) return

    sidebar.replaceChildren()

    // Las hijas no se listan: se llega a ellas por las tabs del padre.
    const visibles = cuentasVisibles(cuentas)
    let idArrastrado = null
    let destinoInsercion = null

    const limpiarInsercion = () => {
        sidebar.querySelectorAll(".cuenta-insercion").forEach(el => el.remove())
        destinoInsercion = null
    }

    const moverCuenta = (origenId, indiceDestino) => {
        const ordenadas = [...cuentas]
        const desde = ordenadas.findIndex(c => c.id === origenId)
        if (desde < 0) return
        const [origen] = ordenadas.splice(desde, 1)
        // Solo cuentan las visibles para el índice de destino.
        const visiblesOrden = ordenadas.filter(c => !esHija(c))
        const destino = visiblesOrden[indiceDestino]
        const hasta = destino ? ordenadas.findIndex(c => c.id === destino.id) : ordenadas.length
        ordenadas.splice(hasta, 0, origen)
        reordenarCuentas(uid, ordenadas)
            .then(() => aplicarOrdenEnMemoria(ordenadas))
            .catch(error => {
                console.error("Error reordenando cuentas:", error)
                aplicarOrdenEnMemoria(ordenadas)
            })
    }

    visibles.forEach((cuenta, indice) => {
        const item = document.createElement("div")
        item.className = "cuenta-sidebar-item"
        item.dataset.id = cuenta.id
        item.draggable = true

        const btn = document.createElement("button")
        btn.className = "glass cuenta-sidebar-btn"
        btn.name = "cta"
        btn.dataset.id = cuenta.id
        btn.draggable = false
        btn.appendChild(contenidoDesdeTemplate("tpl-cuenta-sidebar-icono", {
            html: { "icono": icono(iconoPorTipo(cuenta.tipo), 18) }
        }))

        const texto = document.createElement("span")
        texto.textContent = cuenta.nombre
        btn.appendChild(texto)

        btn.addEventListener("click", () => seleccionarCuenta(cuenta.id))
        item.addEventListener("dragstart", evento => {
            evento.dataTransfer.effectAllowed = "move"
            evento.dataTransfer.setData("text/plain", cuenta.id)
            idArrastrado = cuenta.id
            item.classList.add("arrastrando")
        })
        item.addEventListener("dragend", () => {
            item.classList.remove("arrastrando")
            idArrastrado = null
            limpiarInsercion()
        })
        item.addEventListener("dragover", evento => {
            evento.preventDefault()
            if (!idArrastrado || idArrastrado === cuenta.id) return
            const rect = item.getBoundingClientRect()
            const antes = (evento.clientY - rect.top) < rect.height / 2
            const destino = antes ? indice : indice + 1
            if (destino === destinoInsercion) return
            limpiarInsercion()
            destinoInsercion = destino
            const marca = document.createElement("div")
            marca.className = "cuenta-insercion"
            if (antes) item.before(marca)
            else item.after(marca)
        })
        item.addEventListener("drop", evento => {
            evento.preventDefault()
            const origenId = evento.dataTransfer.getData("text/plain") || idArrastrado
            const destino = destinoInsercion ?? indice
            limpiarInsercion()
            if (!origenId) return
            moverCuenta(origenId, destino > indice ? destino - 0 : destino)
        })

        item.append(btn)
        sidebar.appendChild(item)
    })

    sidebar.ondragover = evento => evento.preventDefault()
    sidebar.ondrop = evento => {
        // Soltar al final de la lista.
        if ([...sidebar.querySelectorAll(".cuenta-sidebar-item")].some(el => el.contains(evento.target) && evento.target.closest(".cuenta-sidebar-item"))) return
        evento.preventDefault()
        const origenId = evento.dataTransfer.getData("text/plain") || idArrastrado
        limpiarInsercion()
        if (!origenId) return
        moverCuenta(origenId, visibles.length)
    }

    // El sidebar se repinta en cada carga: sin esto la cuenta en vista perdía
    // el resaltado al recargar la lista (registrar movimientos,etc.).
    marcarCuentaEnVista()
}

/**
 * Deja el nuevo orden solo en memoria y repinta el sidebar.
 *
 * Antes esto llamaba a cargarCuentas(), que vacía el sidebar y el panel con
 * esqueletos y vuelve a leer todas las cuentas de Firestore: al mover una
 * cuenta por encima de otra se recargaba la página entera, se perdía la
 * selección y había que esperar el viaje de red para volver a ver lo mismo.
 *
 * reordenarCuentas() ya escribe el `orden` y ya invalida la caché, así que
 * aquí solo hace falta adjuntar ese orden al array local y volver a dibujar la
 * lista. El panel no se toca: la cuenta seleccionada no ha cambiado y su
 * detalle sigue siendo válido.
 */
function aplicarOrdenEnMemoria(ordenadas) {
    cuentas = ordenadas.slice()
    renderizarSidebar()
}

// ============================================
// SELECCIÓN
// ============================================

export async function seleccionarCuentaPorId(id) {
    if (!id) return
    cuentaSolicitadaId = id
    if (cuentas.some(cuenta => cuenta.id === id)) {
        await seleccionarCuenta(id)
        cuentaSolicitadaId = null
    }
}

async function seleccionarCuenta(id) {
    // Si hacemos click sobre la misma cuenta ya seleccionada, mantenerla seleccionada
    // y no cerrar el panel (mostrar detalle de la cuenta)
    if (cuentaSeleccionada && cuentaSeleccionada.id === id) {
        // Ya está seleccionada, no hacer toggle off, mantener vista detalle
        marcarCuentaEnVista()
        actualizarLastbar()
        return
    }

    cuentaSeleccionada = cuentas.find(c => c.id === id)
    if (!cuentaSeleccionada) return

    // Al cambiar de cuenta se vuelve a la primera subcuenta de su familia.
    miembroFamiliaVisto = null
    marcarCuentaEnVista()
    await mostrarDetalleCuenta()
    actualizarLastbar()
}

/**
 * Marca en el sidebar la cuenta que se está viendo ahora.
 *
 * El resaltado va en la FILA (.cuenta-sidebar-btn), no en el .cuenta-sidebar-item
 * que la envuelve: ese es un contenedor sin fondo, y el fondo se lo pone el
 * botón. Se usa `en-vista` y no `selected` porque `selected` ya la usa el
 * gesto de mantener pulsado (el "arrastrar para reordenar") y se quita al
 * soltar; mezclar ambos hacía que el resaltado de "la que estoy viendo"
 * parpadeara al pulsar.
 */
function marcarCuentaEnVista() {
    const enVista = cuentaSeleccionada?.id
    document.querySelectorAll(".cuenta-sidebar-btn").forEach(btn => {
        btn.classList.toggle("en-vista", btn.dataset.id === enVista)
        if (btn.dataset.id === enVista) btn.setAttribute("aria-current", "true")
        else btn.removeAttribute("aria-current")
    })
}

// ============================================
// DETALLE
// ============================================

async function mostrarDetalleCuenta() {
    const panel = document.getElementById("panel")
    if (!panel || !cuentaSeleccionada) return

    panel.setAttribute("aria-busy", "true")
    const cuenta = cuentaSeleccionada

    if (!panel.querySelector(".cuenta-vista")) {
        panel.replaceChildren(esqueletoContenedor("panel", 3, lateralidadInfo()))
    }

    let movimientos = []
    try {
        movimientos = await obtenerMovimientos(uid)
    } catch (error) {
        console.error("Error cargando movimientos de la cuenta:", error)
    }

    if (cuentaSeleccionada?.id !== cuenta.id) {
        panel.removeAttribute("aria-busy")
        return
    }

    // La familia: el padre y sus hijas. Cada miembro es una cuenta entera, asi
    // que las pills no cambian "vista de subcuentas": cambian QUE CUENTA se
    // esta viendo, y el render de abajo es el de siempre.
    const familia = familiaDe(cuenta, cuentas)
    const conSubcuentas = familia.length > 1
    let visto = familia.find(c => c.id === miembroFamiliaVisto) || familia[0]
    miembroFamiliaVisto = visto.id

    // Numero y vencimiento de una subcuenta: la entidad financiera es el padre
    // (una tarjeta, una cuenta bancaria), asi que una hija sin los suyos
    // muestra los del padre en vez de un hueco.
    if (esHija(visto)) {
        const referencia = familia.find(c => c.id === (visto.padreId || cuenta.id)) || cuenta
        visto = {
            ...visto,
            num: visto.num || visto.numeroCuenta || referencia.num || "",
            vence: visto.vence || referencia.vence || ""
        }
    }

    const ciclo = visto.tipo === "credito" ? estadoCicloDe(visto, movimientos) : null
    // % del patrimonio de cada subcuenta. El calculo ya respeta el flag
    // `esPatrimonio` del resto de la familia.
    let patrimonioTotal = null
    try {
        patrimonioTotal = (await calcularPatrimonio(uid)).patrimonioPEN
    } catch (error) {
        console.warn("[WARN] No se pudo calcular el patrimonio para el %:", error)
    }
    const panelInfo = visto.tipo === "credito"
        ? plantillaInfoTarjeta(visto, ciclo)
        : plantillaInfoNormal(visto, { laFamilia: familia, patrimonioTotal })

    panel.replaceChildren(contenidoDesdeTemplate("tpl-cuenta-vista", {
        valores: { "raiz@class": `cuenta-vista ${lateralidadInfo()}` },
        html: {
            info: panelInfo
        }
    }))
    const listaMovsCuenta = panel.querySelector("#lista-movimientos-cuenta")
    if (listaMovsCuenta) listaMovsCuenta.replaceChildren(esqueletoContenedor("list", 3))

    await cargarMovimientosDeCuenta(visto, movimientos)
    panel.removeAttribute("aria-busy")
    vincularInteraccionCardsCuenta()

    ultimaVistaCuenta = { cuentaId: cuenta.id, vistoId: visto.id, patrimonioTotal }

    panel.querySelectorAll(".btn-copiar").forEach(btn => {
        btn.addEventListener("click", () => {
            const texto = btn.dataset.copiar
            if (texto) copiarTexto(texto, btn.title?.replace("Copiar ", "") || "Texto")
        })
    })

    // El modal educativo de niveles de uso. Solo el badge de nivel de la
    // tarjeta: las pills de subcuenta tambien son .badge--interactivo y viven
    // dentro de .cuenta-perfil-badges, asi que se limita a los hijos directos
    // para no abrir el modal al cambiar de subcuenta.
    panel.querySelectorAll(".cuenta-perfil-badges > .badge--interactivo").forEach(badge => {
        badge.addEventListener("click", () => abrirModalEducativoCredito(visto, {
            pagadoCompleto: ciclo?.pagadoCompleto === true
        }))
    })

    // Cambiar de pill = mirar otra cuenta de la familia. Se repinta el panel
    // entero con el render estandar de esa cuenta.
    panel.querySelectorAll(".subcuentas-pills .badge").forEach(pill => {
        pill.addEventListener("click", () => {
            if (miembroFamiliaVisto === pill.dataset.cuentaId) return
            miembroFamiliaVisto = pill.dataset.cuentaId
            mostrarDetalleCuenta()
        })
    })
}

// Duplica la vista actual de la cuenta en un modal temporal, sin quitarla del
// sidebar ni cambiar la navegación. Solo disponible con modales persistentes.
export async function modalizarCuentaActual() {
    if (sesion.getPreferencias()?.accesibilidad?.modalesPersistentes !== true) {
        mostrarNotificacion("info", "Activa los modales persistentes para ver la cuenta en modal")
        return
    }
    const ctx = ultimaVistaCuenta
    const cuenta = cuentas.find(c => c.id === ctx?.cuentaId) || cuentaSeleccionada
    if (!cuenta) return
    const familia = familiaDe(cuenta, cuentas)
    let vistoId = ctx?.vistoId || miembroFamiliaVisto || familia[0]?.id
    let movimientos = []
    try {
        movimientos = await obtenerMovimientos(uid)
    } catch { movimientos = [] }

    const pintar = async (modalEl) => {
        const vistoBase = familia.find(c => c.id === vistoId) || familia[0]
        if (!vistoBase) return
        let visto = vistoBase
        if (esHija(visto)) {
            const referencia = familia.find(c => c.id === (visto.padreId || cuenta.id)) || cuenta
            visto = { ...visto, num: visto.num || visto.numeroCuenta || referencia.num || "", vence: visto.vence || referencia.vence || "" }
        }
        let patrimonioTotal = ctx?.patrimonioTotal ?? null
        try {
            patrimonioTotal = (await calcularPatrimonio(uid)).patrimonioPEN
        } catch { /* conserva el anterior */ }
        const ciclo = visto.tipo === "credito" ? estadoCicloDe(visto, movimientos) : null
        const info = visto.tipo === "credito"
            ? plantillaInfoTarjeta(visto, ciclo)
            : plantillaInfoNormal(visto, { laFamilia: familia, patrimonioTotal })
        const movs = movimientos
            .filter(m => movimientoInvolucra(m, visto.id))
            .sort(compararMovimientosPorFecha)
            .slice(0, 20)
        const cuerpo = modalEl.querySelector(".cuenta-modal-cuerpo")
        if (cuerpo) {
            cuerpo.replaceChildren(contenidoDesdeTemplate("tpl-cuenta-modal-vistas", {
                html: {
                    info,
                    movimientos: movs.length
                        ? sinBotonFavorito(contenidoDesdeFilas("tpl-movimiento-card", movs, m => filaMovimiento(m, visto.id)))
                        : contenidoDesdeTemplate("tpl-lista-vacio", { valores: { texto: "Sin movimientos." } })
                }
            }))
        }
        mostrarVistaModal(modalEl, modalEl.querySelector(".cuenta-modal-tabs .cuenta-modal-tab.active")?.dataset.vista || "info")
        modalEl.querySelectorAll(".subcuentas-pills .badge").forEach(pill => {
            pill.addEventListener("click", () => {
                if (vistoId === pill.dataset.cuentaId) return
                vistoId = pill.dataset.cuentaId
                pintar(modalEl)
            })
        })
        modalEl.querySelectorAll(".btn-copiar").forEach(btn => {
            btn.addEventListener("click", () => {
                const texto = btn.dataset.copiar
                if (texto) copiarTexto(texto, btn.title?.replace("Copiar ", "") || "Texto")
            })
        })
    }

    const modalEl = abrirModal({
        titulo: `Cuenta · ${cuenta.nombre}`,
        contenido: contenidoDesdeTemplate("tpl-modal-cuenta", {
            html: {
                anterior: icono("chevron-left", 16),
                siguiente: icono("chevron-right", 16)
            }
        }),
        variante: "wide",
        confirmText: "Cerrar",
        cancelText: null
    })
    modalEl.querySelectorAll(".cuenta-modal-tab").forEach(tab => {
        tab.addEventListener("click", () => mostrarVistaModal(modalEl, tab.dataset.vista))
    })
    modalEl.querySelector(".cuenta-modal-ant")?.addEventListener("click", () => mostrarVistaModal(modalEl, "info"))
    modalEl.querySelector(".cuenta-modal-sig")?.addEventListener("click", () => mostrarVistaModal(modalEl, "movimientos"))
    // Swipe horizontal en táctil: el equivalente en computadora son las
    // flechas y las tabs de arriba.
    let tactoX = null
    modalEl.querySelector(".cuenta-modal-cuerpo")?.addEventListener("touchstart", (e) => {
        tactoX = e.touches[0]?.clientX ?? null
    }, { passive: true })
    modalEl.querySelector(".cuenta-modal-cuerpo")?.addEventListener("touchend", (e) => {
        if (tactoX == null) return
        const dx = (e.changedTouches[0]?.clientX ?? tactoX) - tactoX
        tactoX = null
        if (Math.abs(dx) < 60) return
        mostrarVistaModal(modalEl, dx < 0 ? "movimientos" : "info")
    }, { passive: true })
    pintar(modalEl)
}

function mostrarVistaModal(modalEl, vista) {
    modalEl.querySelectorAll(".cuenta-modal-tab").forEach(tab => {
        const activa = tab.dataset.vista === vista
        tab.classList.toggle("active", activa)
        tab.setAttribute("aria-selected", activa ? "true" : "false")
    })
    modalEl.querySelectorAll(".cuenta-modal-vista").forEach(panel => {
        panel.hidden = panel.dataset.vista !== vista
    })
}

// Pills de la familia: una por subcuenta. La etiqueta respeta el formato del
// usuario (SOLES/DÓLARES con símbolo, PEN/USD con código), nunca solo "$".
function plantillaTabsSubcuentas(familia, visto) {
    return contenidoDesdeTemplate("tpl-tabs-subcuentas", {
        html: {
            pills: contenidoDesdeFilas("tpl-tabs-subcuentas-pill", familia, c => {
                const activa = c.id === visto.id
                return {
                    valores: {
                        "pill@aria-selected": String(activa),
                        "pill@class": `badge badge--interactivo${activa ? " activo" : ""}`,
                        "pill@data-cuenta-id": c.id,
                        "pill@title": c.nombre,
                        etiqueta: etiquetaDivisa(c.moneda)
                    }
                }
            })
        }
    })
}

// "% del patrimonio" como item resumen propio, junto al saldo, con el mismo
// estilo y en color normal.
function tarjetaPorcentajePatrimonio(c, patrimonioTotal) {
    if (patrimonioTotal == null || patrimonioTotal <= 0) return null
    const enPEN = convertirMonto(c.saldoInicial || 0, c.moneda, "pen")
    if (enPEN <= 0) return null
    const porcentaje = (enPEN / patrimonioTotal) * 100
    return contenidoDesdeTemplate("tpl-porcentaje-patrimonio", {
        valores: { valor: `${porcentaje.toFixed(porcentaje < 10 ? 1 : 0)}%` }
    })
}

// ============================================
// INFO · CUENTA NORMAL
// ============================================

/**
 * Estado de una tarjeta a partir de su vencimiento "MM/AA".
 *
 * ElStored "MM/AA" no dice el día, así que se toma el día 1 del mes como
 * referencia: ámbar durante todo el mes en que caduca (que es cuando aún hay
 * margen para cambiarla) y negativa a partir del mes siguiente.
 *
 * @param {string} vence - "MM/AA"
 * @returns {DocumentFragment|null} badge con clase de color, o null si no hay vencimiento
 */
function badgeVencimiento(vence) {
    const partes = /^(\d{2})\/(\d{2})$/.exec(String(vence || "").trim())
    if (!partes) return null

    const mes = Number(partes[1])
    const anio = 2000 + Number(partes[2])
    if (mes < 1 || mes > 12) return null

    const hoy = new Date()
    const finDeVigencia = new Date(anio, mes, 0) // último día del mes

    let clase = "badge--positive"
    let texto = "Vigente"

    if (hoy > finDeVigencia) {
        clase = "badge--negative"
        texto = "Caducada"
    } else if (hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes) {
        clase = "badge--aviso"
        texto = "Caduca este mes"
    }

    return contenidoDesdeTemplate("tpl-badge-vencimiento", {
        valores: {
            "badge@class": `badge ${clase}`,
            texto
        }
    })
}

function campoInfo(etiqueta, valor) {
    return contenidoDesdeTemplate("tpl-campo-info", { valores: { etiqueta, valor } })
}

function campoInfoCopia(etiqueta, valor, aCopiar, titulo) {
    return contenidoDesdeTemplate("tpl-campo-info-copia", {
        valores: {
            etiqueta,
            valor,
            "btn-copiar@data-copiar": aCopiar,
            "btn-copiar@title": titulo
        },
        html: { "btn-copiar": icono("copy", 14) }
    })
}

function plantillaInfoNormal(c, opciones = {}) {
    const saldo = c.saldoInicial || 0
    const esPositivo = saldo >= 0
    const laFamilia = opciones.laFamilia || null
    const numero = c.num || c.numeroCuenta || ""
    const esSubcuenta = esHija(c)

    return contenidoDesdeTemplate("tpl-cuenta-info-normal", {
        valores: {
            nombre: c.nombre,
            tipo: nombreTipo(c.tipo),
            "saldo@class": `resumen-valor ${esPositivo ? "positive" : "negative"}`,
            "saldo-texto": formatearMontoConDivisa(saldo, c.moneda),
            "tipo-detalle": nombreTipo(c.tipo),
            moneda: (c.moneda || "PEN").toUpperCase(),
            patrimonio: c.esPatrimonio === false ? "No" : "Sí"
        },
        html: {
            icono: icono(iconoPorTipo(c.tipo), 26),
            vencimiento: c.vence ? badgeVencimiento(c.vence) : null,
            tabs: laFamilia && laFamilia.length > 1 ? plantillaTabsSubcuentas(laFamilia, c) : null,
            porcentaje: tarjetaPorcentajePatrimonio(c, opciones.patrimonioTotal),
            subcuenta: esSubcuenta ? campoInfo("Subcuenta", etiquetaDivisa(c.moneda)) : null,
            numero: numero ? campoInfoCopia("Número", numero, numero, "Copiar número") : null,
            vence: c.vence ? campoInfo("Vencimiento", c.vence) : null,
            cci: c.cci ? campoInfoCopia("CCI", c.cci, c.cci, "Copiar CCI") : null
        }
    })
}

// ============================================
// INFO · TARJETA DE CRÉDITO
// ============================================

function plantillaInfoTarjeta(c, ciclo) {
    const deuda = Number(c.deuda) || 0
    const limite = Number(c.limite) || 0
    const disponible = Math.max(0, limite - deuda)
    const estado = ciclo || estadoCicloDe(c, [])
    // El nivel sale de `nivelUsoDe` (sobre `deuda`), igual que el modal, el
    // dashboard y las notificaciones. Antes venía de `nivelEstadoCuenta`, que
    // calculaba el mismo nivel sobre los consumos del ciclo y podía discrepar
    // de las otras tres superficies (BUG-026).
    const { nivel, porcentaje } = nivelUsoDe(c)
    // El badge, la barra y el porcentaje se derivan todos de `nivel`. Antes
    // cada uno tenía su propio ternario y además se pisaban con
    // `estado.pagadoCompleto`, de modo que un ciclo pagado con deuda de ciclos
    // anteriores mostraba "Pagado" al lado de una barra al 90% (BUG-026). El
    // estado del ciclo vive en sus propias tarjetas, no en el nivel de uso.
    const nivelTexto = nivel === "critico" ? "Crítico" : nivel === "aviso" ? "Advertencia" : "Normal"
    const claseEstado = nivel === "critico" ? "negative" : nivel === "aviso" ? "ambar" : "positive"
    const claseBarra = nivel === "critico" ? "negative" : nivel === "aviso" ? "ambar" : ""
    const claseBadge = nivel === "critico" ? "badge--negative" : nivel === "aviso" ? "badge--aviso" : "badge--positive"
    const corteInfo = calcularDiasHasta(c.diaCorte)
    const pagoInfo = calcularDiasHasta(c.diaPago)
    const anualidad = proximaAnualidad(c)

    return contenidoDesdeTemplate("tpl-cuenta-info-tarjeta", {
        valores: {
            nombre: c.nombre,
            "nivel@class": `badge badge--interactivo ${claseBadge}`,
            "nivel-texto": nivelTexto,
            "disponible@class": `resumen-valor ${disponible > 0 ? "positive" : "negative"}`,
            "disponible-texto": formatearMontoConDivisa(disponible, c.moneda),
            "consumos@class": `resumen-valor ${claseEstado}`,
            "consumos-texto": formatearMontoConDivisa(estado.consumos, c.moneda),
            "restante@class": `resumen-valor ${estado.restante > 0 ? "negative" : "positive"}`,
            "restante-texto": formatearMontoConDivisa(estado.restante, c.moneda),
            "barra@class": `aporte-progreso-barra ${claseBarra}`.trim(),
            "barra@style": `--progreso:${Math.min(100, porcentaje).toFixed(1)}%`,
            "porcentaje-badge@class": `badge ${claseBadge}`,
            "porcentaje-texto": `${porcentaje.toFixed(0)}%`,
            limite: formatearMontoConDivisa(limite, c.moneda),
            pagos: formatearMontoConDivisa(estado.pagos, c.moneda),
            corte: corteInfo ? `en ${corteInfo.dias} días (${corteInfo.fecha})` : "No definido",
            pago: estado.pagadoCompleto ? "Ciclo pagado" : pagoInfo ? `en ${pagoInfo.dias} días (${pagoInfo.fecha})` : "No definido",
            desgravamen: `${c.desgravamen || "0"}%`,
            patrimonio: c.esPatrimonio === false ? "No" : "Sí"
        },
        html: {
            icono: icono("credit-card", 26),
            vencimiento: c.vence ? badgeVencimiento(c.vence) : null,
            subcuenta: esHija(c) ? campoInfo("Subcuenta", etiquetaDivisa(c.moneda)) : null,
            anualidad: c.anualidad ? campoInfo("Anualidad", `${formatearMontoConDivisa(c.anualidad, c.moneda)}${anualidad ? ` · ${anualidad.fecha.toLocaleDateString("es-PE")}` : ""}`) : null,
            numero: c.num ? campoInfoCopia("Número", agruparTarjeta(c.num), soloDigitos(c.num), "Copiar número") : null,
            vence: c.vence ? campoInfo("Vencimiento", c.vence) : null
        }
    })
}

// "Pagar tarjeta" abierto desde la propia tarjeta (no desde el selector de movimientos).
export async function abrirPagarTarjeta(cuenta) {
    try {
        const { abrirFormularioMovimiento } = await import("./movimientos.js")
        abrirFormularioMovimiento(TIPOS_MOVIMIENTO.PAGO_TARJETA, null, {
            alGuardar: () => cargarCuentas(),
            valores: { tarjeta: cuenta.id, divisa: cuenta.moneda || "pen" }
        })
    } catch (error) {
        console.error("Error abriendo pago de tarjeta:", error)
        mostrarNotificacion("error", "No se pudo abrir el pago de tarjeta")
    }
}

// ============================================
// INFO · MOVIMIENTOS DE LA CUENTA
// ============================================

async function cargarMovimientosDeCuenta(cuenta, movimientosCargados = null) {
    const contenedor = document.getElementById("lista-movimientos-cuenta")
    if (!contenedor) return
    const contenedorTotales = document.getElementById("totales-movimientos-cuenta")
    contenedor.setAttribute("aria-busy", "true")
    contenedor.replaceChildren(esqueletoContenedor("list", 3))

    seleccionadosCuenta.clear()
    ordenSeleccionCuenta.length = 0
    cardConAccionesCuenta = null
    movimientosCuentaActivos = []

    try {
        const movimientos = movimientosCargados || await obtenerMovimientos(uid)

        // Cada miembro de la familia es una cuenta, asi que sus movimientos se
        // distinguen por su id. No hay nada que agrupar por divisa.
        const involucrados = movimientos
            .filter(m => movimientoInvolucra(m, cuenta.id))

        const involucradosOrdenados = involucrados
            .sort(compararMovimientosPorFecha)

        if (contenedorTotales) {
            contenedorTotales.replaceChildren(renderizarTotalesCuenta(cuenta, involucradosOrdenados))
            vincularAccionesTotales(cuenta)
        }

        const recientes = involucradosOrdenados.slice(0, 20)
        movimientosCuentaActivos = recientes

        if (recientes.length === 0) {
            contenedor.replaceChildren(contenidoDesdeTemplate("tpl-lista-vacio", {
                valores: { texto: "No hay movimientos que involucren esta cuenta todavía." }
            }))
            return
        }

        contenedor.replaceChildren(sinBotonFavorito(
            contenidoDesdeFilas("tpl-movimiento-card", recientes, m => filaMovimiento(m, cuenta.id))
        ))
    } catch (error) {
        console.error("Error cargando movimientos de la cuenta:", error)
            if (contenedorTotales) contenedorTotales.replaceChildren()
        contenedor.replaceChildren(contenidoDesdeTemplate("tpl-lista-error", {
            valores: { texto: "Error al cargar movimientos" }
        }))
    } finally {
        contenedor.removeAttribute("aria-busy")
    }
}

// Totales adaptados a los movimientos que involucran esta cuenta.
function renderizarTotalesCuenta(cuenta, involucrados) {

    const porDivisa = {}

    const movimientosTotales = cuenta.tipo === "credito"
        ? involucrados.filter(m => [TIPOS_MOVIMIENTO.GASTO, TIPOS_MOVIMIENTO.COMPRA_TARJETA, TIPOS_MOVIMIENTO.COMPRA_ACTIVO, TIPOS_MOVIMIENTO.P2P_COMPRA].includes(m.tipo))
        : involucrados

    movimientosTotales.forEach(m => {
        const divisa = (m.divisa || cuenta.moneda || "PEN").toUpperCase()
        if (!porDivisa[divisa]) porDivisa[divisa] = { positivo: 0, negativo: 0 }
        const monto = montoDeMovimiento(m, cuenta.id)
        if (esMovimientoPositivo(m, cuenta.id)) porDivisa[divisa].positivo += monto
        else porDivisa[divisa].negativo += monto
    })

    const esCredito = cuenta.tipo === "credito"

    const lineas = contenidoDesdeFilas(
        esCredito ? "tpl-totales-linea-credito" : "tpl-totales-linea-normal",
        Object.entries(porDivisa).sort(([a], [b]) => compararDivisas(a, b)),
        ([divisa, totales]) => ({
            valores: esCredito
                ? { negativo: `−${formatearMontoConDivisa(totales.negativo, divisa)}` }
                : {
                    positivo: `+${formatearMontoConDivisa(totales.positivo, divisa)}`,
                    negativo: `−${formatearMontoConDivisa(totales.negativo, divisa)}`
                }
        })
    )

    // Las tarjetas de crédito solo registran gastos y pagos; el resto de
    // cuentas abre el selector con la cuenta ya preseleccionada.
    // Con el ciclo ya pagado no hay nada que pagar: el botón ofrecería saldar una
    // deuda saldada (BUG-027). `involucrados` es un superconjunto de lo que
    // necesita `movimientosDelCiclo`, así que el ciclo sale igual que en el
    // detalle de la tarjeta.
    const ciclo = esCredito ? estadoCicloDe(cuenta, involucrados) : null
    const puedePagarTarjeta = ciclo ? ciclo.pagadoCompleto !== true : true

    let acciones = null
    if (cuenta.estado !== "archivada") {
        acciones = esCredito
            ? contenidoDesdeTemplate("tpl-totales-acciones-credito", {
                html: {
                    "icono-modal": icono("picture-in-picture", 16),
                    "icono-gasto": icono("arrow-up-right", 16),
                    pagar: puedePagarTarjeta ? contenidoDesdeTemplate("tpl-btn-pagar-tarjeta") : null
                }
            })
            : contenidoDesdeTemplate("tpl-totales-acciones-normal", {
                html: {
                    "icono-modal": icono("picture-in-picture", 16),
                    "icono-nuevo": icono("plus", 16)
                }
            })
    }

    return contenidoDesdeTemplate("tpl-totales-cuenta", {
        valores: { count: `${movimientosTotales.length} movimientos` },
        html: { lineas, acciones }
    })
}

function vincularAccionesTotales(cuenta) {
    document.getElementById("btn-ver-modal-cuenta")?.addEventListener("click", () => {
        modalizarCuentaActual()
    })
    if (cuenta.tipo === "credito") {
        document.getElementById("btn-gasto-tarjeta")?.addEventListener("click", () => {
            import("./movimientos.js").then(({ abrirFormularioMovimiento }) => {
                abrirFormularioMovimiento(TIPOS_MOVIMIENTO.GASTO, null, {
                    alGuardar: () => cargarCuentas(),
                    valores: { cuenta: cuenta.id }
                })
            })
        })
        document.getElementById("btn-pagar-tarjeta")?.addEventListener("click", () => {
            abrirPagarTarjeta(cuenta)
        })
    } else {
        document.getElementById("btn-nuevo-movimiento-cuenta")?.addEventListener("click", () => {
            import("./movimientos.js").then(({ abrirSelectorTipoMovimiento }) => {
                abrirSelectorTipoMovimiento(cuenta.id)
            })
        })
    }
}

function movimientoInvolucra(m, cuentaId) {
    return (
        m.cuenta === cuentaId ||
        m.cuentaOrigen === cuentaId ||
        m.cuentaDestino === cuentaId ||
        m.tarjeta === cuentaId
    )
}

function filaMovimiento(m, cuentaId = null) {
    const monto = montoDeMovimiento(m, cuentaId)
    const esPositivo = esMovimientoPositivo(m, cuentaId)
    const signo = esPositivo ? "+" : "−"
    const tipoNombre = CONFIG_MOVIMIENTOS[m.tipo]?.nombre || m.tipo || "Desconocido"
    const fecha = formatearFecha(m.fechaRealizacion)
    const etiquetas = (m.etiquetas || []).filter(Boolean)

    // Determinar clase de color: error muestra en ambar
    let clase = esPositivo ? "positive" : "negative"
    if (m.tipo === "error") clase = "ambar"

    return {
        valores: {
            "item@class": `card-item${seleccionadosCuenta.has(m.id) ? " seleccionado" : ""}`,
            "item@data-id": m.id,
            titulo: m.concepto || m.activo || tipoNombre || "Sin concepto",
            detalle: fecha,
            "valor@class": `card-item-valor ${clase}`,
            "valor-texto": `${signo} ${formatearMontoConDivisa(Math.abs(monto), m.divisa || "pen")}`
        },
        html: {
            etiquetas: contenidoDesdeFilas("tpl-badge-etiqueta", etiquetas, e => ({ valores: { badge: e } })),
            "icono-editar": icono("pencil", 16),
            "icono-eliminar": icono("trash", 16)
        }
    }
}

// ============================================
// INTERACCIÓN CON LAS CARDS DE MOVIMIENTOS
// ============================================
// Mismo comportamiento que la página de movimientos:
//   click     → abrir edición (o seleccionar si ya hay selección activa)
//   dblclick  → seleccionar / deseleccionar
//   mantén    → seleccionar (clic sostenido)
//   swipe ←   → revelar acciones (editar / eliminar)

function vincularInteraccionCardsCuenta() {
    const container = document.getElementById("lista-movimientos-cuenta")
    container?.addEventListener("click", manejarClickCardCuenta)
    container?.addEventListener("dblclick", manejarDobleClickCardCuenta)
    vincularGestosCardCuenta(container)
    configurarEventosCardsCuentaGlobales()
}

function configurarEventosCardsCuentaGlobales() {
    if (eventosCardsCuentaListos) return
    eventosCardsCuentaListos = true
    document.addEventListener("click", manejarClickFueraCardsCuenta)
    document.addEventListener("keydown", manejarTecladoSeleccionCuenta)
}

function marcarSupresorClickCuenta() {
    supresorClickCuenta = true
    clearTimeout(supresorClickTimerCuenta)
    supresorClickTimerCuenta = setTimeout(() => { supresorClickCuenta = false }, 400)
}

function consumirSupresorClickCuenta() {
    if (!supresorClickCuenta) return false
    supresorClickCuenta = false
    clearTimeout(supresorClickTimerCuenta)
    return true
}

function modoUnClickSeleccion() {
    return sesion.getPreferencias()?.accesibilidad?.unClickSeleccion === true
}

function manejarClickCardCuenta(evento) {
    const accionBtn = evento.target.closest(".card-action-btn")
    if (accionBtn) {
        evento.stopPropagation()
        const m = movimientosCuentaActivos.find(x => x.id === accionBtn.closest(".card-item")?.dataset.id)
        ocultarAccionesCardsCuenta()
        if (!m) return
        if (accionBtn.dataset.accion === "editar") abrirEditarMovimientoCuenta(m)
        else abrirModalEliminarMovimientoCuenta(m)
        return
    }

    const card = evento.target.closest(".card-item")

    if (cardConAccionesCuenta) {
        const esLaMisma = card === cardConAccionesCuenta
        ocultarAccionesCardsCuenta()
        if (esLaMisma) {
            consumirSupresorClickCuenta()
            return
        }
    }

    if (consumirSupresorClickCuenta()) return
    if (!card) return

    const id = card.dataset.id

    if (evento.shiftKey && expandirSeleccion(movimientosCuentaActivos.map(m => m.id), id, seleccionadosCuenta, ordenSeleccionCuenta)) {
        actualizarSeleccionCuentaEnDOM()
        return
    }

    if (modoUnClickSeleccion()) {
        seleccionarPorUnClickCuenta(id, evento.shiftKey)
        return
    }

    if (seleccionadosCuenta.size > 0) {
        toggleSeleccionCuenta(id)
        return
    }

    if (clickTimerCuenta) {
        clearTimeout(clickTimerCuenta)
        clickTimerCuenta = null
    }

    clickTimerCuenta = setTimeout(() => {
        clickTimerCuenta = null
        if (seleccionadosCuenta.size === 0) {
            const m = movimientosCuentaActivos.find(x => x.id === id)
            if (m) abrirEditarMovimientoCuenta(m)
        }
    }, 280)
}

function manejarDobleClickCardCuenta(evento) {
    if (evento.target.closest(".card-action-btn")) return
    const card = evento.target.closest(".card-item")
    if (!card) return
    if (clickTimerCuenta) {
        clearTimeout(clickTimerCuenta)
        clickTimerCuenta = null
    }
    if (modoUnClickSeleccion()) {
        limpiarSeleccionCuenta()
        const m = movimientosCuentaActivos.find(x => x.id === card.dataset.id)
        if (m) abrirEditarMovimientoCuenta(m)
        return
    }
    toggleSeleccionCuenta(card.dataset.id)
}

function manejarClickFueraCardsCuenta(evento) {
    if (!document.getElementById("lista-movimientos-cuenta")) return
    if (evento.target.closest(".card-item")) return
    if (evento.target.closest("#app-footer")) return
    if (evento.target.closest(".modal-overlay")) return
    ocultarAccionesCardsCuenta()
    limpiarSeleccionCuenta()
}

function manejarTecladoSeleccionCuenta(evento) {
    if (!document.getElementById("lista-movimientos-cuenta")) return
    if (estaAbierto()) return

    if (evento.key === "Escape") {
        if (seleccionadosCuenta.size > 0) {
            ocultarAccionesCardsCuenta()
            limpiarSeleccionCuenta()
        }
        return
    }

    if (evento.key !== "Delete" && evento.key !== "Backspace") return
    if (evento.target.matches("input, textarea, select")) return
    if (seleccionadosCuenta.size === 0) return
    evento.preventDefault()
    deseleccionarUltimoCuenta()
}

function seleccionarPorUnClickCuenta(id, conShift) {
    if (conShift) {
        toggleSeleccionCuenta(id)
        return
    }
    if (seleccionadosCuenta.size === 1 && seleccionadosCuenta.has(id)) return
    seleccionadosCuenta.clear()
    ordenSeleccionCuenta.length = 0
    seleccionadosCuenta.add(id)
    ordenSeleccionCuenta.push(id)
    actualizarSeleccionCuentaEnDOM()
}

function toggleSeleccionCuenta(id) {
    if (seleccionadosCuenta.has(id)) {
        seleccionadosCuenta.delete(id)
        const idx = ordenSeleccionCuenta.indexOf(id)
        if (idx !== -1) ordenSeleccionCuenta.splice(idx, 1)
    } else {
        seleccionadosCuenta.add(id)
        ordenSeleccionCuenta.push(id)
    }
    actualizarSeleccionCuentaEnDOM()
}

function limpiarSeleccionCuenta() {
    if (seleccionadosCuenta.size === 0) return
    seleccionadosCuenta.clear()
    ordenSeleccionCuenta.length = 0
    actualizarSeleccionCuentaEnDOM()
}

function deseleccionarUltimoCuenta() {
    if (ordenSeleccionCuenta.length === 0) return
    toggleSeleccionCuenta(ordenSeleccionCuenta[ordenSeleccionCuenta.length - 1])
}

function actualizarSeleccionCuentaEnDOM() {
    const container = document.getElementById("lista-movimientos-cuenta")
    if (!container) return
    container.querySelectorAll(".card-item").forEach(card => {
        card.classList.toggle("seleccionado", seleccionadosCuenta.has(card.dataset.id))
    })
}

function vincularGestosCardCuenta(container) {
    if (!container) return

    let gesto = null

    const cancelar = () => {
        if (gesto?.timer) clearTimeout(gesto.timer)
        gesto = null
    }

    container.addEventListener("pointerdown", (evento) => {
        if (evento.pointerType === "mouse" && evento.button !== 0) return
        if (evento.target.closest(".card-action-btn")) return

        const card = evento.target.closest(".card-item")
        if (!card) return

        cancelar()
        if (cardConAccionesCuenta && cardConAccionesCuenta !== card) ocultarAccionesCardsCuenta()

        gesto = {
            card,
            pointerId: evento.pointerId,
            pointerType: evento.pointerType,
            startX: evento.clientX,
            startY: evento.clientY,
            movido: false,
            swipeRevelado: false,
            timer: null
        }

        const duracion = evento.pointerType === "touch" ? 500 : 700
        gesto.timer = setTimeout(() => {
            if (!gesto) return
            toggleSeleccionCuenta(card.dataset.id)
            marcarSupresorClickCuenta()
            cancelar()
        }, duracion)
    })

    container.addEventListener("pointermove", (evento) => {
        if (!gesto || evento.pointerId !== gesto.pointerId) return

        const dx = evento.clientX - gesto.startX
        const dy = evento.clientY - gesto.startY

        if (!gesto.movido && Math.hypot(dx, dy) > 10) {
            gesto.movido = true
            if (gesto.timer) {
                clearTimeout(gesto.timer)
                gesto.timer = null
            }
        }

        if (!gesto.movido || gesto.pointerType === "mouse") return

        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
            gesto.swipeRevelado = true
            if (dx < 0) mostrarAccionesCardCuenta(gesto.card)
            else ocultarAccionesCardsCuenta()
        }
    })

    const finalizar = (evento) => {
        if (!gesto || evento.pointerId !== gesto.pointerId) return
        if (gesto.swipeRevelado) marcarSupresorClickCuenta()
        cancelar()
    }

    container.addEventListener("pointerup", finalizar)
    container.addEventListener("pointercancel", finalizar)
}

function mostrarAccionesCardCuenta(card) {
    if (cardConAccionesCuenta && cardConAccionesCuenta !== card) {
        cardConAccionesCuenta.classList.remove("acciones-visibles")
    }
    cardConAccionesCuenta = card
    card.classList.add("acciones-visibles")
}

function ocultarAccionesCardsCuenta() {
    if (!cardConAccionesCuenta) return
    cardConAccionesCuenta.classList.remove("acciones-visibles")
    cardConAccionesCuenta = null
}

async function abrirEditarMovimientoCuenta(m) {
    try {
        const { abrirFormularioMovimiento } = await import("./movimientos.js")
        abrirFormularioMovimiento(m.tipo, m, { alGuardar: () => cargarCuentas() })
    } catch (error) {
        console.error("Error abriendo edición de movimiento:", error)
        mostrarNotificacion("error", "No se pudo abrir la edición del movimiento")
    }
}

function abrirModalEliminarMovimientoCuenta(m) {
    const tipoNombre = CONFIG_MOVIMIENTOS[m.tipo]?.nombre || m.tipo || "Movimiento"
    abrirModal({
        titulo: "Eliminar movimiento",
        contenido: contenidoDesdeTemplate("tpl-confirmar-eliminar", {
            valores: {
                concepto: m.concepto || m.activo || tipoNombre,
                fecha: formatearFecha(m.fechaRealizacion)
            }
        }),
        variante: "confirm",
        confirmText: "Eliminar",
        cancelText: "Cancelar",
        onConfirm: async () => {
            try {
                const snapshot = { ...m }
                limpiarSeleccionCuenta()
                await eliminarMovimiento(uid, m)
                await cargarCuentas()
                ofrecerDeshacer({
                    mensaje: "Movimiento eliminado. ¿Deshacer?",
                    restaurar: () => restaurarMovimiento(uid, snapshot),
                    alRestaurar: () => cargarCuentas()
                })
                return true
            } catch (error) {
                console.error("Error eliminando movimiento:", error)
                mostrarNotificacion("error", `No se pudo eliminar: ${error.message || "error desconocido"}`)
                return false
            }
        }
    })
}

function formatearFecha(valor) {
    if (!valor) return "—"
    try {
        if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
            const [anio, mes, dia] = valor.split("-").map(Number)
            return new Date(anio, mes - 1, dia).toLocaleDateString("es-PE")
        }
        if (valor?.toDate) return valor.toDate().toLocaleDateString("es-PE")
        if (valor?.seconds) return new Date(valor.seconds * 1000).toLocaleDateString("es-PE")
        return new Date(valor).toLocaleDateString("es-PE")
    } catch {
        return "—"
    }
}

function nombreTipo(tipo) {
    const NOMBRES = {
        efectivo: "Efectivo",
        broker: "Broker",
        exchange: "Exchange",
        plazo: "Depósito a plazo",
        credito: "Tarjeta de crédito",
        debito: "Tarjeta de débito"
    }
    return NOMBRES[tipo] || "Cuenta"
}

async function copiarTexto(texto, etiqueta = "Texto") {
    try {
        await navigator.clipboard.writeText(texto)
        mostrarNotificacion("exito", `${etiqueta} copiado`)
    } catch (error) {
        console.error("Error copiando:", error)
        mostrarNotificacion("error", `No se pudo copiar ${etiqueta.toLowerCase()}`)
    }
}

function calcularDiasHasta(diaMes) {
    if (!diaMes || diaMes < 1 || diaMes > 31) return null

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const crear = (anio, mes) => {
        const ultimo = new Date(anio, mes + 1, 0).getDate()
        return new Date(anio, mes, Math.min(diaMes, ultimo))
    }

    let fecha = crear(hoy.getFullYear(), hoy.getMonth())
    if (fecha < hoy) fecha = crear(hoy.getFullYear(), hoy.getMonth() + 1)
    const dias = Math.round((fecha - hoy) / 86400000)
    return { dias, fecha: fecha.toLocaleDateString("es-PE") }
}

// ============================================
// LASTRAR
// ============================================

function actualizarLastbar() {
    const editBtn = document.querySelector('.lastbar .item[data-accion="editar-cuenta"]')
    const archBtn = document.querySelector('.lastbar .item[data-accion="archivar-cuenta"]')

    const activo = !!cuentaSeleccionada
    editBtn?.classList.toggle("desact", !activo)
    archBtn?.classList.toggle("desact", !activo)
}

// ============================================
// ACCIONES EXPORTADAS PARA LASTBAR
// ============================================

export function abrirModalCrearCuenta() {
    uid = sesion.uid
    _abrirModalCrearCuentaDosPasos()
}

export function editarCuentaSeleccionada() {
    if (!cuentaSeleccionada) {
        mostrarNotificacion("info", "Selecciona una cuenta primero")
        return
    }
    _abrirModalEditarCuenta(cuentaSeleccionada)
}

export function archivarCuentaSeleccionada() {
    if (!cuentaSeleccionada) {
        mostrarNotificacion("info", "Selecciona una cuenta primero")
        return
    }

    const cuenta = cuentaSeleccionada

    // No hay rama de "desarchivar" aquí: las cuentas archivadas no se listan
    // ni se pueden seleccionar, así que restaurar pasa por
    // Configuración › Datos (js/ui/configuracion.js).

    const saldo = saldoParaRegla(cuenta)
    if (saldo !== 0) {
        abrirModal({
            titulo: "No se puede archivar en cero",
            contenido: contenidoDesdeTemplate(
                cuenta.tipo === "credito" ? "tpl-archivar-en-cero-credito" : "tpl-archivar-en-cero",
                { valores: { nombre: cuenta.nombre } }
            ),
            variante: "confirm",
            confirmText: "Forzar archivo",
            cancelText: "Cancelar",
            onConfirm: () => {
                cambiarEstadoCuenta(cuenta.id, "archivada")
                mostrarNotificacion(
                    "warning",
                    "Cuenta archivada a la fuerza: revisa movimientos, posiciones, trades, órdenes, pendientes y metas relacionados"
                )
                return true
            }
        })
        return
    }

    abrirModal({
        titulo: "Archivar cuenta",
        contenido: contenidoDesdeTemplate("tpl-confirmar-cuenta", {
            valores: { pregunta: "¿Archivar la cuenta", nombre: cuenta.nombre }
        }),
        variante: "confirm",
        confirmText: "Archivar",
        cancelText: "Cancelar",
        onConfirm: () => {
            cambiarEstadoCuenta(cuenta.id, "archivada")
            return true
        }
    })
}

// Saldo que importa para la regla de archivo/eliminación según el tipo:
// · cuenta normal → saldo inicial
// · tarjeta de crédito → deuda (debe estar en 0 → disponible = línea)
function saldoParaRegla(cuenta) {
    return cuenta.tipo === "credito"
        ? (cuenta.deuda || 0)
        : (cuenta.saldoInicial || 0)
}

async function cambiarEstadoCuenta(id, estado) {
    try {
        await actualizarCuenta(uid, id, { estado })
        // Archivar el padre archiva también a sus hijas.
        const raiz = cuentas.find(c => c.id === id)
        if (raiz) {
            for (const h of familiaDe(raiz, cuentas).filter(c => c.id !== id)) {
                await actualizarCuenta(uid, h.id, { estado })
            }
        }
        await cargarCuentas()
        mostrarNotificacion("exito", estado === "activa" ? "Cuenta desarchivada" : "Cuenta archivada")
    } catch (error) {
        console.error(`Error cambiando estado a "${estado}":`, error)
        mostrarNotificacion("error", `No se pudo cambiar el estado: ${error.message}`)
    }
}

export function eliminarCuentaSeleccionada() {
    if (!cuentaSeleccionada) {
        mostrarNotificacion("info", "Selecciona una cuenta primero")
        return
    }
    const cuenta = cuentaSeleccionada
    // Eliminar se bloquea si tiene hijas: primero las subcuentas.
    if (familiaDe(cuenta, cuentas).some(c => c.id !== cuenta.id)) {
        mostrarNotificacion("warning", "Elimina primero las subcuentas de esta cuenta")
        return
    }
    const saldo = saldoParaRegla(cuenta)
    if (saldo !== 0) {
        mostrarNotificacion(
            "warning",
            cuenta.tipo === "credito"
                ? `Solo se puede eliminar una tarjeta con la deuda en 0 (deuda actual: ${saldo})`
                : `Solo se puede eliminar una cuenta con saldo 0 (saldo actual: ${saldo})`
        )
        return
    }

    abrirModal({
        titulo: "Eliminar cuenta",
        contenido: contenidoDesdeTemplate("tpl-confirmar-cuenta", {
            valores: { pregunta: "¿Eliminar definitivamente la cuenta", nombre: cuenta.nombre }
        }),
        variante: "confirm",
        confirmText: "Eliminar",
        cancelText: "Archivar en su lugar",
        onCancel: () => {
            archivarCuentaSeleccionada()
        },
        onConfirm: async () => {
            try {
                const snapshot = { ...cuenta }
                await eliminarCuenta(uid, cuenta.id)
                await cargarCuentas()
                ofrecerDeshacer({
                    mensaje: `Cuenta "${cuenta.nombre}" eliminada. ¿Deshacer?`,
                    restaurar: () => restaurarDocumento(uid, "cuentas", snapshot.id, snapshot),
                    alRestaurar: () => cargarCuentas()
                })
                return true
            } catch (error) {
                console.error("Error eliminando cuenta:", error)
                mostrarNotificacion("error", `No se pudo eliminar la cuenta: ${error.message}`)
                return false
            }
        }
    })
}

function mostrarVacio() {
    const panel = document.getElementById("panel")
    if (!panel) return
    // Si lo único que hay son cuentas archivadas, el mensaje tiene que decir
    // dónde recuperarlas: si no, el usuario ve un vacío sin salida.
    const hayArchivadas = cuentasArchivadas.length > 0
    if (hayArchivadas) {
        const n = cuentasArchivadas.length
        panel.replaceChildren(contenidoDesdeTemplate("tpl-cuentas-vacio-archivadas", {
            valores: { cantidad: n, plural: n === 1 ? "" : "s", plural2: n === 1 ? "" : "s" }
        }))
    } else {
        panel.replaceChildren(contenidoDesdeTemplate("tpl-cuentas-vacio"))
    }
}

// ============================================
// EVENTOS (doble clic para editar)
// ============================================

function configurarEventos() {
    const sidebar = document.getElementById("sidebar")

    sidebar?.addEventListener("dblclick", (event) => {
        const btn = event.target.closest('button[name="cta"]')
        if (!btn) return
        const btnId = btn.dataset.id

        const cuenta = cuentas.find(c => c.id === btnId)
        if (cuenta) {
            _abrirModalEditarCuenta(cuenta)
        }
    })
}

// ============================================
// MODAL CREAR CUENTA (interno)
// ============================================

const esTipoTarjeta = tipo => tipo === "credito" || tipo === "debito"

function campoFechaAnualidad(id, value = "") {
    return contenidoDesdeTemplate("tpl-campo-fecha-anualidad", {
        valores: { "input@id": id, "input@value": value }
    })
}

// Formulario completo de "Nueva cuenta" para un tipo. Lo comparten el flujo de
// dos pasos y el formulario directo del selector de tipo: misma plantilla, mismos
// huecos, una sola fuente de verdad.
function plantillaFormCrearCuenta(tipo) {
    return contenidoDesdeTemplate("tpl-form-crear-cuenta", {
        valores: {
            "tipo@value": tipo,
            "nombre@placeholder": PLACEHOLDER_NOMBRE_POR_TIPO[tipo] || PLACEHOLDER_NOMBRE_POR_TIPO.broker,
            "patrimonio@checked": tipo !== "credito",
            "bloque-uid@hidden": tipo !== "exchange"
        },
        html: {
            saldos: tipo === "credito" ? "" : campoSaldosPorDivisa("pen"),
            vencimiento: campoVencimiento("campo"),
            "anualidad-fecha": campoFechaAnualidad("campo-anualidad-fecha")
        }
    })
}

const TIPOS_CUENTA_CREACION = [
    { id: "efectivo", nombre: "Efectivo", icono: "banknote" },
    { id: "broker", nombre: "Broker", icono: "trending-up" },
    { id: "exchange", nombre: "Exchange", icono: "arrow-left-right" },
    { id: "plazo", nombre: "Depósito a plazo", icono: "landmark" },
    { id: "credito", nombre: "Tarjeta de crédito", icono: "credit-card" },
    { id: "debito", nombre: "Tarjeta de débito", icono: "credit-card" }
]

// El ejemplo del nombre tiene que encajar con lo que se está creando: "Ej:
// BBVA, BCP..." en una cuenta de efectivo no dice nada. Los de tipo tarjeta
// tampoco, porque el nombre es lo que el usuario elige para distinguirla, no
// el banco emisor.
const PLACEHOLDER_NOMBRE_POR_TIPO = {
    efectivo: "Ej: Efectivo",
    broker: "Ej: Broker principal...",
    exchange: "Ej: Exchange principal...",
    plazo: "Ej: Depósito BCP...",
    credito: "Ej: Tarjeta BCP...",
    debito: "Ej: Débito BBVA..."
}

/**
 * Deja el nombre en una columna y lo estira a dos solo si hace falta.
 *
 * Los formularios van en rejilla de dos columnas, así que un número impar de
 * celdas deja media fila vacía al final. Se cuentan CELDAS (un .form-group vale
 * 1, un .form-group.full vale 2) y, si el total es impar, el nombre se estira
 * para ocupar las dos y la rejilla queda llena. Es el mismo criterio que usa
 * el selector de tipo de movimiento para su botón de "error".
 *
 * Se cuenta en celdas y no en campos a propósito: el campo "Fecha de
 * anualidad" ocupa dos columnas y por eso el formulario de crédito suma 15
 * celdas, no 13, y sin contar así quedaría un hueco al final.
 */
function ajustarAnchoNombre(formulario) {
    if (!formulario) return
    const grupos = [...formulario.querySelectorAll(".form-group")]
    const nombre = grupos.find(grupo => grupo.querySelector("#campo-nombre"))
    if (!nombre) return

    const celdas = grupos
        .filter(grupo => !grupo.hidden)
        .reduce((total, grupo) => total + (grupo.classList.contains("full") ? 2 : 1), 0)

    // El nombre entra en el recuento como una celda; si el total es impar se
    // le da la segunda y todo empareja.
    nombre.classList.toggle("full", celdas % 2 === 1)
}

function _abrirModalCrearCuentaDosPasos() {
    let tipoSeleccionado = null
    let paso = 1

    const paso1 = () => contenidoDesdeTemplate("tpl-selector-tipo-cuenta", {
        html: {
            opciones: contenidoDesdeFilas("tpl-tipo-cuenta-opcion", TIPOS_CUENTA_CREACION, tipo => ({
                valores: { "tipo@data-tipo": tipo.id, nombre: tipo.nombre },
                html: { icono: icono(tipo.icono, 22) }
            }))
        }
    })

    const formulario = tipo => plantillaFormCrearCuenta(tipo)

    const modalEl = abrirModal({
        titulo: "Nueva cuenta",
        contenido: paso1(),
        variante: "wide",
        confirmText: null,
        cancelText: null,
        onCancel: null,
        onConfirm: async () => {
            if (paso === 1) {
                if (!tipoSeleccionado) {
                    mostrarNotificacion("warning", "Selecciona un tipo de cuenta")
                    return false
                }
                paso = 2
                modalEl.querySelector(".modal-title").textContent = "Nueva cuenta"
                modalEl.querySelector(".modal-body").replaceChildren(formulario(tipoSeleccionado))
                const confirmar = modalEl.querySelector("#modal-confirm")
                if (confirmar) confirmar.textContent = "Crear cuenta"
                const esCredito = tipoSeleccionado === "credito"
                const esTarjeta = esCredito || tipoSeleccionado === "debito"
                modalEl.querySelectorAll(".credit-only").forEach(el => { el.hidden = !esCredito })
                modalEl.querySelectorAll(".card-only").forEach(el => { el.hidden = !esTarjeta })
                // Se ajusta DESPUES de mostrar/ocultar los grupos condicionales:
                // el recuento solo mira los visibles, y estos acaban de cambiar.
                ajustarAnchoNombre(modalEl.querySelector("#form-crear-cuenta"))
                conectarToggleDivisas(modalEl)
                conectarVencimiento(modalEl, "campo")
                modalEl.querySelector("#cuenta-paso-atras")?.addEventListener("click", () => {
                    paso = 1
                    tipoSeleccionado = null
                    modalEl.querySelector(".modal-title").textContent = "Nueva cuenta"
                    modalEl.querySelector(".modal-body").replaceChildren(paso1())
                    const boton = modalEl.querySelector("#modal-confirm")
                    if (boton) boton.textContent = "Continuar"
                    modalEl.querySelectorAll(".cuenta-tipo-opcion").forEach(opcion => {
                        opcion.addEventListener("click", () => {
                            tipoSeleccionado = opcion.dataset.tipo
                            modalEl.querySelectorAll(".cuenta-tipo-opcion").forEach(otra => {
                                otra.classList.toggle("seleccionada", otra === opcion)
                            })
                        })
                    })
                })
                modalEl.querySelector("#campo-nombre")?.focus()
                return false
            }

            const nombre = modalEl.querySelector("#campo-nombre")?.value.trim()
            const tipo = tipoSeleccionado
            const toggles = modalEl.querySelectorAll(".toggle-option")
            const divisasSeleccionadas = Array.from(toggles).filter(t => t.classList.contains("active")).map(t => t.dataset.divisa)
            const numDivisasSeleccionadas = divisasSeleccionadas.length
            const saldos = leerSaldosPorDivisa(modalEl)
            if (!nombre) {
                mostrarNotificacion("warning", "El nombre es obligatorio")
                return false
            }

            let monedaCuenta
            let conSubcuentas

            if (tipo === "exchange") {
                monedaCuenta = "usdt"
                conSubcuentas = divisasSeleccionadas.filter(d => d !== "usdt").length > 0
            } else if (numDivisasSeleccionadas >= 2) {
                monedaCuenta = divisasSeleccionadas[0]
                conSubcuentas = true
            } else if (numDivisasSeleccionadas === 1) {
                monedaCuenta = divisasSeleccionadas[0]
                conSubcuentas = false
            } else {
                monedaCuenta = tipo === "exchange" ? "usdt" : "pen"
                conSubcuentas = false
            }

            const datos = {
                nombre: normalizarNombre(nombre),
                tipo,
                moneda: monedaCuenta,
                estado: "activa",
                esPatrimonio: modalEl.querySelector("#campo-esPatrimonio")?.checked === true,
                orden: cuentas.length,
                // No se guarda en Firestore: `crearCuentaConSubcuentas` lo usa
                // para crear las hijas y lo descarta al escribir el padre.
                divisasExtras: conSubcuentas ? divisasSeleccionadas.filter(d => d !== monedaCuenta) : []
            }
            // `conSubcuentas` no se escribe en el documento: que una cuenta
            // tenga subcuentas no es un campo, es la existencia de hijas con
            // `padreId` apuntando aqui.

            if (tipo === "credito") {
                datos.limite = parseFloat(modalEl.querySelector("#campo-limite")?.value) || 0
                datos.deuda = 0
                datos.desgravamen = parseFloat(modalEl.querySelector("#campo-desgravamen")?.value) || 0.34
                datos.diaCorte = parseInt(modalEl.querySelector("#campo-diaCorte")?.value) || 10
                datos.diaPago = parseInt(modalEl.querySelector("#campo-diaPago")?.value) || 6
                datos.umbralAviso = parseInt(modalEl.querySelector("#campo-umbralAviso")?.value) || 30
                datos.umbralCritico = parseInt(modalEl.querySelector("#campo-umbralCritico")?.value) || 70
                datos.anualidad = parseFloat(modalEl.querySelector("#campo-anualidad")?.value) || 0
                const anualidadFecha = modalEl.querySelector("#campo-anualidad-fecha")?.value
                if (datos.anualidad > 0 && anualidadFecha) {
                    const [, mes, dia] = anualidadFecha.split("-").map(Number)
                    datos.anualidadFecha = `${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
                }
                datos.avisoUsoEnviado = false
                datos.avisoCriticoEnviado = false
            }

            if (esTipoTarjeta(tipo)) {
                datos.num = soloDigitos(modalEl.querySelector("#campo-num-tarjeta")?.value) || ""
                datos.vence = leerVencimiento(modalEl, "campo")
            }
            if (tipo === "exchange") {
                datos.uid = modalEl.querySelector("#campo-uid")?.value.trim() || ""
            }

            try {
                // Padre + una hija por cada divisa extra, en una sola operacion.
                const creada = await crearCuentaConSubcuentas(uid, datos, saldos, {
                    esCredito: tipo === "credito"
                })
                await cargarCuentas()
                await seleccionarCuenta(creada.id)
                mostrarNotificacion(
                    "exito",
                    datos.divisasExtras.length > 0
                        ? `Cuenta creada con ${datos.divisasExtras.length + 1} subcuentas`
                        : "Cuenta creada"
                )
                avisarVersionInversionista()
                return true
            } catch (error) {
                console.error("Error creando cuenta:", error)
                mostrarNotificacion("error", `No se pudo crear la cuenta: ${error.message}`)
                return false
            }
        }
    })

    modalEl.querySelectorAll(".cuenta-tipo-opcion").forEach(boton => {
        boton.addEventListener("click", () => {
            cerrarModal()
            abrirFormularioCrearCuenta(boton.dataset.tipo)
        })
    })
}

function abrirFormularioCrearCuenta(tipo) {
    const esCredito = tipo === "credito"
    const esTarjeta = esCredito || tipo === "debito"

    const modal = abrirModal({
        titulo: `Nueva cuenta · ${nombreTipo(tipo)}`,
        contenido: plantillaFormCrearCuenta(tipo),
        variante: "form",
        confirmText: "Crear cuenta",
        cancelText: "Cancelar",
        onConfirm: async () => {
            const nombre = modal.querySelector("#campo-nombre")?.value.trim()
            const toggles = modal.querySelectorAll(".toggle-option")
            const divisasSeleccionadas = Array.from(toggles).filter(t => t.classList.contains("active")).map(t => t.dataset.divisa)
            const numDivisasSeleccionadas = divisasSeleccionadas.length
            const saldos = leerSaldosPorDivisa(modal)
            if (!nombre) {
                mostrarNotificacion("warning", "El nombre es obligatorio")
                return false
            }

            let monedaCuenta
            let conSubcuentas

            if (tipo === "exchange") {
                monedaCuenta = "usdt"
                conSubcuentas = divisasSeleccionadas.filter(d => d !== "usdt").length > 0
            } else if (numDivisasSeleccionadas >= 2) {
                monedaCuenta = divisasSeleccionadas[0]
                conSubcuentas = true
            } else if (numDivisasSeleccionadas === 1) {
                monedaCuenta = divisasSeleccionadas[0]
                conSubcuentas = false
            } else {
                monedaCuenta = tipo === "exchange" ? "usdt" : "pen"
                conSubcuentas = false
            }

            const datos = {
                nombre: normalizarNombre(nombre),
                tipo,
                moneda: monedaCuenta,
                estado: "activa",
                esPatrimonio: modal.querySelector("#campo-esPatrimonio")?.checked === true,
                orden: cuentas.length,
                // No se guarda en Firestore: `crearCuentaConSubcuentas` lo usa
                // para crear las hijas y lo descarta al escribir el padre.
                divisasExtras: conSubcuentas ? divisasSeleccionadas.filter(d => d !== monedaCuenta) : []
            }
            // `conSubcuentas` no se escribe en el documento: que una cuenta
            // tenga subcuentas no es un campo, es la existencia de hijas con
            // `padreId` apuntando aqui.
            if (esCredito) {
                datos.limite = parseFloat(modal.querySelector("#campo-limite")?.value) || 0
                datos.deuda = 0
                datos.desgravamen = parseFloat(modal.querySelector("#campo-desgravamen")?.value) || 0.34
                datos.diaCorte = parseInt(modal.querySelector("#campo-diaCorte")?.value) || 10
                datos.diaPago = parseInt(modal.querySelector("#campo-diaPago")?.value) || 6
                datos.umbralAviso = parseInt(modal.querySelector("#campo-umbralAviso")?.value) || 30
                datos.umbralCritico = parseInt(modal.querySelector("#campo-umbralCritico")?.value) || 70
                datos.anualidad = parseFloat(modal.querySelector("#campo-anualidad")?.value) || 0
                const anualidadFecha = modal.querySelector("#campo-anualidad-fecha")?.value
                if (datos.anualidad > 0 && anualidadFecha) {
                    const [, mes, dia] = anualidadFecha.split("-").map(Number)
                    datos.anualidadFecha = `${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
                }
                datos.avisoUsoEnviado = false
                datos.avisoCriticoEnviado = false
            }
            if (esTarjeta) {
                datos.num = soloDigitos(modal.querySelector("#campo-num-tarjeta")?.value) || ""
                datos.vence = leerVencimiento(modal, "campo")
            }
            if (tipo === "exchange") {
                datos.uid = modal.querySelector("#campo-uid")?.value.trim() || ""
            }

            // Número de cuenta y CCI NO se piden aquí. Una cuenta con varias
            // divisas genera una subcuenta por divisa, y cada una tiene el
            // suyo: meter aquí un solo campo obligaría a elegir a cuál de las
            // hijas pertenecía. Se rellenan en la configuración de cada
            // subcuenta, una vez creadas todas.
            try {
                const creada = await crearCuentaConSubcuentas(uid, datos, saldos, {
                    esCredito: tipo === "credito"
                })
                await cargarCuentas()
                await seleccionarCuenta(creada.id)
                mostrarNotificacion(
                    "exito",
                    datos.divisasExtras.length > 0
                        ? `Cuenta creada con ${datos.divisasExtras.length + 1} subcuentas`
                        : "Cuenta creada"
                )
                avisarVersionInversionista()
                return true
            } catch (error) {
                console.error("Error creando cuenta:", error)
                mostrarNotificacion("error", `No se pudo crear la cuenta: ${error.message}`)
                return false
            }
        }
    })
    modal.querySelectorAll(".credit-only").forEach(el => { el.hidden = !esCredito })
    modal.querySelectorAll(".card-only").forEach(el => { el.hidden = !esTarjeta })
    modal.querySelector("#campo-nombre")?.focus()
    ajustarAnchoNombre(modal.querySelector("#form-crear-cuenta"))
    conectarToggleDivisas(modal)
    conectarVencimiento(modal, "campo")
}

// ============================================
// AVISO · VERSIÓN INVERSIONISTA
// ============================================
// Al crear una cuenta, invita una sola vez a activar Inversiones y Trading
// (que un usuario nuevo tiene ocultas). El aviso se recuerda en localStorage
// para no repetirse en cada cuenta.

const CLAVE_AVISO_INVERSIONISTA = "escinco_aviso_inversionista"

function avisarVersionInversionista() {
    try {
        if (localStorage.getItem(CLAVE_AVISO_INVERSIONISTA) === "1") return
    } catch (e) {
        return
    }
    const paginas = sesion.getPaginasVisibles()
    // Solo si el usuario todavia no tiene la version inversionista.
    if (paginas.inversiones !== false || paginas.trading !== false) return
    try {
        localStorage.setItem(CLAVE_AVISO_INVERSIONISTA, "1")
    } catch (e) {}
    mostrarNotificacion(
        "info",
        "¿Eres inversionista? Esto te interesa",
        0,
        [{ texto: "Ver qué incluye", primaria: true, alClick: abrirModalVersionInversionista }]
    )
}

function abrirModalVersionInversionista() {
    abrirModal({
        titulo: "Versión inversionista",
        variante: "narrow",
        contenido: contenidoDesdeTemplate("tpl-info-inversionista", {
            html: {
                "icono-inversiones": icono("chart-candlestick", 18),
                "icono-trading": icono("coins", 18)
            }
        }),
        confirmText: "Habilitar estas funciones",
        cancelText: "Ahora no",
        onConfirm: async () => {
            await habilitarVersionInversionista()
            return true
        }
    })
}

async function habilitarVersionInversionista() {
    try {
        if (sesion.uid) {
            await aplicarPreferenciasDiff(sesion.uid, {
                set: { "paginas.inversiones": true, "paginas.trading": true }
            })
        }
    } catch (error) {
        console.error("No se pudo habilitar la versión inversionista:", error)
        mostrarNotificacion("error", "No se pudieron habilitar las funciones")
        return
    }
    sesion.setPreferencias({ paginas: { inversiones: true, trading: true } })
    document.querySelectorAll(".nav-container a").forEach(link => {
        const page = link.dataset.page
        if (page === "inversiones" || page === "trading") link.classList.remove("nav-oculto")
    })
    mostrarNotificacion("exito", "Inversiones y Trading habilitados")
}

// ============================================
// MODAL EDITAR CUENTA (interno)
// ============================================

function _abrirModalEditarCuenta(cuenta) {
    const esExchange = cuenta.tipo === "exchange"
    const esCredito = cuenta.tipo === "credito"
    const esDebito = cuenta.tipo === "debito"
    const esBroker = cuenta.tipo === "broker"
    const permisoMoneda = !esCredito && !esExchange
    const esArchivada = cuenta.estado === "archivada"
    const saldoParaEliminar = saldoParaRegla(cuenta)
    const familia = familiaDe(cuenta, cuentas)
    const abstracta = esAbstracta(cuenta)
    const conFamilia = familia.length > 1 || abstracta
    // Miembros editables como subcuenta: en familia abstracta son las hijas;
    // en legacy, el padre (primero) más las hijas. En cuenta simple no hay.
    const miembros = !conFamilia ? [] : familia
    const divisasYaUsadas = conFamilia
        ? familia.map(c => (c.moneda || "pen").toLowerCase())
        : [(cuenta.moneda || "pen").toLowerCase()]
    const partesAnualidad = String(cuenta.anualidadFecha || "").split("-").map(Number)
    const anualidadFechaInput = partesAnualidad.length === 2 && partesAnualidad.every(Number.isFinite)
        ? `${new Date().getFullYear()}-${String(partesAnualidad[0]).padStart(2, "0")}-${String(partesAnualidad[1]).padStart(2, "0")}`
        : ""

    const tabs = [
        { id: "general", etiqueta: "Cuenta" },
        ...miembros.map(m => ({ id: m.id, etiqueta: etiquetaDivisa(m.moneda) }))
    ]

    const tabsHTML = contenidoDesdeFilas("tpl-edit-tab", tabs.map((t, i) => ({ ...t, activo: i === 0 })), t => ({
        valores: {
            "tab@data-tab": t.id,
            "tab@class": `edit-tab${t.activo ? " active" : ""}`,
            "tab@aria-selected": t.activo,
            "tab": t.etiqueta
        }
    }))

    const DIVISAS = ["pen", "usd", "eur", "usdt"]
    const divisasHTML = permisoMoneda
        ? contenidoDesdeTemplate("tpl-edit-divisas", {
            html: {
                opciones: contenidoDesdeFilas("tpl-divisa-toggle", DIVISAS, d => ({
                    valores: {
                        "toggle@data-divisa": d,
                        "toggle@class": `toggle-option${divisasYaUsadas.includes(d) ? " active" : ""}`,
                        "toggle": d.toUpperCase()
                    }
                }))
            }
        })
        : null

    // Campos de número/CCI de una instancia según el tipo.
    const camposNumeroInstancia = (m, prefijo) => {
        if (!esBroker && !esDebito) return null
        const idNum = esBroker ? `${prefijo}-num` : `${prefijo}-numcuenta`
        const valorNum = esBroker ? (m.num || "") : (m.numeroCuenta || "")
        return contenidoDesdeTemplate("tpl-member-num", {
            valores: {
                "lbl-num@for": idNum,
                "num@id": idNum,
                "num@value": valorNum,
                "lbl-cci@for": `${prefijo}-cci`,
                "cci@id": `${prefijo}-cci`,
                "cci@value": m.cci || ""
            }
        })
    }

    // Panel de una subcuenta: nombre propio (vacío = derivado), saldo,
    // número/CCI y patrimonio, todo propio de la instancia.
    const panelMiembro = (m) => {
        const esPadre = m.id === cuenta.id
        const etiqueta = etiquetaDivisa(m.moneda)
        const prefijo = `esub-${m.id}`
        return contenidoDesdeTemplate("tpl-member-panel", {
            valores: {
                "panel@data-panel": m.id,
                "panel@hidden": true,
                "lbl-saldo@for": `${prefijo}-saldo`,
                "saldo@id": `${prefijo}-saldo`,
                "saldo@value": m.saldoInicial || 0,
                "lbl-patrimonio@for": `${prefijo}-patrimonio`,
                "patrimonio@id": `${prefijo}-patrimonio`,
                "patrimonio@checked": m.esPatrimonio !== false
            },
            html: {
                nombre: esPadre ? null : contenidoDesdeTemplate("tpl-member-nombre", {
                    valores: {
                        "label@for": `${prefijo}-nombre`,
                        "input@id": `${prefijo}-nombre`,
                        "input@value": m.tieneNombrePropio ? m.nombre : "",
                        "input@placeholder": `${cuenta.nombre} ${etiqueta}`
                    }
                }),
                numeros: camposNumeroInstancia(m, prefijo)
            }
        })
    }

    const miembrosFrag = document.createDocumentFragment()
    miembros.forEach(m => miembrosFrag.appendChild(panelMiembro(m)))

    const contenido = contenidoDesdeTemplate("tpl-editar-cuenta", {
        valores: {
            "nombre@value": cuenta.nombre || "",
            "esPatrimonio@checked": cuenta.esPatrimonio !== false,
            "bloque-saldo@hidden": conFamilia,
            "saldo@value": cuenta.saldoInicial || 0,
            "bloque-crypto@hidden": !esExchange,
            "bloque-credito@hidden": !esCredito,
            "limite@value": cuenta.limite || 0,
            "desgravamen@value": cuenta.desgravamen || 0.34,
            "diaCorte@value": cuenta.diaCorte || 10,
            "diaPago@value": cuenta.diaPago || 6,
            "anualidad@value": cuenta.anualidad || 0,
            "umbralAviso@value": cuenta.umbralAviso || 30,
            "umbralCritico@value": cuenta.umbralCritico || 70,
            "bloque-tarjeta@hidden": !(esCredito || esDebito),
            "numTarjeta@value": agruparTarjeta(cuenta.num || ""),
            "bloque-broker@hidden": !(esBroker && !conFamilia),
            "num@value": cuenta.num || "",
            "cci@value": cuenta.cci || "",
            "bloque-exchange@hidden": !esExchange,
            "uid@value": cuenta.uid || "",
            "bloque-debito@hidden": !(esDebito && !conFamilia),
            "numeroCuenta@value": cuenta.numeroCuenta || "",
            "cciDebito@value": cuenta.cci || ""
        },
        html: {
            tabs: tabsHTML,
            divisas: divisasHTML,
            "anualidad-fecha": campoFechaAnualidad("edit-anualidad-fecha", anualidadFechaInput),
            vencimiento: campoVencimiento("edit", cuenta.vence || ""),
            miembros: miembrosFrag
        }
    })

    const modalEditar = abrirModal({
        titulo: `Editar ${cuenta.nombre}`,
        contenido,
        variante: "form",
        confirmText: "Guardar cambios",
        // Las acciones destructivas salen en el footer, a la izquierda de
        // Guardar, y no dentro del formulario: asi no se leen como un campo
        // mas y no se desplazan al final de un formulario largo.
        footerExtra: contenidoDesdeTemplate("tpl-editar-cuenta-footer", {
            html: {
                archivar: esArchivada ? null : contenidoDesdeTemplate("tpl-btn-archivar-cuenta"),
                eliminar: saldoParaEliminar === 0 ? contenidoDesdeTemplate("tpl-btn-eliminar-cuenta") : null
            }
        }),
        onConfirm: async () => {
            const nombre = modalEditar.querySelector("#edit-nombre")?.value.trim()

            if (!nombre) {
                mostrarNotificacion("warning", "El nombre es obligatorio")
                return false
            }

            const datos = { nombre: normalizarNombre(nombre) }

            // Muestra la actualidad: lee el switch del propio modal.
            datos.esPatrimonio = modalEditar.querySelector("#edit-esPatrimonio")?.checked === true

            const toggles = modalEditar.querySelectorAll(".toggle-option")
            const divisasSeleccionadas = Array.from(toggles).filter(t => t.classList.contains("active")).map(t => t.dataset.divisa)

            const divisaActual = (cuenta.moneda || "pen").toLowerCase()
            const divisasExistentes = conFamilia
                ? familia.map(c => (c.moneda || "pen").toLowerCase())
                : [divisaActual]
            const divisasParaAnadir = (permisoMoneda ? divisasSeleccionadas : [])
                .filter(d => !divisasExistentes.includes(d))

            if (esCredito) {
                datos.limite = parseFloat(modalEditar.querySelector("#edit-limite")?.value) || 0
                datos.desgravamen = parseFloat(modalEditar.querySelector("#edit-desgravamen")?.value) || 0.34
                datos.diaCorte = parseInt(modalEditar.querySelector("#edit-diaCorte")?.value) || 10
                datos.diaPago = parseInt(modalEditar.querySelector("#edit-diaPago")?.value) || 6
                datos.umbralAviso = parseInt(modalEditar.querySelector("#edit-umbralAviso")?.value) || 30
                datos.umbralCritico = parseInt(modalEditar.querySelector("#edit-umbralCritico")?.value) || 70
                datos.anualidad = parseFloat(modalEditar.querySelector("#edit-anualidad")?.value) || 0
                const anualidadFecha = modalEditar.querySelector("#edit-anualidad-fecha")?.value
                if (datos.anualidad > 0 && anualidadFecha) {
                    const [, mes, dia] = anualidadFecha.split("-").map(Number)
                    datos.anualidadFecha = `${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
                } else {
                    datos.anualidadFecha = ""
                }
            }

            if (esCredito || esDebito) {
                datos.num = soloDigitos(modalEditar.querySelector("#edit-num-tarjeta")?.value) || ""
                datos.vence = leerVencimiento(modalEditar, "edit")
            }

            if (esExchange) {
                datos.uid = modalEditar.querySelector("#edit-uid")?.value.trim() || ""
                datos.num = ""
                datos.cci = ""
            }

            // Cuenta simple: saldo y número/CCI viven en el propio documento.
            if (!conFamilia) {
                if (!esCredito) {
                    datos.saldoInicial = Number(modalEditar.querySelector("#edit-saldo")?.value) || 0
                }
                if (esBroker) {
                    datos.num = soloDigitos(modalEditar.querySelector("#edit-num")?.value) || ""
                    datos.cci = soloDigitos(modalEditar.querySelector("#edit-cci")?.value) || ""
                }
                if (esDebito) {
                    datos.numeroCuenta = soloDigitos(modalEditar.querySelector("#edit-num-cuenta")?.value) || ""
                    datos.cci = soloDigitos(modalEditar.querySelector("#edit-cci-debito")?.value) || ""
                }
            }

            try {
                await actualizarCuenta(uid, cuenta.id, datos)
                Object.assign(cuenta, datos)
                // Simple que gana divisas: migra a abstracta conservando el
                // saldo, número e historial en una hija de su divisa.
                if (divisasParaAnadir.length > 0 && !conFamilia) {
                    await migrarPadreASubcuenta(uid, cuenta, cuentas.length)
                    for (let i = 0; i < divisasParaAnadir.length; i++) {
                        await crearCuenta(uid, {
                            tipo: cuenta.tipo,
                            moneda: divisasParaAnadir[i],
                            saldoInicial: 0,
                            padreId: cuenta.id,
                            estado: "activa",
                            esPatrimonio: datos.esPatrimonio,
                            orden: cuentas.length + i + 1
                        })
                    }
                } else {
                    for (let i = 0; i < divisasParaAnadir.length; i++) {
                        await crearCuenta(uid, {
                            tipo: cuenta.tipo,
                            moneda: divisasParaAnadir[i],
                            saldoInicial: 0,
                            padreId: cuenta.id,
                            estado: "activa",
                            esPatrimonio: datos.esPatrimonio,
                            orden: cuentas.length + i
                        })
                    }
                }
                // Subcuentas: cada tab guarda su propia instancia.
                for (const m of miembros) {
                    const prefijo = `esub-${m.id}`
                    const parcial = {}
                    const esPadreMiembro = m.id === cuenta.id
                    if (!esPadreMiembro) {
                        const nombreSub = modalEditar.querySelector(`#${prefijo}-nombre`)?.value.trim() || ""
                        parcial.nombre = nombreSub ? normalizarNombre(nombreSub) : deleteField()
                    }
                    const saldoSub = modalEditar.querySelector(`#${prefijo}-saldo`)
                    if (saldoSub) parcial.saldoInicial = Number(saldoSub.value) || 0
                    parcial.esPatrimonio = modalEditar.querySelector(`#${prefijo}-patrimonio`)?.checked === true
                    if (esBroker) {
                        parcial.num = soloDigitos(modalEditar.querySelector(`#${prefijo}-num`)?.value) || ""
                        parcial.cci = soloDigitos(modalEditar.querySelector(`#${prefijo}-cci`)?.value) || ""
                    }
                    if (esDebito) {
                        parcial.numeroCuenta = soloDigitos(modalEditar.querySelector(`#${prefijo}-numcuenta`)?.value) || ""
                        parcial.cci = soloDigitos(modalEditar.querySelector(`#${prefijo}-cci`)?.value) || ""
                    }
                    await actualizarCuenta(uid, m.id, parcial)
                }
                await cargarCuentas()
                mostrarNotificacion("exito", "Cuenta actualizada")
                return true
            } catch (error) {
                console.error("Error actualizando cuenta:", error)
                mostrarNotificacion("error", `No se pudo guardar: ${error.message}`)
                return false
            }
        }
    })

    // Acciones secundarias: archivar y eliminar (viven en el footer)
    modalEditar.querySelector("#btn-editar-estado")?.addEventListener("click", () => {
        cerrarModal()
        archivarCuentaSeleccionada()
    })
    modalEditar.querySelector("#btn-editar-eliminar")?.addEventListener("click", () => {
        cerrarModal()
        eliminarCuentaSeleccionada()
    })

    // Exchange: añadir subcuenta cripto al momento (símbolo libre, p. ej. BTC).
    modalEditar.querySelector("#btn-crypto-anadir")?.addEventListener("click", async () => {
        const input = modalEditar.querySelector("#edit-crypto-nueva")
        const simbolo = String(input?.value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)
        if (!simbolo) {
            mostrarNotificacion("warning", "Escribe el símbolo de la cripto")
            return
        }
        const usadas = familiaDe(cuenta, cuentas).map(c => String(c.moneda || "").toUpperCase())
        if (usadas.includes(simbolo)) {
            mostrarNotificacion("info", "Esa cripto ya existe en la cuenta")
            return
        }
        try {
            const esSimple = !esAbstracta(cuenta) && !familiaDe(cuenta, cuentas).some(c => c.id !== cuenta.id)
            if (esSimple) {
                await migrarPadreASubcuenta(uid, cuenta, cuentas.length)
            }
            await crearCuenta(uid, {
                tipo: cuenta.tipo,
                moneda: simbolo.toLowerCase(),
                saldoInicial: 0,
                padreId: cuenta.id,
                estado: "activa",
                esPatrimonio: cuenta.esPatrimonio !== false,
                orden: cuentas.length + 1
            })
            await cargarCuentas()
            mostrarNotificacion("exito", `Subcuenta ${simbolo} creada`)
            cerrarModal()
            _abrirModalEditarCuenta(cuentas.find(c => c.id === cuenta.id) || cuenta)
        } catch (error) {
            console.error("Error creando subcuenta cripto:", error)
            mostrarNotificacion("error", `No se pudo crear: ${error.message}`)
        }
    })

    // Las divisas ya presentes en la cuenta quedan bloqueadas: se pueden
    // añadir subcuentas en otras, pero nunca quitar las que ya existen.
    conectarToggleDivisas(modalEditar, divisasYaUsadas)
    conectarVencimiento(modalEditar, "edit")

    // Tabs del editor: Cuenta + una por subcuenta.
    modalEditar.querySelectorAll(".edit-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            modalEditar.querySelectorAll(".edit-tab").forEach(otra => {
                const activa = otra === tab
                otra.classList.toggle("active", activa)
                otra.setAttribute("aria-selected", activa ? "true" : "false")
            })
            modalEditar.querySelectorAll(".edit-panel").forEach(panel => {
                panel.hidden = panel.dataset.panel !== tab.dataset.tab
            })
        })
    })
}
