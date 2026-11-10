import {
    linkWithCredential
} from "../../firebase/firebaseClient.js"
import { FacebookAuthProvider } from "../../firebase/firebaseClient.js"
import { loginConFacebook } from "../../firebase/auth.js"

// Claves para guardar los datos de la credencial de Facebook de forma segura
// (sin serializar el objeto OAuthCredential completo, que no sobrevive
// JSON.stringify/JSON.parse).
const CLAVE_ACCESS_TOKEN = "credencial_facebook_access_token"
const CLAVE_ID_TOKEN = "credencial_facebook_id_token"

/**
 * Inicia sesión con Facebook mediante popup.
 *
 * - Añade el scope de email para obtener el correo del usuario.
 * - Crea el documento de usuario en Firestore y la cuenta de efectivo inicial.
 * - Si el correo ya existe con otro proveedor (contraseña o Google), guarda la
 *   credencial de Facebook en sessionStorage y lanza un error con código
 *   "auth/cuenta-existe-con-otro-metodo" para que la UI lo muestre claro.
 * @returns {Promise<object>} Resultado del inicio de sesión con el usuario autenticado.
 */
export async function iniciarSesionConFacebook() {
    try {
        return await loginConFacebook()
    } catch (error) {
        if (error.code === "auth/account-exists-with-different-credential") {
            const { accessToken, idToken } = error.credential
            sessionStorage.setItem(CLAVE_ACCESS_TOKEN, accessToken || "")
            sessionStorage.setItem(CLAVE_ID_TOKEN, idToken || "")
            throw new Error("auth/cuenta-existe-con-otro-metodo")
        }
        throw error
    }
}

/**
 * Vincula la credencial de Facebook guardada en sessionStorage al usuario
 * pasado. Se llama tras un login exitoso con contraseña o Google cuando el
 * correo coincide con el de la credencial de Facebook pendiente.
 * @param {object} usuario - Usuario de Firebase Auth ya autenticado.
 * @returns {Promise<boolean>} true si se vinculó, false si no había credencial pendiente.
 */
export async function vincularCredencialFacebook(usuario) {
    const accessToken = sessionStorage.getItem(CLAVE_ACCESS_TOKEN)
    const idToken = sessionStorage.getItem(CLAVE_ID_TOKEN)
    if (!accessToken || !idToken) return false

    const credencial = FacebookAuthProvider.credential(accessToken, idToken)
    await linkWithCredential(usuario, credencial)
    sessionStorage.removeItem(CLAVE_ACCESS_TOKEN)
    sessionStorage.removeItem(CLAVE_ID_TOKEN)
    return true
}

/**
 * Comprueba si hay una credencial de Facebook pendiente de vincular.
 * @returns {boolean}
 */
export function hayCredencialFacebookPendiente() {
    return (
        sessionStorage.getItem(CLAVE_ACCESS_TOKEN) !== null &&
        sessionStorage.getItem(CLAVE_ID_TOKEN) !== null
    )
}
