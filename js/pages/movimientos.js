import { obtenerMovimientos, obtenerCuentas, actualizarMovimientoDoc } from "../../firebase/firestore.js"
import { cacheCapa } from "../core/cache.js"
import { asegurarEstilos } from "../core/estilos.js"
import { sesion } from "../core/sesion.js"
import { getFechaHoy } from "../core/fechas.js"
import { icono } from "../core/iconos.js"
import { skeletonMarkup } from "../ui/skeletons.js"
import { CONFIG_MOVIMIENTOS, TIPOS_MOVIMIENTO } from "../../constants/tiposMovimiento.js"
import { abrirModal, cerrarModal, estaAbierto, contenidoDesdeTemplate, contenidoDesdeFilas } from "../ui/modal.js"
import {
    generarFormularioMovimiento,
    recogerDatosFormulario,
    vincularSimboloDivisa
} from "../ui/formularioMovimiento.js"
import { registrarMovimiento, actualizarMovimiento, eliminarMovimiento, restaurarMovimiento, aplicarEtiquetasEnLote } from "../services/MovimientoServicio.js"
import { crearFavoritoDesdeMovimiento, desvincularMovimiento, esTipoFavoritable, ejecutarFavorito, editarPlantillaFavorito, eliminarFavoritoConDesvinculacion } from "../services/FavoritoServicio.js"
import { ofrecerDeshacer } from "../services/DeshacerServicio.js"
import { mostrarNotificacion } from "../ui/notificaciones.js"
import { envolverSidebar } from "../ui/colapsoSidebar.js"
import { expandirSeleccion } from "../ui/seleccion.js"
import { formatearMontoConDivisa } from "../services/DivisaServicio.js"
import { esMovimientoPositivo, montoDeMovimiento, compararMovimientosPorFecha } from "../core/movimientos.js"
import { escapeHtml } from "../core/escape.js"
import { normalizarEtiquetas } from "../core/etiquetas.js"
import { obtenerEtiquetas } from "../repositories/EtiquetaRepositorio.js"
import { obtenerFavorito, obtenerFavoritos, crearFavorito } from "../repositories/FavoritoRepositorio.js"
import { montarSelectorEtiquetas } from "../ui/etiquetas.js"

asegurarEstilos("movimientos")

let movimientos = []
let cuentas = []
let uid = null
let filtroActual = "todos"
const seleccionados = new Set()
let seleccionadosFavoritos = new Set()
// Caché de favoritos para resolver un id sin volver a Firestore, y los dos
// temporizadores de los gestos (click sostenido y doble click) sobre el
// contenedor de favoritos. Sin declarar, asignarles en un módulo (modo
// estricto siempre) lanzaba ReferenceError y `renderFavoritos()` moría.
let favoritosCache = []
let favoritoPressTimer = null
let favoritoClickTimer = null
const ordenSeleccion = []
let clickTimer = null
let supresorClick = false
let supresorClickTimer = null
let cardConAcciones = null
let eventosGlobalesListos = false

// ============================================
// RENDER
// ============================================

// Agrupa los 11 tipos en filtros: tarjetas incluye compra Y pago.
const FILTROS_DISPONIBLES = [
    { filtro: "todos", label: "Todos", icono: "list", tipos: null },
    { filtro: "ingreso", label: "Ingresos", icono: "arrow-down-left", tipos: ["ingreso"] },
    { filtro: "gasto", label: "Gastos", icono: "arrow-up-right", tipos: ["gasto"] },
    { filtro: "transferencia", label: "Transferencias", icono: "arrow-left-right", tipos: ["transferencia"] },
    { filtro: "cambioDivisa", label: "Cambio divisa", icono: "refresh-cw", tipos: ["cambioDivisa"] },
    { filtro: "inversiones", label: "Inversiones", icono: "chart-candlestick", tipos: ["compraActivo", "ventaActivo"], pagina: "inversiones" },
    { filtro: "p2p", label: "P2P", icono: "coins", tipos: ["p2pCompra", "p2pVenta"], pagina: "trading" },
    { filtro: "tarjetas", label: "Tarjetas", icono: "credit-card", tipos: ["compraTarjeta", "pagoTarjeta"] },
    { filtro: "error", label: "Errores", icono: "alert-triangle", tipos: ["error"] }
]

// Filtros visibles según las páginas habilitadas: sin inversiones ni
// trading, se ocultan sus filtros (sus movimientos se ven en "Todos").
function filtrosVisibles() {
    const paginas = sesion.getPaginasVisibles()
    return FILTROS_DISPONIBLES.filter(f => !f.pagina || paginas[f.pagina] !== false)
}

export function render() {
    const botones = filtrosVisibles()
        .map(f => `
            <button class="glass${f.filtro === "todos" ? " act" : ""}" data-filtro="${f.filtro}">
                ${icono(f.icono, 18)}<span>${f.label}</span>
            </button>
        `)
        .join("")

    return `
        ${envolverSidebar(`
            <section id="sidebar">
                ${botones}
            </section>
        `)}
        <section id="panel" class="glass">
            <div class="filtros">
                <div class="campo-buscar">
                    <input type="text" id="filtro-buscar" class="filtro-buscar" placeholder="Buscar..." aria-label="Buscar">
                    <button type="button" class="campo-buscar-limpiar" id="filtro-buscar-limpiar" title="Limpiar búsqueda" aria-label="Limpiar búsqueda" hidden>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x preview-icon">
                            <path d="M18 6 6 18"/>
                            <path d="m6 6 12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="campo-etiqueta">
                    <select id="filtro-etiqueta" class="filtro-select" aria-label="Etiquetas">
                        <option value="">Etiquetas</option>
                    </select>
                </div>
                <div class="campo-fecha">
                    <input type="date" id="filtro-desde" aria-label="Desde">
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
                <div class="campo-fecha">
                    <input type="date" id="filtro-hasta" aria-label="Hasta">
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
                <select id="filtro-cuenta" class="filtro-select" aria-label="Cuenta">
                    <option value="">Cuentas</option>
                </select>
                <select id="filtro-divisa" class="filtro-select" aria-label="Divisa">
                    <option value="">Divisas</option>
                    <option value="PEN">PEN</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="USDT">USDT</option>
                </select>
                <button type="button" class="btn-icon filtro-limpiar" id="filtro-limpiar" title="Limpiar filtros" aria-label="Limpiar filtros">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-broom preview-icon">
                        <path d="M13.5 10.5 22 2"/>
                        <path d="M14.734 13.841a2 2 0 00-.314-2.42L12.58 9.58a2 2 0 00-2.421-.314l-7.657 4.461A1 1 0 002.3 15.3l6.403 6.403a1 1 0 001.571-.204z"/>
                        <path d="m5 18 2-2"/>
                        <path d="m7.699 10.7 5.602 5.601"/>
                    </svg>
                </button>
            </div>
            <div id="totales-movimientos" class="totales" aria-busy="true">
                ${skeletonMarkup({ rows: 1, className: "skeleton-totals" })}
            </div>
            <div id="favoritos-movimientos" class="favoritos-movimientos" hidden></div>
            <div id="lista-movimientos" class="lista-cards" aria-busy="true">
                ${skeletonMarkup({ rows: 4 })}
            </div>
        </section>
    `
}

function toggleSeleccionFavorito(id) {
    if (seleccionadosFavoritos.has(id)) {
        seleccionadosFavoritos.delete(id)
    } else {
        seleccionadosFavoritos.add(id)
    }
    renderFavoritos(uid)
}

function limpiarSeleccionFavoritos() {
    seleccionadosFavoritos.clear()
    renderFavoritos(uid)
}

async function abrirFormularioConFavorito(favoritoId) {
    const favorito = favoritosCache.find(f => f.id === favoritoId)
    if (!favorito) return
    limpiarSeleccionFavoritos()
    await abrirFormularioMovimiento(favorito.tipo, null, {
        // Ojo con el nombre de la clave: `abrirFormularioMovimiento` lee
        // `opciones.valores`. Con `valoresIniciales` el formulario salía vacío
        // y el "toque" sobre el favorito perdía cuenta, importe y etiquetas.
        valores: {
            cuenta: favorito.cuenta,
            monto: favorito.monto,
            divisa: favorito.divisa,
            concepto: favorito.concepto || "",
            etiquetas: favorito.etiquetas || []
        },
        favoritoId: favorito.id
    })
}

/**
 * "Editar" con un favorito marcado: abre su plantilla y, al confirmar, guarda
 * los cambios EN la plantilla. No registra ningún movimiento —para eso está el
 * toque simple, que crea una instancia con esos datos.
 */
