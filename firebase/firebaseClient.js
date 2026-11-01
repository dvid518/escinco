import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js"
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-analytics.js"
import { firebaseConfig } from "./config.js"

export const app = initializeApp(firebaseConfig)

let analytics = null
try {
    analytics = getAnalytics(app)
} catch (error) {
    // Analytics puede no estar disponible (bloqueadores de anuncios,
    // entorno sin red, etc.). No se lanza: el servicio de analytics
    // simplemente no enviará eventos.
    console.warn("[WARN] Firebase Analytics no disponible:", error?.message || error)
}

export { analytics }