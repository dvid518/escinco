// ============================================
// DESCARDA UN BLOB COMO ARCHIVO DE FORMA SEGURA
// ============================================
// Corrige el bug #9: revocar el ObjectURL con setTimeout(..., 0) puede
// cancelar la descarga en algunos navegadores antes de que arranque,
// especialmente con archivos grandes o CPU ocupada.
//
// Estrategia:
// 1. Crea el enlace, lo dispara y lo retira del DOM.
// 2. Revoca el ObjectURL con un margen de tiempo razonable (1000 ms) para
//    asegurar que el navegador ya empezó a leer el blob.
// 3. No revoca nunca antes de que `link.click()` se haya ejecutado.

const REVOCAR_MS = 1000

export function descargarArchivoSeguro(url, nombre) {
    const link = document.createElement("a")
    link.href = url
    link.download = nombre
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Revocación diferida con margen: evita cancelar la descarga antes de
    // que arranque, pero no deja el ObjectURL colgado para siempre.
    setTimeout(() => URL.revokeObjectURL(url), REVOCAR_MS)
}
