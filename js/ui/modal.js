import { mostrarNotificacion } from "./notificaciones.js"
import { sesion } from "../core/sesion.js"
import { LOGO_ESCINCO_CARGA } from "../core/iconos.js"

// ============================================
// ESTADO
// ============================================
// Pila de modales abiertos. En modo estándar siempre hay 0 o 1;
// con "modales persistentes" pueden apilarse varias ventanas.
const modales = []
let zContador = 0

function modoPersistenteActivo() {
    try {
        return sesion.getPreferencias()?.accesibilidad?.modalesPersistentes === true
    } catch {
        return false
    }
}

function esFrente(overlay) {
    const ultimo = modales[modales.length - 1]
    return !!ultimo && ultimo.overlay === overlay
}

function sobreponer(overlay) {
    const idx = modales.findIndex(m => m.overlay === overlay)
    if (idx === -1) return
    const [registro] = modales.splice(idx, 1)
    modales.push(registro)
    overlay.style.setProperty("--z-modal", ++zContador)
}

/**
 * Construye el cuerpo de un modal clonando un <template> del documento y
 * rellenando sus huecos. Los templates viven en el HTML principal
 * (dashboard.html, demo.html), que el service worker ya precachea: no hay
 * peticiones extra ni framework.
 *
 * El HTML editable se queda en el HTML, el texto se inserta escapado por
 * defecto y no hay marcadores `{{variable}}` que puedan quedar sin reemplazar.
 *
 * Las opciones son las tres clases de hueco que tiene un template:
 *
 *   valores    pares { hueco: valor } para [data-tpl="hueco"]. Todo dato que
 *              venga de la aplicación o del usuario va aquí: se escribe con
 *              textContent, nunca se interpreta como HTML. Un hueco marcado con
 *              `data-tpl-oculto` se esconde cuando su valor es vacío, que es lo
 *              que reemplaza los bloques `cond ? html : ""`. Para escribir en vez
 *              de en el texto, la clave lleva `@`: "tipo@data-tipo" pone el
 *              valor en el atributo `data-tipo` del elemento, y "marcado@checked"
 *              marca la casilla. El atributo `data-tpl-attr="a,b"` del template
 *              no hace falta para el relleno: documenta qué se rellena.
 *   html       pares { hueco: markup } para el mismo atributo. Solo para iconos
 *              del catálogo (`icono()`, `LOGO_ESCINCO_CARGA`) o para otro
 *              fragmento ya construido: markup que genera el propio código.
 *              Nunca texto de usuario: ahí va `valores`. Un hueco con
 *              `data-tpl-reemplazar` no envuelve el contenido: se sustituye por
 *              él (para bloques que son un form-group entero y no pueden llevar
 *              un div alrededor sin romper la rejilla del formulario).
 *
 * @param {string} id            id del <template>
 * @param {Object} [opciones]    { valores, html }
 * @returns {DocumentFragment}   fragmento listo para `abrirModal({ contenido })`
 */
export function contenidoDesdeTemplate(id, opciones = {}) {
    const fragmento = clonarTemplate(id)
    rellenarHuecos(fragmento, opciones)
    return fragmento
}

/**
 * Igual que `contenidoDesdeTemplate`, pero para cuerpos que son una lista: clona
 * el template una vez por fila y junta todas en un único fragmento.
 *
 * @param {string} id            id del <template> de una fila
 * @param {Array} filas          datos a representar
 * @param {Function} mapear      fila -> { valores, html }
 * @returns {DocumentFragment}   fragmento con una copia del template por fila
 */
export function contenidoDesdeFilas(id, filas, mapear) {
    const fragmento = document.createDocumentFragment()
    for (const fila of Array.isArray(filas) ? filas : []) {
        const copia = clonarTemplate(id)
        rellenarHuecos(copia, mapear(fila) || {})
        fragmento.appendChild(copia)
    }
    return fragmento
}

function clonarTemplate(id) {
    const tpl = document.getElementById(id)
    if (!tpl?.content) {
        throw new Error(`No existe el <template id="${id}"> en este documento`)
    }
    return tpl.content.cloneNode(true)
}