async function editarPlantillaFavoritoDesdeItem(favoritoId) {
    const favorito = favoritosCache.find(f => f.id === favoritoId)
    if (!favorito) return
    limpiarSeleccionFavoritos()
    await abrirFormularioMovimiento(favorito.tipo, null, {
        titulo: "Editar favorito",
        confirmText: "Guardar cambios",
        nombreFavorito: true,
        valores: {
            favoritoNombre: favorito.nombre,
            cuenta: favorito.cuenta,
            monto: favorito.monto,
            divisa: favorito.divisa,
            concepto: favorito.concepto || "",
            etiquetas: favorito.etiquetas || []
        },
        alConfirmar: async (datos, formulario) => {
            // `recogerDatosFormulario` solo devuelve los campos del movimiento;
            // el nombre del favorito es un campo añadido por este formulario.
            const nombre = formulario.querySelector("#campo-favoritoNombre")?.value || ""
            await editarPlantillaFavorito(uid, favorito, {
                nombre,
                // Un pago con tarjeta guarda la cuenta en el campo `tarjeta`, no
                // en `cuenta`: si el formulario no trae cuenta (porque no la
                // pide), se conserva la que ya tenía la plantilla en vez de
                // dejarla vacía.
                cuenta: datos.cuenta || favorito.cuenta,
                monto: datos.monto,
                divisa: datos.divisa,
                concepto: datos.concepto,
                etiquetas: datos.etiquetas
            })
            mostrarNotificacion("exito", "Favorito actualizado")
            await renderFavoritos(uid)
        }
    })
}

async function ejecutarFavoritoDesdeItem(favoritoId) {
    const favorito = favoritosCache.find(f => f.id === favoritoId)
    if (!favorito) return
    limpiarSeleccionFavoritos()
    await ejecutarFavorito(uid, favorito)
}

/**
 * Ejecuta (repite) un movimiento: si tiene favoritoId, ejecuta ese favorito;
 * si no, crea una nueva instancia con los mismos datos y fecha de hoy.
 */
async function ejecutarFavoritoDesdeMovimiento(m) {
    if (m.favoritoId) {
        const favorito = favoritosCache.find(f => f.id === m.favoritoId)
        if (favorito) {
            await ejecutarFavorito(uid, favorito)
            return
        }
    }
    // No es favorito: crear una nueva instancia con los mismos datos
    if (!esTipoFavoritable(m.tipo)) {
        mostrarNotificacion("error", `El tipo "${m.tipo}" no se puede ejecutar`)
        return
    }
    await registrarMovimiento(uid, m.tipo, {
        tipo: m.tipo,
        cuenta: m.cuenta || '',
        monto: m.monto,
        divisa: m.divisa || 'pen',
        concepto: m.concepto || '',
        etiquetas: m.etiquetas || [],
        fechaRealizacion: getFechaHoy()
    })
}

async function renderFavoritos(uid) {
    const contenedor = document.getElementById("favoritos-movimientos")
    if (!contenedor) return

    const favoritos = await obtenerFavoritos(uid)
    favoritosCache = favoritos

    // Si ya no queda ningún favorito, la selección tampoco puede seguir viva:
    // ids que apuntan a favoritos borrados dejarían la lastbar Showing un
    // contexto que no existe.
    if (favoritos.length === 0) seleccionadosFavoritos.clear()

    if (favoritos.length === 0) {
        contenedor.hidden = true
        actualizarEstadoLastbar()
        return
    }

    contenedor.hidden = false
    contenedor.replaceChildren(
        contenidoDesdeFilas("tpl-favorito-item", favoritos, f => ({
            valores: {
                "item@data-favorito-id": f.id,
                "item@class": `favorito-item${seleccionadosFavoritos.has(f.id) ? " seleccionado" : ""}`,
                nombre: f.nombre,
                tipo: f.tipo,
                monto: `${formatearMontoConDivisa(Math.abs(f.monto), f.divisa || "pen")}`
            },
            html: {
                etiquetas: contenidoDesdeFilas("tpl-badge-etiqueta", f.etiquetas || [], e => ({
                    valores: { badge: e }
                })),
                "icono-ejecutar": icono("play", 16)
            }
        }))
    )

    if (contenedor.dataset.favoritosListo !== "1") {
        contenedor.dataset.favoritosListo = "1"

        contenedor.addEventListener("pointerdown", (evento) => {
            const item = evento.target.closest(".favorito-item")
            if (!item) return
            favoritoPressTimer = setTimeout(() => {
                favoritoPressTimer = null
                const id = item.dataset.favoritoId
                if (id) toggleSeleccionFavorito(id)
            }, 500)
        })

        contenedor.addEventListener("pointerup", () => {
            if (favoritoPressTimer) {
                clearTimeout(favoritoPressTimer)
                favoritoPressTimer = null
            }
        })

        contenedor.addEventListener("click", async (evento) => {
            // Si se hizo click en el botón ejecutar del favorito, ejecutarlo
            // sin tocar la selección ni abrir el formulario.
            const btnEjecutar = evento.target.closest(".favorito-ejecutar")
            if (btnEjecutar) {
                evento.stopPropagation()
                const item = btnEjecutar.closest(".favorito-item")
                const id = item?.dataset.favoritoId
                if (id) {
                    limpiarSeleccionFavoritos()
                    await ejecutarFavoritoDesdeItem(id)
                }
                return
            }

            const item = evento.target.closest(".favorito-item")
            if (!item) return
            const id = item.dataset.favoritoId
            if (!id) return

            if (favoritoClickTimer) {
                // Doble clic: ejecutar (crear instancia) o abrir formulario
                clearTimeout(favoritoClickTimer)
                favoritoClickTimer = null
                if (seleccionadosFavoritos.has(id)) {
                    await ejecutarFavoritoDesdeItem(id)
                } else {
                    await abrirFormularioConFavorito(id)
                }
            } else {
                // Clic simple: seleccionar / deseleccionar (obvio para eliminar)
                favoritoClickTimer = setTimeout(() => {
                    favoritoClickTimer = null
                    toggleSeleccionFavorito(id)
                }, 250)
            }
        })
    }

    // Punto único de refresco de la lastbar: cualquier cambio de selección pasa
    // por aquí (alternar, limpiar, ejecutar, eliminar), así que es donde se
    // decide qué grupo de items se ve y qué dice el contexto.
    actualizarEstadoLastbar()
}


// ============================================
// INIT
// ============================================

export async function init() {
    uid = sesion.uid
    console.log("[INFO] Movimientos iniciado para UID:", uid)

    await new Promise(resolve => setTimeout(resolve, 50))
    await cargarCuentas()
    await cargarMovimientos()
    configurarEventos()
}

// ============================================

// Los movimientos sobreviven a la eliminación de su cuenta (regla de la app:
// archivar es la vía normal, y borrar la cuenta no arrastra sus movimientos).
// Cuando el id ya no resuelve, se muestra una etiqueta en vez del id en crudo,
// para que quede claro que el movimiento sigue ahí y lo que falta es la
// referencia.
const ETIQUETA_CUENTA_ELIMINADA = "Cuenta eliminada"

function nombreCuentaDeMovimiento(m) {
    const id = m.cuenta || m.cuentaOrigen || m.tarjeta
    if (!id) return ""
    const cuenta = cuentas.find(c => c.id === id)
    return cuenta?.nombre || ETIQUETA_CUENTA_ELIMINADA
}

// Construye un <option> con DOM API: el texto de usuario nunca pasa por HTML.
function opcionSelect(valor, texto) {
    const opcion = document.createElement("option")
    opcion.value = valor
    opcion.textContent = texto
    return opcion
}

async function cargarCuentas() {
    const uidActual = uid || sesion.uid
    if (!uidActual) {
        console.warn("[WARN] cargarCuentas: no hay UID de sesión")
        return
    }
    try {
        cuentas = await obtenerCuentas(uidActual)
        const select = document.getElementById("filtro-cuenta")
        if (select) {
            select.disabled = true
            select.setAttribute("aria-busy", "true")
            select.replaceChildren(
                opcionSelect("", "Cuentas"),
                ...cuentas.map(c => opcionSelect(c.id, c.nombre || c.id))
            )
        }
    } catch (error) {
        console.error("Error cargando cuentas:", error)
        mostrarNotificacion("error", "No se pudieron cargar las cuentas")
    } finally {
        const select = document.getElementById("filtro-cuenta")
        if (select) {
            select.disabled = false
            select.removeAttribute("aria-busy")
        }
    }
}

// Reconstruye las opciones del filtro de etiquetas con las que existen en los
// movimientos cargados. Conserva la selección si esa etiqueta sigue existiendo.
function actualizarOpcionesEtiquetas() {
    const select = document.getElementById("filtro-etiqueta")
    if (!select) return

    const seleccionada = select.value
    const etiquetas = new Set()
    movimientos.forEach(m => (m.etiquetas || []).forEach(e => etiquetas.add(e)))

    const ordenadas = [...etiquetas].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
    select.replaceChildren(
        opcionSelect("", "Etiquetas"),
        ...ordenadas.map(e => opcionSelect(e, e))
    )

    if (seleccionada) {
        select.value = ordenadas.includes(seleccionada) ? seleccionada : ""
    }
}

