// ============================================
// FIREBASE APP (MOCK DE LA DEMO)
// ============================================
// initializeApp() devuelve un objeto inerte: la demo no habla con Firebase.

export function initializeApp(opciones) {
    return { name: "[DEMO]", options: opciones || {} }
}

export function getApp() {
    return { name: "[DEMO]" }
}
