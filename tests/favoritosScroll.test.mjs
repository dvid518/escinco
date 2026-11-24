// Scroll horizontal de la tira de favoritos.
//
// La página de movimientos solo carga css/movimientos.css (dashboard.css es
// perezosa y no llega aquí), así que las reglas del scrollbar tienen que vivir
// en esta hoja. En horizontal el grosor se fija con `height`, no con `width`, y
// el track debe ser transparente para no pintar la franja blanca por defecto.
import { leer } from "./helpers.mjs"

const css = leer("css/movimientos.css")

function cuerpoDe(selector) {
    const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const m = new RegExp(`${escapado}\\s*\\{([^}]*)\\}`).exec(css)
    return m ? m[1] : ""
}

export default async function ejecutar(t) {
    const base = cuerpoDe("#favoritos-movimientos")
    t.check("A1 la tira de favoritos scrollea en horizontal",
        /overflow-x:\s*auto/.test(base))
    t.check("A2 el track usa el color de borde sobre transparente",
        /scrollbar-color:\s*var\(--border\)\s+transparent/.test(base),
        base.replace(/\s+/g, " ").trim())

    const barra = cuerpoDe("#favoritos-movimientos::-webkit-scrollbar")
    t.check("B1 el grosor horizontal se fija con height: 6px",
        /height:\s*6px/.test(barra) && !/width:\s*6px/.test(barra),
        barra.replace(/\s+/g, " ").trim())

    const track = cuerpoDe("#favoritos-movimientos::-webkit-scrollbar-track")
    t.check("B2 el track es transparente (sin fondo blanco)",
        /background:\s*transparent/.test(track),
        track.replace(/\s+/g, " ").trim())

    const thumb = cuerpoDe("#favoritos-movimientos::-webkit-scrollbar-thumb")
    t.check("B3 el pulgar usa el color de borde del tema",
        /background:\s*var\(--border\)/.test(thumb),
        thumb.replace(/\s+/g, " ").trim())

    const contenedores = (css.match(/overflow-x\s*:\s*auto/g) || []).length
    t.check("C1 solo hay un contenedor con scroll horizontal",
        contenedores === 1, String(contenedores))
}
