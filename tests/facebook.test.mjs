// Login de Facebook: verifica que iniciarSesionConFacebook crea el documento
// de usuario y la cuenta de efectivo, y que vincularCredencialFacebook
// reconstruye la credencial correctamente (sin JSON.stringify/JSON.parse).
//
// Los modulos que dependen de Firebase se leen como texto y se evalúan con
// stubs mínimos (patrón usado por el resto de tests de tests/).

import { leer, extraerFuncion, nuevoReporter } from "./helpers.mjs"

const CLAVE_ACCESS_TOKEN = "credencial_facebook_access_token"
const CLAVE_ID_TOKEN = "credencial_facebook_id_token"

function mockSessionStorage() {
    const store = {}
    return {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = v },
        removeItem: (k) => { delete store[k] }
    }
}

export default async function ejecutar(t = nuevoReporter("facebook")) {
    const srcAuthServicio = leer("js/services/AuthServicio.js")

    // -----------------------------------------------------------
    // 1. hayCredencialFacebookPendiente: funciona sin credenciales
    // -----------------------------------------------------------
    {
        const sessionStorage = mockSessionStorage()
        const hay = new Function(
            "sessionStorage", "CLAVE_ACCESS_TOKEN", "CLAVE_ID_TOKEN",
            `return (${extraerFuncion(srcAuthServicio, "hayCredencialFacebookPendiente")})`
        )(sessionStorage, CLAVE_ACCESS_TOKEN, CLAVE_ID_TOKEN)

        t.check("sin credenciales devuelve false", hay() === false)

        sessionStorage.setItem(CLAVE_ACCESS_TOKEN, "token")
        sessionStorage.setItem(CLAVE_ID_TOKEN, "id")
        t.check("con credenciales devuelve true", hay() === true)

        sessionStorage.removeItem(CLAVE_ACCESS_TOKEN)
        t.check("sin accessToken devuelve false", hay() === false)
    }

    // -----------------------------------------------------------
    // 2. vincularCredencialFacebook: reconstruye credencial con
    //    FacebookAuthProvider.credential(accessToken, idToken)
    // -----------------------------------------------------------
    {
        const sessionStorage = mockSessionStorage()
        sessionStorage.setItem(CLAVE_ACCESS_TOKEN, "access-token-123")
        sessionStorage.setItem(CLAVE_ID_TOKEN, "id-token-456")

        let linkCalled = false
        let usuarioRecibido = null

        const mockFacebookAuthProvider = {
            credential: (accessToken, idToken) => ({ accessToken, idToken, providerId: "facebook.com" })
        }
        const mockLinkWithCredential = async (usuario, _credencial) => {
            linkCalled = true
            usuarioRecibido = usuario
        }

        const vincular = new Function(
            "sessionStorage", "FacebookAuthProvider", "linkWithCredential",
            "CLAVE_ACCESS_TOKEN", "CLAVE_ID_TOKEN",
            `return (${extraerFuncion(srcAuthServicio, "vincularCredencialFacebook")})`
        )(sessionStorage, mockFacebookAuthProvider, mockLinkWithCredential, CLAVE_ACCESS_TOKEN, CLAVE_ID_TOKEN)

        const usuario = { uid: "uid-abc", email: "usuario@ejemplo.com" }
        const resultado = await vincular(usuario)

        t.check("devuelve true al vincular", resultado === true)
        t.check("llama a linkWithCredential", linkCalled === true)
        t.check("usuario pasado a linkWithCredential", usuarioRecibido === usuario)
        t.check("limpia accessToken de sessionStorage", sessionStorage.getItem(CLAVE_ACCESS_TOKEN) === null)
        t.check("limpia idToken de sessionStorage", sessionStorage.getItem(CLAVE_ID_TOKEN) === null)
    }

    // -----------------------------------------------------------
    // 3. vincularCredencialFacebook: sin credenciales devuelve false
    // -----------------------------------------------------------
    {
        const sessionStorage = mockSessionStorage()
        const mockFacebookAuthProvider = { credential: () => {} }
        const mockLinkWithCredential = async () => {}

        const vincular = new Function(
            "sessionStorage", "FacebookAuthProvider", "linkWithCredential",
            "CLAVE_ACCESS_TOKEN", "CLAVE_ID_TOKEN",
            `return (${extraerFuncion(srcAuthServicio, "vincularCredencialFacebook")})`
        )(sessionStorage, mockFacebookAuthProvider, mockLinkWithCredential, CLAVE_ACCESS_TOKEN, CLAVE_ID_TOKEN)

        const resultado = await vincular({ uid: "uid" })
        t.check("sin credenciales devuelve false", resultado === false)
    }

    // -----------------------------------------------------------
    // 4. firebase/auth.js exporta registrarConFacebook y loginConFacebook
    // -----------------------------------------------------------
    {
        const srcAuth = leer("firebase/auth.js")
        t.check("exporta registrarConFacebook", srcAuth.includes("export async function registrarConFacebook"))
        t.check("exporta loginConFacebook", srcAuth.includes("export function loginConFacebook"))
        t.check("importa FacebookAuthProvider", srcAuth.includes("FacebookAuthProvider"))
        t.check("usa signInWithPopup con Facebook", srcAuth.includes("new FacebookAuthProvider()"))
        t.check("añade scope email", srcAuth.includes('provider.addScope("email")'))
        t.check("llama a asegurarDocUsuario", srcAuth.includes("asegurarDocUsuario(resultado.user"))
        t.check("llama a asegurarCuentaEfectivoInicial", srcAuth.includes("asegurarCuentaEfectivoInicial(resultado.user.uid"))
    }

    // -----------------------------------------------------------
    // 5. AuthServicio.js: iniciarSesionConFacebook usa loginConFacebook
    //    y guarda credencial por campos (no JSON.stringify del credential)
    // -----------------------------------------------------------
    t.check("iniciarSesionConFacebook existe en AuthServicio.js",
        srcAuthServicio.includes("export async function iniciarSesionConFacebook"))
    t.check("usa loginConFacebook", srcAuthServicio.includes("return await loginConFacebook()"))
    t.check("no usa JSON.stringify del credential", !srcAuthServicio.includes("JSON.stringify(error.credential)"))
    t.check("guarda accessToken por separado",
        srcAuthServicio.includes(`sessionStorage.setItem(CLAVE_ACCESS_TOKEN, accessToken`))
    t.check("guarda idToken por separado",
        srcAuthServicio.includes(`sessionStorage.setItem(CLAVE_ID_TOKEN, idToken`))
    t.check("vincularCredencialFacebook usa FacebookAuthProvider.credential",
        srcAuthServicio.includes("FacebookAuthProvider.credential(accessToken, idToken)"))
    t.check("hayCredencialFacebookPendiente verifica ambas claves",
        srcAuthServicio.includes(`sessionStorage.getItem(CLAVE_ACCESS_TOKEN) !== null`) &&
        srcAuthServicio.includes(`sessionStorage.getItem(CLAVE_ID_TOKEN) !== null`))
}
