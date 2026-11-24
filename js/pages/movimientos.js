import { obtenerMovimientos, obtenerCuentas, actualizarMovimientoDoc } from "../../firebase/firestore.js"
import { cacheCapa } from "../core/cache.js"
import { asegurarEstilos } from "../core/estilos.js"
import { sesion } from "../core/sesion.js"
import { getFechaHoy } from "../core/fechas.js"
import { icono } from "../core/iconos.js"
import { skeletonMarkup, esqueletoContenedor } from "../ui/skeletons.js"
import { CONFIG_MOVIMIENTOS, TIPOS_MOVIMIENTO } from "../../constants/tiposMovimiento.js"
import { cuentasOperables } from "../core/familiaCuentas.js"
import { abrirModal, cerrarModal, estaAbierto, contenidoDesdeTemplate, contenidoDesdeFilas } from "../ui/modal.js"
import {
    generarFormularioMovimiento,
    recogerDatosFormulario,
    vincularSimboloDivisa
} from "../ui/formularioMovimiento.js"
import { registrarMovimiento, actualizarMovimiento, eliminarMovimiento, restaurarMovimiento, aplicarEtiquetasEnLote } from "../services/MovimientoServicio.js"
import { crearFavoritoDesdeMovimiento, ejecutarFavorito, guardarInstanciaVinculada, editarPlantillaFavorito, eliminarFavoritoConDesvinculacion, recuperarFavoritoConId, estaEjecutandoFavorito } from "../services/FavoritoServicio.js"
import { ofrecerDeshacer } from "../services/DeshacerServicio.js"
import { mostrarNotificacion } from "../ui/notificaciones.js"
import { envolverSidebar } from "../ui/colapsoSidebar.js"
import { alternarSeleccion, seleccionarRango, seleccionarTodos, limpiarSeleccion as limpiarSeleccionHelper } from "../ui/seleccion.js"
import { formatearMontoConDivisa, presentarDivisa } from "../services/DivisaServicio.js"
import { compararDivisas } from "../../constants/divisas.js"
import { esMovimientoPositivo, montoDeMovimiento, compararMovimientosPorFecha } from "../core/movimientos.js"
import { escapeHtml } from "../core/escape.js"
import { descargarArchivoSeguro } from "../core/descarga.js"
import { crearSupresorDobleClick } from "../core/supresorClick.js"
import { normalizarEtiquetas } from "../core/etiquetas.js"
import { obtenerEtiquetas } from "../repositories/EtiquetaRepositorio.js"
import { obtenerFavoritos } from "../repositories/FavoritoRepositorio.js"
import { montarSelectorEtiquetas } from "../ui/etiquetas.js"

asegurarEstilos("movimientos")

let movimientos = []
let cuentas = []
let uid = null
let filtroActual = "todos"
const seleccionados = new Set()
const seleccionadosFavoritos = new Set()
// Caché de favoritos para resolver un id sin volver a Firestore y el estado
// del gesto de clic sostenido (seleccionar para la lastbar). Sin declarar,
// asignarles en un módulo (modo estricto siempre) lanzaba ReferenceError y
// `renderFavoritos()` moría.
let favoritosCache = []
let favoritoPressTimer = null
let favoritoLongPress = false
// Claves (favoritoId o `nuevo:<movId>`) con una alternancia en curso. Evita que
// dos clics rápidos sobre el MISMO favorito intercalen mutaciones optimistas y
// rollback. Se libera en el `finally` de alternarFavoritoMovimiento.
const alternanciasEnCurso = new Set()
const ordenSeleccion = []
const sel = { ids: seleccionados, orden: ordenSeleccion }
let clickTimer = null
const supresorClick = crearSupresorDobleClick()
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
    const uidActual = sesion.uid
    const movimientosCache = uidActual ? cacheCapa.leerCache(uidActual, "movimientos") : null
    const hayCache = !!movimientosCache
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
                <select id="filtro-cuenta" class="filtro-select" aria-label="Cuenta">
                    <option value="">Cuentas</option>
                </select>
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
                <div class="campo-divisa">
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
            </div>
            <div id="totales-movimientos" class="totales" aria-busy="${hayCache ? 'false' : 'true'}">
                ${hayCache ? '' : skeletonMarkup({ rows: 1, className: "skeleton-totals" })}
            </div>
            <div id="favoritos-movimientos" class="favoritos-movimientos" hidden></div>
            <div id="lista-movimientos" class="lista-cards${hayCache ? ' contenido-entrante' : ''}" aria-busy="${hayCache ? 'false' : 'true'}">
                ${hayCache ? '' : skeletonMarkup({ rows: 4 })}
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
    renderFavoritos(uid, { desdeCache: true })
}

function limpiarSeleccionFavoritos() {
    seleccionadosFavoritos.clear()
    renderFavoritos(uid, { desdeCache: true })
}

/**
 * Modal único de un favorito. "Guardar" actualiza solo la plantilla, "Cancelar"
 * descarta y "Ejecutar" registra un movimiento con los valores que hay ahora
 * mismo en el formulario, sin modificar la plantilla.
 */
