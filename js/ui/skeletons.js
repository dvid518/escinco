const maxFilas = valor => Math.max(1, Math.min(Number(valor) || 1, 8))

const texto = clase => `<span class="skeleton ${clase}" aria-hidden="true"></span>`

// Las filas reales de todas las listas (movimientos, trades, órdenes,
// posiciones, estrategias, ajustes) empiezan por el bloque de texto: no hay
// icono/círculo a la izquierda. El esqueleto imita esa misma fila (texto a la
// izquierda + valor a la derecha) para que comparta ancho y alineación. La
// única lista con icono es el sidebar, que usa su propia variante.
const itemLista = () => `
    <div class="skeleton-item">
        <div class="skeleton-lines">
            ${texto("skeleton-line skeleton-line-wide")}
            ${texto("skeleton-line")}
        </div>
        ${texto("skeleton-line skeleton-line-value")}
    </div>
`

const varianteLista = filas => Array.from({ length: maxFilas(filas) }, itemLista).join("")

const variantePanel = filas => `
    <div class="skeleton-panel">
        <div class="skeleton-panel-info">
            ${texto("skeleton-circle skeleton-circle-large")}
            ${texto("skeleton-line skeleton-line-wide")}
            ${texto("skeleton-line")}
            ${texto("skeleton-line skeleton-line-short")}
        </div>
        <div class="skeleton-panel-list">${varianteLista(filas)}</div>
    </div>
`

const varianteAjustes = filas => Array.from({ length: maxFilas(filas) }, () => `
    <div class="skeleton-setting">
        <div class="skeleton-lines">
            ${texto("skeleton-line skeleton-line-medium")}
            ${texto("skeleton-line skeleton-line-short")}
        </div>
        ${texto("skeleton-pill")}
    </div>
`).join("")

const varianteSidebar = filas => Array.from({ length: maxFilas(filas) }, () => `
    <div class="cuenta-sidebar-item">
        <button type="button" class="glass cuenta-sidebar-btn" disabled aria-hidden="true">
            ${texto("skeleton-sidebar-icon")}
            ${texto("skeleton-line skeleton-sidebar-line")}
        </button>
    </div>
`).join("")

const varianteGrafico = () => texto("skeleton-grafico-bloque")

export function skeletonText(className = "") {
    return `<span class="skeleton skeleton-text ${className}" aria-hidden="true"></span>`
}

export function skeletonMarkup({
    variant = "list",
    rows = 4,
    className = "",
    label = "Cargando datos"
} = {}) {
    let content = varianteLista(rows)
    if (variant === "panel") content = variantePanel(rows)
    if (variant === "settings") content = varianteAjustes(rows)
    if (variant === "sidebar") content = varianteSidebar(rows)
    if (variant === "chart") content = varianteGrafico()

    return `
        <div class="skeleton skeleton-${variant} ${className}" role="status" aria-label="${label}" aria-busy="true">
            ${content}
        </div>
    `
}

// ============================================
// ESQUELETOS BASADOS EN <template>
// ============================================
// Devuelven DocumentFragment listos para replaceChildren / appendChild,
// sin pasar por innerHTML. Usan ids literales para que
// tests/plantillas.test.mjs los detecte.

import { contenidoDesdeTemplate } from "./modal.js"

export function esqueletoFilas(filas = 4) {
    const n = maxFilas(filas)
    const fragmento = document.createDocumentFragment()
    for (let i = 0; i < n; i++) {
        fragmento.appendChild(contenidoDesdeTemplate("tpl-esqueleto-item"))
    }
    return fragmento
}

export function esqueletoTexto(clase = "") {
    if (clase.includes("large")) {
        return contenidoDesdeTemplate("tpl-esqueleto-texto-large")
    }
    return contenidoDesdeTemplate("tpl-esqueleto-texto")
}

export function esqueletoBadge() {
    return contenidoDesdeTemplate("tpl-esqueleto-badge")
}

export function esqueletoPanel(filas = 4) {
    const panel = contenidoDesdeTemplate("tpl-esqueleto-panel")
    const lista = panel.querySelector("[data-tpl=lista]")
    lista.replaceChildren(esqueletoFilas(filas))
    return panel
}

export function esqueletoSettings(filas = 4) {
    const n = maxFilas(filas)
    const fragmento = document.createDocumentFragment()
    for (let i = 0; i < n; i++) {
        fragmento.appendChild(contenidoDesdeTemplate("tpl-esqueleto-settings"))
    }
    return fragmento
}

export function esqueletoSidebar(filas = 4) {
    const n = maxFilas(filas)
    const fragmento = document.createDocumentFragment()
    for (let i = 0; i < n; i++) {
        fragmento.appendChild(contenidoDesdeTemplate("tpl-esqueleto-sidebar"))
    }
    return fragmento
}

export function esqueletoChart() {
    return contenidoDesdeTemplate("tpl-esqueleto-chart")
}

export function esqueletoContenedor(variant = "list", filas = 4, className = "", label = "Cargando datos") {
    const contenedor = document.createElement("div")
    contenedor.className = `skeleton skeleton-${variant} ${className}`.trim()
    contenedor.setAttribute("role", "status")
    contenedor.setAttribute("aria-label", label)
    contenedor.setAttribute("aria-busy", "true")

    let contenido
    switch (variant) {
        case "panel": contenido = esqueletoPanel(filas); break
        case "settings": contenido = esqueletoSettings(filas); break
        case "sidebar": contenido = esqueletoSidebar(filas); break
        case "chart": contenido = esqueletoChart(); break
        default: contenido = esqueletoFilas(filas); break
    }

    contenedor.appendChild(contenido)
    return contenedor
}
