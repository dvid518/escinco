// Carga diferida de las hojas de estilo propias de cada página.
//
// El shell (dashboard.html) solo lleva los estilos globales del armazón
// (style, componentes, navegacion, iconos, modal, configuracion, pendientes).
// Cada módulo de página declara aquí las suyas con `asegurarEstilos()` y el
// navegador las inyecta al importar el módulo. Como toda UI que necesita una
// hoja de página importa su módulo (el router para la ruta, o lastbar/atajos
// para un modal), la hoja llega siempre antes de usarse.
//
// Una página declara TODAS las hojas que su markup necesita, no solo la
// propia: si se apoya en clases de otra, se rompe al entrar directo a ella
// (se veía bien solo después de haber visitado esa otra página). Las clases
// realmente compartidas (.resumen-card, barra de aporte) viven ya en
// componentes.css; aquí quedan las familias de items que no se comparten.
//
// - cuentas: el detalle de una cuenta lista movimientos con el markup de
//   movimientos.js, así que necesita su hoja (card-item-main, acciones).
// - trading: sus trades y órdenes reutilizan el bloque de posiciones de
//   inversiones (posicion-item, posicion-*, lista-posiciones).

const ESTILOS = {
    dashboard: ["css/dashboard.css"],
    cuentas: ["css/cuentas.css", "css/movimientos.css"],
    movimientos: ["css/movimientos.css"],
    inversiones: ["css/inversiones.css"],
    trading: ["css/trading.css", "css/inversiones.css"]
}

const inyectadas = new Set()

export function estilosDe(nombre) {
    return ESTILOS[nombre] ? [...ESTILOS[nombre]] : []
}

export function asegurarEstilos(nombre) {
    for (const href of estilosDe(nombre)) {
        if (inyectadas.has(href)) continue
        inyectadas.add(href)

        const yaEnHtml = [...document.querySelectorAll('link[rel="stylesheet"]')]
            .some(link => (link.getAttribute("href") || "").endsWith(href))
        if (yaEnHtml) continue

        const link = document.createElement("link")
        link.rel = "stylesheet"
        link.href = href
        document.head.appendChild(link)
    }
}
