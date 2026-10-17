import { icono } from "./iconos.js"
import { navigateTo } from "./router.js"
import { sesion } from "./sesion.js"
import { etiquetaDivisa } from "../services/DivisaServicio.js"
import { CONFIG_MOVIMIENTOS } from "../../constants/tiposMovimiento.js"

// ============================================
// BÚSCADOR GLOBAL
// ============================================

// Páginas navegables. Se duplican aquí porque `routes` en router.js
// es privado; este listado es el contrato público para el buscador.
const PAGINAS = [
    { path: "/dashboard", nombre: "Dashboard", icono: "home" },
    { path: "/cuentas", nombre: "Cuentas", icono: "wallet" },
    { path: "/movimientos", nombre: "Movimientos", icono: "list" },
    { path: "/inversiones", nombre: "Inversiones", icono: "trending-up" },
    { path: "/trading", nombre: "Trading", icono: "chart-candlestick" },
    { path: "/configuracion", nombre: "Configuración", icono: "settings" }
]

const ICONO_POR_TIPO = {
    pagina: "list",
    cuenta: "landmark",
    movimiento: "arrow-left-right",
    activo: "bitcoin"
}

/**
 * Abre el modal del buscador global. Filtra páginas, cuentas, movimientos
 * y activos; se navega con ↑↓ / Enter / clic.
 */
export async function abrirBuscadorGlobal() {
    const { abrirModal, cerrarModal, estaAbierto, contenidoDesdeTemplate } = await import("../ui/modal.js")

    // Toggle: si el buscador ya está abierto, cerrarlo.
    if (estaAbierto?.() && document.querySelector(".buscador-global")) {
        cerrarModal()
        return
    }

    let indice = 0
    let resultados = []

    function navegarA(resultado) {
        const path = resultado?.navega
        cerrarModal()
        if (path) setTimeout(() => navigateTo(path), 100)
    }

    function items() {
        return Array.from(modalEl.querySelectorAll(".buscador-resultado"))
    }

    function actualizarSeleccion() {
        items().forEach((item, i) => item.classList.toggle("seleccionado", i === indice))
    }

    function renderResultados() {
        if (resultados.length === 0) {
            resultadosContainer.innerHTML = `<p class="lista-vacia">No se encontraron resultados.</p>`
            return
        }

        resultadosContainer.innerHTML = resultados.map((r, i) => `
            <div class="buscador-resultado${i === indice ? " seleccionado" : ""}" data-tipo="${r.tipo}">
                <span class="buscador-icono">${icono(ICONO_POR_TIPO[r.tipo] || "list", 16)}</span>
                <span class="buscador-concepto"></span>
                <span class="buscador-detalle"></span>
            </div>
        `).join("")

        // El texto del usuario se inserta con textContent (nunca con innerHTML).
        const filas = items()
        resultados.forEach((r, i) => {
            const fila = filas[i]
            if (!fila) return
            fila.querySelector(".buscador-concepto").textContent = r.concepto || "-"
            fila.querySelector(".buscador-detalle").textContent = r.detalle || ""
            fila.addEventListener("click", () => navegarA(r))
            fila.addEventListener("mouseenter", () => {
                indice = i
                actualizarSeleccion()
            })
        })
    }

    async function buscar(texto) {
        const resultadosFin = []

        if (!texto) {
            resultados = []
            indice = 0
            renderResultados()
            return
        }

        // 1. Páginas
        for (const p of PAGINAS) {
            if (p.nombre.toLowerCase().includes(texto) || p.path.toLowerCase().includes(texto)) {
                resultadosFin.push({ tipo: "pagina", concepto: p.nombre, detalle: p.path, navega: p.path })
            }
        }

        const uid = sesion.uid

        // 2. Cuentas
        try {
            const { obtenerCuentas } = await import("../../firebase/firestore.js")
            const cuentas = await obtenerCuentas(uid)
            cuentas.forEach(c => {
                if (`${c.nombre} ${c.moneda || ""}`.toLowerCase().includes(texto)) {
                    resultadosFin.push({ tipo: "cuenta", concepto: c.nombre, detalle: etiquetaDivisa(c.moneda || "pen"), navega: "/cuentas" })
                }
            })
        } catch (error) {
            console.warn("[WARN] Buscador: error cargando cuentas:", error)
        }

        // 3. Movimientos (últimos 50)
        try {
            const { obtenerMovimientos } = await import("../../firebase/firestore.js")
            const movimientos = await obtenerMovimientos(uid)
            movimientos.slice(0, 50).forEach(m => {
                const etiqueta = m.concepto || m.activo || CONFIG_MOVIMIENTOS[m.tipo]?.nombre || m.tipo || "Sin concepto"
                const textoMov = [m.concepto, m.activo, CONFIG_MOVIMIENTOS[m.tipo]?.nombre || m.tipo].filter(Boolean).join(" ").toLowerCase()
                if (textoMov.includes(texto)) {
                    resultadosFin.push({ tipo: "movimiento", concepto: etiqueta, detalle: "", navega: "/movimientos" })
                }
            })
        } catch (error) {
            console.warn("[WARN] Buscador: error cargando movimientos:", error)
        }

        // 4. Activos
        try {
            const { obtenerActivos } = await import("../repositories/ActivoRepositorio.js")
            const activos = await obtenerActivos(uid)
            activos.forEach(a => {
                const simbolo = (a.simbolo || "").toUpperCase()
                const nombre = a.nombre || simbolo
                if (simbolo.toLowerCase().includes(texto) || nombre.toLowerCase().includes(texto)) {
                    resultadosFin.push({ tipo: "activo", concepto: nombre, detalle: simbolo, navega: "/inversiones" })
                }
            })
        } catch (error) {
            console.warn("[WARN] Buscador: error cargando activos:", error)
        }

        resultados = resultadosFin
        indice = 0
        renderResultados()
    }

    const modalEl = abrirModal({
        titulo: "Buscar",
        contenido: contenidoDesdeTemplate("tpl-buscador-global", {
            html: { icono: icono("eye", 20) }
        }),
        variante: "narrow",
        cancelText: null,
        confirmText: null
    })

    const input = modalEl.querySelector("#buscador-input")
    const resultadosContainer = modalEl.querySelector(".buscador-resultados")

    input.addEventListener("input", () => buscar(input.value.trim().toLowerCase()))

    modalEl.addEventListener("keydown", evento => {
        if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
            evento.preventDefault()
            if (resultados.length === 0) return
            indice = evento.key === "ArrowDown"
                ? Math.min(indice + 1, resultados.length - 1)
                : Math.max(indice - 1, 0)
            actualizarSeleccion()
        } else if (evento.key === "Enter") {
            evento.preventDefault()
            if (resultados[indice]) navegarA(resultados[indice])
        }
    })

    input.focus()
}

