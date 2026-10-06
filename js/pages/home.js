import { initTemaLocal } from "../core/tema.js"
import { initPWA } from "../core/pwa.js"

// ============================================
// LANDING
// ============================================
// La landing es pública: no toca Firebase Auth ni comprueba la sesión, solo
// aplica el tema guardado en localStorage (para que no haya flash) y registra el
// service worker como el resto de páginas de la app.

initTemaLocal()
initPWA()