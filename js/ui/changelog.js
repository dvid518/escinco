import { CHANGELOG } from "../../constants/changelog.js"
import { VERSION } from "../../constants/version.js"

// ============================================
// MODAL DE NOVEDADES
// ============================================
// Lo abren la versión del pie de Configuración (app), la de las pantallas de
// acceso y la de la landing. Como esas páginas no comparten los <template> del
// dashboard, el cuerpo se construye aquí con nodos (textContent), no con
// innerHTML: funciona igual en todas y no depende de ninguna plantilla.

const ETIQUETA_TIPO = {
    nuevo: { texto: "Nuevo", clase: "badge--positive" },
    mejora: { texto: "Mejora", clase: "badge--neutral" },
    arreglo: { texto: "Arreglo", clase: "badge--aviso" }
}

function formatearFecha(fecha) {
    const valor = new Date(`${fecha}T00:00:00`)
    if (Number.isNaN(valor.getTime())) return fecha
    return valor.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
}

function crearCambio(cambio) {
    const item = document.createElement("li")
    item.className = "changelog-item"

    const etiqueta = ETIQUETA_TIPO[cambio.tipo]
    if (etiqueta) {
        const chip = document.createElement("span")
        chip.className = `badge changelog-tipo ${etiqueta.clase}`
        chip.textContent = etiqueta.texto
        item.appendChild(chip)
    }

    const texto = document.createElement("span")
    texto.className = "changelog-texto"
    texto.textContent = cambio.texto
    item.appendChild(texto)

    return item
}

function crearBloqueVersion(entrada) {
    const bloque = document.createElement("section")
    bloque.className = "changelog-version"

    const cabecera = document.createElement("div")
    cabecera.className = "changelog-cabecera"

    const numero = document.createElement("span")
    numero.className = "changelog-numero"
    numero.textContent = `v${entrada.version}`
    cabecera.appendChild(numero)

    if (entrada.fecha) {
        const fecha = document.createElement("span")
        fecha.className = "changelog-fecha"
        fecha.textContent = formatearFecha(entrada.fecha)
        cabecera.appendChild(fecha)
    }

    bloque.appendChild(cabecera)

    const lista = document.createElement("ul")
    lista.className = "changelog-lista"
    for (const cambio of entrada.cambios || []) {
        lista.appendChild(crearCambio(cambio))
    }
    bloque.appendChild(lista)

    return bloque
}

/**
 * Abre el modal con todas las novedades. Funciona como interruptor: si ya
 * está abierto, lo cierra.
 */
export async function abrirModalChangelog() {
    const { abrirModal, cerrarModal, estaAbierto } = await import("./modal.js")

    if (estaAbierto?.() && document.querySelector(".changelog")) {
        cerrarModal()
        return
    }

    const contenido = document.createElement("div")
    contenido.className = "changelog"

    // Solo mostrar la versión actual; el historial completo no pertenece al modal.
    const entradaActual = CHANGELOG.find(e => e.version === VERSION.numero)

    if (entradaActual) {
        contenido.appendChild(crearBloqueVersion(entradaActual))
    } else {
        const mensaje = document.createElement("p")
        mensaje.textContent = "No hay notas de versión disponibles."
        contenido.appendChild(mensaje)
    }

    abrirModal({
        titulo: `Novedades · v${VERSION.numero}`,
        variante: "form",
        contenido,
        cancelText: null,
        confirmText: null
    })
}
