import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js"
import { db } from "../../firebase/firestore.js"
import { Etiqueta } from "../models/Etiqueta.js"
import { cacheCapa } from "../core/cache.js"

// ============================================
// ETIQUETA REPOSITORIO
// ============================================
// Catálogo de etiquetas del usuario. Los movimientos guardan etiquetas por
// NOMBRE (no por id), así que este catálogo solo aporta orden, color y el
// set principal sembrado al crear la cuenta del usuario.

export async function obtenerEtiquetas(uid) {
    return cacheCapa.obtener(uid, "etiquetas:todos", async () => {
        const referencia = collection(db, "usuarios", uid, "etiquetas")
        const resultado = await getDocs(referencia)
        const etiquetas = resultado.docs.map(d => Etiqueta.fromFirestore(d.id, d.data()))
        // Orden alfabético en cliente: la subcolección es pequeña y así no
        // exige índice ni campo normalizado en Firestore.
        return etiquetas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }))
    })
}

// Devuelve la etiqueta con ese nombre (sin distinguir mayúsculas) o null.
// La unicidad se resuelve leyendo el catálogo entero: cabe en una lectura y
// evita índices o transacciones.
export async function buscarEtiquetaPorNombre(uid, nombre) {
    const buscado = String(nombre || "").trim().toLowerCase()
    if (!buscado) return null
    const etiquetas = await obtenerEtiquetas(uid)
    return etiquetas.find(e => e.nombre.toLowerCase() === buscado) || null
}

export async function crearEtiqueta(uid, { nombre, color = null, esPrincipal = false }) {
    const referencia = collection(db, "usuarios", uid, "etiquetas")
    const resultado = await addDoc(referencia, {
        nombre,
        color,
        esPrincipal: esPrincipal === true,
        fechaCreacion: serverTimestamp()
    })
    cacheCapa.invalidarPrefijo(uid, "etiquetas")
    return resultado.id
}

export async function actualizarEtiqueta(uid, etiquetaId, cambios) {
    const referencia = doc(db, "usuarios", uid, "etiquetas", etiquetaId)
    await updateDoc(referencia, cambios)
    cacheCapa.invalidarPrefijo(uid, "etiquetas")
}

export async function eliminarEtiqueta(uid, etiquetaId) {
    const referencia = doc(db, "usuarios", uid, "etiquetas", etiquetaId)
    await deleteDoc(referencia)
    cacheCapa.invalidarPrefijo(uid, "etiquetas")
}