// Un hueco reemplazable admite un nodo, un fragmento o markup en texto.
function nodosDe(markup) {
    if (markup instanceof DocumentFragment) return [...markup.childNodes]
    if (markup instanceof Node) return [markup]
    const envoltorio = document.createElement("template")
    envoltorio.innerHTML = markup == null ? "" : String(markup)
    return [...envoltorio.content.childNodes]
}

// Atributos que en realidad son propiedades del elemento: se escriben como
// `destino[propiedad] = valor`, para poder poner y quitar checked/disabled.
const PROPIEDADES = ["checked", "disabled", "selected", "hidden", "indeterminate"]

function rellenarHuecos(fragmento, { valores = {}, html = {} } = {}) {
    for (const [clave, valor] of Object.entries(valores)) {
        const [hueco, destino] = clave.includes("@") ? clave.split("@") : [clave, null]
        const elemento = fragmento.querySelector(`[data-tpl="${hueco}"]`)
        if (!elemento) continue
        const texto = valor == null ? "" : String(valor)
        if (destino && PROPIEDADES.includes(destino)) elemento[destino] = valor === true
        else if (destino) elemento.setAttribute(destino, texto)
        else {
            elemento.textContent = texto
            // data-tpl-oculto manda solo si el hueco se rellena como texto:
            // con "algo@atributo" el atributo lo decide el llamador.
            if (elemento.hasAttribute("data-tpl-oculto")) elemento.hidden = !valor
        }
    }
    for (const [clave, markup] of Object.entries(html)) {
        const [hueco] = clave.split("@")
        const destino = fragmento.querySelector(`[data-tpl="${hueco}"]`)
        if (!destino) continue
        // data-tpl-reemplazar: el hueco no envuelve el contenido, se sustituye
        // por él. Para bloques que son un form-group entero y no pueden llevar
        // un div alrededor sin romper la rejilla del formulario.
        if (destino.hasAttribute("data-tpl-reemplazar")) {
            destino.replaceWith(...nodosDe(markup))
            continue
        }
        // Un fragmento ya construido (otro template) se inserta tal cual; el
        // markup del catálogo de iconos va como texto.
        if (markup instanceof Node) destino.appendChild(markup)
        else destino.innerHTML = markup == null ? "" : String(markup)
        if (destino.hasAttribute("data-tpl-oculto")) destino.hidden = !markup
    }
}

/**
 * @param {string} [opciones.titulo]
 * @param {string|Node} [opciones.contenido]  HTML del cuerpo, o un fragmento
 *   ya construido (lo habitual: `contenidoDesdeTemplate()`)
 * @param {string} [opciones.variante]        'info' | 'form' | 'confirm' | 'wide' | 'xl' | 'narrow'
 * @param {string} [opciones.confirmText]
 * @param {string} [opciones.cancelText]
 * @param {string} [opciones.footerExtra]      HTML de botones extra en el footer
 * @param {string} [opciones.headerExtra]      HTML de botones extra junto al botón de cerrar
 * @param {Function} [opciones.onConfirm]     Puede devolver false para NO cerrar
 * @param {Function} [opciones.onCancel]      Se llama al cerrar sin confirmar
 * @param {boolean} [opciones.cerrarAlClickFuera=true]
 * @param {boolean} [opciones.cerrarConEsc=true]
 * @param {boolean} [opciones.cerrarConBotonX=true]  Muestra la X del header.
 *   En false el modal solo se cierra al confirmar: para modales de progreso de
 *   operaciones que no se pueden deshacer.
 */
