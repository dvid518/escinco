import { sesion } from "../core/sesion.js"
import { icono } from "../core/iconos.js"
import { normalizarEtiquetas, MAX_ETIQUETAS, CATEGORIAS_SISTEMA, categoriaSistema, esCategoriaSistema } from "../core/etiquetas.js"
import {
    obtenerEtiquetas,
    buscarEtiquetaPorNombre,
    crearEtiqueta,
    actualizarEtiqueta,
    eliminarEtiqueta
} from "../repositories/EtiquetaRepositorio.js"
import { contenidoDesdeTemplate, abrirModal, cerrarModal } from "./modal.js"
import { mostrarNotificacion } from "./notificaciones.js"

// Paleta fija de etiquetas: las mismas claves que validan las reglas
// (esColorEtiqueta) y que pinta css/style.css con --etiqueta-*.
export const PALETA_ETIQUETAS = ["verde", "rojo", "ambar", "azul", "menta", "frambuesa", "mostaza", "cielo"]

// ============================================
// SELECTOR DE ETIQUETAS (CHIPS)
// ============================================
// Componente de chips compartido por el formulario de movimiento, el
// etiquetado masivo de la lastbar y la sección de Configuración.
//
// En el formulario la fuente de verdad es el <input id="campo-etiquetas">:
// el selector la lee al montar y la reescribe en cada cambio, así que
// `recogerDatosFormulario` y `rellenarFormulario` siguen funcionando igual.

/**
 * Monta el selector de chips dentro de `contenedor` (#chips-etiquetas).
 *
 * Opciones:
 *   - gestion: true → modo catálogo (Configuración): el click en un chip abre
 *     su editor (renombrar/color/eliminar) y ningún chip queda "activo".
 *   - seleccionadas: nombres marcados de inicio; si no llega, se lee el
 *     input oculto `entrada` (por defecto campo-etiquetas).
 *   - semiactivas: nombres en estado intermedio (etiquetado masivo).
 *   - entrada: id del input oculto que sincroniza.
 *   - alCambiar: callback con la selección tras cada cambio.
 *
 * Devuelve { obtenerSeleccion, refrescar } o null si el contenedor desapareció
 * mientras se cargaba el catálogo (modal cerrado antes de tiempo). Si el
 * contenedor ya tenía un selector montado, refresca y devuelve el existente:
 * así reentrar a la sección de Configuración no duplica listeners.
 */
