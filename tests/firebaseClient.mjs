// Mock de firebaseClient.js para tests F7.3
// La app en navegador continúa usando el archivo real desde CDN.
// Este mock solo evita que Node.js intente procesar URLs https:// en tiempo de módulo.
//
// Exportaciones vacías que satisfacen la cadena de imports sin cargar SDK real.
const noop = () => {}
const noopAsync = async () => ({})
const stubAuth = () => ({})

export const firebase = {};
export const initializeApp = () => {};
export const getAnalytics = () => null;
export const getFirestore = () => ({
    doc: () => ({}),
    getDoc: () => ({}),
    getDocs: () => ({}),
    collection: () => ({}),
    addDoc: async () => ({}),
    setDoc: async () => {},
    updateDoc: async () => {},
    deleteDoc: async () => {},
    serverTimestamp: () => null,
    writeBatch: () => ({}),
    deleteField: () => ({}),
    query: () => ({}),
    where: () => ({}),
    orderBy: () => ({}),
    limit: () => ({}),
});

// Auth y Analytics: solo tienen que existir para que el enlace de módulos no falle.
export const getAuth = stubAuth;
export const createUserWithEmailAndPassword = noopAsync;
export const signInWithEmailAndPassword = noopAsync;
export const signInWithPopup = noopAsync;
export const signOut = noopAsync;
export const onAuthStateChanged = noop;
export const linkWithCredential = noopAsync;
export const updatePassword = noopAsync;
export const reauthenticateWithCredential = noopAsync;
export const fetchSignInMethodsForEmail = noopAsync;
export const getAdditionalUserInfo = () => ({});
export const deleteUser = noopAsync;
export const sendEmailVerification = noopAsync;
export const sendPasswordResetEmail = noopAsync;
export const confirmPasswordReset = noopAsync;
export const applyActionCode = noopAsync;
export const reload = noopAsync;
export const setPersistence = noopAsync;
export const updateProfile = noopAsync;

export class GoogleAuthProvider {}
export class FacebookAuthProvider {}
export class EmailAuthProvider {}

export const browserSessionPersistence = "session";
export const browserLocalPersistence = "local";

export const logEvent = noop;
export const setUserId = noop;
export const setUserProperties = noop;
