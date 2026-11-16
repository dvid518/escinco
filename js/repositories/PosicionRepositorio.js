import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    serverTimestamp
} from "../../firebase/firestore.js"
import { db } from "../../firebase/firestore.js"
import { Posicion } from "../models/Posicion.js"
import { obtenerActivo } from "./ActivoRepositorio.js"
import { cacheCapa } from "../core/cache.js"

// ============================================
// POSICION REPOSITORIO (por usuario)
// ============================================

export async function crearPosicion(uid, datos) {
    const posicion = new Posicion(datos)
    posicion.validar()
    
    const referencia = collection(db, "usuarios", uid, "posiciones")
    const resultado = await addDoc(referencia, {
        ...posicion.toFirestore(),
        ultimaActualizacion: serverTimestamp()
    })
    cacheCapa.invalidar(uid, "posiciones")
    
    return resultado.id
}

export function obtenerPosiciones(uid) {
    return cacheCapa.obtener(uid, "posiciones", async () => {
        const referencia = collection(db, "usuarios", uid, "posiciones")
        const resultado = await getDocs(referencia)
        
        const posiciones = await Promise.all(resultado.docs.map(async documento => {
            const pos = Posicion.fromFirestore(documento.id, documento.data())
            try {
                const activo = await obtenerActivo(uid, pos.activoId)
                pos.activo = activo
            } catch (error) {
                console.warn(`Activo no encontrado para posición ${pos.id}:`, error)
            }
            return pos
        }))
        
        return posiciones
    })
}

export async function obtenerPosicion(uid, posicionId) {
    const referencia = doc(db, "usuarios", uid, "posiciones", posicionId)
    const resultado = await getDoc(referencia)
    
    if (!resultado.exists()) {
        return null
    }
    
    const pos = Posicion.fromFirestore(resultado.id, resultado.data())
    
    try {
        const activo = await obtenerActivo(uid, pos.activoId)
        pos.activo = activo
    } catch {
        console.warn(`Activo no encontrado para posición ${pos.id}`)
    }
    
    return pos
}

// NUEVA: devolver todas las posiciones de un activo (array)
export async function obtenerPosicionesPorActivo(uid, activoId) {
    const posiciones = await obtenerPosiciones(uid)
    return posiciones.filter(p => p.activoId === activoId)
}

// ACTUALIZADO: ahora firma enhanced con custodioId opcional
export async function obtenerPosicionPorActivo(uid, activoId, custodioId = null) {
    // Si se especifica custodioId, buscar solo la de ese custodio
    if (custodioId) {
        const posiciones = await obtenerPosicionesPorActivo(uid, activoId)
        const pos = posiciones.find(p => p.custodioId === custodioId)
        return pos || null
    }
    
    // Sin custodioId: devolver null para forzar al llamador a pasar custodioId
    // o usar obtenerPosicionesPorActivo para ver todas las posiciones
    return null
}

// ACTUALIZADO: mantener firma actual como fallback legacy
// Si custodioId es undefined → posición legacy (custodioId: null)
// Si custodioId está definido → usar identidad custodioId + activoId
export async function crearOActualizarPosicion(uid, datos) {
    const { activoId, cantidad, divisa = 'usd', precioPromedio, custodioId } = datos
    
    // Validación básica
    if (!activoId) {
        throw new Error('El ID del activo es obligatorio')
    }
    if (cantidad === undefined || cantidad === null) {
        throw new Error('La cantidad es obligatoria')
    }
    
    // Si custodioId no está definido (undefined), crear posición legacy
    if (custodioId === undefined) {
        // Posición legacy: custodioId será null, pendiente_asignacion (M5)
        const id = await crearPosicion(uid, {
            activoId,
            custodioId: null,
            cantidad,
            divisa,
            precioPromedio
        })
        return id
    }
    
    // Si custodioId está definido, usar identidad custodioId + activoId
    // Verificar si ya existe posición para este custodio + activo
    const posicionExistente = await obtenerPosicionPorActivo(uid, activoId, custodioId)
    
    if (posicionExistente) {
        // Fusionar cantidad
        const nuevaCantidad = posicionExistente.cantidad + cantidad
        if (nuevaCantidad <= 0) {
            await eliminarPosicion(uid, posicionExistente.id)
            return null
        }
        // Recalcular precio promedio solo en compra (cantidad > 0)
        let nuevoPrecioPromedio = posicionExistente.precioPromedio
        if (cantidad > 0) {
            const valorTotalActual = posicionExistente.cantidad * posicionExistente.precioPromedio
            const valorNuevo = cantidad * precioPromedio
            nuevoPrecioPromedio = (valorTotalActual + valorNuevo) / nuevaCantidad
        }
        await actualizarPosicion(uid, posicionExistente.id, {
            cantidad: nuevaCantidad,
            precioPromedio: nuevoPrecioPromedio,
            divisa: divisa,
            custodioId: custodioId
        })
        return posicionExistente.id
    } else {
        // Crear nueva posición con custodioId definido
        const id = await crearPosicion(uid, {
            activoId,
            custodioId,
            cantidad,
            divisa,
            precioPromedio
        })
        return id
    }
}

export async function actualizarPosicion(uid, posicionId, datos) {
    const referencia = doc(db, "usuarios", uid, "posiciones", posicionId)
    const resultado = await updateDoc(referencia, {
        ...datos,
        ultimaActualizacion: serverTimestamp()
    })
    cacheCapa.invalidar(uid, "posiciones")
    return resultado
}

export async function eliminarPosicion(uid, posicionId) {
    const referencia = doc(db, "usuarios", uid, "posiciones", posicionId)
    const resultado = await deleteDoc(referencia)
    cacheCapa.invalidar(uid, "posiciones")
    return resultado
}