export async function montarSelectorEtiquetas(contenedor, opciones = {}) {
    const {
        gestion = false,
        seleccionadas = null,
        semiactivas = [],
        entrada = "campo-etiquetas",
        alCambiar = null,
        // Catálogo ya resuelto por quien llama. El etiquetado masivo lo usa
        // para incluir las etiquetas huérfanas (las que tiene algún movimiento
        // pero no están en el catálogo): si el selector las recargara por su
        // cuenta, nunca se pintarían.
        catalogo: catalogoDado = null
    } = opciones

    if (!contenedor) return null

    if (contenedor.dataset.selectorListo === "1") {
        await contenedor.__selectorEtiquetas?.refrescar()
        return contenedor.__selectorEtiquetas
    }

    const uid = sesion.uid
    let catalogoUsuario = catalogoDado ? [...catalogoDado] : []
    if (!catalogoDado) {
        try {
            catalogoUsuario = await obtenerEtiquetas(uid)
        } catch (error) {
            console.warn("[WARN] No se pudo cargar el catálogo de etiquetas:", error?.code || error)
        }
    }

    // Las categorías del sistema van SIEMPRE y primero; el resto es lo que el
    // usuario tiene guardado. Si el usuario creó una con el mismo nombre, manda
    // la del sistema: es la que no se puede borrar ni duplicar.
    const catalogo = [
        ...CATEGORIAS_SISTEMA.map(c => ({ ...c, esSistema: true, id: null })),
        ...catalogoUsuario.filter(e => !esCategoriaSistema(e.nombre))
    ]

    if (!contenedor.isConnected) return null

    const entradaHidden = gestion || !entrada ? null : document.getElementById(entrada)
    const activas = gestion
        ? new Set()
        : new Set(normalizarEtiquetas(seleccionadas ?? entradaHidden?.value))
    const semi = new Set(normalizarEtiquetas(semiactivas))

    const obtenerSeleccion = () => [...activas]

    const sincronizarEntrada = () => {
        if (entradaHidden) entradaHidden.value = obtenerSeleccion().join(", ")
        alCambiar?.(obtenerSeleccion())
    }

    // Solo se ordena el catálogo del usuario: las categorías del sistema van
    // siempre arriba, en su orden fijo, porque son el primer nivel.
    const ordenar = () => {
        const usuario = catalogo.filter(e => !e.esSistema)
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }))
        catalogo.length = 0
        catalogo.push(...CATEGORIAS_SISTEMA.map(c => ({ ...c, esSistema: true, id: null })), ...usuario)
    }

    const pintarChip = etiqueta => {
        const activa = activas.has(etiqueta.nombre)
        const valores = {
            "chip@data-nombre": etiqueta.nombre,
            nombre: etiqueta.nombre
        }
        if (etiqueta.esSistema) {
            // Las del sistema se pintan con --positive, sin el borde de color
            // que llevan las del usuario.
            valores["punto@style"] = "--chip-color: var(--positive)"
            valores["chip@data-sistema"] = "1"
        } else if (etiqueta.color) {
            valores["punto@style"] = `--chip-color: var(--etiqueta-${etiqueta.color})`
        }
        const chip = contenidoDesdeTemplate("tpl-etiqueta-chip", { valores })
        const boton = chip.querySelector(".chip-etiqueta")
        boton.classList.toggle("activo", activa)
        boton.classList.toggle("semi", !activa && semi.has(etiqueta.nombre))
        boton.classList.toggle("categoria", !!etiqueta.esSistema)
        return chip
    }

    const repintar = () => {
        contenedor.replaceChildren()
        for (const etiqueta of catalogo) contenedor.append(pintarChip(etiqueta))
        contenedor.append(contenidoDesdeTemplate("tpl-etiqueta-crear", {
            html: { icono: icono("plus", 14) }
        }))
    }

    // ---- Creación inline: el botón + abre un input con forma de chip ----

    const cerrarInput = input => input.remove()

    const confirmarCreacion = async input => {
        const nombre = normalizarEtiquetas(input.value)[0]
        if (!nombre) {
            cerrarInput(input)
            return
        }
        try {
            // Una categoría del sistema ya existe siempre: se selecciona, no se
            // crea otra igual en Firestore.
            const categoria = categoriaSistema(nombre)
            let etiqueta = categoria || await buscarEtiquetaPorNombre(uid, nombre)
            if (!etiqueta) {
                // La etiqueta nace en el catálogo aunque el usuario cancele el
                // movimiento: queda disponible para reutilizar.
                const id = await crearEtiqueta(uid, { nombre, color: null, esPrincipal: false })
                etiqueta = { id, nombre, color: null, esPrincipal: false }
                catalogo.push(etiqueta)
                ordenar()
            }
            // Límite del movimiento, no del catálogo: la categoría ya existe y
            // solo cuenta si se puede marcar. En modo catálogo no hay nada
            // que marcar: la etiqueta nueva se crea y ya.
            if (!gestion) {
                if (!activas.has(etiqueta.nombre) && activas.size >= MAX_ETIQUETAS) {
                    mostrarNotificacion("info", `Máximo ${MAX_ETIQUETAS} etiquetas por movimiento`)
                } else {
                    activas.add(etiqueta.nombre)
                    semi.delete(etiqueta.nombre)
                    sincronizarEntrada()
                }
            }
            cerrarInput(input)
            repintar()
        } catch (error) {
            console.error("[ERROR] No se pudo crear la etiqueta:", error)
            mostrarNotificacion("error", "No se pudo crear la etiqueta")
        }
    }

    const abrirCreacion = () => {
        if (contenedor.querySelector(".chip-etiqueta-input")) return
        const input = document.createElement("input")
        input.type = "text"
        input.className = "chip-etiqueta-input"
        input.maxLength = 24
        input.placeholder = "Nueva etiqueta"
        input.setAttribute("aria-label", "Nombre de la nueva etiqueta")
        contenedor.insertBefore(input, contenedor.lastElementChild)
        input.focus()

        input.addEventListener("keydown", evento => {
            if (evento.key === "Escape") {
                evento.preventDefault()
                cerrarInput(input)
                return
            }
            if (evento.key === "Enter") {
                evento.preventDefault()
                confirmarCreacion(input)
            }
        })

        input.addEventListener("blur", () => {
            if (!input.value.trim()) cerrarInput(input)
        })
    }

    // ---- Modo gestión (Configuración): editor de cada etiqueta ----

    const refrescar = async () => {
        try {
            catalogo = await obtenerEtiquetas(uid)
        } catch (error) {
            // Se conserva el catálogo anterior y se avisa: es lectura, no daño.
            console.warn("[WARN] No se pudo refrescar el catálogo de etiquetas:", error?.code || error)
        }
        if (!contenedor.isConnected) return
        ordenar()
        repintar()
    }

    const abrirEditor = etiqueta => {
        const contenido = contenidoDesdeTemplate("tpl-etiqueta-editor")
        const inputNombre = contenido.querySelector("#campo-etiqueta-editor-nombre")
        const paleta = contenido.querySelector("#paleta-etiquetas")
        inputNombre.value = etiqueta.nombre

        // Las categorías del sistema no se editan ni se borran: no viven en
        // Firestore, no tienen documento que actualizar y su nombre es fijo.
        // Se abren igual, pero sin paleta y sin botón de eliminar.
        const esSistema = etiqueta.esSistema
        if (esSistema) {
            inputNombre.disabled = true
            paleta.hidden = true
            const aviso = document.createElement("p")
            aviso.className = "form-hint etiqueta-editor-sistema"
            aviso.textContent = "Las categorías del sistema no se pueden editar ni eliminar."
            inputNombre.insertAdjacentElement("afterend", aviso)
        }

        let colorElegido = etiqueta.color || null

        const pintarPaleta = () => {
            paleta.replaceChildren()
            for (const clave of PALETA_ETIQUETAS) {
                const punto = document.createElement("button")
                punto.type = "button"
                punto.className = "paleta-punto" + (clave === colorElegido ? " activo" : "")
                punto.style.setProperty("--chip-color", `var(--etiqueta-${clave})`)
                punto.setAttribute("aria-label", `Color ${clave}`)
                punto.title = clave
                punto.addEventListener("click", () => {
                    colorElegido = clave
                    pintarPaleta()
                })
                paleta.append(punto)
            }
        }
        if (!esSistema) pintarPaleta()

        // El pie del modal lleva "Eliminar" junto a "Guardar": el borrado es
        // una acción de la etiqueta, no un campo más del formulario.
        let botonEliminar = null
        if (!esSistema) {
            botonEliminar = contenidoDesdeTemplate("tpl-etiqueta-eliminar")
                .querySelector("#chip-etiqueta-eliminar")

            // Eliminar con confirmación: el primer click arma el botón.
            let armado = false
            botonEliminar.addEventListener("click", async () => {
                if (!armado) {
                    armado = true
                    botonEliminar.textContent = "¿Seguro? Eliminar"
                    botonEliminar.classList.add("armado")
                    return
                }
                try {
                    await eliminarEtiqueta(uid, etiqueta.id)
                    mostrarNotificacion("exito", `Etiqueta "${etiqueta.nombre}" eliminada`)
                    cerrarModal()
                    refrescar()
                } catch (error) {
                    console.error("[ERROR] No se pudo eliminar la etiqueta:", error)
                    mostrarNotificacion("error", "No se pudo eliminar la etiqueta")
                }
            })
        }

        abrirModal({
            titulo: "Editar etiqueta",
            contenido,
            confirmText: "Guardar",
            cancelText: "Cancelar",
            footerExtra: botonEliminar,
            // Devolver false mantiene el modal abierto (modal.js:353).
            onConfirm: async () => {
                const nombre = normalizarEtiquetas(inputNombre.value)[0]
                if (!nombre) {
                    mostrarNotificacion("info", "Escribe un nombre para la etiqueta")
                    return false
                }
                if (nombre.toLowerCase() !== etiqueta.nombre.toLowerCase()) {
                    const existente = await buscarEtiquetaPorNombre(uid, nombre)
                    if (existente && existente.id !== etiqueta.id) {
                        mostrarNotificacion("error", `Ya existe una etiqueta "${nombre}"`)
                        return false
                    }
                }
                if (nombre === etiqueta.nombre && colorElegido === (etiqueta.color || null)) return true
                try {
                    await actualizarEtiqueta(uid, etiqueta.id, { nombre, color: colorElegido })
                    mostrarNotificacion("exito", "Etiqueta actualizada")
                    refrescar()
                    return true
                } catch (error) {
                    console.error("[ERROR] No se pudo actualizar la etiqueta:", error)
                    mostrarNotificacion("error", "No se pudo actualizar la etiqueta")
                    return false
                }
            }
        })
    }

    // ---- Interacción por delegación en el contenedor ----

    contenedor.addEventListener("click", evento => {
        if (evento.target.closest(".chip-etiqueta-crear")) {
            abrirCreacion()
            return
        }
        const chip = evento.target.closest(".chip-etiqueta[data-nombre]")
        if (!chip) return
        const nombre = chip.dataset.nombre
        if (gestion) {
            const etiqueta = catalogo.find(e => e.nombre === nombre)
            if (etiqueta) abrirEditor(etiqueta)
            return
        }
        if (activas.has(nombre)) {
            activas.delete(nombre)
        } else {
            if (activas.size >= MAX_ETIQUETAS) {
                mostrarNotificacion("info", `Máximo ${MAX_ETIQUETAS} etiquetas por movimiento`)
                return
            }
            activas.add(nombre)
            semi.delete(nombre)
        }
        sincronizarEntrada()
        repintar()
    })

    ordenar()
    repintar()

    const api = { obtenerSeleccion, refrescar }
    contenedor.dataset.selectorListo = "1"
    contenedor.__selectorEtiquetas = api
    return api
}
