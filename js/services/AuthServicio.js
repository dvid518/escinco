import {
    signInWithPopup,
    linkWithCredential,
    getAuth
} from "../../firebase/auth.js"
import { app } from "../../firebase/firebaseClient.js"

const auth = getAuth(app)

// Clave bajo la que se guarda la credencial de Facebook pendiente de vincular
// cuando el correo ya existe con otro proveedor (auth/account-exists-with-different-credential).
const CLAVE_CREDENCIAL_PENDIENTE = "credencial_facebook_pendiente"

/**
 * Inicia sesión con Facebook mediante popup.
 *
 * - Añade el scope de email para obtener el correo del usuario.
 * - Si el correo ya existe con otro proveedor (contraseña o Google), guarda la
 *   credencial de Facebook en sessionStorage y lanza un error con código
 *   "auth/cuenta-existe-con-otro-metodo" para que la UI lo muestre claro.
 * @returns {Promise<object>} Resultado de signInWithPopup con el usuario autenticado.
 */
export async function iniciarSesionConFacebook() {
    throw new Error("Inicio de sesión con Facebook no disponible en esta versión")
}

/**
 * Vincula la credencial de Facebook guardada en sessionStorage al usuario
 * pasado. Se llama tras un login exitoso con contraseña o Google cuando el
 * correo coincide con el de la credencial de Facebook pendiente.
 * @param {object} usuario - Usuario de Firebase Auth ya autenticado.
 * @returns {Promise<boolean>} true si se vinculó, false si no había credencial pendiente.
 */
export async function vincularCredencialFacebook(usuario) {
    throw new Error("Vinculación de Facebook no disponible en esta versión")
}

/**
 * Comprueba si hay una credencial de Facebook pendiente de vincular.
 * @returns {boolean}
 */
export function hayCredencialFacebookPendiente() {
    return sessionStorage.getItem(CLAVE_CREDENCIAL_PENDIENTE) !== null
}