export function abrirModal(opciones) {
    const {
        titulo = "escinco",
        contenido = "",
        variante = "form",
        confirmText = "Confirmar",
        cancelText = "Cancelar",
        footerExtra = "",
        headerExtra = "",
        onConfirm = null,
        onCancel = null,
        cerrarAlClickFuera = true,
        cerrarConEsc = true,
        cerrarConBotonX = true
    } = opciones

    const persistente = modoPersistenteActivo()

    // Modo estándar: un solo modal a la vez. Eliminar el previo.
    if (!persistente) {
        cerrarModal({ silencioso: true })
    }

    const overlay = document.createElement("div")
    overlay.className = "modal-overlay" + (persistente ? " modal-overlay-ventana" : "")
    overlay.style.setProperty("--z-modal", ++zContador)

    const textoTitulo = titulo == null || String(titulo).trim().toLowerCase() === "null" ? "escinco" : String(titulo)
    // footerExtra/headerExtra aceptan markup en texto (los botones del catálogo)
    // o un nodo ya construido (otro template). El nodo se inserta en su sitio
    // del pie/cabecera tras montar el modal.
    const nodoHeaderExtra = headerExtra instanceof Node ? headerExtra : null
    const textoHeaderExtra = nodoHeaderExtra ? "" : (headerExtra == null ? "" : headerExtra)
    const nodoFooterExtra = footerExtra instanceof Node ? footerExtra : null
    const textoFooterExtra = nodoFooterExtra ? "" : (footerExtra == null ? "" : String(footerExtra).trim())
    const hayFooterExtra = !!nodoFooterExtra || textoFooterExtra !== ""
    const textoCancelar = cancelText == null ? "" : String(cancelText)
    const textoConfirmar = confirmText == null || String(confirmText).trim().toLowerCase() === "null"
        ? "Aceptar"
        : String(confirmText)
    // Un botón de pie que solo dice "Cerrar" duplica la X de la esquina, así que
    // no se pinta: cerrar queda en la X, ESC y el clic fuera. Las etiquetas con
    // intención propia ("Cancelar", "Archivar en su lugar"…) sí se conservan.
    const mostrarCancelar = typeof onCancel === "function" &&
        textoCancelar.trim() !== "" &&
        textoCancelar.trim().toLowerCase() !== "cerrar"
    const mostrarConfirmar = typeof onConfirm === "function" && textoConfirmar.trim() !== ""
    const soloCerrar = mostrarConfirmar && !mostrarCancelar && !hayFooterExtra && textoConfirmar.trim().toLowerCase() === "cerrar"
    const mostrarFooter = !soloCerrar && (mostrarCancelar || mostrarConfirmar || hayFooterExtra)

    overlay.innerHTML = `
        <div class="modal glass modal-${variante}" role="dialog" aria-modal="true" tabindex="-1">
            <div class="modal-header">
                <h2 class="modal-title"></h2>
                <div class="modal-header-controls">
                    <div class="modal-header-acciones">
                        ${textoHeaderExtra}
                    </div>
${cerrarConBotonX ? `
                            <button class="modal-close" type="button" aria-label="Cerrar">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x preview-icon">
                                    <path d="M18 6 6 18"/>
                                    <path d="m6 6 12 12"/>
                                </svg>
                            </button>` : ""}
                </div>
            </div>
            <div class="modal-body"></div>
            ${mostrarFooter ? `
            <div class="modal-footer">
                ${mostrarCancelar ? `<button class="modal-btn modal-btn-secondary" id="modal-cancel"
                    type="button"></button>` : ""}
                ${textoFooterExtra}
                ${mostrarConfirmar ? `<button class="modal-btn modal-btn-primary" id="modal-confirm"
                    type="button"></button>` : ""}
            </div>
            ` : ""}
        </div>
    `

    // El título y las etiquetas de los botones pueden llevar datos de usuario
    // (nombre de cuenta, activo del trade…): van con textContent, nunca innerHTML.
    overlay.querySelector(".modal-title").textContent = textoTitulo
    if (mostrarCancelar) overlay.querySelector("#modal-cancel").textContent = textoCancelar
    if (mostrarConfirmar) overlay.querySelector("#modal-confirm").textContent = textoConfirmar

    document.body.appendChild(overlay)

    // El cuerpo puede llegar como HTML (los modales que aún no han migrado) o
    // como un fragmento ya construido desde un <template> del documento, que se
    // inserta tal cual: sus nodos no pasan por innerHTML y su texto ya viene
    // escapado por textContent.
    const bodyEl = overlay.querySelector(".modal-body")
    if (contenido instanceof Node) {
        bodyEl.appendChild(contenido)
    } else if (contenido != null && String(contenido) !== "") {
        bodyEl.innerHTML = String(contenido)
    }

    // Los extras que llegan como nodo se colocan en su posición real: la
    // cabecera dentro de .modal-header-acciones y el pie entre "Cancelar" y
    // "Confirmar". Así los botones fijos de un modal pueden venir de un
    // <template> sin pasar por innerHTML.
    if (nodoHeaderExtra) {
        overlay.querySelector(".modal-header-acciones")?.appendChild(nodoHeaderExtra)
    }
    if (nodoFooterExtra && mostrarFooter) {
        const footer = overlay.querySelector(".modal-footer")
        footer?.insertBefore(nodoFooterExtra, footer.querySelector("#modal-confirm") || null)
    }

    // En modo persistente, cada nueva ventana baja un poco de la anterior
    // para que se aprecien varias a la vez (como ventanas en cascada).
    if (persistente) {
        const n = modales.length
        aplicarOffset(overlay.querySelector(".modal"), n * 28, n * 28)
    }

    const modalEl = overlay.querySelector(".modal")
    const prevFocus = document.activeElement

    // --------------------------------------------
    // EVENTOS
    // --------------------------------------------

    const closeBtn = overlay.querySelector(".modal-close")
    const cancelBtn = overlay.querySelector("#modal-cancel")
    const confirmBtn = overlay.querySelector("#modal-confirm")
    let procesando = false

    const cerrar = (motivo = "cancelar") => {
        if (procesando) return
        try {
            if (motivo === "cancelar" && typeof onCancel === "function") {
                onCancel()
            }
        } catch (error) {
            // Un fallo en onCancel no debe impedir que el modal se cierre.
            console.error("Error en onCancel:", error)
        } finally {
            cerrarModal({ overlay })
        }
    }

    const confirmar = async () => {
        if (typeof onConfirm !== "function") {
            cerrarModal({ overlay })
            return
        }
        if (procesando) return

        // Mientras procesa: blur del cuerpo del modal + escinco girando. El
        // overlay captura los clics a propósito, así que la pantalla no es
        // navegable durante la acción: es lo prudente cuando la operación ya no
        // se puede deshacer (eliminar un movimiento, borrar datos).
        // El modal tampoco acepta interacción (botones desactivados) y `cerrar`
        // aborta mientras procesando === true, de modo que ni la X, ni ESC, ni
        // el clic fuera pueden cerrar el modal a media operación.
        procesando = true
        overlay.classList.add("modal-procesando")
        confirmBtn?.setAttribute("disabled", "true")
        cancelBtn?.setAttribute("disabled", "true")
        closeBtn?.setAttribute("disabled", "true")

        // Logo escinco con la animación del router (spin) centrado en el modal.
        const logoProcesando = document.createElement("div")
        logoProcesando.className = "modal-procesando-logo"
        logoProcesando.setAttribute("aria-hidden", "true")
        logoProcesando.innerHTML = LOGO_ESCINCO_CARGA
        modalEl.appendChild(logoProcesando)

        let resultado
        try {
            resultado = await onConfirm()
        } catch (error) {
            // Un error inesperado en onConfirm no debe dejar el modal
            // congelado (blur + botones desactivados para siempre).
            console.error("Error en onConfirm:", error)
            mostrarNotificacion("error", error.message || "Error inesperado al procesar la acción")
            cerrarModal({ overlay })
            return
        } finally {
            procesando = false
            overlay.classList.remove("modal-procesando")
            logoProcesando.remove()
            confirmBtn?.removeAttribute("disabled")
            cancelBtn?.removeAttribute("disabled")
            closeBtn?.removeAttribute("disabled")
        }

        if (resultado !== false) {
            cerrarModal({ overlay })
        }
    }

    closeBtn?.addEventListener("click", () => soloCerrar ? confirmar() : cerrar("cancelar"))
    cancelBtn?.addEventListener("click", () => cerrar("cancelar"))
    confirmBtn?.addEventListener("click", confirmar)

    // --------------------------------------------
    // FOCO INICIAL Y TRAP DE FOCUS
    // --------------------------------------------

    const obtenerEnfocables = () =>
        [...modalEl.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
        )].filter(el => el.offsetParent !== null)
    const enfocables = obtenerEnfocables()
    ;(enfocables[0] || modalEl).focus?.()

    // En modo persistente no se atrapa el foco: el usuario interactúa con
    // la aplicación mientras las ventanas están abiertas.
    let tabHandler = null
    if (!persistente) {
        tabHandler = (e) => {
            if (e.key !== "Tab") return

            const lista = obtenerEnfocables()
            if (lista.length === 0) return

            const primero = lista[0]
            const ultimo = lista[lista.length - 1]
            const activo = document.activeElement

            if (e.shiftKey) {
                if (activo === primero || !modalEl.contains(activo)) {
                    e.preventDefault()
                    ultimo.focus()
                }
            } else if (activo === ultimo || !modalEl.contains(activo)) {
                e.preventDefault()
                primero.focus()
            }
        }
        document.addEventListener("keydown", tabHandler)
    }

    // Click fuera del modal (solo en modo estándar; en persistente el
    // usuario sigue interactuando con la app y las ventanas se cierran
    // con ESC o con la X).
    if (cerrarAlClickFuera && !persistente) {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) cerrar("cancelar")
        })
    }

    // ESC: en modo persistente cierra únicamente la ventana en primer plano.
    let escHandler = null
    if (cerrarConEsc) {
        escHandler = (e) => {
            if (e.key === "Escape" && (!persistente || esFrente(overlay))) {
                cerrar("cancelar")
            }
        }
        document.addEventListener("keydown", escHandler)
    }

    // ENTER: equivale a pulsar el botón principal (Aceptar/Confirmar). Solo si
    // el modal tiene botón de confirmar. No se intercepta en controles que ya
    // usan Enter por su cuenta (multilínea, botones, enlaces, selects) ni si
    // otro handler ya lo ha consumido (p.ej. el buscador de activos).
    let enterHandler = null
    if (mostrarConfirmar) {
        enterHandler = (e) => {
            if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return
            if (e.defaultPrevented) return
            if (persistente && !esFrente(overlay)) return
            const activo = document.activeElement
            if (activo && ["TEXTAREA", "BUTTON", "A", "SELECT"].includes(activo.tagName)) return
            e.preventDefault()
            confirmar()
        }
        document.addEventListener("keydown", enterHandler)
    }

    // Traer al frente al hacer clic en la ventana (modo persistente).
    if (persistente) {
        overlay.addEventListener("pointerdown", () => sobreponer(overlay), true)
    }

    // Drag desde el header. Solo en modo persistente: en modo estándar el
    // modal queda fijo y centrado (no tiene sentido arrastrarlo si hay overlay).
    const limpiarDrag = persistente ? activarDrag(modalEl, overlay) : null

    const registro = {
        overlay,
        modalEl,
        escHandler,
        enterHandler,
        tabHandler,
        prevFocus,
        limpiarDrag
    }
    modales.push(registro)

    return modalEl
}

