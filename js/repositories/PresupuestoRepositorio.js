import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js"
import { db } from "../../firebase/firestore.js"
import { Presupuesto } from "../models/Presupuesto.js"
import { cacheCapa } from "../core/cache.js"

// ============================================
// PRESUPUESTO REPOSITORIO (por usuario)
// ============================================
// Ruta: usuarios/{uid}/presupuestos/{presupuestoId}
// ============================================

const CLAVE_CACHE = "presupuestos"

function refPresupuestos(uid) {
    return collection(db, "usuarios", uid, "presupuestos")
}

// --------------------------------------------
// CREAR
// --------------------------------------------

export async function crearPresupuesto(uid, datos) {
    const presupuesto = new Presupuesto(datos)
    presupuesto.validar()

    const resultado = await addDoc(refPresupuestos(uid), {
        ...presupuesto.toFirestore(),
        fechaCreacion: serverTimestamp()
    })
    cacheCapa.invalidar(uid, CLAVE_CACHE)

    return resultado.id
}

// --------------------------------------------
// LEER
// --------------------------------------------

export async function obtenerPresupuestos(uid) {
    return cacheCapa.obtener(uid, CLAVE_CACHE, async () => {
        const q = query(refPresupuestos(uid), orderBy("fechaCreacion", "desc"))
        const resultado = await getDocs(q)

        return resultado.docs.map(documento => {
            return Presupuesto.fromFirestore(documento.id, documento.data())
        })
    })
}

export async function obtenerPresupuesto(uid, presupuestoId) {
    if (!presupuestoId) return null

    const referencia = doc(db, "usuarios", uid, "presupuestos", presupuestoId)
    const resultado = await getDoc(referencia)

    if (!resultado.exists()) {
        return null
    }

    return Presupuesto.fromFirestore(resultado.id, resultado.data())
}

// --------------------------------------------
// ACTUALIZAR
// --------------------------------------------

export async function actualizarPresupuesto(uid, presupuestoId, datos) {
    const referencia = doc(db, "usuarios", uid, "presupuestos", presupuestoId)
    const presupuesto = new Presupuesto({ ...datos })
    presupuesto.validar()

    const resultado = await updateDoc(referencia, { ...datos })
    cacheCapa.invalidar(uid, CLAVE_CACHE)

    return resultado
}

// --------------------------------------------
// ELIMINAR
// --------------------------------------------

export async function eliminarPresupuesto(uid, presupuestoId) {
    const referencia = doc(db, "usuarios", uid, "presupuestos", presupuestoId)
    const resultado = await deleteDoc(referencia)
    cacheCapa.invalidar(uid, CLAVE_CACHE)

    return resultado
}
