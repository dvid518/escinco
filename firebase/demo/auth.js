// ============================================
// FIREBASE AUTH (MOCK DE LA DEMO)
// ============================================
// Sustituye al SDK por import map SOLO dentro de la demo. No hay cuentas ni
// login: existe un usuario invitado fijo. Las acciones que no tienen sentido
// sin sesión real (registrarse, cambiar contraseña, borrar la cuenta) rechazan
// con un mensaje claro; las de solo lectura devuelven datos del invitado.

const USUARIO = {
    uid: "demo",
    email: "demo@escinco.app",
    displayName: "Invitado",
    emailVerified: true,
    photoURL: null,
    providerData: [{ providerId: "password" }]
}

const auth = {
    currentUser: USUARIO,
    app: null
}

export function getAuth(app) {
    auth.app = app
    return auth
}

export function onAuthStateChanged() {
    return () => {}
}

export async function signOut() {
    window.location.assign("/")
}

export async function setPersistence() {}

export const browserLocalPersistence = { type: "LOCAL" }
export const browserSessionPersistence = { type: "SESSION" }

export class GoogleAuthProvider {
    static credential() {
        return { providerId: "google.com" }
    }
}

export class EmailAuthProvider {
    static credential() {
        return { providerId: "password" }
    }
}

async function noDisponible() {
    throw Object.assign(new Error("Esta acción no está disponible en la demo"), { code: "auth/operation-not-allowed" })
}

export const createUserWithEmailAndPassword = noDisponible
export const updateProfile = noDisponible
export const signInWithEmailAndPassword = noDisponible
export const signInWithPopup = noDisponible
export const linkWithCredential = noDisponible
export const updatePassword = noDisponible
export const reauthenticateWithCredential = noDisponible
export const fetchSignInMethodsForEmail = async () => ["password"]
export const getAdditionalUserInfo = () => ({ isNewUser: false, profile: null })
export const deleteUser = noDisponible
export const sendEmailVerification = noDisponible
export const sendPasswordResetEmail = noDisponible
export const confirmPasswordReset = noDisponible
export const applyActionCode = async () => {}
export const reload = async () => {}
