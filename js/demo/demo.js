// ============================================
// ARRANQUE DE LA DEMO
// ============================================
// Reutiliza el armazón, el router y las páginas reales, pero con la capa de
// datos mockeada (localStorage). Se siembra un usuario invitado y el fixture,
// y se inicializan los mismos módulos que arranca la app real salvo la
// autenticación.

import { sesion } from "../core/sesion.js"
import { initRouter } from "../core/router.js"
import { obtenerPreferencias, asegurarCuentaEfectivoInicial } from "../../firebase/firestore.js"
import { initTemaLocal, aplicarTema } from "../core/tema.js"
import { initPWA } from "../core/pwa.js"
import { initDoodles } from "../ui/doodles.js"
import { initAtajos } from "../core/atajos.js"
import { configurarDelegacionLastbar } from "../core/lastbar.js"
import { configurarColapsoSidebar } from "../ui/colapsoSidebar.js"
import { iniciarDesvanecidoScrolls } from "../ui/scrollEdges.js"
import { sembrar, UID } from "./fixture.js"

window.__ESCINCO_DEMO__ = true

initTemaLocal()
initPWA()
iniciarDesvanecidoScrolls()
initDoodles({ logoSpin: false })

async function arrancar() {
    const sembrado = sembrar()

    sesion.setUsuario({ uid: UID, email: "demo@escinco.app", nombre: "Invitado" })

    try {
        await asegurarCuentaEfectivoInicial(UID, { uid: UID })
        const preferencias = await obtenerPreferencias(UID)
        if (preferencias) sesion.setPreferencias(preferencias)
    } catch (error) {
        console.warn("[DEMO] No se pudieron cargar las preferencias:", error)
    }

    aplicarTema(sesion.getPreferencias()?.tema || "dark")
    document.body.classList.remove("loading")

    initRouter("dashboard")
    configurarDelegacionLastbar()
    configurarColapsoSidebar()
    initAtajos()
    conectarBanner()

    if (sembrado) console.log("[DEMO] Datos de ejemplo sembrados")
}

function conectarBanner() {
    document.getElementById("demo-reset")?.addEventListener("click", () => {
        sembrar({ forzar: true })
        window.location.reload()
    })

    document.getElementById("demo-salir")?.addEventListener("click", () => {
        window.location.assign("/")
    })
}

document.addEventListener("DOMContentLoaded", arrancar)