async function cargarMovimientos() {
    const container = document.getElementById("lista-movimientos")
    const totales = document.getElementById("totales-movimientos")
    container?.setAttribute("aria-busy", "true")
    totales?.setAttribute("aria-busy", "true")
    if (container) container.innerHTML = skeletonMarkup({ rows: 4 })
    if (totales) totales.innerHTML = skeletonMarkup({ rows: 1, className: "skeleton-totals" })
    try {
        movimientos = await obtenerMovimientos(uid)
        movimientos.sort(compararMovimientosPorFecha)
        limpiarSeleccion()
        actualizarOpcionesEtiquetas()
        aplicarFiltro()
        await renderFavoritos(uid)
    } catch (error) {
        console.error("Error cargando movimientos:", error)
        mostrarError()
    } finally {
        container?.removeAttribute("aria-busy")
        totales?.removeAttribute("aria-busy")
    }
}

function mostrarError() {
    const container = document.getElementById("lista-movimientos")
    if (!container) return
    container.replaceChildren(contenidoDesdeTemplate("tpl-lista-error", {
        valores: { texto: "Error al cargar movimientos" }
    }))
    // También limpiar el contenedor de totales para que no se quede con esqueleto
    const totales = document.getElementById("totales-movimientos")
    if (totales) totales.innerHTML = ""
}

// ============================================
// RENDERIZADO
// ============================================

// `cuentaId` es el ámbito desde el que se mira el movimiento: sin él, una
// transferencia o un cambio de divisa se etiquetan siempre como salida, que es
// el lado contrario del correcto en la cuenta de destino (BUG-025).
function filaMovimiento(m, cuentaId = null) {
    const monto = montoDeMovimiento(m, cuentaId)
    const esPositivo = esMovimientoPositivo(m, cuentaId)
    const signo = esPositivo ? "+" : "-"
    let clase = esPositivo ? "positive" : "negative"
    if (m.tipo === "error") clase = "ambar"
    const tipoNombre = CONFIG_MOVIMIENTOS[m.tipo]?.nombre || m.tipo || "Desconocido"
    const fecha = formatearFecha(m.fechaRealizacion)
    const cuenta = nombreCuentaDeMovimiento(m)
    const etiquetas = (m.etiquetas || []).filter(Boolean)

    return {
        valores: {
            "item@class": `card-item${seleccionados.has(m.id) ? " seleccionado" : ""}`,
            "item@data-id": m.id,
            "favorito@class": `movimiento-favorito${m.favoritoId ? " es-favorito" : ""}`,
            "favorito@data-favorito-id": m.favoritoId || "",
            "favorito@aria-label": m.favoritoId ? "Quitar de favoritos" : "Marcar como favorito",
            "favorito@title": m.favoritoId ? "Quitar de favoritos" : "Marcar como favorito",
            titulo: m.concepto || m.activo || tipoNombre || "Sin concepto",
            detalle: [fecha, cuenta].filter(Boolean).join(" · "),
        "valor@class": `card-item-valor ${clase}`,
        "valor-texto": `${signo} ${formatearMontoConDivisa(Number.isFinite(monto) ? Math.abs(monto) : 0, m.divisa || "pen")}`
        },
        html: {
            etiquetas: contenidoDesdeFilas("tpl-badge-etiqueta", etiquetas, e => ({ valores: { badge: e } })),
            "icono-editar": icono("pencil", 16),
            "icono-eliminar": icono("trash", 16),
            "icono-ejecutar": icono("play", 16),
            "icono-favorito": icono("star", 16)
        }
    }
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

// ============================================
// FILTROS
// ============================================

function configurarEventos() {
    document.querySelectorAll("#sidebar button").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#sidebar button").forEach(b => b.classList.remove("act"))
            btn.classList.add("act")

            filtroActual = btn.dataset.filtro
            aplicarFiltro()
        })
    })

    const desde = document.getElementById("filtro-desde")
    const hasta = document.getElementById("filtro-hasta")
    const cuenta = document.getElementById("filtro-cuenta")
    const divisa = document.getElementById("filtro-divisa")
    const etiqueta = document.getElementById("filtro-etiqueta")
    const buscar = document.getElementById("filtro-buscar")
    const buscarLimpiar = document.getElementById("filtro-buscar-limpiar")
    const limpiar = document.getElementById("filtro-limpiar")

    desde?.addEventListener("change", aplicarFiltro)
    hasta?.addEventListener("change", aplicarFiltro)
    cuenta?.addEventListener("change", aplicarFiltro)
    divisa?.addEventListener("change", aplicarFiltro)
    etiqueta?.addEventListener("change", aplicarFiltro)

    buscar?.addEventListener("input", () => {
        if (buscarLimpiar) buscarLimpiar.hidden = !buscar.value.trim()
        aplicarFiltro()
    })
    buscarLimpiar?.addEventListener("click", () => {
        if (buscar) buscar.value = ""
        if (buscarLimpiar) buscarLimpiar.hidden = true
        aplicarFiltro()
        buscar?.focus()
    })
    limpiar?.addEventListener("click", () => {
        if (desde) desde.value = ""
        if (hasta) hasta.value = ""
        if (cuenta) cuenta.value = ""
        if (divisa) divisa.value = ""
        if (etiqueta) etiqueta.value = ""
        if (buscar) buscar.value = ""
        if (buscarLimpiar) buscarLimpiar.hidden = true
        aplicarFiltro()
    })

    // Interacción con las cards:
    //   click     → abrir detalle (o seleccionar si ya hay selección activa)
    //   dblclick  → seleccionar / deseleccionar
    //   mantén    → seleccionar (clic sostenido)
    //   swipe ←   → revelar acciones (editar / eliminar)
    const container = document.getElementById("lista-movimientos")
    container?.addEventListener("click", manejarClickCard)
    container?.addEventListener("dblclick", manejarDobleClickCard)
    vincularGestosCard(container)
    configurarEventosGlobales()
}

function configurarEventosGlobales() {
    if (eventosGlobalesListos) return
    eventosGlobalesListos = true
    document.addEventListener("click", manejarClickFueraCards)
    document.addEventListener("keydown", manejarTecladoSeleccion)
}

function marcarSupresorClick() {
    supresorClick = true
    clearTimeout(supresorClickTimer)
    supresorClickTimer = setTimeout(() => { supresorClick = false }, 400)
}

function consumirSupresorClick() {
    if (!supresorClick) return false
    supresorClick = false
    clearTimeout(supresorClickTimer)
    return true
}

// Preferencia "un click para seleccionar" (Configuración → Accesibilidad).
function modoUnClickSeleccion() {
    return sesion.getPreferencias()?.accesibilidad?.unClickSeleccion === true
}

// Modo "un click para seleccionar": un click (sin modificador) reemplaza la
// selección con ese movimiento; Shift + click añade o quita de la selección.
function seleccionarPorUnClick(id, conShift) {
    if (conShift) {
        toggleSeleccion(id)
        return
    }
    if (seleccionados.size === 1 && seleccionados.has(id)) return
    seleccionados.clear()
    ordenSeleccion.length = 0
    seleccionados.add(id)
    ordenSeleccion.push(id)
    actualizarSeleccionEnDOM()
    actualizarEstadoLastbar()
}

async function alternarFavoritoMovimiento(m) {
    if (m.favoritoId) {
        await desvincularMovimiento(uid, m.id)
    } else {
        if (!esTipoFavoritable(m.tipo)) {
            mostrarNotificacion("info", "Este tipo de movimiento no se puede guardar como favorito")
            return
        }
        await crearFavoritoDesdeMovimiento(uid, m)
    }
    // No recargar movimientos completo (evita esqueletos y lecturas de red
    // innecesarias). Solo invalidar las capas de caché para que la próxima
    // navegación traiga los datos frescos, y actualizar el estado local de
    // la estrella en la tarjeta actual sin repintar toda la lista.
    cacheCapa.invalidarPrefijo(uid, "favoritos")
    cacheCapa.invalidarPrefijo(uid, "movimientos")
    const card = document.querySelector(`.card-item[data-id="${m.id}"]`)
    if (card) {
        const estrella = card.querySelector(".movimiento-favorito")
        if (estrella) {
            estrella.classList.toggle("es-favorito", !m.favoritoId)
            estrella.setAttribute("aria-label", m.favoritoId ? "Marcar como favorito" : "Quitar de favoritos")
            estrella.setAttribute("title", m.favoritoId ? "Marcar como favorito" : "Quitar de favoritos")
        }
    }
}

