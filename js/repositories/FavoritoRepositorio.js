import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js"
import { db } from "../../firebase/firestore.js"
import { Favorito } from "../models/Favorito.js"
import { cacheCapa } from "../core/cache.js"

// ============================================
// FAVORITO REPOSITORIO
// ============================================
// Catálogo de plantillas de movimiento del usuario. Los movimientos
// creados a partir de un favorito llevan el campo favoritoId; este
// repositorio solo gestiona la plantilla.

export async function obtenerFavoritos(uid) {
    return cacheCapa.obtener(uid, "favoritos:todos", async () => {
        const referencia = collection(db, "usuarios", uid, "favoritos")
        const resultado = await getDocs(referencia)
        const favoritos = resultado.docs.map(d => Favorito.fromFirestore(d.id, d.data()))
        return favoritos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }))
    })
}

export async function obtenerFavorito(uid, favoritoId) {
    const referencia = doc(db, "usuarios", uid, "favoritos", favoritoId)
    const resultado = await getDoc(referencia)
    if (!resultado.exists()) return null
    return Favorito.fromFirestore(favoritoId, resultado.data())
}

export async function crearFavorito(uid, { nombre, tipo, cuenta, monto, divisa, concepto, etiquetas = [] }) {
    const referencia = collection(db, "usuarios", uid, "favoritos")
    const resultado = await addDoc(referencia, {
        nombre,
        tipo,
        cuenta,
        monto,
        divisa,
        concepto,
        etiquetas,
        fechaCreacion: serverTimestamp()
    })
    cacheCapa.invalidarPrefijo(uid, "favoritos")
    return resultado.id
}

export async function actualizarFavorito(uid, favoritoId, cambios) {
    const referencia = doc(db, "usuarios", uid, "favoritos", favoritoId)
    await updateDoc(referencia, cambios)
    cacheCapa.invalidarPrefijo(uid, "favoritos")
}

export async function eliminarFavorito(uid, favoritoId) {
    const referencia = doc(db, "usuarios", uid, "favoritos", favoritoId)
    await deleteDoc(referencia)
    cacheCapa.invalidarPrefijo(uid, "favoritos")
}
