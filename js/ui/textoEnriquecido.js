// ============================================
// TEXTO ENRIQUECIDO · NEGRITA SEGURA
// ============================================
// El chat recibe texto del modelo, que es contenido dinámico: NUNCA se
// interpreta como HTML. Solo se reconoce la marca de negrita —**texto** o
// <strong>texto</strong>— y se construye un nodo <strong> con textContent.
// Cualquier otro asterisco, etiqueta o ángulo queda como texto literal.

const PATRON_NEGRITA = /(\*\*[^*\n]+\*\*|<strong>[\s\S]*?<\/strong>|<b>[\s\S]*?<\/b>)/gi

/**
 * Sustituye el contenido de `elemento` por el texto, convirtiendo las marcas
 * de negrita en nodos <strong> reales.
 *
 * @param {Element|null} elemento
 * @param {string} texto
 */
export function pintarTextoEnriquecido(elemento, texto) {
    if (!elemento) return
    elemento.replaceChildren(...nodosDeTexto(String(texto ?? "")))
}

function nodosDeTexto(texto) {
    const nodos = []
    let ultimo = 0

    for (const coincidencia of texto.matchAll(PATRON_NEGRITA)) {
        const inicio = coincidencia.index
        if (inicio > ultimo) {
            nodos.push(document.createTextNode(texto.slice(ultimo, inicio)))
        }

        const fragmento = coincidencia[0]
        const interior = interiorDeNegrita(fragmento)

        if (interior === null) {
            nodos.push(document.createTextNode(fragmento))
        } else {
            const fuerte = document.createElement("strong")
            fuerte.textContent = interior
            nodos.push(fuerte)
        }

        ultimo = inicio + fragmento.length
    }

    if (ultimo < texto.length) {
        nodos.push(document.createTextNode(texto.slice(ultimo)))
    }

    return nodos
}

function interiorDeNegrita(fragmento) {
    if (fragmento.startsWith("**")) return fragmento.slice(2, -2)
    if (/^<strong>/i.test(fragmento)) return fragmento.slice(8, -9)
    if (/^<b>/i.test(fragmento)) return fragmento.slice(3, -4)
    return null
}
