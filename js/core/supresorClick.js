// ============================================
// SUPRESOR DE DOBLE CLIC
// ============================================
// Evita que un clic rápido se registre dos veces en el mismo control.
// Cada instancia mantiene su propio estado, por lo que hacer clic en un
// elemento no suprime clics en otros elementos de la misma página.
//
// Uso:
//   const supresor = crearSupresorDobleClick()
//   supresor.marcar()      // llama tras un clic válido
//   if (supresor.consumir()) return // bloquea si ya hubo un clic reciente

export function crearSupresorDobleClick(delay = 400) {
    let activo = false
    let timer = null

    return {
        marcar() {
            activo = true
            clearTimeout(timer)
            timer = setTimeout(() => { activo = false }, delay)
        },
        consumir() {
            if (!activo) return false
            activo = false
            clearTimeout(timer)
            return true
        }
    }
}
