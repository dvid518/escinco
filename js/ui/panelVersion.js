import { VERSION } from "../../constants/version.js"

// ============================================
// VERSIÓN EN EL BORDE INFERIOR DEL PANEL
// ============================================
// Las páginas de acceso no tienen lastbar ni panel: son documentos estáticos
// cuyo único contenedor es el <main>. La versión se pinta en JS (no en el
// HTML) para que la número solo viva en constants/version.js: escribirla a mano
// en los .html obligaba a acordarse de subirla en todos los sitios a la vez.
//
// Se inyecta en cualquier elemento con [data-panel-version], así que el
// markup de auth.html y reset-password.html no necesita conocer el formato.

const CLASE = "panel-version"

export function pintarVersionPanel() {
    for (const destino of document.querySelectorAll("[data-panel-version]")) {
        if (destino.dataset.versionPintada === "true") continue
        destino.dataset.versionPintada = "true"
        destino.classList.add(CLASE)
        destino.innerHTML = `
            <span class="panel-version-brand">${VERSION.nombre}</span>
            <span class="panel-version-numero">v${VERSION.numero}</span>
        `
    }
}
