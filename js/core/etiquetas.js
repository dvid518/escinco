// ============================================
// ETIQUETAS (nombres, no Firebase)
// ============================================
// Reglas de formato compartidas por el formulario de movimiento, el selector
// de chips y el catálogo. El límite de 24 caracteres lo replica también
// firestore.rules para el catálogo.

export const MAX_ETIQUETAS = 20
export const MAX_LARGO_ETIQUETA = 24

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
