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

// ============================================
// LIMPIEZA DEL CATÁLOGO SEMBRADO (puntual)
// ============================================
// Hasta la 1.0.0-beta.28 escinco sembraba 8 "etiquetas principales" en la cuenta
// de cada usuario (Comida, Transporte, Ocio, Vivienda, Salud, Educación,
// Inversiones, Otros). Ya no: las cinco categorías viven en el código
// (CATEGORIAS_SISTEMA) y el catálogo guarda solo lo que crea el usuario.
//
// Esta función borra esas etiquetas viejas. Filtra por `esPrincipal === true`:
// es la única marca que ponía la siembra (todo lo que crea el usuario va con
// `esPrincipal: false`), así que no toca nada suyo aunque se llame
// "Vivienda". Los MOVIMIENTOS no se tocan: guardan las etiquetas por nombre, no
// por id, así que sus chips siguen funcionando aunque la etiqueta desaparezca
// del catálogo.

export async function eliminarEtiquetasPrincipales(uid) {
    if (!uid) return 0
    try {
        const etiquetas = await obtenerEtiquetas(uid)
        const viejas = etiquetas.filter(e => e.esPrincipal === true)
        if (!viejas.length) return 0
        for (const etiqueta of viejas) {
            await eliminarEtiqueta(uid, etiqueta.id)
        }
        console.info(
            `[INFO] Se limpiaron ${viejas.length} etiqueta(s) principales del catálogo: ` +
            viejas.map(e => e.nombre).join(", ")
        )
        return viejas.length
    } catch (error) {
        // Que falle la limpieza no debe impedir arrancar la app: el catálogo
        // quedaría con esas etiquetas, pero las categorías del sistema se
        // siguen mostrando igualmente.
        console.warn("[WARN] No se pudo limpiar el catálogo de etiquetas principales:", error?.code || error)
        return 0
    }
}
