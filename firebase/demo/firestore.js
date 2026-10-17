// ============================================
// FIREBASE FIRESTORE (MOCK DE LA DEMO)
// ============================================
// Sustituye al SDK por import map SOLO dentro de la demo. Implementa el
// subconjunto de la API que usa la app: getFirestore, doc, collection, getDoc,
// getDocs, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch,
// deleteField, query, where, orderBy y limit. No hay tiempo real (onSnapshot)
// ni transacciones porque la app no las usa.
//
// Los datos viven en firebase/demo/store.js (localStorage), no en la nube.

import * as store from "./store.js"

const ELIMINAR = { __borrar: true }

function ruta(...partes) {
    return partes.map(String).join("/")
}

export function getFirestore() {
    return { __demo: true }
}

export function doc(db, ...partes) {
    return { tipo: "doc", ruta: ruta(...partes) }
}

export function collection(db, ...partes) {
    return { tipo: "coleccion", ruta: ruta(...partes) }
}

// ---------- consultas ----------

export function where(campo, operador, valor) {
    return { __tipo: "where", campo, operador, valor }
}

export function orderBy(campo, direccion = "asc") {
    return { __tipo: "orderBy", campo, direccion }
}

export function limit(tope) {
    return { __tipo: "limit", tope }
}

export function query(referencia, ...restricciones) {
    const filtros = []
    const ordenes = []
    let tope = null
    for (const restriccion of restricciones) {
        if (restriccion?.__tipo === "where") filtros.push(restriccion)
        else if (restriccion?.__tipo === "orderBy") ordenes.push(restriccion)
        else if (restriccion?.__tipo === "limit") tope = restriccion.tope
    }
    return { tipo: "query", referencia, filtros, ordenes, tope }
}

// ---------- utilidades internas ----------

function datosDe(ref) {
    if (ref?.tipo === "coleccion") {
        return store.hijosDeColeccion(ref.ruta).map(([id, datos]) => ({ id, datos }))
    }
    const coleccion = ref?.referencia
    let lista = store.hijosDeColeccion(coleccion.ruta).map(([id, datos]) => ({ id, datos }))

    for (const filtro of ref.filtros || []) {
        lista = lista.filter(({ datos }) => cumple(datos, filtro))
    }
    for (const orden of [...(ref.ordenes || [])].reverse()) {
        lista.sort((a, b) => comparar(a, b, orden))
    }
    if (ref.tope != null) lista = lista.slice(0, ref.tope)
    return lista
}

function valorDe(datos, campo, id) {
    if (campo === "__name__") return id
    return datos?.[campo]
}

function tiempo(valor) {
    if (valor instanceof Date) return valor.getTime()
    if (valor?.toDate) return valor.toDate().getTime()
    if (valor == null) return NaN
    return new Date(valor).getTime()
}

function cumple(datos, filtro) {
    const a = valorDe(datos, filtro.campo)
    const b = filtro.valor
    switch (filtro.operador) {
        case "==": return a === b
        case "!=": return a !== b
        case ">": return a > b
        case ">=": return a >= b
        case "<": return a < b
        case "<=": return a <= b
        case "in": return Array.isArray(b) && b.includes(a)
        case "array-contains": return Array.isArray(a) && a.includes(b)
        default: return false
    }
}

function comparar(a, b, orden) {
    const va = valorDe(a.datos, orden.campo, a.id)
    const vb = valorDe(b.datos, orden.campo, b.id)
    const ta = va instanceof Date || va?.toDate ? tiempo(va) : null
    const tb = vb instanceof Date || vb?.toDate ? tiempo(vb) : null
    let resultado
    if (ta !== null && tb !== null) resultado = ta - tb
    else if (typeof va === "string" || typeof vb === "string") resultado = String(va).localeCompare(String(vb))
    else resultado = (va ?? 0) - (vb ?? 0)
    return orden.direccion === "desc" ? -resultado : resultado
}

function instantaneaDeDoc(id, rutaDoc, valores) {
    return {
        id,
        ref: { tipo: "doc", ruta: rutaDoc },
        exists: () => valores !== null && valores !== undefined,
        data: () => (valores ? { ...valores } : undefined),
        get: campo => valores?.[campo]
    }
}

// ---------- operaciones ----------

export async function getDoc(ref) {
    const valores = store.leer(ref.ruta)
    return instantaneaDeDoc(ref.ruta.split("/").pop(), ref.ruta, valores)
}

export async function getDocs(ref) {
    const docs = datosDe(ref).map(({ id, datos }) => {
        const rutaDoc = ref.tipo === "coleccion" ? `${ref.ruta}/${id}` : `${ref.referencia.ruta}/${id}`
        return instantaneaDeDoc(id, rutaDoc, datos)
    })
    return {
        docs,
        empty: docs.length === 0,
        size: docs.length,
        forEach: callback => docs.forEach(callback)
    }
}

export async function addDoc(ref, datos) {
    const id = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
    store.escribir(`${ref.ruta}/${id}`, { ...datos })
    return { id, path: `${ref.ruta}/${id}` }
}

export async function setDoc(ref, datos, opciones = {}) {
    const base = opciones.merge ? (store.leer(ref.ruta) || {}) : {}
    store.escribir(ref.ruta, aplicarCambios(base, datos))
}

export async function updateDoc(ref, datos) {
    const base = store.leer(ref.ruta) || {}
    store.escribir(ref.ruta, aplicarCambios(base, datos))
}

export async function deleteDoc(ref) {
    store.borrar(ref.ruta)
}

export function serverTimestamp() {
    return new Date()
}

// La demo ya vive en localStorage; el real lo ofrece el SDK. Aquí no hace
// nada, pero debe existir para que `firebase/firestore.js` importe bien.
export function enableIndexedDbPersistence() {
    return Promise.resolve()
}

export function deleteField() {
    return ELIMINAR
}

export function writeBatch() {
    const operaciones = []
    return {
        set: (ref, datos, opciones) => operaciones.push(() => setDoc(ref, datos, opciones)),
        update: (ref, datos) => operaciones.push(() => updateDoc(ref, datos)),
        delete: ref => operaciones.push(() => deleteDoc(ref)),
        commit: async () => {
            for (const operacion of operaciones) await operacion()
        }
    }
}

function aplicarCambios(base, cambios) {
    const salida = { ...(base || {}) }
    for (const [clave, valor] of Object.entries(cambios || {})) {
        const partes = clave.split(".")
        let destino = salida
        for (let i = 0; i < partes.length - 1; i++) {
            const parte = partes[i]
            const actual = destino[parte]
            destino[parte] = (actual && typeof actual === "object" && !Array.isArray(actual)) ? { ...actual } : {}
            destino = destino[parte]
        }
        const ultima = partes[partes.length - 1]
        if (valor && valor.__borrar) delete destino[ultima]
        else destino[ultima] = valor
    }
    return salida
}
