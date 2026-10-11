const selectoresScroll = [
    ".dashboard .movimientos-lista",
    ".dashboard .favoritos-lista",
    ".dashboard .metas-lista",
    ".dashboard .pendientes-lista",
    ".dashboard .ordenes-lista",
    ".dashboard .estrategias-lista",
    ".dashboard .distribucion-lista",
    ".dashboard .programados-lista",
    ".dashboard .alertas-lista",
    ".lista-cards",
    ".cuenta-detalle",
    ".lista-posiciones",
    ".pendientes-lista",
    ".vencimientos-lista",
    // El sidebar de cuentas (y el de las demás páginas, que comparten
    // estructura) también scrollea, y sin esto la lista se cortaba en seco
    // contra el botón de colapsar. Se mete aquí y no en una regla propia para
    // que herede el mismo fade y los mismos estados de "hay más".
    ".sidebar-wrap #sidebar",
    // El panel de cada página y el de la configuración: son los contenedores
    // que cortan su contenido contra el borde inferior del panel.
    "#panel"
].join(", ")

const elementosRegistrados = new Set()
let observerScroll = null
let actualizacionPendiente = false
let iniciado = false

function esScrollVertical(elemento) {
    const overflowY = getComputedStyle(elemento).overflowY
    return (overflowY === "auto" || overflowY === "scroll") && elemento.scrollHeight > elemento.clientHeight
}

function actualizarScroll(elemento) {
    if (!(elemento instanceof Element)) return
    if (!elemento.isConnected) {
        elementosRegistrados.delete(elemento)
        return
    }
    const tieneScroll = esScrollVertical(elemento)
    elemento.classList.toggle("scroll-fade", tieneScroll)
    if (!tieneScroll) {
        elemento.classList.remove("scroll-fade-top", "scroll-fade-bottom")
        return
    }
    elemento.classList.toggle("scroll-fade-top", elemento.scrollTop > 2)
    elemento.classList.toggle("scroll-fade-bottom", elemento.scrollTop + elemento.clientHeight < elemento.scrollHeight - 2)
}

function registrarScroll(elemento) {
    if (!(elemento instanceof Element) || elementosRegistrados.has(elemento)) return
    elementosRegistrados.add(elemento)
    actualizarScroll(elemento)
}

function explorarScrolls(raiz) {
    if (!(raiz instanceof Element) && raiz !== document) return
    if (raiz instanceof Element && raiz.matches(selectoresScroll)) registrarScroll(raiz)
    if (typeof raiz.querySelectorAll === "function") {
        raiz.querySelectorAll(selectoresScroll).forEach(registrarScroll)
    }
}

function actualizarScrollsRegistrados() {
    elementosRegistrados.forEach(actualizarScroll)
}

function programarActualizacionScrolls() {
    if (actualizacionPendiente) return
    actualizacionPendiente = true
    requestAnimationFrame(() => {
        actualizacionPendiente = false
        actualizarScrollsRegistrados()
        explorarScrolls(document)
    })
}

export function iniciarDesvanecidoScrolls() {
    if (iniciado) return
    iniciado = true
    explorarScrolls(document)
    document.addEventListener("scroll", evento => {
        if (evento.target instanceof Element) actualizarScroll(evento.target)
    }, true)
    observerScroll = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.removedNodes.forEach(nodo => {
                if (!(nodo instanceof Element)) return
                elementosRegistrados.delete(nodo)
                nodo.querySelectorAll(selectoresScroll).forEach(elemento => elementosRegistrados.delete(elemento))
            })
            mutation.addedNodes.forEach(explorarScrolls)
        })
        programarActualizacionScrolls()
    })
    observerScroll.observe(document.documentElement, { childList: true, subtree: true })
}
