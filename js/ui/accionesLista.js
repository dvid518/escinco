// ============================================
// ACCIONES DEL HEADER DE LOS MODALES DE LISTA
// ============================================
// Metas, pendientes y presupuestos comparten la misma cabecera: un contador y
// las acciones de agregar y eliminar. Las acciones van junto a la X del modal,
// con el mismo esquema que el modal de historial de precios: un botón de
// icono por acción.
//
// Los botones salen del cuerpo del modal (que solo lleva el contador y la
// lista) y viven en el header, así que quien los cablea los busca por su id
// sobre el modal completo: `modalEl.querySelector("#btn-crear-meta")`.

import { contenidoDesdeTemplate } from "./modal.js"
import { icono } from "../core/iconos.js"

/**
 * Botones de acción del header de un modal de lista.
 *
 * @param {Object} opciones
 * @param {string} opciones.idCrear         id del botón de agregar
 * @param {string} opciones.textoCrear      etiqueta del botón de agregar
 * @param {string} [opciones.idEliminar]    id del botón de eliminar; sin él no se pinta
 * @param {string} [opciones.textoEliminar] etiqueta del botón de eliminar
 * @returns {DocumentFragment}
 */
export function accionesDeListado({ idCrear, textoCrear, idEliminar, textoEliminar } = {}) {
    const fragmento = contenidoDesdeTemplate("tpl-acciones-lista", {
        valores: {
            "boton-crear@id": idCrear,
            "boton-crear@title": textoCrear,
            "boton-crear@aria-label": textoCrear,
            "boton-eliminar@id": idEliminar,
            "boton-eliminar@title": textoEliminar,
            "boton-eliminar@aria-label": textoEliminar
        },
        html: {
            "icono-crear": icono("plus", 16),
            "icono-eliminar": icono("trash-2", 16)
        }
    })

    // Sin botón de eliminar no se pinta: los presupuestos no lo tienen.
    if (!idEliminar) fragmento.querySelector('[data-tpl="boton-eliminar"]')?.remove()

    return fragmento
}