async function abrirModalFavorito(favoritoId) {
    const favorito = favoritosCache.find(f => f.id === favoritoId)
    if (!favorito) return
    limpiarSeleccionFavoritos()

    // Guardar estado anterior para rollback
    const favoritoAnterior = { ...favorito }

    const contenido = contenidoDesdeTemplate("tpl-modal-editar-favorito")

    const selectCuenta = contenido.querySelector("#editar-favorito-cuenta")
    const inputNombre = contenido.querySelector("#editar-favorito-nombre")
    const inputMonto = contenido.querySelector("#editar-favorito-monto")
    const selectDivisa = contenido.querySelector("#editar-favorito-divisa")
    const inputConcepto = contenido.querySelector("#editar-favorito-concepto")
    const inputEtiquetas = contenido.querySelector("#editar-favorito-etiquetas")

    // Poblar cuentas (solo activas, no archivadas)
    try {
        const cuentasLista = await obtenerCuentas(uid)
        const cuentasActivas = cuentasLista.filter(c => c.estado !== "archivada")
        selectCuenta.replaceChildren(
            ...cuentasActivas.map(c => {
                const opcion = document.createElement("option")
                opcion.value = c.id
                opcion.textContent = `${c.nombre || c.id} (${presentarDivisa(c.moneda)})`
                if (c.id === favorito.cuenta) opcion.selected = true
                return opcion
            })
        )
    } catch {
        selectCuenta.replaceChildren()
    }

    // Rellenar valores del favorito
    inputNombre.value = favorito.nombre || ""
    inputMonto.value = favorito.monto || ""
    selectDivisa.value = favorito.divisa || "pen"
    inputConcepto.value = favorito.concepto || ""
    inputEtiquetas.value = (favorito.etiquetas || []).join(", ")

    const leerDatos = () => {
        const nombre = inputNombre.value.trim()
        const cuenta = selectCuenta.value
        const monto = Number(inputMonto.value)
        const divisa = selectDivisa.value
        const concepto = inputConcepto.value.trim()
        const etiquetasRaw = inputEtiquetas.value.trim()
        const etiquetas = etiquetasRaw
            ? etiquetasRaw.split(",").map(e => e.trim()).filter(Boolean)
            : []

        if (!nombre) {
            mostrarNotificacion("error", "El nombre es obligatorio")
            return null
        }
        if (!Number.isFinite(monto) || monto <= 0) {
            mostrarNotificacion("error", "El monto debe ser mayor que cero")
            return null
        }
        if (!cuenta) {
            mostrarNotificacion("error", "Selecciona una cuenta")
            return null
        }
        return { nombre, cuenta, monto, divisa, concepto, etiquetas }
    }

    const botonEjecutar = document.createElement("button")
    botonEjecutar.type = "button"
    botonEjecutar.className = "modal-btn modal-btn-secondary"
    botonEjecutar.textContent = "Ejecutar"

    abrirModal({
        titulo: `Favorito: ${favorito.nombre}`,
        contenido,
        variante: "form",
        confirmText: "Guardar",
        cancelText: "Cancelar",
        footerExtra: botonEjecutar,
        // El modal solo pinta "Cancelar" si existe onCancel; aquí no hay nada
        // que deshacer fuera del formulario.
        onCancel: () => {},
        onConfirm: async () => {
            const cambios = leerDatos()
            if (!cambios) return false

            // Actualización optimista: pintar desde la caché, sin releer.
            Object.assign(favorito, cambios)
            await renderFavoritos(uid, { desdeCache: true })

            try {
                await editarPlantillaFavorito(uid, favorito, cambios)
                cacheCapa.invalidarPrefijo(uid, "favoritos")
                await renderFavoritos(uid, { desdeCache: true })
                mostrarNotificacion("exito", "Favorito actualizado")
                return true
            } catch (error) {
                // ROLLBACK: restaurar estado anterior
                console.error("Error editando favorito:", error)
                Object.assign(favorito, favoritoAnterior)
                await renderFavoritos(uid, { desdeCache: true })
                mostrarNotificacion("error", `No se pudo actualizar: ${error.message || "error desconocido"}`)
                return false
            }
        }
    })

    botonEjecutar.addEventListener("click", async () => {
        const datos = leerDatos()
        if (!datos) return
        botonEjecutar.disabled = true
        try {
            await guardarInstanciaVinculada(uid, favorito.id, {
                tipo: favorito.tipo,
                cuenta: datos.cuenta,
                monto: datos.monto,
                divisa: datos.divisa,
                // El servicio exige un concepto no vacío; si la plantilla no
                // lo tiene, se usa su nombre como concepto del movimiento.
                concepto: datos.concepto || datos.nombre,
                etiquetas: datos.etiquetas,
                fechaRealizacion: getFechaHoy()
            })
            await cargarMovimientos()
            mostrarNotificacion("exito", "Movimiento creado desde favorito")
            cerrarModal()
        } catch (error) {
            console.error("Error ejecutando favorito:", error)
            mostrarNotificacion("error", `No se pudo ejecutar el favorito: ${error.message || "error desconocido"}`)
            botonEjecutar.disabled = false
        }
    })
}

// Inserta un movimiento provisional en la lista y retorna su ID temporal
function _insertarMovimientoProvisional(favorito) {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const movTemp = {
        id: tempId,
        tipo: favorito.tipo,
        cuenta: favorito.cuenta,
        monto: favorito.monto,
        divisa: favorito.divisa,
        concepto: favorito.concepto || '',
        etiquetas: favorito.etiquetas || [],
        fechaRealizacion: getFechaHoy(),
        favoritoId: favorito.id,
        _provisional: true
    }
    movimientos.unshift(movTemp)
    return { tempId, movTemp }
}

// Reemplaza un movimiento provisional por el definitivo en la lista y en el DOM
function _reemplazarMovimientoProvisional(tempId, movimientoReal) {
    const idx = movimientos.findIndex(m => m.id === tempId)
    if (idx >= 0) {
        movimientos[idx] = { ...movimientoReal, _provisional: false }
    }
    // Reemplazar en el DOM
    const nodoAntiguo = document.querySelector(`.movimiento-item[data-movimiento-id="${tempId}"]`)
    if (nodoAntiguo) {
        const contenedor = document.getElementById("lista-movimientos")
        if (contenedor) {
            const fila = contenidoDesdeFilas("tpl-movimiento-item", [movimientoReal], m => filaMovimiento(m))[0]
            contenedor.replaceChild(fila, nodoAntiguo)
        }
    }
}