async function manejarClickCard(evento) {
    // La estrella ya no vive dentro de `.card-item-acciones` (queda a la
    // izquierda de la fila), así que no pasa por la rama de abajo: se atiende
    // aquí, igual que `.posicion-favorito` en la lista de inversiones.
    const botonFavorito = evento.target.closest(".movimiento-favorito")
    if (botonFavorito) {
        evento.stopPropagation()
        const card = botonFavorito.closest(".card-item")
        // `alternarFavoritoMovimiento` espera el movimiento entero (lee tipo y
        // favoritoId), no su id.
        const m = movimientos.find(x => x.id === card?.dataset.id)
        if (m) await alternarFavoritoMovimiento(m)
        return
    }

    // Botones de acción revelados por hover/swipe
    const accionBtn = evento.target.closest(".card-action-btn")
    if (accionBtn) {
        evento.stopPropagation()
        const card = accionBtn.closest(".card-item")
        const m = movimientos.find(x => x.id === card?.dataset.id)
        ocultarAccionesCards()
        if (!m) return
        if (accionBtn.dataset.accion === "editar") {
            abrirFormularioMovimiento(m.tipo, m)
        } else {
            abrirModalEliminarMovimiento(m)
        }
        return
    }

    const card = evento.target.closest(".card-item")

    // Un toque sobre la card con acciones reveladas solo las oculta.
    if (cardConAcciones) {
        const esLaMisma = card === cardConAcciones
        ocultarAccionesCards()
        if (esLaMisma) {
            consumirSupresorClick()
            return
        }
    }

    // Click inmediatamente después de una selección por clic sostenido o swipe
    if (consumirSupresorClick()) return

    if (!card) return

    const id = card.dataset.id

    if (evento.shiftKey && expandirSeleccion(movimientos.map(m => m.id), id, seleccionados, ordenSeleccion)) {
        actualizarSeleccionEnDOM()
        actualizarEstadoLastbar()
        return
    }

    // Modo "un click para seleccionar": el click selecciona de inmediato.
    if (modoUnClickSeleccion()) {
        seleccionarPorUnClick(id, evento.shiftKey)
        return
    }

    // Comportamiento clásico: con selección activa, un click la alterna;
    // si no, un click simple abre el detalle del movimiento.
    if (seleccionados.size > 0) {
        toggleSeleccion(id)
        return
    }

    if (clickTimer) {
        clearTimeout(clickTimer)
        clickTimer = null
    }

    clickTimer = setTimeout(() => {
        clickTimer = null
        if (seleccionados.size === 0) abrirDetalleMovimiento(id)
    }, 280)
}

function manejarDobleClickCard(evento) {
    if (evento.target.closest(".card-action-btn, .movimiento-favorito")) return
    const card = evento.target.closest(".card-item")
    if (!card) return
    if (clickTimer) {
        clearTimeout(clickTimer)
        clickTimer = null
    }
    // Con la opción activa el click ya selecciona; el doble click abre el detalle.
    if (modoUnClickSeleccion()) {
        limpiarSeleccion()
        abrirDetalleMovimiento(card.dataset.id)
        return
    }
    toggleSeleccion(card.dataset.id)
}

function manejarClickFueraCards(evento) {
    if (!document.getElementById("lista-movimientos")) return
    if (evento.target.closest(".card-item")) return
    if (evento.target.closest("#app-footer")) return
    if (evento.target.closest(".modal-overlay")) return
    ocultarAccionesCards()
    limpiarSeleccion()
}

function manejarTecladoSeleccion(evento) {
    if (!document.getElementById("lista-movimientos")) return
    if (estaAbierto()) return

    if (evento.key === "Escape") {
        if (seleccionados.size > 0) {
            ocultarAccionesCards()
            limpiarSeleccion()
        }
        return
    }

    if (evento.key !== "Delete" && evento.key !== "Backspace") return
    if (evento.target.matches("input, textarea, select")) return
    if (seleccionados.size === 0) return
    evento.preventDefault()
    deseleccionarUltimo()
}

function vincularGestosCard(container) {
    if (!container) return

    let gesto = null

    const cancelar = () => {
        if (gesto?.timer) clearTimeout(gesto.timer)
        gesto = null
    }

    container.addEventListener("pointerdown", (evento) => {
        if (evento.pointerType === "mouse" && evento.button !== 0) return
        if (evento.target.closest(".card-action-btn, .movimiento-favorito")) return

        const card = evento.target.closest(".card-item")
        if (!card) return

        cancelar()
        if (cardConAcciones && cardConAcciones !== card) ocultarAccionesCards()

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
            toggleSeleccion(card.dataset.id)
            marcarSupresorClick()
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
            if (dx < 0) mostrarAccionesCard(gesto.card)
            else ocultarAccionesCards()
        }
    })

    const finalizar = (evento) => {
        if (!gesto || evento.pointerId !== gesto.pointerId) return
        if (gesto.swipeRevelado) marcarSupresorClick()
        cancelar()
    }

    container.addEventListener("pointerup", finalizar)
    container.addEventListener("pointercancel", finalizar)
}

function mostrarAccionesCard(card) {
    if (cardConAcciones && cardConAcciones !== card) {
        cardConAcciones.classList.remove("acciones-visibles")
    }
    cardConAcciones = card
    card.classList.add("acciones-visibles")
}

function ocultarAccionesCards() {
    if (!cardConAcciones) return
    cardConAcciones.classList.remove("acciones-visibles")
    cardConAcciones = null
}