// ============================================
// AYUDA DE ATAJOS
// ============================================
// Única fuente de la lista que muestra el modal de ayuda. Los grupos y las
// combinaciones se reflejan aquí y en ningún otro sitio; el modal solo pinta.
// Si se añade o cambia un atajo, se actualiza esta tabla.

const ATAJOS_AYUDA = [
    {
        titulo: "Globales",
        filas: [
            { teclas: "Alt+K", descripcion: "Buscar en toda la app" },
            { teclas: "Alt+P", descripcion: "Pendientes" },
            { teclas: "Alt+M", descripcion: "Metas" },
            { teclas: "Alt+N", descripcion: "Centro de notificaciones" },
            { teclas: "Alt+A", descripcion: "Esta ayuda de atajos" },
            { teclas: "Supr", descripcion: "Cerrar la notificación más antigua" }
        ]
    },
    {
        titulo: "Listas (Cuentas, Movimientos, Inversiones y Trading)",
        filas: [
            { teclas: "Esc", descripcion: "Limpiar la selección" },
            { teclas: "Supr / Retroceso", descripcion: "Quitar el último elemento seleccionado" }
        ]
    },
    {
        titulo: "Panel de inicio (edición de tarjetas)",
        filas: [
            { teclas: "Enter", descripcion: "Guardar y salir de la edición" },
            { teclas: "Esc", descripcion: "Salir de la edición (guarda si hay cambios)" }
        ]
    },
    {
        titulo: "Ventanas",
        filas: [
            { teclas: "Esc", descripcion: "Cerrar la ventana" },
            { teclas: "Tab / Shift+Tab", descripcion: "Recorrer los controles de la ventana" }
        ]
    },
    {
        titulo: "Formularios",
        filas: [
            { teclas: "Enter", descripcion: "Enviar (iniciar sesión, registro, contraseña)" }
        ]
    }
]

/**
 * Abre el modal de ayuda con todas las combinaciones de atajos. Funciona como
 * interruptor: si ya está abierto, lo cierra.
 */
export async function abrirModalAtajos() {
    const { abrirModal, cerrarModal, estaAbierto, contenidoDesdeTemplate, contenidoDesdeFilas } = await import("../ui/modal.js")

    if (estaAbierto?.() && document.querySelector(".atajos-modal")) {
        cerrarModal()
        return
    }

    const grupos = contenidoDesdeFilas("tpl-atajos-grupo", ATAJOS_AYUDA, grupo => ({
        valores: { titulo: grupo.titulo },
        html: {
            filas: contenidoDesdeFilas("tpl-atajo-fila", grupo.filas, fila => ({
                valores: { teclas: fila.teclas, descripcion: fila.descripcion }
            }))
        }
    }))

    abrirModal({
        titulo: "Atajos de teclado",
        variante: "narrow",
        contenido: contenidoDesdeTemplate("tpl-atajos-modal", { html: { grupos } }),
        cancelText: null,
        confirmText: null
    })
}

// ============================================
// ATAJOS GLOBALES
// ============================================
// Alt+K buscador · Alt+P pendientes · Alt+M metas · Alt+N notificaciones ·
// Alt+A ayuda de atajos. Funcionan aunque haya un campo de texto enfocado.

let atajosInicializados = false

export function initAtajos() {
    if (atajosInicializados) return
    atajosInicializados = true

    document.addEventListener("keydown", evento => {
        if (evento.repeat) return
        if (!evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey) return

        let accion = null

        switch (evento.code) {
            case "KeyK":
                accion = abrirBuscadorGlobal
                break
            case "KeyP":
                accion = () => import("../ui/pendientes.js").then(m => m.mostrarPendientes())
                break
            case "KeyM":
                accion = () => import("../ui/metas.js").then(m => m.mostrarMetas())
                break
            case "KeyN":
                accion = () => import("../ui/notificaciones.js").then(m => m.abrirCentroNotificaciones())
                break
            case "KeyA":
                accion = abrirModalAtajos
                break
        }

        if (!accion) return
        evento.preventDefault()
        accion()
    })
}