// Retira un movimiento provisional de la lista y del DOM
function _retirarMovimientoProvisional(tempId) {
    const idx = movimientos.findIndex(m => m.id === tempId)
    if (idx >= 0) {
        movimientos.splice(idx, 1)
    }
    const nodo = document.querySelector(`.movimiento-item[data-movimiento-id="${tempId}"]`)
    if (nodo) {
        nodo.remove()
    }
}

async function ejecutarFavoritoDesdeItem(favoritoId) {
    const favorito = favoritosCache.find(f => f.id === favoritoId)
    if (!favorito) return
    if (estaEjecutandoFavorito(favoritoId)) return // Idempotencia: ya hay ejecución en curso
    limpiarSeleccionFavoritos()

    // Estado visual: pendiente en la tarjeta del favorito
    const itemFav = document.querySelector(`.favorito-item[data-favorito-id="${favoritoId}"]`)
    if (itemFav) itemFav.classList.add("favorito-pendiente")

    // 1. Insertar movimiento provisional inmediatamente
    const { tempId, movTemp } = _insertarMovimientoProvisional(favorito)
    // Render selectivo: prepend en la lista
    const contenedorLista = document.getElementById("lista-movimientos")
    if (contenedorLista) {
        const fila = contenidoDesdeFilas("tpl-movimiento-item", [movTemp], m => filaMovimiento(m))[0]
        fila.classList.add("movimiento-pendiente")
        contenedorLista.prepend(fila)
    }

    try {
        const movimiento = await ejecutarFavorito(uid, favorito)
        // Éxito: reconciliar provisional -> real
        _reemplazarMovimientoProvisional(tempId, movimiento)
        // Invalidar caché (el servicio ya invalida "movimientos" y "cuentas")
        // Estado visual: confirmado en la tarjeta del favorito
        if (itemFav) {
            itemFav.classList.remove("favorito-pendiente")
            itemFav.classList.add("favorito-confirmado")
            setTimeout(() => itemFav.classList.remove("favorito-confirmado"), 500)
        }
        mostrarNotificacion("exito", "Movimiento creado desde favorito")
        return movimiento
    } catch (error) {
        // ROLLBACK: retirar provisional y restaurar estado
        _retirarMovimientoProvisional(tempId)
        if (itemFav) {
            itemFav.classList.remove("favorito-pendiente")
            if (error.message === "Ejecución en curso para este favorito") {
                mostrarNotificacion("info", "Ya se está ejecutando este favorito")
            } else {
                console.error("Error ejecutando favorito:", error)
                itemFav.classList.add("favorito-error")
                setTimeout(() => itemFav.classList.remove("favorito-error"), 600)
                mostrarNotificacion("error", `No se pudo ejecutar el favorito: ${error.message}`)
            }
        }
        throw error
    }
}

