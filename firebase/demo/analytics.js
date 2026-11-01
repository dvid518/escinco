// ============================================
// FIREBASE ANALYTICS (MOCK DE LA DEMO)
// ============================================
// Sustituye al SDK de analytics por import map SOLO dentro de la demo.
// La demo no habla con Firebase, así que todo es un no-op silencioso.
// Esto evita que el importmap redirija firebase-app.js a un mock que no
// exporta _getProvider, lo que lanzaría un SyntaxError y dejaría la demo
// en pantalla negra (body con clase "loading" sin eliminar).

export function getAnalytics() {
    return null
}

export function logEvent() {}

export function setUserId() {}

export function setUserProperties() {}