// --------------------------------------------
// CERRAR MODAL
// --------------------------------------------

// Cierra una ventana concreta (`overlay`) o la que está en primer plano.
export function cerrarModal({ silencioso = false, overlay = null } = {}) {
    const idx = overlay
        ? modales.findIndex(m => m.overlay === overlay)
        : modales.length - 1

    if (idx === -1) {
        return
    }

    const [registro] = modales.splice(idx, 1)
    const modal = registro.overlay

    if (registro.escHandler) {
        document.removeEventListener("keydown", registro.escHandler)
    }

    if (registro.tabHandler) {
        document.removeEventListener("keydown", registro.tabHandler)
    }

    if (registro.enterHandler) {
        document.removeEventListener("keydown", registro.enterHandler)
    }

    registro.limpiarDrag?.()

    // Animación de salida: se espera a que termine antes de quitar el nodo.
    // En silencioso (p.ej. reemplazo al abrir otro) el nodo se elimina al instante.
    if (silencioso || modal.classList.contains("cerrando")) {
        modal.remove()
    } else {
        let cerrado = false
        const terminar = () => {
            if (cerrado) return
            cerrado = true
            clearTimeout(fallback)
            modal.remove()
        }
        modal.classList.add("cerrando")
        modal.addEventListener("animationend", terminar, { once: true })
        modal.addEventListener("animationcancel", terminar, { once: true })
        // Red de seguridad por si el navegador no dispara animationend
        const fallback = setTimeout(terminar, 400)
    }

    // Foco: si quedan ventanas, devolver el foco a la nueva primera plana;
    // si no, al elemento que tenía el foco antes de abrir.
    const siguiente = modales[modales.length - 1]
    if (siguiente) {
        const enfocables = siguiente.modalEl?.querySelector(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
        )
        ;(enfocables || siguiente.modalEl)?.focus?.()
    } else if (registro.prevFocus && typeof registro.prevFocus.focus === "function" && registro.prevFocus.isConnected) {
        registro.prevFocus.focus()
    }

    if (!silencioso) {
        // Hook para limpieza externa si se necesita
    }
}

