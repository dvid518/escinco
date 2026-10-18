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
    enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js"
import { app } from "./firebaseClient.js"
import { cacheCapa } from "../js/core/cache.js"
import { sesion } from "../js/core/sesion.js"
import { resolverNombresCuentas } from "../js/core/familiaCuentas.js"

const db = getFirestore(app)

// Persistencia offline con IndexedDB: las lecturas y escrituras se guardan en
// local y se sincronizan al volver la conexión. Si falla (navegador sin
// IndexedDB, pestañas múltiples sobre la misma base, etc.) la app sigue
// funcionando solo con la capa de caché, así que el fallo no es fatal.
enableIndexedDbPersistence(db).catch(error => {
    console.warn("[WARN] Persistencia offline no disponible:", error?.code || error)
})

// Re-exportamos utilidades de Firestore para que el resto de la app
// no importe desde la CDN directamente (punto único de acceso).
export { db, doc, updateDoc, deleteField, writeBatch }

// ============================================
// USUARIO
// ============================================

export async function obtenerUsuario(uid) {
    const referencia = doc(db, "usuarios", uid)
    const resultado = await getDoc(referencia)

    if (!resultado.exists()) return null

    return { id: resultado.id, ...resultado.data() }
}

// ============================================
// CUENTAS
// ============================================

// ============================================
// NOTA SOBRE LAS ETIQUETAS
// ============================================
// Antes se sembraban aquí ocho "etiquetas principales" en la cuenta de cada
// usuario. Ya no: las cinco categorías del sistema viven en el código
// (CATEGORIAS_SISTEMA en js/core/etiquetas.js), se cargan siempre y no se
// borran. El catálogo de Firestore guarda únicamente las etiquetas que crea
// el usuario, así que este archivo ya no necesita sembrar nada.

export async function asegurarCuentaEfectivoInicial(uid, usuario = null) {
    if (!uid) return null

    const usuarioRef = doc(db, "usuarios", uid)
    const usuarioDoc = await getDoc(usuarioRef)
    if (!usuarioDoc.exists()) {
        await setDoc(usuarioRef, {
            email: usuario?.email || null,
            nombre: usuario?.displayName || usuario?.nombre || null,
            fechaRegistro: serverTimestamp(),
            preferencias: {}
        })
        // Las categorías del sistema NO se siembran aquí: viven en el código
        // (CATEGORIAS_SISTEMA, js/core/etiquetas.js) y el selector las pinta
        // siempre al principio. El catálogo de Firestore guarda solo lo que
        // crea el usuario.
    }

    const cuentas = await obtenerCuentas(uid)
    const tieneEfectivo = cuentas.some(c => c.tipo === "efectivo")

    if (tieneEfectivo) {
        return null
    }

    const referencia = doc(db, "usuarios", uid, "cuentas", "efectivo-inicial")
    const existente = await getDoc(referencia)
    if (!existente.exists()) {
        await setDoc(referencia, {
            nombre: "Efectivo",
            tipo: "efectivo",
            moneda: "pen",
            saldoInicial: 0,
            estado: "activa",
            esPatrimonio: true,
            orden: 0,
            fechaCreacion: serverTimestamp()
        })
    }

    cacheCapa.invalidar(uid, "cuentas")
    return referencia.id
}

export async function normalizarOrdenCuentas(uid, cuentas) {
    if (!uid || !cuentas.length || cuentas.every(c => Number.isFinite(Number(c.orden)))) return

    const ordenadas = cuentas.slice().sort((a, b) => {
        if (a.id === "efectivo-inicial") return -1
        if (b.id === "efectivo-inicial") return 1
        const fa = a.fechaCreacion?.toDate?.()?.getTime?.() || a.fechaCreacion?.seconds || 0
        const fb = b.fechaCreacion?.toDate?.()?.getTime?.() || b.fechaCreacion?.seconds || 0
        return fa - fb
    })

    const batch = writeBatch(db)
    ordenadas.forEach((cuenta, index) => {
        batch.update(doc(db, "usuarios", uid, "cuentas", cuenta.id), { orden: index })
    })
    await batch.commit()
    cacheCapa.invalidar(uid, "cuentas")
}

export async function reordenarCuentas(uid, cuentasOrdenados) {
    if (!uid || !Array.isArray(cuentasOrdenados)) return
    const batch = writeBatch(db)
    cuentasOrdenados.forEach((cuenta, index) => {
        batch.update(doc(db, "usuarios", uid, "cuentas", cuenta.id), { orden: index })
    })
    await batch.commit()
    cacheCapa.invalidar(uid, "cuentas")
}

export async function crearCuenta(uid, datos) {
    const referencia = collection(db, "usuarios", uid, "cuentas")
    const resultado = await addDoc(referencia, {
        ...datos,
        fechaCreacion: serverTimestamp()
    })
    cacheCapa.invalidar(uid, "cuentas")
    return resultado
}

export async function obtenerCuentas(uid) {
    return cacheCapa.obtener(uid, "cuentas", async () => {
        const referencia = collection(db, "usuarios", uid, "cuentas")
        const resultado = await getDocs(referencia)
        // Los nombres se resuelven (mayúsculas + nombre derivado para hijas
        // sin nombre) en el punto de lectura único, para que todas las vistas
        // muestren lo mismo. El formato (SOLES frente a PEN) sale de la
        // preferencia del usuario.
        const formato = sesion.getPreferencias()?.formatoDivisa === "codigo" ? "codigo" : "simbolo"
        return resolverNombresCuentas(resultado.docs.map(documento => ({
            id: documento.id,
            ...documento.data()
        })), formato)
    })
}

