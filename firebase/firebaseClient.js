import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js"
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-analytics.js"
import {
    getAuth,
    createUserWithEmailAndPassword,
    updateProfile,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    EmailAuthProvider,
    linkWithCredential,
    updatePassword,
    reauthenticateWithCredential,
    fetchSignInMethodsForEmail,
    getAdditionalUserInfo,
    deleteUser,
    sendEmailVerification,
    sendPasswordResetEmail,
    confirmPasswordReset,
    applyActionCode,
    reload,
    setPersistence,
    browserSessionPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js"
import {
    getFirestore,
    doc,
    getDoc,
    getDocs,
    collection,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    writeBatch,
    deleteField,
    query,
    where,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js"
import { logEvent, setUserId, setUserProperties } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-analytics.js"
import { firebaseConfig } from "./config.js"

export const app = initializeApp(firebaseConfig)

let analytics = null
try {
    analytics = getAnalytics(app)
} catch (error) {
    console.warn("[WARN] Firebase Analytics no disponible:", error?.message || error)
}

export { analytics }

export {
    getAuth,
    createUserWithEmailAndPassword,
    updateProfile,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    EmailAuthProvider,
    linkWithCredential,
    updatePassword,
    reauthenticateWithCredential,
    fetchSignInMethodsForEmail,
    getAdditionalUserInfo,
    deleteUser,
    sendEmailVerification,
    sendPasswordResetEmail,
    confirmPasswordReset,
    applyActionCode,
    reload,
    setPersistence,
    browserSessionPersistence,
    browserLocalPersistence
}

export {
    getFirestore,
    doc,
    getDoc,
    getDocs,
    collection,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    writeBatch,
    deleteField,
    query,
    where,
    orderBy,
    limit
}

export { logEvent, setUserId, setUserProperties }