export function estaAbierto() {
    return modales.length > 0
}

// --------------------------------------------
// BOTÓN DE CALENDARIO (inputs type="date")
// --------------------------------------------
// Delegación global (se instala al cargar el módulo): cualquier
// ".btn-calendario" abre el date picker del input de fecha que le
// acompaña, esté dentro de un modal o en la página.

function vincularBotonesCalendario() {
    document.addEventListener("click", (e) => {
        const boton = e.target.closest(".btn-calendario")
        if (!boton) return

        const input = boton.parentElement?.querySelector('input[type="date"]')
        if (!input) return

        if (typeof input.showPicker === "function") {
            try {
                input.showPicker()
                return
            } catch {
                // Si el navegador no permite abrirlo aquí, fallback a foco
            }
        }
        input.focus()
    })
}

vincularBotonesCalendario()

// --------------------------------------------
// DRAG DEL MODAL
// --------------------------------------------
// Usa CSS variables --modal-x y --modal-y
// para no romper la regla "sin style inline".
// El CSS aplica: transform: translate(var(--modal-x, 0), var(--modal-y, 0))
// Devuelve una función para limpiar sus listeners.
// --------------------------------------------

function activarDrag(modalEl, overlay) {
    if (!modalEl) return null

    let startX = 0
    let startY = 0
    let startOffsetX = 0
    let startOffsetY = 0
    let arrastrando = false

    const onDown = (e) => {
        if (!e.target.closest(".modal-header")) return
        if (e.target.closest("button, a, input, select, textarea, [contenteditable='true']")) return

        const punto = obtenerPunto(e)
        startX = punto.x
        startY = punto.y
        startOffsetX = leerOffset(modalEl, "--modal-x")
        startOffsetY = leerOffset(modalEl, "--modal-y")
        arrastrando = true

        modalEl.classList.add("dragging")
        document.addEventListener("mousemove", onMove)
        document.addEventListener("mouseup", onUp)
        document.addEventListener("touchmove", onMove, { passive: false })
        document.addEventListener("touchend", onUp)
        document.addEventListener("touchcancel", onUp)
    }

    const onMove = (e) => {
        if (!arrastrando) return
        if (e.cancelable) e.preventDefault()

        const punto = obtenerPunto(e)
        const dx = punto.x - startX
        const dy = punto.y - startY

        aplicarOffset(modalEl, startOffsetX + dx, startOffsetY + dy)
    }

    const onUp = () => {
        arrastrando = false
        modalEl.classList.remove("dragging")
        document.removeEventListener("mousemove", onMove)
        document.removeEventListener("mouseup", onUp)
        document.removeEventListener("touchmove", onMove)
        document.removeEventListener("touchend", onUp)
        document.removeEventListener("touchcancel", onUp)
    }

    modalEl.addEventListener("mousedown", onDown)
    modalEl.addEventListener("touchstart", onDown, { passive: true })

    return () => {
        modalEl.removeEventListener("mousedown", onDown)
        modalEl.removeEventListener("touchstart", onDown)
        onUp()
    }
}

function obtenerPunto(evento) {
    if (evento.touches && evento.touches.length > 0) {
        return { x: evento.touches[0].clientX, y: evento.touches[0].clientY }
    }
    return { x: evento.clientX, y: evento.clientY }
}

function aplicarOffset(modalEl, x, y) {
    // Escribimos las CSS variables en el elemento, no style inline de propiedades
    modalEl.style.setProperty("--modal-x", `${x}px`)
    modalEl.style.setProperty("--modal-y", `${y}px`)
}

function leerOffset(modalEl, propiedad) {
    const valor = modalEl.style.getPropertyValue(propiedad)
    return valor ? parseFloat(valor) || 0 : 0
}