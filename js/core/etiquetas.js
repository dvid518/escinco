// ============================================
// ETIQUETAS (nombres, no Firebase)
// ============================================
// Reglas de formato compartidas por el formulario de movimiento, el selector
// de chips y el catálogo. El límite de 24 caracteres lo replica también
// firestore.rules para el catálogo.

export const MAX_ETIQUETAS = 20
export const MAX_LARGO_ETIQUETA = 24

// ============================================
// CATEGORÍAS DEL SISTEMA
// ============================================
// Viven en el código, NO en Firestore: no se siembran en la cuenta del usuario
// y no se borran nunca. Son el primer nivel con el que se segmentarán los
// presupuestos; las etiquetas que crea el usuario son el segundo nivel.
//
// `color: "positive"` es la marca de las del sistema: se pintan con
// `var(--positive)` en vez del borde que llevan las del usuario.

export const CATEGORIAS_SISTEMA = Object.freeze([
    Object.freeze({ nombre: "vivienda", color: "positive" }),
    Object.freeze({ nombre: "alimentación", color: "positive" }),
    Object.freeze({ nombre: "transporte", color: "positive" }),
    Object.freeze({ nombre: "ahorro", color: "positive" }),
    Object.freeze({ nombre: "ocio", color: "positive" })
])

const CATEGORIAS_INDICE = new Map(CATEGORIAS_SISTEMA.map(c => [c.nombre.toLowerCase(), c]))

/** ¿Ese nombre es una de las categorías del sistema? */
export function esCategoriaSistema(nombre) {
    return CATEGORIAS_INDICE.has(String(nombre || "").trim().toLowerCase())
}

/** La categoría del sistema con ese nombre, o null. */
export function categoriaSistema(nombre) {
    return CATEGORIAS_INDICE.get(String(nombre || "").trim().toLowerCase()) || null
}

/** Convierte "viaje, comida, viaje" en ["viaje", "comida"]: sin vacíos, sin
    duplicados (comparando sin distinguir mayúsculas) y recortada cada una. */
export function normalizarEtiquetas(valor) {
    const partes = Array.isArray(valor) ? valor : String(valor || "").split(",")
    const vistas = new Set()
    const resultado = []
    for (const parte of partes) {
        const etiqueta = String(parte || "").trim().slice(0, MAX_LARGO_ETIQUETA)
        if (!etiqueta) continue
        const clave = etiqueta.toLowerCase()
        if (vistas.has(clave)) continue
        vistas.add(clave)
        resultado.push(etiqueta)
        if (resultado.length >= MAX_ETIQUETAS) break
    }
    return resultado
}
