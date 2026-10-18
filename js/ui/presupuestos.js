// ============================================
// PRESUPUESTOS — MODAL (sin router, es un modal más)
// ============================================
// Se abre desde la lastbar persistente (botón "Presupuestos") y desde la
// card de presupuestos del dashboard. No usa el router: es un modal más.

import { abrirModal, cerrarModal, contenidoDesdeTemplate, contenidoDesdeFilas } from "./modal.js"
import { obtenerPresupuestosConProgreso, eliminarPresupuesto } from "../services/PresupuestoServicio.js"
import { sesion } from "../core/sesion.js"
import { icono } from "../core/iconos.js"
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
            nombre: pp.nombre,
            estado: p.estadoTexto,
            detalle: `${formatearMontoConDivisa(p.gastoReal, pp.divisa)} de ${formatearMontoConDivisa(pp.monto, pp.divisa)}`,
            valor: `${p.porcentaje.toFixed(0)}%`
        },
        html: {
            "icono-activar": icono("play", 16),
            "icono-eliminar": icono("trash", 16)
        }
    }
}

// Avisa al dashboard para que refresque la card de presupuestos.
function notificarCambioPresupuestos() {
    window.dispatchEvent(new CustomEvent("presupuestos-actualizados"))
}

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
        }
    })

    // Crear presupuesto nuevo (abre el modal de creación si existe; de lo
    // contrario avisa que se viene).
    const btnCrear = overlay.querySelector("#btn-crear-presupuesto")
    if (btnCrear) {
        btnCrear.addEventListener("click", () => {
            mostrarNotificacion("info", "La creación de presupuestos se añade en el siguiente paso.")
        })
    }
}