export async function obtenerCuenta(uid, cuentaId) {
    const referencia = doc(db, "usuarios", uid, "cuentas", cuentaId)
    const resultado = await getDoc(referencia)

    if (!resultado.exists()) return null

    return { id: resultado.id, ...resultado.data() }
}

export async function actualizarCuenta(uid, cuentaId, datos) {
    const referencia = doc(db, "usuarios", uid, "cuentas", cuentaId)
    const resultado = await updateDoc(referencia, datos)
    cacheCapa.invalidar(uid, "cuentas")
    return resultado
}

export async function eliminarCuenta(uid, cuentaId) {
    const referencia = doc(db, "usuarios", uid, "cuentas", cuentaId)
    const resultado = await deleteDoc(referencia)
    cacheCapa.invalidar(uid, "cuentas")
    return resultado
}

// ============================================
// MOVIMIENTOS
// ============================================

export async function crearMovimiento(uid, datos) {
    const referencia = collection(db, "usuarios", uid, "movimientos")
    const resultado = await addDoc(referencia, {
        ...datos,
        fechaRegistro: serverTimestamp()
    })
    // Parchear en vez de invalidar: las vistas de Movimientos, Cuentas y
    // Dashboard se suscriben a `movimientos-actualizados` y las tres releen
    // movimientos al guardar. Invalidando, las tres perdían la caché y cada
    // una pagaba la colección entera (que no pagina). Con el parche, la
    // primera lectura repuebla y las otras dos aciertan.
    //
    // `serverTimestamp()` se resuelve en local con una estimación, así que la
    // copia cacheada puede diferir del valor final del servidor por unos
    // milisegundos. El TTL de 5 min la corrige sola.
    const movimiento = { id: resultado.id, ...datos, fechaRegistro: serverTimestamp() }
    cacheCapa.parchear(uid, "movimientos", lista => [...lista, movimiento])
    return resultado
}

export async function obtenerMovimientos(uid) {
    return cacheCapa.obtener(uid, "movimientos", async () => {
        const referencia = collection(db, "usuarios", uid, "movimientos")
        const resultado = await getDocs(referencia)
        return resultado.docs.map(documento => ({
            id: documento.id,
            ...documento.data()
        }))
    })
}

export async function actualizarMovimientoDoc(uid, movimientoId, datos) {
    const referencia = doc(db, "usuarios", uid, "movimientos", movimientoId)
    const resultado = await updateDoc(referencia, datos)
    cacheCapa.parchear(uid, "movimientos", lista =>
        lista.map(m => (m.id === movimientoId ? { ...m, ...datos } : m))
    )
    return resultado
}

export async function eliminarMovimientoDoc(uid, movimientoId) {
    const referencia = doc(db, "usuarios", uid, "movimientos", movimientoId)
    const resultado = await deleteDoc(referencia)
    cacheCapa.parchear(uid, "movimientos", lista =>
        lista.filter(m => m.id !== movimientoId)
    )
    return resultado
}

export async function restaurarDocumento(uid, coleccion, id, datos) {
    if (!datos || typeof datos !== "object") {
        throw new Error("No hay datos para restaurar")
    }
    const { id: _campoId, ...datosGuardados } = datos
    const referencia = doc(db, "usuarios", uid, coleccion, id)
    const resultado = await setDoc(referencia, datosGuardados)
    cacheCapa.invalidar(uid, coleccion)
    return resultado
}

// ============================================
// PREFERENCIAS DE USUARIO
// ============================================
// Usa dot notation para no pisar campos no tocados.
// Ejemplo: actualizarPreferencias(uid, { tema: 'dark' })
//          NO borra `divisaPrincipal`.
// ============================================

export async function obtenerPreferencias(uid) {
    const usuario = await obtenerUsuario(uid)
    if (!usuario) return null
    return usuario.preferencias || null
}

export async function actualizarPreferencias(uid, preferencias) {
    if (!preferencias || typeof preferencias !== "object") {
        throw new Error("Las preferencias deben ser un objeto")
    }

    const referencia = doc(db, "usuarios", uid)

    // Construimos un objeto con notación de punto para merge real
    // Ejemplo: actualizarPreferencias(uid, { tema: 'dark' })
    //          NO borra `divisaPrincipal`.
    const datosMerge = {}
    for (const [clave, valor] of Object.entries(preferencias)) {
        if (valor !== undefined) {
            datosMerge[`preferencias.${clave}`] = valor
        }
    }

    return await updateDoc(referencia, datosMerge)
}

/**
 * Guarda SOLO lo que el usuario ha cambiado de verdad.
 *
 * `actualizarPreferencias` hace merge y por eso no puede BORRAR: si el usuario
 * vuelve a marcar un default, la clave se queda en Firestore con el valor por
 * escrito. Esto la borra de verdad, de modo que un usuario recien creado tiene
 * el documento de preferencias vacio y solo crecen las claves tocadas.
 *
 * @param {string} uid
 * @param {{set?: Object, unset?: string[]}} cambios  `unset` son rutas con
 *        notación de punto ("accesibilidad.doodles").
 */
export async function aplicarPreferenciasDiff(uid, { set = {}, unset = [] } = {}) {
    const referencia = doc(db, "usuarios", uid)
    const datosMerge = {}

    for (const [clave, valor] of Object.entries(set)) {
        if (valor !== undefined) datosMerge[`preferencias.${clave}`] = valor
    }
    for (const ruta of unset) {
        if (typeof ruta === "string" && ruta.trim() !== "") {
            datosMerge[`preferencias.${ruta}`] = deleteField()
        }
    }

    // Sin cambios no se escribe nada: abrir y cerrar la configuracion sin tocar
    // nada no debe crear un documentoPreferences vacio ni generar escrituras.
    if (Object.keys(datosMerge).length === 0) return null
    return await updateDoc(referencia, datosMerge)
}