function aplicarFiltro() {
    const container = document.getElementById("lista-movimientos")
    if (!container) return

    const filtro = FILTROS_DISPONIBLES.find(f => f.filtro === filtroActual)

    const desde = document.getElementById("filtro-desde")?.value
    const hasta = document.getElementById("filtro-hasta")?.value
    const cuentaId = document.getElementById("filtro-cuenta")?.value
    const divisa = document.getElementById("filtro-divisa")?.value
    const etiqueta = document.getElementById("filtro-etiqueta")?.value
    const busqueda = document.getElementById("filtro-buscar")?.value

    let filtrados = movimientos

    if (filtro?.tipos) {
        filtrados = filtrados.filter(m => filtro.tipos.includes(m.tipo))
    }

    if (desde) {
        const d = parseFechaLocal(desde)
        filtrados = filtrados.filter(m => {
            const f = fechaDeMovimiento(m)
            return f && f >= d
        })
    }

    if (hasta) {
        const h = parseFechaLocal(hasta)
        h.setHours(23, 59, 59, 999)
        filtrados = filtrados.filter(m => {
            const f = fechaDeMovimiento(m)
            return f && f <= h
        })
    }

    if (cuentaId) {
        filtrados = filtrados.filter(m => (
            m.cuenta === cuentaId ||
            m.cuentaOrigen === cuentaId ||
            m.cuentaDestino === cuentaId ||
            m.tarjeta === cuentaId
        ))
    }

    if (divisa) {
        const divisaUpper = divisa.toUpperCase()
        filtrados = filtrados.filter(m => (m.divisa || "").toUpperCase() === divisaUpper)
    }

    if (etiqueta) {
        const objetivo = etiqueta.toLowerCase()
        filtrados = filtrados.filter(m =>
            (m.etiquetas || []).some(e => String(e).toLowerCase() === objetivo)
        )
    }

    if (busqueda) {
        const q = busqueda.trim().toLowerCase()
        filtrados = filtrados.filter(m => {
            return [
                m.concepto,
                m.activo,
                m.exchange,
                m.nombreVendedor,
                m.nombreComprador,
                m.cuentaPago,
                m.cuentaCobro,
                ...(m.etiquetas || [])
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(q)
        })
    }

    renderizarTotales(filtrados, cuentaId)
    cardConAcciones = null

    if (filtrados.length === 0) {
        container.replaceChildren(movimientos.length === 0
            ? contenidoDesdeTemplate("tpl-movimientos-vacio")
            : contenidoDesdeTemplate("tpl-movimientos-vacio-filtro"))
        return
    }

    container.replaceChildren(contenidoDesdeFilas("tpl-movimiento-card", filtrados, m => filaMovimiento(m, cuentaId)))
}

// ============================================
// TOTALES DEL FILTRO
// ============================================

function renderizarTotales(filtrados, cuentaId = null) {
    const contenedor = document.getElementById("totales-movimientos")
    if (!contenedor) return
    void pintarTotales(contenedor, filtrados, cuentaId)
}

async function pintarTotales(contenedor, filtrados, cuentaId = null) {

    const porDivisa = {}

    filtrados.forEach(m => {
        const divisa = (m.divisa || "PEN").toUpperCase()
        if (!porDivisa[divisa]) {
            porDivisa[divisa] = { positivo: 0, negativo: 0 }
        }
        const monto = montoDeMovimiento(m, cuentaId)
        if (esMovimientoPositivo(m, cuentaId)) {
            porDivisa[divisa].positivo += monto
        } else {
            porDivisa[divisa].negativo += monto
        }
    })

    const lineas = contenidoDesdeFilas("tpl-totales-mov-linea", Object.entries(porDivisa), ([divisa, totales]) => ({
        valores: {
            positivo: `+${totales.positivo.toFixed(2)}`,
            negativo: `−${totales.negativo.toFixed(2)}`,
            divisa
        }
    }))

    const totalMovimientos = filtrados.length

    contenedor.replaceChildren(contenidoDesdeTemplate("tpl-totales-movimientos", {
        valores: { count: `${totalMovimientos} movimientos` },
        html: {
            lineas,
            "icono-nuevo": icono("plus-circle", 16)
        }
    }))

    document.getElementById("btn-nuevo-movimiento")?.addEventListener("click", () => {
        abrirSelectorTipoMovimiento()
    })
}

function parseFechaLocal(valor) {
    if (!valor) return null
    const [anio, mes, dia] = valor.split("-").map(Number)
    if (!anio || !mes || !dia) return new Date(valor)
    return new Date(anio, mes - 1, dia)
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
// LASTBAR (handlers centralizados en app.js)
// ============================================

// Tipos que se pueden crear según las preferencias y las páginas visibles:
//  · activos & pago de tarjeta → ocultos por defecto; si se activan en
//    configuración (Apariencia → Tipos de movimiento en el selector) vuelven.
//  · p2p y trades → requieren la página "trading".
//  · error → siempre el último.
//  · compraTarjeta NO aparece: comprar con tarjeta es un gasto desde la
//    cuenta de la tarjeta (aumenta su deuda), no un tipo aparte.
const TIPO_TRADE = "trade"

function tiposDisponiblesParaCrear() {
    const paginas = sesion.getPaginasVisibles()
    const tiposPref = sesion.getPreferencias()?.tiposMovimiento || {}

    const tipos = [
        TIPOS_MOVIMIENTO.INGRESO,
        TIPOS_MOVIMIENTO.GASTO,
        TIPOS_MOVIMIENTO.TRANSFERENCIA
    ]

    if (tiposPref.cambioDivisa !== false) {
        tipos.push(TIPOS_MOVIMIENTO.CAMBIO_DIVISA)
    }

    if (paginas.inversiones !== false && tiposPref.compraActivo !== false) {
        tipos.push(TIPOS_MOVIMIENTO.COMPRA_ACTIVO)
    }
    if (paginas.inversiones !== false && tiposPref.ventaActivo !== false) {
        tipos.push(TIPOS_MOVIMIENTO.VENTA_ACTIVO)
    }

    if (paginas.trading !== false && tiposPref.p2pCompra !== false) {
        tipos.push(TIPOS_MOVIMIENTO.P2P_COMPRA)
    }
    if (paginas.trading !== false && tiposPref.p2pVenta !== false) {
        tipos.push(TIPOS_MOVIMIENTO.P2P_VENTA)
    }

    if (tiposPref.pagoTarjeta !== false) {
        tipos.push(TIPOS_MOVIMIENTO.PAGO_TARJETA)
    }

    if (paginas.trading !== false && tiposPref.trade !== false) {
        tipos.push(TIPO_TRADE)
    }

    tipos.push(TIPOS_MOVIMIENTO.ERROR)

    return tipos
}

// Tipos destacados (grandes, con círculo e ícono) frente a los secundarios.
// Se pueden quitar desde Accesibilidad (resaltarIngresoGasto).
const TIPOS_DESTACADOS = [
    TIPOS_MOVIMIENTO.INGRESO,
    TIPOS_MOVIMIENTO.GASTO
]

const NOMBRES_ADICIONALES = {
    [TIPO_TRADE]: "Trade"
}

const ICONO_TIPO_MOVIMIENTO = {
    [TIPOS_MOVIMIENTO.INGRESO]: "arrow-down-left",
    [TIPOS_MOVIMIENTO.GASTO]: "arrow-up-right"
}

export function abrirSelectorTipoMovimiento(cuentaId = null) {
    // Garantizar uid actual para quien invoque desde otra página
    uid = sesion.uid

    const disponibles = tiposDisponiblesParaCrear()

    // Accesibilidad: resaltar ingreso/gasto (destacados) o verlos igual que el resto
    const resaltar = sesion.getPreferencias()?.accesibilidad?.resaltarIngresoGasto !== false
    const destacados = resaltar
        ? TIPOS_DESTACADOS.filter(t => disponibles.includes(t))
        : []
    const secundarios = disponibles.filter(t => !destacados.includes(t))

    // El destacado es un único `<button>`, no un `div` que envuelve a otro
    // `button`. Con el `div` exterior la zona sensible era el cuadrado entero
    // de la celda y el efecto de hover se disparaba en las esquinas, además de
    // quedar fuera del recorrido del teclado (BUG-016).
    const nombreDe = t => CONFIG_MOVIMIENTOS[t]?.nombre || NOMBRES_ADICIONALES[t] || t

    // Si la cantidad de secundarios es impar, el último (error) ocupa ambas columnas.
    const impar = secundarios.length % 2 === 1

    const destacado = contenidoDesdeFilas("tpl-tipo-principal", destacados, t => {
        const nombre = nombreDe(t)
        return {
            valores: {
                "tipo@data-tipo": t,
                "tipo@aria-label": `Crear ${nombre}`,
                nombre
            },
            html: { icono: icono(ICONO_TIPO_MOVIMIENTO[t] || "plus-circle", 24) }
        }
    })

    const contenido = contenidoDesdeTemplate("tpl-grupo-tipos-destacados")
    contenido.querySelector("[data-tpl='botones']").appendChild(destacado)

    if (secundarios.length > 0) {
        const botones = contenidoDesdeFilas(
            impar ? "tpl-tipo-secundario-full" : "tpl-tipo-secundario",
            secundarios,
            t => ({ valores: { "tipo@data-tipo": t, nombre: nombreDe(t) } })
        )
        const grupo = contenidoDesdeTemplate("tpl-grupo-tipos-secundarios")
        grupo.querySelector("[data-tpl='botones']").appendChild(botones)
        contenido.appendChild(grupo)
    }

    abrirModal({
        titulo: "Seleccionar tipo",
        contenido,
        variante: "narrow",
        confirmText: null,
        cancelText: null,
        cerrarAlClickFuera: true
    })

    const abrirFormularioPorTipo = tipo => {
        cerrarModal()
        if (tipo === TIPO_TRADE) {
            abrirSelectorDireccionTrade()
            return
        }
        const opciones = cuentaId
            ? { valores: { cuenta: cuentaId, cuentaOrigen: cuentaId } }
            : undefined
        abrirFormularioMovimiento(tipo, null, opciones)
    }

    document.querySelectorAll(".tipo-principal").forEach(btn => {
        btn.addEventListener("click", () => abrirFormularioPorTipo(btn.dataset.tipo))
    })

    document.querySelectorAll(".tipo-secundario").forEach(btn => {
        btn.addEventListener("click", () => abrirFormularioPorTipo(btn.dataset.tipo))
    })
}

// El tipo "Trade" abre una dirección (Largo/Corto) antes del formulario.
function abrirSelectorDireccionTrade() {
    abrirModal({
        titulo: "Nuevo trade",
        contenido: contenidoDesdeTemplate("tpl-direccion-trade"),
        variante: "narrow",
        confirmText: null,
        cancelText: null,
        cerrarAlClickFuera: true
    })

    document.querySelectorAll("[data-direccion]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const direccion = btn.dataset.direccion
            cerrarModal()
            try {
                const { abrirModalNuevoTrade } = await import("./trading.js")
                abrirModalNuevoTrade(direccion)
            } catch (error) {
                console.error("Error abriendo trade:", error)
                mostrarNotificacion("error", "No se pudo abrir el registro de trade")
            }
        })
    })
}

