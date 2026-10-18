// ============================================
// PRESUPUESTOS — MODAL (sin router, es un modal más)
// ============================================
// Se abre desde la lastbar persistente (botón "Presupuestos") y desde la
// card de presupuestos del dashboard. No usa el router: es un modal más.

import { abrirModal, cerrarModal, contenidoDesdeTemplate, contenidoDesdeFilas } from "./modal.js"
import {
    obtenerPresupuestosConProgreso,
    eliminarPresupuesto,
    crearPresupuestoServicio,
    actualizarPresupuesto
} from "../services/PresupuestoServicio.js"
import { obtenerPresupuesto } from "../repositories/PresupuestoRepositorio.js"
import { obtenerEtiquetas } from "../repositories/EtiquetaRepositorio.js"
import { sesion } from "../core/sesion.js"
import { icono } from "../core/iconos.js"
import { montarSelectorEtiquetas } from "./etiquetas.js"
import { mostrarNotificacion } from "./notificaciones.js"
import { formatearMontoConDivisa } from "../services/DivisaServicio.js"

// ============================================
// PLANTILLAS
// ============================================

function plantillaPresupuestoCard(p) {
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

// ============================================
// AVISOS
// ============================================

// Avisa al dashboard para que refresque la card de presupuestos.
function notificarCambioPresupuestos() {
    window.dispatchEvent(new CustomEvent("presupuestos-actualizados"))
}

// ============================================
// FORMULARIO DE CREACIÓN / EDICIÓN
// ============================================

// Alterna entre "Categoría del sistema" y "Etiquetas" en el formulario.
function configurarToggleTipo(form) {
    const inputTipo = form.querySelector("#presupuesto-tipo")
    const grupoCategoria = form.querySelector("#grupo-categoria")
    const grupoEtiquetas = form.querySelector("#grupo-etiquetas")
    const btnCategoria = form.querySelector('.toggle-option[data-tipo="categoria"]')
    const btnEtiquetas = form.querySelector('.toggle-option[data-tipo="etiquetas"]')
    const selectCategoria = form.querySelector("#presupuesto-categoria")
    const inputEtiquetas = form.querySelector("#campo-etiquetas-presupuesto")

    if (!inputTipo || !grupoCategoria || !grupoEtiquetas || !btnCategoria || !btnEtiquetas) return

    const aplicar = tipo => {
        inputTipo.value = tipo
        const esCat = tipo === "categoria"
        grupoCategoria.hidden = !esCat
        grupoEtiquetas.hidden = esCat
        if (selectCategoria) selectCategoria.required = esCat
        btnCategoria.classList.toggle("activo", esCat)
        btnEtiquetas.classList.toggle("activo", !esCat)
        inputEtiquetas.required = !esCat
    }

    btnCategoria.addEventListener("click", () => aplicar("categoria"))
    btnEtiquetas.addEventListener("click", () => aplicar("etiquetas"))

    // Valor inicial: si hay etiquetas preseleccionadas, mostrar etiquetas.
    const etiquetasIniciales = inputEtiquetas.value
    if (etiquetasIniciales) aplicar("etiquetas")
}

// Lee las etiquetas seleccionadas del input oculto del selector de chips.
function leerEtiquetasSeleccionadas(form) {
    const input = form.querySelector("#campo-etiquetas-presupuesto")
    if (!input || !input.value) return []
    return input.value.split(",").map(e => e.trim()).filter(Boolean)
}

// Monta el selector de chips de etiquetas (solo visible cuando se elige
// "Etiquetas"). Se llama después de abrir el modal, porque el contenedor
// debe estar en el DOM.
async function montarSelectorPresupuesto(form, etiquetasSeleccionadas = []) {
    const contenedor = form.querySelector("#chips-presupuesto-etiquetas")
    if (!contenedor) return

    const uid = sesion.uid
    let catalogo = []
    try {
        catalogo = await obtenerEtiquetas(uid)
    } catch (error) {
        console.warn("[WARN] No se pudo cargar el catálogo de etiquetas:", error?.code || error)
    }

    // Rellenar el input oculto con las etiquetas preseleccionadas (edición).
    const input = form.querySelector("#campo-etiquetas-presupuesto")
    if (input && etiquetasSeleccionadas.length) input.value = etiquetasSeleccionadas.join(",")

    await montarSelectorEtiquetas(contenedor, { entrada: "campo-etiquetas-presupuesto" })
}

// ============================================
// CREAR PRESUPUESTO
// ============================================

export async function abrirModalCrearPresupuesto() {
    const uid = sesion.uid
    if (!uid) {
        console.error("[ERROR] No hay UID disponible")
        return
    }

    const modalEl = abrirModal({
        titulo: "Nuevo presupuesto",
        contenido: contenidoDesdeTemplate("tpl-form-presupuesto"),
        confirmText: "Crear",
        cancelText: "Cancelar",
        onConfirm: async () => {
            const form = document.getElementById("form-presupuesto")
            if (!form) return false

            const nombre = (form.querySelector("#presupuesto-nombre")?.value || "").trim()
            const tipo = form.querySelector("#presupuesto-tipo")?.value || "categoria"
            const categoria = tipo === "categoria" ? (form.querySelector("#presupuesto-categoria")?.value || "") : null
            const etiquetas = tipo === "etiquetas" ? leerEtiquetasSeleccionadas(form) : []
            const monto = Number(form.querySelector("#presupuesto-monto")?.value || 0)
            const divisa = form.querySelector("#presupuesto-divisa")?.value || "pen"
            const periodo = form.querySelector("#presupuesto-periodo")?.value || "mensual"
            const fechaInicio = form.querySelector("#presupuesto-fecha")?.value || ""

            if (!nombre || !monto || monto <= 0 || !fechaInicio) {
                mostrarNotificacion("error", "Completa todos los campos correctamente")
                return false
            }
            if (tipo === "categoria" && !categoria) {
                mostrarNotificacion("error", "Elige una categoría del sistema")
                return false
            }
            if (tipo === "etiquetas" && etiquetas.length === 0) {
                mostrarNotificacion("error", "Elige al menos una etiqueta")
                return false
            }

            try {
                await crearPresupuestoServicio(uid, {
                    nombre,
                    categoria,
                    monto,
                    divisa,
                    periodo,
                    fechaInicio,
                    etiquetas
                })
                notificarCambioPresupuestos()
                mostrarNotificacion("exito", "Presupuesto creado")
                return true
            } catch (error) {
                console.error("[ERROR] No se pudo crear el presupuesto:", error)
                mostrarNotificacion("error", error.message || "No se pudo crear el presupuesto")
                return false
            }
        }
    })

    // Montar el selector de etiquetas después de abrir el modal.
    configurarToggleTipo(formularioDe(modalEl))
    await montarSelectorPresupuesto(formularioDe(modalEl))

    return modalEl
}

// ============================================
// EDITAR PRESUPUESTO
// ============================================

export async function abrirModalEditarPresupuesto(presupuestoId) {
    const uid = sesion.uid
    if (!uid) {
        console.error("[ERROR] No hay UID disponible")
        return
    }

    let presupuesto
    try {
        presupuesto = await obtenerPresupuesto(uid, presupuestoId)
    } catch (error) {
        console.error("[ERROR] No se pudo cargar el presupuesto:", error)
        mostrarNotificacion("error", "No se pudo cargar el presupuesto")
        return
    }
    if (!presupuesto) {
        mostrarNotificacion("error", "El presupuesto ya no existe")
        return
    }

    const modalEl = abrirModal({
        titulo: "Editar presupuesto",
        contenido: contenidoDesdeTemplate("tpl-form-presupuesto"),
        confirmText: "Guardar cambios",
        cancelText: "Cancelar",
        onConfirm: async (datos, formulario) => {
            const form = formulario || document.getElementById("form-presupuesto")
            if (!form) return false

            const nombre = (form.querySelector("#presupuesto-nombre")?.value || "").trim()
            const tipo = form.querySelector("#presupuesto-tipo")?.value || "categoria"
            const categoria = tipo === "categoria" ? (form.querySelector("#presupuesto-categoria")?.value || "") : null
            const etiquetas = tipo === "etiquetas" ? leerEtiquetasSeleccionadas(form) : []
            const monto = Number(form.querySelector("#presupuesto-monto")?.value || 0)
            const divisa = form.querySelector("#presupuesto-divisa")?.value || "pen"
            const periodo = form.querySelector("#presupuesto-periodo")?.value || "mensual"
            const fechaInicio = form.querySelector("#presupuesto-fecha")?.value || ""

            if (!nombre || !monto || monto <= 0 || !fechaInicio) {
                mostrarNotificacion("error", "Completa todos los campos correctamente")
                return false
            }
            if (tipo === "categoria" && !categoria) {
                mostrarNotificacion("error", "Elige una categoría del sistema")
                return false
            }
            if (tipo === "etiquetas" && etiquetas.length === 0) {
                mostrarNotificacion("error", "Elige al menos una etiqueta")
                return false
            }

            try {
                await actualizarPresupuesto(uid, presupuestoId, {
                    nombre,
                    categoria,
                    monto,
                    divisa,
                    periodo,
                    fechaInicio,
                    etiquetas
                })
                notificarCambioPresupuestos()
                mostrarNotificacion("exito", "Presupuesto actualizado")
                return true
            } catch (error) {
                console.error("[ERROR] No se pudo actualizar el presupuesto:", error)
                mostrarNotificacion("error", error.message || "No se pudo actualizar el presupuesto")
                return false
            }
        }
    })

    const form = formularioDe(modalEl)
    // Precargar los valores del presupuesto.
    const inputNombre = form.querySelector("#presupuesto-nombre")
    const inputTipo = form.querySelector("#presupuesto-tipo")
    const selectCategoria = form.querySelector("#presupuesto-categoria")
    const inputMonto = form.querySelector("#presupuesto-monto")
    const selectDivisa = form.querySelector("#presupuesto-divisa")
    const selectPeriodo = form.querySelector("#presupuesto-periodo")
    const inputFecha = form.querySelector("#presupuesto-fecha")
    const inputEtiquetas = form.querySelector("#campo-etiquetas-presupuesto")

    if (inputNombre) inputNombre.value = presupuesto.nombre
    if (inputTipo) inputTipo.value = presupuesto.categoria ? "categoria" : "etiquetas"
    if (selectCategoria) selectCategoria.value = presupuesto.categoria || ""
    if (inputMonto) inputMonto.value = presupuesto.monto
    if (selectDivisa) selectDivisa.value = presupuesto.divisa
    if (selectPeriodo) selectPeriodo.value = presupuesto.periodo
    if (inputFecha) inputFecha.value = presupuesto.fechaInicio ? new Date(presupuesto.fechaInicio).toISOString().slice(0, 10) : ""
    if (inputEtiquetas && presupuesto.etiquetas?.length) inputEtiquetas.value = presupuesto.etiquetas.join(",")

    // Aplicar el toggle (mostrar/ocultar grupos) y montar selector de etiquetas.
    configurarToggleTipo(form)
    await montarSelectorPresupuesto(form, presupuesto.etiquetas || [])

    return modalEl
}

// Devuelve el formulario dentro de un modal (por si el contenido aún no se
// ha insertado del todo en el DOM).
function formularioDe(modalEl) {
    return modalEl?.querySelector("#form-presupuesto") || document.getElementById("form-presupuesto")
}

// ============================================
// MODAL DE LISTA DE PRESUPUESTOS
// ============================================

export async function abrirModalPresupuestos(presupuestoId = null) {
    const uid = sesion.uid
    if (!uid) {
        console.error("[ERROR] No hay UID disponible")
        return
    }

    let presupuestos
    try {
        presupuestos = await obtenerPresupuestosConProgreso(uid)
    } catch (error) {
        console.error("[ERROR] Error cargando presupuestos:", error)
        mostrarNotificacion("error", "No se pudieron cargar los presupuestos")
        return
    }

    const html = contenidoDesdeTemplate("tpl-modal-presupuestos", {
        valores: {
            contador: `${presupuestos.length} presupuesto${presupuestos.length !== 1 ? "s" : ""}`,
            vacio: presupuestos.length === 0 ? "No hay presupuestos registrados." : ""
        },
        html: {
            lista: contenidoDesdeFilas("tpl-presupuesto-card", presupuestos, plantillaPresupuestoCard)
        }
    })

    const modalEl = abrirModal({
        titulo: "Presupuestos",
        contenido: html,
        confirmText: "Cerrar",
        onConfirm: () => {
            cerrarModal()
        }
    })

    // Listeners anclados al overlay del modal.
    const overlay = modalEl?.closest(".modal-overlay")
    const lista = modalEl?.querySelector(".pendientes-lista")

    // Marcar el presupuesto activado (si se pidió uno específico).
    const marcarActivado = id => {
        lista?.querySelectorAll(".card-item").forEach(card => {
            card.classList.toggle("activado", card.dataset.id === id)
        })
    }
    if (presupuestoId) marcarActivado(presupuestoId)

    const enLista = id => [...(lista?.querySelectorAll(".card-item") || [])]
        .find(card => card.dataset.id === id)

    // Activar un presupuesto: se selecciona/enfoca. Desde la card del
    // dashboard se llama con el id del presupuesto para abrir el modal
    // con ese presupuesto destacado.
    const activarPresupuesto = id => {
        marcarActivado(id)
        const card = enLista(id)
        card?.scrollIntoView({ behavior: "smooth", block: "nearest" })
        mostrarNotificacion("exito", `Presupuesto activado: ${card?.querySelector(".card-item-titulo")?.textContent?.trim() || id}`)
    }

    const eliminarPresupuestoSeleccionado = async id => {
        if (!confirm("¿Eliminar este presupuesto?")) return
        try {
            await eliminarPresupuesto(uid, id)
            notificarCambioPresupuestos()
            // Volver a cargar y renderizar
            const actualizados = await obtenerPresupuestosConProgreso(uid)
            lista.replaceChildren(
                contenidoDesdeFilas("tpl-presupuesto-card", actualizados, plantillaPresupuestoCard)
            )
            const contador = overlay.querySelector("#presupuestos-contador")
            if (contador) {
                contador.textContent = `${actualizados.length} presupuesto${actualizados.length !== 1 ? "s" : ""}`
            }
            if (actualizados.length === 0) {
                const vacio = overlay.querySelector("[data-tpl='vacio']")
                if (vacio) vacio.hidden = false
            }
            mostrarNotificacion("exito", "Presupuesto eliminado")
        } catch (error) {
            console.error("[ERROR] No se pudo eliminar el presupuesto:", error)
            mostrarNotificacion("error", "No se pudo eliminar el presupuesto")
        }
    }

    lista?.addEventListener("click", async (e) => {
        const btn = e.target.closest(".card-action-btn")
        if (!btn) return
        const accion = btn.dataset.accion
        const card = btn.closest(".card-item")
        const id = card?.dataset.id
        if (!id) return

        if (accion === "activar-presupuesto") {
            activarPresupuesto(id)
        } else if (accion === "eliminar-presupuesto") {
            await eliminarPresupuestoSeleccionado(id)
        } else if (accion === "editar-presupuesto") {
            await abrirModalEditarPresupuesto(id)
        }
    })

    // Crear presupuesto nuevo: abre el formulario de creación.
    const btnCrear = overlay.querySelector("#btn-crear-presupuesto")
    if (btnCrear) {
        btnCrear.addEventListener("click", () => {
            abrirModalCrearPresupuesto()
        })
    }
}
