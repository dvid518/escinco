import { sesion } from "../core/sesion.js"
import { LOGO_ESCINCO_CARGA } from "../core/iconos.js"
import { abrirModal, cerrarModal, contenidoDesdeTemplate } from "./modal.js"
import { mostrarNotificacion } from "./notificaciones.js"

// ============================================
// EXPORTAR / EXTRACTO (reutilizable)
// ============================================

export async function accionExportar() {
    const uid = sesion.uid
    if (!uid) return

    abrirModal({
        titulo: "Exportando respaldo",
        contenido: contenidoDesdeTemplate("tpl-cargando", {
            valores: { texto: "Preparando archivo .dvid..." },
            html: { logo: LOGO_ESCINCO_CARGA }
        }),
        variante: "narrow",
        confirmText: null,
        cancelText: null,
        // La exportación no se puede deshacer: el modal de progreso no se cierra
        // hasta que la operación termine (ver BUG-019).
        cerrarAlClickFuera: false,
        cerrarConEsc: false,
        cerrarConBotonX: false
    })

    try {
        const { exportarDVID } = await import("../services/ExportarServicio.js")
        const resultado = await exportarDVID(uid)
        cerrarModal()

        setTimeout(() => {
            abrirModal({
                titulo: "Respaldo exportado",
                contenido: contenidoDesdeTemplate("tpl-respaldo-exportado", {
                    valores: { archivo: resultado.archivo }
                }),
                variante: "info",
                confirmText: "Entendido",
                onConfirm: () => true
            })
        }, 100)
    } catch (error) {
        console.error("Error exportando:", error)
        cerrarModal()
        mostrarNotificacion("error", `No se pudo exportar el respaldo: ${error.message}`)
    }
}