export async function abrirFormularioMovimiento(tipo, movimiento = null, opciones = {}) {
    uid = sesion.uid
    const esEdicion = !!movimiento
    const alGuardar = opciones.alGuardar || null
    const valoresIniciales = opciones.valores || null
    const formulario = await generarFormularioMovimiento(
        tipo,
        valoresIniciales?.divisa || null,
        { nombreFavorito: !!opciones.nombreFavorito }
    )

    const config = CONFIG_MOVIMIENTOS[tipo]

    const modalEl = abrirModal({
        titulo: opciones.titulo || (esEdicion
            ? `Editar ${config?.nombre || tipo}`
            : `Nuevo ${config?.nombre || tipo}`),
        contenido: formulario,
        variante: "form",
        confirmText: opciones.confirmText || (esEdicion ? "Guardar cambios" : "Registrar movimiento"),
        onConfirm: async () => {
            const datos = recogerDatosFormulario(tipo)
            if (!datos) return false

            if (opciones.favoritoId) {
                datos.favoritoId = opciones.favoritoId
            }

            if (!datos.fechaRealizacion) {
                datos.fechaRealizacion = getFechaHoy()
            }

            try {
                // Quien abre el formulario puede quedarse con los datos y hacer
                // su propia guardado (editar la plantilla de un favorito, por
                // ejemplo). Si lo hace, es dueño también del refresco y del
                // mensaje de éxito.
                if (opciones.alConfirmar) {
                    await opciones.alConfirmar(datos, formulario)
                    return true
                }
                if (esEdicion) {
                    await actualizarMovimiento(uid, movimiento.id, movimiento, tipo, datos)
                    mostrarNotificacion("exito", "Movimiento actualizado")
                } else {
                    await registrarMovimiento(uid, tipo, datos)
                    mostrarNotificacion("exito", "Movimiento registrado")
                }
                if (alGuardar) {
                    await alGuardar()
                } else {
                    await cargarMovimientos()
                }
                return true
            } catch (error) {
                console.error("Error guardando movimiento:", error)
                mostrarNotificacion("error", `No se pudo guardar el movimiento: ${error.message || "error desconocido"}`)
                return false
            }
        }
    })

    if (esEdicion) {
        rellenarFormulario(tipo, movimiento)
    } else if (valoresIniciales) {
        for (const [campo, valor] of Object.entries(valoresIniciales)) {
            const input = document.getElementById(`campo-${campo}`)
            if (input) input.value = valor
        }
    }

    if (tipo === TIPOS_MOVIMIENTO.PAGO_TARJETA) {
        filtrarCuentasPagoTarjeta()
    } else if (tipo === TIPOS_MOVIMIENTO.TRANSFERENCIA) {
        filtrarCuentasDestinoTransferencia()
    }
    vincularSimboloDivisa()

    // Selector de chips de etiquetas: lee el input oculto #campo-etiquetas
    // (ya rellenado si es edición) y lo reescribe en cada cambio.
    const contenedorChips = formulario.querySelector("#chips-etiquetas")
    if (contenedorChips) await montarSelectorEtiquetas(contenedorChips)
}

function filtrarCuentasPagoTarjeta() {
    const tarjeta = document.getElementById("campo-tarjeta")
    const origen = document.getElementById("campo-cuentaOrigen")
    if (!tarjeta || !origen) return

    const actualizar = () => {
        const moneda = tarjeta.selectedOptions?.[0]?.dataset?.moneda
        Array.from(origen.options).forEach((opcion, indice) => {
            if (indice === 0) return
            const tipo = opcion.dataset.tipo
            const compatible = tipo !== "credito" && (!moneda || opcion.dataset.moneda === moneda)
            opcion.dataset.disponible = compatible ? "1" : "0"
        })
        if (origen._aplicarBusqueda) origen._aplicarBusqueda()
        else Array.from(origen.options).forEach((opcion, indice) => {
            if (indice === 0) return
            opcion.hidden = opcion.disabled = opcion.dataset.disponible === "0"
        })
        if (origen.selectedOptions[0]?.disabled) origen.value = ""
    }

    tarjeta.addEventListener("change", actualizar)
    actualizar()
}

/**
 * Ajusta el formulario de transferencia a la divisa de las cuentas: si
 * comparten divisa, mueve un solo `monto`; si cruzan divisas, mueve
 * `montoOrigen` y `montoDestino` con `tasa`. Antes ocultaba las cuentas de
 * destino con divisa distinta (DEUDA-002 opción a); ya no hace falta porque el
 * servicio soporta el cruce con conversión explícita.
 */
function filtrarCuentasDestinoTransferencia() {
    const origen = document.getElementById("campo-cuentaOrigen")
    const destino = document.getElementById("campo-cuentaDestino")
    if (!origen || !destino) return

    origen.addEventListener("change", ajustarCamposTransferenciaCrucenDivisas)
    destino.addEventListener("change", ajustarCamposTransferenciaCrucenDivisas)
    ajustarCamposTransferenciaCrucenDivisas()
}

/**
 * Muestra `montoOrigen`/`montoDestino`/`tasa` cuando las cuentas tienen divisas
 * distintas; oculta y limpia `monto` en ese caso. Si comparten divisa, muestra
 * `monto` y oculta los tres campos de cruce (igual que cambioDivisa).
 */
function ajustarCamposTransferenciaCrucenDivisas() {
    const origen = document.getElementById("campo-cuentaOrigen")
    const destino = document.getElementById("campo-cuentaDestino")
    const inputMonto = document.getElementById("campo-monto")
    const inputMontoOrigen = document.getElementById("campo-montoOrigen")
    const inputMontoDestino = document.getElementById("campo-montoDestino")
    const inputTasa = document.getElementById("campo-tasa")

    const divisaOrigen = origen?.selectedOptions?.[0]?.dataset?.moneda || null
    const divisaDestino = destino?.selectedOptions?.[0]?.dataset?.moneda || null
    const cruzan = divisaOrigen && divisaDestino && divisaOrigen !== divisaDestino

    const setDisabled = (el, disabled) => {
        if (!el) return
        el.disabled = disabled
        const grupo = el.closest(".form-group")
        if (grupo) grupo.hidden = disabled
    }

    if (cruzan) {
        setDisabled(inputMonto, true)
        setDisabled(inputMontoOrigen, false)
        setDisabled(inputMontoDestino, false)
        setDisabled(inputTasa, false)
    } else {
        setDisabled(inputMonto, false)
        setDisabled(inputMontoOrigen, true)
        setDisabled(inputMontoDestino, true)
        setDisabled(inputTasa, true)
        if (inputMontoOrigen) inputMontoOrigen.value = ""
        if (inputMontoDestino) inputMontoDestino.value = ""
        if (inputTasa) inputTasa.value = ""
    }
}

function rellenarFormulario(tipo, m) {
    const config = CONFIG_MOVIMIENTOS[tipo]
    const campos = [...new Set([
        ...(config.camposObligatorios || []),
        ...(config.camposOpcionales || [])
    ])]

    for (const campo of campos) {
        const input = document.getElementById(`campo-${campo}`)
        if (!input) continue
        const valor = m[campo]
        if (valor === undefined || valor === null) continue
        if (campo === "fechaRealizacion") {
            input.value = formatearParaInput(valor)
        } else {
            input.value = valor
        }
    }

    const comisionInput = document.getElementById("campo-comision")
    if (comisionInput && m.comision !== undefined && m.comision !== null) {
        comisionInput.value = m.comision
    }

    const etiquetasInput = document.getElementById("campo-etiquetas")
    if (etiquetasInput) {
        etiquetasInput.value = (m.etiquetas || []).join(", ")
    }
}

function formatearParaInput(valor) {
    if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}/.test(valor)) return valor
    if (valor?.toDate) {
        const d = valor.toDate()
        const anio = d.getFullYear()
        const mes = String(d.getMonth() + 1).padStart(2, "0")
        const dia = String(d.getDate()).padStart(2, "0")
        return `${anio}-${mes}-${dia}`
    }
    return String(valor)
}

// ============================================
// ELIMINAR MOVIMIENTO
// ============================================

