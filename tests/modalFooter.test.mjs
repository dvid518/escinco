// Abrir un modal "solo cerrar" lanzaba TypeError.
//
// `mostrarPendientes()` abre su modal con `confirmText: 'Cerrar'` y SIN
// `onCancel`. Eso activa `soloCerrar` → `mostrarFooter = false` → el markup del
// pie no se genera. Pero `abrirModal` escribía después, sin condición:
//
//     if (mostrarConfirmar) overlay.querySelector("#modal-confirm").textContent = ...
//
// `mostrarConfirmar` seguía siendo true, `#modal-confirm` era null, y el modal
// moría con "Cannot set properties of null (setting textContent)". Afectaba a
// los 16 modales soloCerrar del proyecto, no solo al de pendientes.
import { leer } from "./helpers.mjs"

const src = leer("js/ui/modal.js")

// --- A) Reproducir el cálculo de `soloCerrar` / `mostrarFooter` ---
// Réplica de las fórmulas de modal.js:206-211.
function decidirFooter({ onCancel, onConfirm, confirmText, hayFooterExtra }) {
    const textoConfirmar = confirmText == null ||
        String(confirmText).trim().toLowerCase() === "null" ? "Aceptar" : String(confirmText)
    const textoCancelar = cancelText => String(cancelText ?? "")
    const mostrarCancelar = typeof onCancel === "function" &&
        textoCancelar(confirmText.cancel).trim() !== "" &&
        textoCancelar(confirmText.cancel).trim().toLowerCase() !== "cerrar"
    const mostrarConfirmar = typeof onConfirm === "function" && textoConfirmar.trim() !== ""
    const soloCerrar = mostrarConfirmar && !mostrarCancelar && !hayFooterExtra &&
        textoConfirmar.trim().toLowerCase() === "cerrar"
    const mostrarFooter = !soloCerrar && (mostrarCancelar || mostrarConfirmar || hayFooterExtra)
    return { mostrarFooter, mostrarConfirmar, mostrarCancelar, soloCerrar }
}

// El caso de pendientes: onConfirm presente, onCancel ausente, "Cerrar".
const pendientes = decidirFooter({
    onCancel: null,
    onConfirm: () => {},
    confirmText: "Cerrar",
    hayFooterExtra: false
})

// Un modal normal, para contrastar.
const normal = decidirFooter({
    onCancel: () => {},
    onConfirm: () => {},
    confirmText: "Guardar",
    hayFooterExtra: false
})

// --- B) El código debe escribir el pie solo si existe ---
// Se busca el patrón "querySelector(...).textContent =" sin guarda previa.
const escriturasInmunes = /if\s*\(\s*mostrar(?:Cancelar|Confirmar)\s*\)\s*\{[^}]*if\s*\(\s*btnConfirmar\s*\)/.test(src) ||
    /mostrarFooter\s*\)\s*\{[^}]*querySelector/.test(src)
const escribeSinGuardar = [...src.matchAll(/querySelector\("#modal-(cancel|confirm)"\)\s*\.\s*textContent/g)]

// --- C) Coherencia: `mostrarConfirmar` puede ser true con `mostrarFooter` false ---
const combinacionPeligrosa = pendientes.mostrarConfirmar && !pendientes.mostrarFooter

export default function ejecutar(t) {
    console.log("A) Reproducción del cálculo de footer")
    t.check("el modal de pendientes es soloCerrar", pendientes.soloCerrar)
    t.check("y por tanto NO se genera el pie", !pendientes.mostrarFooter)
    t.check("pero mostrarConfirmar sigue siendo true (de ahí el null)",
        combinacionPeligrosa, `mostrarFooter=${pendientes.mostrarFooter}, mostrarConfirmar=${pendientes.mostrarConfirmar}`)
    t.check("un modal normal sí genera pie (control)", normal.mostrarFooter && normal.mostrarConfirmar)

    console.log("\nB) La escritura del pie está guardada")
    t.check("ninguna escritura directa de textContent sobre #modal-cancel/#modal-confirm",
        escribeSinGuardar.length === 0, escribeSinGuardar.map(m => m[1]).join(", "))
    t.check("el pie se escribe tras comprobar que el botón existe", escriturasInmunes)

    return t
}