async function renderFavoritos(uidUsuario, { desdeCache = false } = {}) {
    const contenedor = document.getElementById("favoritos-movimientos")
    if (!contenedor) return

    // Las operaciones optimistas pintan desde la caché en memoria: esperar una
    // lectura de Firestore hacía que la tarjeta apareciera con retraso y, peor,
    // que la lectura pisara el estado optimista antes de persistirlo.
    if (!desdeCache) favoritosCache = await obtenerFavoritos(uidUsuario)
    // La estrella depende de la plantilla, no del favoritoId histórico.
    sincronizarEstrellasFavoritos()

    // Filtrar favoritos según el tipo activo en el sidebar (mismo criterio que movimientos)
    const filtro = FILTROS_DISPONIBLES.find(f => f.filtro === filtroActual)
    let favoritosFiltrados = favoritosCache
    if (filtro?.tipos) {
        favoritosFiltrados = favoritosCache.filter(fav => filtro.tipos.includes(fav.tipo))
    }

    // Si ya no queda ningún favorito, la selección tampoco puede seguir viva:
    // ids que apuntan a favoritos borrados dejarían la lastbar Showing un
    // contexto que no existe.
    if (favoritosFiltrados.length === 0) seleccionadosFavoritos.clear()

    if (favoritosFiltrados.length === 0) {
        contenedor.hidden = true
        actualizarEstadoLastbar()
        return
    }

    contenedor.replaceChildren(
        contenidoDesdeFilas("tpl-favorito-item", favoritosFiltrados, f => ({
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
    contenedor.hidden = false

    if (contenedor.dataset.favoritosListo !== "1") {
        contenedor.dataset.favoritosListo = "1"

        contenedor.addEventListener("pointerdown", (evento) => {
            const item = evento.target.closest(".favorito-item")
            if (!item || evento.target.closest(".favorito-ejecutar")) return
            favoritoLongPress = false
            favoritoPressTimer = setTimeout(() => {
                favoritoPressTimer = null
                favoritoLongPress = true
                const id = item.dataset.favoritoId
                if (id) toggleSeleccionFavorito(id)
            }, 500)
        })

        const cancelarPulsacion = () => {
            if (!favoritoPressTimer) return
            clearTimeout(favoritoPressTimer)
            favoritoPressTimer = null
        }
        contenedor.addEventListener("pointerup", cancelarPulsacion)
        contenedor.addEventListener("pointercancel", cancelarPulsacion)
        contenedor.addEventListener("pointerleave", cancelarPulsacion)

        contenedor.addEventListener("click", async (evento) => {
            // Si se hizo click en el botón ejecutar del favorito, ejecutarlo
            // sin tocar la selección ni abrir el modal.
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

            // El click que sigue a un clic sostenido solo sirvió para
            // seleccionar: no debe abrir además el modal.
            if (favoritoLongPress) {
                favoritoLongPress = false
                return
            }

            const item = evento.target.closest(".favorito-item")
            if (!item) return
            const id = item.dataset.favoritoId
            if (id) await abrirModalFavorito(id)
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
    console.info("[INFO] Movimientos iniciado para UID:", uid)

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

    // Si ya hay datos en caché (memoria o localStorage), no mostrar esqueleto:
    // renderizar directamente. Esto evita el parpadeo al cambiar de pestaña
    // cuando los datos ya se recibieron antes de la BD.
    const cache = cacheCapa.leerCache(uid, "movimientos")
    if (cache) {
        movimientos = cache
        container?.removeAttribute("aria-busy")
        totales?.removeAttribute("aria-busy")
        movimientos.sort(compararMovimientosPorFecha)
        limpiarSeleccionHelper(sel)
        actualizarSeleccionEnDOM()
        actualizarEstadoLastbar()
        actualizarOpcionesEtiquetas()
        aplicarFiltro()

        // Entrada suave del contenido cuando ya viene de caché (sin esqueleto):
        // aparece con opacity 0 y se desvanece a 1 en 0.2 s, sin salto brusco.
        container.classList.add("contenido-entrante")
        requestAnimationFrame(() => {
            container.classList.remove("contenido-entrante")
        })

        await renderFavoritos(uid)
        return
    }

    container?.setAttribute("aria-busy", "true")
    totales?.setAttribute("aria-busy", "true")
    if (container) container.replaceChildren(esqueletoContenedor("list", 4))
    if (totales) totales.replaceChildren(esqueletoContenedor("list", 1, "skeleton-totals"))
    try {
        movimientos = await obtenerMovimientos(uid)
        movimientos.sort(compararMovimientosPorFecha)
        limpiarSeleccionHelper(sel)
        actualizarSeleccionEnDOM()
        actualizarEstadoLastbar()
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
    if (totales) totales.replaceChildren()
}

// ============================================
// RENDERIZADO
// ============================================

// El favoritoId de un movimiento es histórico: se conserva aunque la plantilla
// se elimine para poder recuperarla. La estrella solo debe estar encendida
// cuando la plantilla existe de verdad en la caché de favoritos.
function esFavoritoActivo(favoritoId) {
    return Boolean(favoritoId) && favoritosCache.some(f => f.id === favoritoId)
}

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
    const favoritoActivo = esFavoritoActivo(m.favoritoId)

    return {
        valores: {
            "item@class": `movimiento-item${seleccionados.has(m.id) ? " seleccionado" : ""}`,
            "item@data-movimiento-id": m.id,
            "item@data-favorito-id": m.favoritoId || "",
            "favorito@class": `movimiento-favorito${favoritoActivo ? " es-favorito" : ""}`,
            "favorito@data-favorito-id": m.favoritoId || "",
            "favorito@aria-label": favoritoActivo ? "Quitar de favoritos" : "Marcar como favorito",
            "favorito@title": favoritoActivo ? "Quitar de favoritos" : "Marcar como favorito",
            concepto: m.concepto || m.activo || tipoNombre || "Sin concepto",
            detalle: [fecha, cuenta].filter(Boolean).join(" · "),
            "valor": `${signo} ${formatearMontoConDivisa(Number.isFinite(monto) ? Math.abs(monto) : 0, m.divisa || "pen")}`,
            "valor@class": `movimiento-valor ${clase}`
        },
        html: {
            etiquetas: contenidoDesdeFilas("tpl-badge-etiqueta", etiquetas, e => ({
                valores: { badge: e }
            })),
            "icono-favorito": icono("star", 16),
            "icono-editar": icono("pencil", 15),
            "icono-eliminar": icono("trash", 15)
        }
    }
}

// Refleja en las filas ya pintadas el estado real de la caché de favoritos.
// Necesario al cargar la página (las filas se pintan antes de leer favoritos)
// y cuando la caché cambia sin volver a renderizar la lista completa.
function sincronizarEstrellasFavoritos() {
    document.querySelectorAll(".movimiento-item").forEach(card => {
        const activo = esFavoritoActivo(card.dataset.favoritoId)
        const estrella = card.querySelector(".movimiento-favorito")
        if (!estrella) return
        estrella.classList.toggle("es-favorito", activo)
        estrella.setAttribute("aria-label", activo ? "Quitar de favoritos" : "Marcar como favorito")
        estrella.setAttribute("title", activo ? "Quitar de favoritos" : "Marcar como favorito")
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
            renderFavoritos(uid)
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
    aplicarAccionesSiempreVisibles()
}

function aplicarAccionesSiempreVisibles() {
    const lista = document.getElementById("lista-movimientos")
    if (!lista) return
    const siempre = sesion.getPreferencias()?.accesibilidad?.accionesSiempreVisibles === true
    lista.classList.toggle("acciones-siempre-visibles", siempre)
}

function configurarEventosGlobales() {
    if (eventosGlobalesListos) return
    eventosGlobalesListos = true
    document.addEventListener("click", manejarClickFueraCards)
    document.addEventListener("keydown", manejarTecladoSeleccion)
}

function marcarSupresorClick() {
    supresorClick.marcar()
}

function consumirSupresorClick() {
    return supresorClick.consumir()
}

async function alternarFavoritoMovimiento(m) {
    // Un movimiento puede conservar un favoritoId histórico aunque su documento
    // ya no exista (se conserva para recuperación). Distinguimos tres casos:
    //   - favoritoActivo: el documento existe en favoritosCache -> desmarcar
    //   - recuperacion:  tiene favoritoId pero el documento no existe -> recuperar
    //   - nuevo:         no tiene favoritoId -> crear con id temporal y reconciliar
    const favoritoIdOriginal = m.favoritoId
    const favoritoActivo = Boolean(favoritoIdOriginal) && favoritosCache.some(f => f.id === favoritoIdOriginal)
    const esRecuperacion = Boolean(favoritoIdOriginal) && !favoritoActivo

    // Protección de concurrencia: una segunda alternancia sobre el MISMO favorito
    // se ignora mientras la primera esté en curso. Se libera en finally.
    // Un id temporal sigue siendo la misma operación "nuevo" del movimiento:
    // sin esto, el segundo clic lo vería como un favorito activo y lo desmarcaría.
    const esIdTemporal = typeof favoritoIdOriginal === "string" && favoritoIdOriginal.startsWith("temp_")
    const claveEnCurso = favoritoIdOriginal && !esIdTemporal ? favoritoIdOriginal : `nuevo:${m.id}`
    if (alternanciasEnCurso.has(claveEnCurso)) return
    alternanciasEnCurso.add(claveEnCurso)

    // Estrellas afectadas: al desmarcar, todas las instancias que comparten el
    // favoritoId; en los demás casos, solo la instancia actual.
    const instanciasAfectadas = favoritoActivo
        ? movimientos.filter(mov => mov.favoritoId === favoritoIdOriginal)
        : [m]
    const estrellasAnteriores = new Map()
    for (const mov of instanciasAfectadas) {
        const card = document.querySelector(`.movimiento-item[data-movimiento-id="${mov.id}"]`)
        const estrella = card?.querySelector(".movimiento-favorito")
        if (estrella) estrellasAnteriores.set(mov.id, estrella.classList.contains("es-favorito"))
    }

    // Estado del favorito afectado para el rollback selectivo (sin tocar el resto
    // de la caché, para no pisar cambios optimistas de otros favoritos).
    const favoritoAfectado = favoritoActivo
        ? favoritosCache.find(f => f.id === favoritoIdOriginal)
        : null
    let tempFavId = null
    let favoritoProvisional = null

    function pintarEstrella(mov, activo) {
        const card = document.querySelector(`.movimiento-item[data-movimiento-id="${mov.id}"]`)
        if (!card) return
        // El dataset debe seguir al favoritoId vigente: es lo que consulta
        // sincronizarEstrellasFavoritos() tras cada cambio de caché.
        card.dataset.favoritoId = mov.favoritoId || ""
        const estrella = card.querySelector(".movimiento-favorito")
        if (!estrella) return
        estrella.dataset.favoritoId = mov.favoritoId || ""
        estrella.classList.toggle("es-favorito", activo)
        estrella.setAttribute("aria-label", activo ? "Quitar de favoritos" : "Marcar como favorito")
        estrella.setAttribute("title", activo ? "Quitar de favoritos" : "Marcar como favorito")
    }

    try {
        // ----- Actualización optimista -----
        if (favoritoActivo) {
            // Desmarcar: apagar todas las estrellas vinculadas y retirar de la caché
            for (const mov of instanciasAfectadas) pintarEstrella(mov, false)
            favoritosCache = favoritosCache.filter(f => f.id !== favoritoIdOriginal)
        } else {
            // Marcar / recuperar: encender la estrella y añadir el favorito a la caché.
            // La operación optimista usa el id histórico (recuperación) o uno temporal
            // (nuevo), nunca sustituye un id histórico por uno temporal.
            tempFavId = favoritoIdOriginal || `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`
            if (!favoritoIdOriginal) m.favoritoId = tempFavId
            pintarEstrella(m, true)
            favoritoProvisional = {
                id: tempFavId,
                nombre: m.concepto || `${m.tipo} en ${m.cuenta}`,
                tipo: m.tipo,
                cuenta: m.cuenta || '',
                monto: m.monto || 0,
                divisa: m.divisa || 'pen',
                concepto: m.concepto || '',
                etiquetas: m.etiquetas || []
            }
            favoritosCache = [...favoritosCache, favoritoProvisional]
        }
        // Render inmediato de la barra desde la caché (sin esperar a Firestore)
        await renderFavoritos(uid, { desdeCache: true })

        // ----- Persistencia -----
        if (favoritoActivo) {
            // Desmarcar: eliminar el documento; m.favoritoId se conserva (histórico).
            await eliminarFavoritoConDesvinculacion(uid, favoritoIdOriginal)
        } else if (esRecuperacion) {
            // Recuperar con el MISMO id histórico; la plantilla se reconstruye desde
            // el movimiento. m.favoritoId conserva el id histórico (no se toca).
            await recuperarFavoritoConId(uid, favoritoIdOriginal, m)
        } else {
            // Nuevo: reconciliar el id temporal con el definitivo en movimiento y caché.
            const favoritoIdReal = await crearFavoritoDesdeMovimiento(uid, m)
            m.favoritoId = favoritoIdReal
            pintarEstrella(m, true)
            let reconciliado = false
            favoritosCache = favoritosCache.map(f => {
                if (f.id !== tempFavId) return f
                reconciliado = true
                return { ...f, id: favoritoIdReal }
            })
            // Otra lectura pudo refrescar la caché durante la escritura: si el
            // provisional ya no está, se reincorpora con su id real.
            if (!reconciliado) {
                favoritosCache = [...favoritosCache, { ...favoritoProvisional, id: favoritoIdReal }]
            }
        }
        // Invalidar caché para próximas navegaciones
        cacheCapa.invalidarPrefijo(uid, "favoritos")
        cacheCapa.invalidarPrefijo(uid, "movimientos")
        await renderFavoritos(uid, { desdeCache: true })
        mostrarNotificacion("exito", favoritoActivo ? "Quitado de favoritos" : "Añadido a favoritos")
    } catch (error) {
        // ----- Rollback selectivo: solo el favorito afectado -----
        console.error("Error alternando favorito:", error)
        if (favoritoActivo) {
            // Desmarcar falló: reponer el favorito en la caché si no está (sin pisar otros)
            if (!favoritosCache.some(f => f.id === favoritoIdOriginal)) {
                favoritosCache = [...favoritosCache, favoritoAfectado]
            }
        } else {
            // Marcar/recuperar falló: retirar SOLO el favorito provisional añadido
            // (id histórico en recuperación, temporal en creación).
            favoritosCache = favoritosCache.filter(f => f.id !== tempFavId)
            // Restaurar el favoritoId original del movimiento (histórico o ausente)
            m.favoritoId = favoritoIdOriginal
        }
        // Restaurar las estrellas afectadas a su estado previo
        for (const mov of instanciasAfectadas) {
            const eraFavorito = estrellasAnteriores.get(mov.id)
            if (eraFavorito !== undefined) pintarEstrella(mov, eraFavorito)
        }
        await renderFavoritos(uid, { desdeCache: true })
        mostrarNotificacion("error", `No se pudo ${favoritoActivo ? "quitar de favoritos" : "añadir a favoritos"}: ${error.message}`)
    } finally {
        alternanciasEnCurso.delete(claveEnCurso)
    }
}

async function manejarClickCard(evento) {
    // La estrella ya no vive dentro de `.card-item-acciones` (queda a la
    // izquierda de la fila), así que no pasa por la rama de abajo: se atiende
    // aquí, igual que `.posicion-favorito` en la lista de inversiones.
    const botonFavorito = evento.target.closest(".movimiento-favorito")
    if (botonFavorito) {
        evento.stopPropagation()
        const card = botonFavorito.closest(".movimiento-item")
        // `alternarFavoritoMovimiento` espera el movimiento entero (lee tipo y
        // favoritoId), no su id.
        const m = movimientos.find(x => x.id === card?.dataset.movimientoId)
        if (m) await alternarFavoritoMovimiento(m)
        return
    }

    // Botones de acción revelados por hover/swipe
    const accionBtn = evento.target.closest(".card-action-btn")
    if (accionBtn) {
        evento.stopPropagation()
        const card = accionBtn.closest(".movimiento-item")
        const m = movimientos.find(x => x.id === card?.dataset.movimientoId)
        ocultarAccionesCards()
        if (!m) return
        if (accionBtn.dataset.accion === "editar") {
            abrirFormularioMovimiento(m.tipo, m)
        } else {
            abrirModalEliminarMovimiento(m)
        }
        return
    }

    const card = evento.target.closest(".movimiento-item")

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

    const id = card.dataset.movimientoId

    // Shift + click: seleccionar rango (reemplaza la selección actual).
    if (evento.shiftKey && seleccionarRango(sel, movimientos.map(m => m.id), id)) {
        actualizarSeleccionEnDOM()
        actualizarEstadoLastbar()
        return
    }

    // Click simple o Ctrl/Cmd + click: alternar la card clickeada.
    alternarSeleccion(sel, id)
    actualizarSeleccionEnDOM()
    actualizarEstadoLastbar()
}

function manejarDobleClickCard(evento) {
    if (evento.target.closest(".card-action-btn, .movimiento-favorito")) return
    const card = evento.target.closest(".movimiento-item")
    if (!card) return
    if (clickTimer) {
        clearTimeout(clickTimer)
        clickTimer = null
    }
    // Doble click siempre abre el detalle (D3).
    abrirDetalleMovimiento(card.dataset.movimientoId)
}

function manejarClickFueraCards(evento) {
    if (!document.getElementById("lista-movimientos")) return
    if (evento.target.closest(".movimiento-item")) return
    if (evento.target.closest("#app-footer")) return
    if (evento.target.closest(".modal-overlay")) return
    ocultarAccionesCards()
    limpiarSeleccionHelper(sel)
    actualizarSeleccionEnDOM()
    actualizarEstadoLastbar()
}

function manejarTecladoSeleccion(evento) {
    if (!document.getElementById("lista-movimientos")) return
    if (estaAbierto()) return

    if (evento.key === "Escape") {
        if (seleccionados.size > 0) {
            ocultarAccionesCards()
            limpiarSeleccionHelper(sel)
            actualizarSeleccionEnDOM()
            actualizarEstadoLastbar()
        }
        return
    }

    // Ctrl + A: seleccionar todos los visibles
    if (evento.key === "a" && (evento.ctrlKey || evento.metaKey)) {
        evento.preventDefault()
        seleccionarTodos(sel, movimientos.map(m => m.id))
        actualizarSeleccionEnDOM()
        actualizarEstadoLastbar()
        return
    }

    if (evento.key !== "Delete" && evento.key !== "Backspace") return
    if (evento.target.matches("input, textarea, select")) return
    if (seleccionados.size === 0) return
    evento.preventDefault()
    eliminarSeleccionados()
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

        const card = evento.target.closest(".movimiento-item")
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
            if (!seleccionados.has(card.dataset.movimientoId)) {
                alternarSeleccion(sel, card.dataset.movimientoId)
                actualizarSeleccionEnDOM()
                actualizarEstadoLastbar()
                marcarSupresorClick()
            }
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

    container.replaceChildren(contenidoDesdeFilas("tpl-movimiento-item", filtrados, m => filaMovimiento(m, cuentaId)))
}

// ============================================
// TOTALES DEL FILTRO
// ============================================

function renderizarTotales(filtrados, cuentaId = null) {
    const contenedor = document.getElementById("totales-movimientos")
    if (!contenedor) return
    pintarTotales(contenedor, filtrados, cuentaId)
}

function pintarTotales(contenedor, filtrados, cuentaId = null) {

    const porDivisa = {}

    filtrados.forEach(m => {
        const divisa = (m.divisa || "pen").toLowerCase()
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

    const divisasOrdenadas = Object.entries(porDivisa)
        .sort(([a], [b]) => compararDivisas(a, b))

    // Mismo formato que los totales de cuentas: la divisa acompaña a cada
    // importe (+S/ 139.40 / −S/ 0.00) y respeta símbolo o código.
    const lineas = contenidoDesdeFilas("tpl-totales-mov-linea", divisasOrdenadas, ([divisa, totales]) => ({
        valores: {
            positivo: `+${formatearMontoConDivisa(totales.positivo, divisa)}`,
            negativo: `−${formatearMontoConDivisa(totales.negativo, divisa)}`
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

    // El modal se crea después de definir los callbacks que lo usan.
    let modalEl = null

    // Just-in-time: asegurar que los selects de cuenta tengan opciones
    const asegurarCuentasEnFormulario = async () => {
        const selectsCuenta = [
            formulario.querySelector("#campo-cuenta"),
            formulario.querySelector("#campo-cuentaOrigen"),
            formulario.querySelector("#campo-cuentaDestino")
        ].filter(Boolean)

        const selectTarjeta = formulario.querySelector("#campo-tarjeta")

        const necesitaCargar = (select) => {
            if (!select) return false
            const opcionesSelect = Array.from(select.options || [])
            if (opcionesSelect.length === 0) return true
            // Si solo tiene una opción vacía/sin valor o placeholder
            const reales = opcionesSelect.filter(o => o.value && o.value !== "")
            return reales.length === 0
        }

        const haySelectsSinOpciones = selectsCuenta.some(necesitaCargar) || necesitaCargar(selectTarjeta)

        if (!haySelectsSinOpciones) return

        const deshabilitarYMostrar = (select, texto) => {
            if (!select) return
            select.disabled = true
            select.replaceChildren()
            const opt = document.createElement("option")
            opt.value = ""
            opt.disabled = true
            opt.selected = true
            opt.textContent = texto
            select.appendChild(opt)
        }

        selectsCuenta.forEach(s => deshabilitarYMostrar(s, "Cargando cuentas..."))
        deshabilitarYMostrar(selectTarjeta, "Cargando cuentas...")

        const btnConfirmar = modalEl?.querySelector(".modal-confirm") || modalEl?.querySelector("button[type='submit']") || document.querySelector(".modal-confirm")
        if (btnConfirmar) btnConfirmar.disabled = true

        const uidForm = uid || (typeof sesion !== 'undefined' && sesion.uid)
        if (!uidForm || typeof uidForm !== 'string' || uidForm.trim() === '') {
            console.error('[movimientos] Sin UID válido para cargar cuentas del formulario')
            selectsCuenta.forEach(s => deshabilitarYMostrar(s, 'Error de sesión. Recarga la página.'))
            deshabilitarYMostrar(selectTarjeta, 'Error de sesión. Recarga la página.')
            if (btnConfirmar) btnConfirmar.disabled = true
            return
        }

        try {
            const cuentasUsuario = await obtenerCuentas(uidForm)
            let cuentasActivas = Array.isArray(cuentasUsuario) ? cuentasUsuario.slice() : []
            if (typeof cuentasOperables === 'function') {
                cuentasActivas = cuentasOperables(cuentasActivas)
            }
            cuentasActivas = cuentasActivas.filter(c => c && c.estado !== "archivada")

            const poblarSelect = (select, tipoFiltro) => {
                if (!select) return
                select.replaceChildren()
                let lista = cuentasActivas
                if (tipoFiltro === "soloNoCredito") {
                    lista = cuentasActivas.filter(c => c.tipo !== "credito")
                } else if (tipoFiltro === "soloCredito") {
                    lista = cuentasActivas.filter(c => c.tipo === "credito")
                }

                if (lista.length === 0) {
                    deshabilitarYMostrar(select, cuentasActivas.length === 0 ? "No tienes cuentas creadas. Crea una primero." : "No hay cuentas disponibles para este tipo")
                    return
                }

                const optVacia = document.createElement("option")
                optVacia.value = ""
                optVacia.disabled = true
                optVacia.selected = true
                optVacia.textContent = "Seleccionar cuenta"
                select.appendChild(optVacia)

                for (const c of lista) {
                    const opt = document.createElement("option")
                    opt.value = c.id
                    opt.textContent = `${c.nombre || c.id} (${presentarDivisa(c.moneda)})`
                    opt.dataset.moneda = (c.moneda || "pen").toLowerCase()
                    opt.dataset.tipo = c.tipo || "otro"
                    select.appendChild(opt)
                }
                select.disabled = false
                if (typeof select._aplicarBusqueda === 'function') {
                    select._aplicarBusqueda()
                }
                select.dispatchEvent(new Event('change'))
            }

            const esPagoTarjeta = tipo === TIPOS_MOVIMIENTO.PAGO_TARJETA
            const esTransferencia = tipo === TIPOS_MOVIMIENTO.TRANSFERENCIA

            selectsCuenta.forEach(s => {
                if (esPagoTarjeta || esTransferencia) {
                    poblarSelect(s, "soloNoCredito")
                } else {
                    poblarSelect(s)
                }
            })
            poblarSelect(selectTarjeta, "soloCredito")

            const hayCuentasDisponibles = Array.from(document.querySelectorAll('#form-movimiento select')).some(select => {
                const opts = Array.from(select.options || []).filter(o => o.value && o.value !== "")
                return opts.length > 0
            })

            if (btnConfirmar) {
                if (!hayCuentasDisponibles) {
                    btnConfirmar.disabled = true
                } else {
                    btnConfirmar.disabled = false
                }
            }
        } catch (error) {
            console.error("Error cargando cuentas para formulario:", error?.code, error?.message, error)
            selectsCuenta.forEach(s => deshabilitarYMostrar(s, "Error al cargar cuentas. Intenta de nuevo."))
            deshabilitarYMostrar(selectTarjeta, "Error al cargar cuentas. Intenta de nuevo.")
            if (btnConfirmar) btnConfirmar.disabled = true
        }
    }

    modalEl = abrirModal({
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

    // Just-in-time: cargar cuentas si el formulario no las tiene
    await asegurarCuentasEnFormulario()

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

    contenedor.replaceChildren(contenidoDesdeTemplate(bloqueado
        ? "tpl-detalle-acciones-bloqueado"
        : "tpl-detalle-acciones-desbloqueado",
        {
            html: {
                "icono-editar": icono("pencil", 15),
                "icono-eliminar": icono("trash", 15)
            }
        }
    ))
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

function actualizarSeleccionEnDOM() {
    document.querySelectorAll(".movimiento-item").forEach(card => {
        card.classList.toggle("seleccionado", seleccionados.has(card.dataset.movimientoId))
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

export function haySeleccionActiva() {
    return seleccionados.size > 0
}

export async function editarSeleccionados() {
    // Editar sirve para los dos tipos de selección. Si hay favoritos
    // marcados mandan ellos; el botón queda desactivo con más de uno, así que
    // aquí solo llega el caso de uno.
    if (seleccionadosFavoritos.size === 1) {
        const favoritoId = [...seleccionadosFavoritos][0]
        await abrirModalFavorito(favoritoId)
        return
    }

    if (seleccionados.size !== 1) return

    const id = [...seleccionados][0]
    const movimiento = movimientos.find(m => m.id === id)
    if (!movimiento) return

    limpiarSeleccionHelper(sel)
    actualizarSeleccionEnDOM()
    actualizarEstadoLastbar()
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

    limpiarSeleccionHelper(sel)
    actualizarSeleccionEnDOM()
    actualizarEstadoLastbar()
    abrirModalEliminarVarios(lista)
}

export async function etiquetarSeleccionados() {
    // Sin selección, el botón abre el catálogo de etiquetas (las del sistema y
    // las que creó el usuario) y deja crear más. No se toca ningún
    // movimiento: sin selección no hay a quién etiquetar.
    if (seleccionados.size === 0) {
        await abrirModalCatalogoEtiquetas()
        return
    }

    const lista = [...seleccionados]
        .map(id => movimientos.find(m => m.id === id))
        .filter(Boolean)
    if (!lista.length) return

    await abrirModalEtiquetarMasivo(lista)
}

// Catálogo de etiquetas a secas: se ve lo que hay (sistema + usuario) y se
// puede crear más, pero ningún movimiento cambia. El click en un chip abre su
// editor (renombrar, color, borrar), igual que en Configuración.
async function abrirModalCatalogoEtiquetas() {
    const contenido = contenidoDesdeTemplate("tpl-catalogo-etiquetas")
    const contenedor = contenido.querySelector("#catalogo-chips-etiquetas")

    abrirModal({
        titulo: "Etiquetas",
        contenido,
        variante: "narrow",
        confirmText: "Cerrar",
        cancelText: "",
        onConfirm: () => true
    })

    await montarSelectorEtiquetas(contenedor, { gestion: true })
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
                limpiarSeleccionHelper(sel)
                actualizarSeleccionEnDOM()
                actualizarEstadoLastbar()
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

function abrirModalEliminarVariosFavoritos(lista) {
    const hayVarios = lista.length > 1
    const modalEl = abrirModal({
        titulo: hayVarios ? "Eliminar favoritos" : "Eliminar favorito",
        contenido: contenidoDesdeTemplate("tpl-confirmar-eliminar-favorito", {
            valores: {
                nombre: hayVarios ? `${lista.length} favorito(s)` : (lista[0]?.nombre || "Favorito"),
                hint: hayVarios ? `Se eliminarán ${lista.length} favorito(s).` : "",
                desvincula: "true"
            }
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
                        // Usar eliminarFavorito del repositorio (solo borra el documento, no toca favoritoId en movimientos)
                        const { eliminarFavorito } = await import("../repositories/FavoritoRepositorio.js")
                        await eliminarFavorito(uid, f.id)
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
                                // Recrear el favorito con el MISMO ID usando setDoc
                                const { db, doc, setDoc, serverTimestamp } = await import("../../firebase/firestore.js")
                                await setDoc(doc(db, "usuarios", uid, "favoritos", s.id), {
                                    nombre: s.favorito.nombre,
                                    tipo: s.favorito.tipo,
                                    cuenta: s.favorito.cuenta,
                                    monto: s.favorito.monto,
                                    divisa: s.favorito.divisa,
                                    concepto: s.favorito.concepto || '',
                                    etiquetas: s.favorito.etiquetas || [],
                                    fechaCreacion: serverTimestamp()
                                })
                                for (const movimientoId of s.movimientosVinculados) {
                                    await actualizarMovimientoDoc(uid, movimientoId, { favoritoId: s.id })
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
                presentarDivisa(m.divisa),
                (m.etiquetas || []).filter(Boolean).join(", ")
            ])

        const cabecera = ["Fecha", "Tipo", "Concepto", "Cuenta", "Monto", "Divisa", "Etiquetas"]
        const csv = [cabecera, ...filas]
            .map(fila => fila.map(valor => escaparCSV(valor)).join(","))
            .join("\r\n")

        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)

        descargarArchivoSeguro(url, `escinco_movimientos_${getFechaHoy()}.csv`)
        // Revocación diferida con margen (1000 ms): evita cancelar la
        // descarga antes de que arranque (bug #9).

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