function abrirModalEliminarMovimiento(m) {
    abrirModal({
        titulo: "Eliminar movimiento",
        contenido: contenidoDesdeTemplate("tpl-confirmar-eliminar", {
            valores: {
                concepto: m.concepto || m.activo || CONFIG_MOVIMIENTOS[m.tipo]?.nombre || "Sin concepto",
                fecha: formatearFecha(m.fechaRealizacion)
            }
        }),
        variante: "confirm",
        confirmText: "Eliminar",
        cancelText: "Cancelar",
        onConfirm: async () => {
            try {
                const snapshot = { ...m }
                await eliminarMovimiento(uid, m)
                await cargarMovimientos()
                ofrecerDeshacer({
                    mensaje: "Movimiento eliminado. ¿Deshacer?",
                    restaurar: () => restaurarMovimiento(uid, snapshot),
                    alRestaurar: () => cargarMovimientos()
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

// ============================================
// MODAL DE DETALLE
// ============================================
// Un clic abre el mismo formulario que "Editar" pero con los campos
// bloqueados. Desde ahí se puede habilitar la edición o eliminar.

function abrirDetalleMovimiento(id) {
    const m = movimientos.find(x => x.id === id)
    if (!m) return
    abrirFormularioDetalle(m)
}

export async function abrirFormularioDetalle(m) {
    uid = sesion.uid
    const config = CONFIG_MOVIMIENTOS[m.tipo]
    const tipoNombre = config?.nombre || m.tipo || "Desconocido"

    const formulario = contenidoDesdeTemplate("tpl-detalle-movimiento", {
        html: { formulario: await generarFormularioMovimiento(m.tipo) }
    })

    const modalEl = abrirModal({
        titulo: `${tipoNombre} · ${escapeHtml(formatearFecha(m.fechaRealizacion))}`,
        contenido: formulario,
        variante: "form",
        confirmText: null,
        cancelText: null,
        cerrarAlClickFuera: true
    })

    rellenarFormulario(m.tipo, m)
    vincularSimboloDivisa()
    bloquearFormulario(true)
    renderizarAccionesDetalle(modalEl, true)

    const body = modalEl.querySelector(".modal-body")
    body?.addEventListener("click", (evento) => {
        const boton = evento.target.closest("[data-detalle-accion]")
        if (!boton) return
        manejarAccionDetalle(boton.dataset.detalleAccion, m, modalEl)
    })
}

function renderizarAccionesDetalle(modalEl, bloqueado) {
    const contenedor = modalEl.querySelector("#detalle-acciones")
    if (!contenedor) return

    contenedor.innerHTML = bloqueado
        ? `
            <button type="button" class="glass-btn" data-detalle-accion="editar">
                ${icono("pencil", 15)} Editar
            </button>
            <button type="button" class="glass-btn danger" data-detalle-accion="eliminar">
                ${icono("trash", 15)} Eliminar
            </button>
        `
        : `
            <button type="button" class="modal-btn modal-btn-primary" data-detalle-accion="guardar">Guardar cambios</button>
            <button type="button" class="glass-btn cancel" data-detalle-accion="cancelar">Cancelar</button>
        `
}

function bloquearFormulario(bloquear) {
    const form = document.getElementById("form-movimiento")
    if (!form) return
    form.querySelectorAll("input, select, textarea, button").forEach(el => {
        el.disabled = bloquear
    })
    form.classList.toggle("form-bloqueado", bloquear)
}

async function manejarAccionDetalle(accion, m, modalEl) {
    if (accion === "editar") {
        bloquearFormulario(false)
        renderizarAccionesDetalle(modalEl, false)
        document.getElementById("campo-concepto")?.focus()
        return
    }

    if (accion === "cancelar") {
        abrirFormularioDetalle(m)
        return
    }

    if (accion === "eliminar") {
        cerrarModal()
        abrirModalEliminarMovimiento(m)
        return
    }

    if (accion === "guardar") {
        const datos = recogerDatosFormulario(m.tipo)
        if (!datos) return

        if (!datos.fechaRealizacion) datos.fechaRealizacion = getFechaHoy()

        // Mientras el servidor procesa: blur en toda la pantalla + desactivar
        // botones del detalle para evitar doble envío.
        const overlay = modalEl.closest(".modal-overlay")
        overlay?.classList.add("modal-procesando")
        modalEl.querySelectorAll("button").forEach(boton => boton.setAttribute("disabled", "true"))

        try {
            await actualizarMovimiento(uid, m.id, m, m.tipo, datos)
            await cargarMovimientos()
            mostrarNotificacion("exito", "Movimiento actualizado")
            cerrarModal()
        } catch (error) {
            console.error("Error actualizando movimiento:", error)
            mostrarNotificacion("error", `No se pudo actualizar: ${error.message || "error desconocido"}`)
            overlay?.classList.remove("modal-procesando")
            modalEl.querySelectorAll("button").forEach(boton => boton.removeAttribute("disabled"))
        }
    }
}

// ============================================
// SELECCIÓN (dblclick / clic sostenido / click en modo selección)
// ============================================
// La selección habilita los botones Editar (uno solo) / Eliminar del lastbar.
// Escape o un click fuera de la lista limpian la selección.
// Suprimir/Delete quita el último movimiento seleccionado.

function toggleSeleccion(id) {
    if (seleccionados.has(id)) {
        seleccionados.delete(id)
        const indice = ordenSeleccion.indexOf(id)
        if (indice !== -1) ordenSeleccion.splice(indice, 1)
    } else {
        seleccionados.add(id)
        if (!ordenSeleccion.includes(id)) ordenSeleccion.push(id)
    }
    actualizarSeleccionEnDOM()
    actualizarEstadoLastbar()
}

function deseleccionarUltimo() {
    const id = ordenSeleccion.pop()
    if (!id) return
    seleccionados.delete(id)
    actualizarSeleccionEnDOM()
    actualizarEstadoLastbar()
}

function limpiarSeleccion() {
    if (seleccionados.size === 0) {
        actualizarEstadoLastbar()
        return
    }
    seleccionados.clear()
    ordenSeleccion.length = 0
    actualizarSeleccionEnDOM()
    actualizarEstadoLastbar()
}

function actualizarSeleccionEnDOM() {
    document.querySelectorAll(".card-item").forEach(card => {
        card.classList.toggle("seleccionado", seleccionados.has(card.dataset.id))
    })
}

function actualizarEstadoLastbar() {
    const hayMovimientos = seleccionados.size > 0
    const hayFavoritos = seleccionadosFavoritos.size > 0
    // Editar es de a uno: vale tanto para un movimiento como para un favorito.
    const unMovimiento = seleccionados.size === 1
    const unFavorito = seleccionadosFavoritos.size === 1

    document.querySelectorAll('[data-accion="editar-movimiento"]').forEach(item => {
        item.classList.toggle("desact", !(unMovimiento || unFavorito))
    })
    document.querySelectorAll('[data-accion="etiquetar-movimiento"]').forEach(item => {
        // Siempre activo: las etiquetas también se editan desde el modal de
        // crear o editar un movimiento, así que el botón no depende de que haya
        // algo seleccionado en la lista.
        item.classList.remove("desact")
    })
    // El botón "Eliminar" sirve para los dos: está activo si hay algo que
    // borrar, sea un movimiento o un favorito.
    document.querySelectorAll('[data-accion="eliminar-movimiento"]').forEach(item => {
        item.classList.toggle("desact", !(hayMovimientos || hayFavoritos))
    })
}

export async function editarSeleccionados() {
    // Editar sirve para los dos tipos de selección. Si hay favoritos
    // marcados mandan ellos; el botón queda desactivo con más de uno, así que
    // aquí solo llega el caso de uno.
    if (seleccionadosFavoritos.size === 1) {
        const favoritoId = [...seleccionadosFavoritos][0]
        await editarPlantillaFavoritoDesdeItem(favoritoId)
        return
    }

    if (seleccionados.size !== 1) return

    const id = [...seleccionados][0]
    const movimiento = movimientos.find(m => m.id === id)
    if (!movimiento) return

    limpiarSeleccion()
    abrirFormularioMovimiento(movimiento.tipo, movimiento)
}

export async function eliminarSeleccionados() {
    // El botón "Eliminar" de la barra es dual. Si hay favoritos marcados se
    // borran ellos; si no, los movimientos seleccionados. La comprobación va
    // ANTES del early return: con favoritos marcados no hay movimientos.
    if (seleccionadosFavoritos.size > 0) {
        await eliminarSeleccionadosFavoritos()
        return
    }

    if (seleccionados.size === 0) return

    const lista = [...seleccionados]
        .map(id => movimientos.find(m => m.id === id))
        .filter(Boolean)

    limpiarSeleccion()
    abrirModalEliminarVarios(lista)
}

export async function etiquetarSeleccionados() {
    if (seleccionados.size === 0) return

    const lista = [...seleccionados]
        .map(id => movimientos.find(m => m.id === id))
        .filter(Boolean)
    if (!lista.length) return

    await abrirModalEtiquetarMasivo(lista)
}

async function abrirModalEtiquetarMasivo(lista) {
    const uidSesion = sesion.uid
    const catalogo = await obtenerEtiquetas(uidSesion)

    // Estados iniciales: activa = en TODOS, semi = en al menos uno. Las
    // etiquetas de los movimientos que no están en el catálogo (huérfanas,
    // p. ej. tras un renombrado o de datos antiguos) se muestran igual: sin
    // ellas sería imposible quitarlas del lote.
    const presencia = lista.map(m => new Set(normalizarEtiquetas(m.etiquetas || []).map(e => e.toLowerCase())))
    const union = new Set(presencia.flatMap(p => [...p]))
    const enTodos = new Set([...union].filter(n => presencia.every(p => p.has(n))))
    const enAlguno = [...union].filter(n => !enTodos.has(n))

    const enCatalogo = new Set(catalogo.map(e => e.nombre.toLowerCase()))
    const efectivo = [...catalogo]
    for (const nombre of union) {
        if (!enCatalogo.has(nombre)) efectivo.push({ id: null, nombre, color: null, esPrincipal: false })
    }

    const contenido = contenidoDesdeTemplate("tpl-etiquetar-masivo")
    const contenedor = contenido.querySelector("#masivo-chips-etiquetas")
    let selector = null

    abrirModal({
        titulo: `Etiquetar ${lista.length} movimiento(s)`,
        contenido,
        confirmText: "Aplicar",
        cancelText: "Cancelar",
        onConfirm: async () => {
            const finales = selector.obtenerSeleccion().map(e => e.toLowerCase())
            // Las etiquetas que el modal no mostró se conservan tal cual.
            const gestionadas = new Set([...union, ...catalogo.map(e => e.nombre.toLowerCase())])
            const cambios = lista.map(m => ({
                id: m.id,
                etiquetas: normalizarEtiquetas([
                    ...normalizarEtiquetas(m.etiquetas || []).filter(e => !gestionadas.has(e.toLowerCase())),
                    ...finales
                ])
            }))
            try {
                const originales = cambios.map(c => ({
                    id: c.id,
                    etiquetas: lista.find(m => m.id === c.id).etiquetas || []
                }))
                await aplicarEtiquetasEnLote(uidSesion, cambios)
                await cargarMovimientos()
                limpiarSeleccion()
                ofrecerDeshacer({
                    mensaje: `Etiquetas aplicadas a ${lista.length} movimiento(s). ¿Deshacer?`,
                    restaurar: () => aplicarEtiquetasEnLote(uidSesion, originales),
                    alRestaurar: () => cargarMovimientos()
                })
                return true
            } catch (error) {
                console.error("Error etiquetando movimientos:", error)
                mostrarNotificacion("error", `No se pudieron etiquetar: ${error.message || "error desconocido"}`)
                return false
            }
        }
    })

    selector = await montarSelectorEtiquetas(contenedor, {
        seleccionadas: [...enTodos],
        semiactivas: enAlguno,
        entrada: null,
        // Se pasa `efectivo` (catálogo + huérfanas) en vez de dejar que el
        // selector lo recargue: sin esto, las etiquetas que tienen algún
        // movimiento pero no están en el catálogo no se pintaban nunca.
        catalogo: efectivo
    })
}

function abrirModalEliminarVarios(lista) {
    abrirModal({
        titulo: "Eliminar movimientos",
        contenido: contenidoDesdeTemplate("tpl-confirmar-eliminar-varios", {
            valores: { pregunta: `¿Eliminar ${lista.length} movimiento(s)?` }
        }),
        variante: "confirm",
        confirmText: "Eliminar",
        cancelText: "Cancelar",
        onConfirm: async () => {
            try {
                const snapshots = lista.map(x => ({ ...x }))
                for (const m of lista) {
                    await eliminarMovimiento(uid, m)
                }
                await cargarMovimientos()
                ofrecerDeshacer({
                    mensaje: `${lista.length} movimiento(s) eliminado(s). ¿Deshacer?`,
                    restaurar: async () => {
                        for (const s of snapshots) {
                            await restaurarMovimiento(uid, s)
                        }
                    },
                    alRestaurar: () => cargarMovimientos()
                })
                return true
            } catch (error) {
                console.error("Error eliminando movimientos:", error)
                mostrarNotificacion("error", `No se pudieron eliminar: ${error.message || "error desconocido"}`)
                return false
            }
        }
    })
}

export async function eliminarSeleccionadosFavoritos() {
    if (seleccionadosFavoritos.size === 0) return

    const lista = [...seleccionadosFavoritos]
        .map(id => favoritosCache.find(f => f.id === id))
        .filter(Boolean)

    // La selección se limpia SIEMPRE, incluso si algún id ya no resuelve: si
    // no, la lastbar se queda con favoritos marcados que no existen.
    limpiarSeleccionFavoritos()
    if (!lista.length) return

    await abrirModalEliminarVariosFavoritos(lista)
}

// ============================================
// SELECCIÓN DE FAVORITOS
// ============================================
// Los favoritos no tienen botones propios en la lastbar: se gestionan con los
// de siempre. Editar y eliminar los atienden `editarSeleccionados` y
// `eliminarSeleccionados`; ejecutar y cancelar quedan en el contenedor lateral
// (doble click y click fuera).

async function abrirModalEliminarVariosFavoritos(lista) {
    const modalEl = abrirModal({
        titulo: "Eliminar favorito(s)",
        contenido: contenidoDesdeTemplate("tpl-confirmar-eliminar-varios", {
            valores: { pregunta: `¿Eliminar ${lista.length} favorito(s)?` }
        }),
        variante: "confirm",
        confirmText: "Eliminar",
        cancelText: "Cancelar",
        onConfirm: async () => {
            try {
                const snapshots = lista.map(f => ({
                    id: f.id,
                    favorito: { ...f },
                    movimientosVinculados: movimientos.filter(m => m.favoritoId === f.id).map(m => m.id)
                }))
                let eliminados = 0
                for (const f of lista) {
                    try {
                        await eliminarFavoritoConDesvinculacion(uid, f.id)
                        eliminados++
                    } catch (error) {
                        console.error(`Error eliminando favorito ${f.id}:`, error)
                    }
                }
                await cargarMovimientos()
                if (eliminados > 0) {
                    mostrarNotificacion("exito", `${eliminados} favorito(s) eliminado(s)`)
                    ofrecerDeshacer({
                        mensaje: `${eliminados} favorito(s) eliminado(s). ¿Deshacer?`,
                        restaurar: async () => {
                            for (const s of snapshots) {
                                const id = await crearFavorito(uid, {
                                    nombre: s.favorito.nombre,
                                    tipo: s.favorito.tipo,
                                    cuenta: s.favorito.cuenta,
                                    monto: s.favorito.monto,
                                    divisa: s.favorito.divisa,
                                    concepto: s.favorito.concepto || '',
                                    etiquetas: s.favorito.etiquetas || []
                                })
                                for (const movimientoId of s.movimientosVinculados) {
                                    await actualizarMovimientoDoc(uid, movimientoId, { favoritoId: id })
                                }
                            }
                            await cargarMovimientos()
                        }
                    })
                }
                return true
            } catch (error) {
                console.error("Error eliminando favoritos:", error)
                mostrarNotificacion("error", `No se pudieron eliminar los favoritos: ${error.message || "error desconocido"}`)
                return false
            }
        }
    })

    if (!modalEl) {
        mostrarNotificacion("error", "No se pudo abrir el modal de eliminación")
    }
}

// ============================================
// EXTRACTO CSV (solo movimientos)
// ============================================

export async function exportarExtractoCSV() {
    uid = sesion.uid
    if (!uid) {
        mostrarNotificacion("error", "No hay sesión activa")
        return
    }

    try {
        movimientos = await obtenerMovimientos(uid)
        if (!movimientos || movimientos.length === 0) {
            mostrarNotificacion("info", "No hay movimientos para exportar")
            return
        }

        const filas = movimientos
            .slice()
            .sort(compararMovimientosPorFecha)
            .map(m => [
                formatearFecha(m.fechaRealizacion),
                CONFIG_MOVIMIENTOS[m.tipo]?.nombre || m.tipo || "Desconocido",
                m.concepto || m.activo || CONFIG_MOVIMIENTOS[m.tipo]?.nombre || "Sin concepto",
                nombreCuentaDeMovimiento(m),
                `${esMovimientoPositivo(m) ? "+" : "-"}${escapeHtml(Math.abs(montoDeMovimiento(m)).toFixed(2))}`,
                (m.divisa || "PEN").toUpperCase(),
                (m.etiquetas || []).filter(Boolean).join(", ")
            ])

        const cabecera = ["Fecha", "Tipo", "Concepto", "Cuenta", "Monto", "Divisa", "Etiquetas"]
        const csv = [cabecera, ...filas]
            .map(fila => fila.map(valor => escaparCSV(valor)).join(","))
            .join("\r\n")

        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        descargarArchivo(url, `escinco_movimientos_${getFechaHoy()}.csv`)
        // Revoke diferido: revocar aquí cancelaba la descarga antes de arrancar (bug #9)
        setTimeout(() => URL.revokeObjectURL(url), 0)

        mostrarNotificacion("exito", `Extracto exportado (${movimientos.length} movimientos)`)
    } catch (error) {
        console.error("Error exportando CSV de movimientos:", error)
        mostrarNotificacion("error", `No se pudo exportar el extracto: ${error.message || "error desconocido"}`)
    }
}

function escaparCSV(valor) {
    const texto = String(valor ?? "")
    if (/[",\r\n]/.test(texto)) {
        return `"${texto.replaceAll('"', '""')}"`
    }
    return texto
}

// Un movimiento es de aporte a meta si guarda el vínculo explícito (metaId)
// o si su concepto coincide con el generado por los aportes automáticos.
function esMovimientoDeMeta(m) {
    if (!!m?.metaId) return true
    return /^aporte a meta:/i.test(String(m?.concepto || "").trim())
}

function descargarArchivo(url, nombre) {
    const link = document.createElement("a")
    link.href = url
    link.download = nombre
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}

// Mantiene sincronizados los favoritos mostrados cuando cualquier cambio
// de movimientos los afecta (crear, editar, eliminar, restaurar, vincular).
window.addEventListener("movimientos-actualizados", async () => {
    await renderFavoritos(uid)
})

// Limpia la selección de favoritos al hacer clic fuera del contenedor.
document.addEventListener("click", (evento) => {
    if (!document.getElementById("favoritos-movimientos")?.contains(evento.target)) {
        limpiarSeleccionFavoritos()
    }
})