// ============================================
// ALMACÉN DE LA DEMO · localStorage CON PERSISTENCIA
// ============================================
// Guarda un "Firestore falso" en localStorage como un mapa plano
// ruta → documento. Las rutas son las mismas que usa la app real
// ("usuarios/{uid}/cuentas/{id}", "usuarios/{uid}", ...), así que todo el
// código de repositorios y servicios funciona sin cambios contra este almacén.
//
// Las fechas se serializan como { __fecha: ms } y se reviven a Date al cargar,
// para que los modelos que llaman a .getTime()/.toDate() sigan funcionando
// después de un reload.

const CLAVE = "escinco_demo_db_v1"
const MARCA_FECHA = "__fecha"

function revivir(clave, valor) {
    if (valor && typeof valor === "object" && typeof valor[MARCA_FECHA] === "number") {
        return new Date(valor[MARCA_FECHA])
    }
    return valor
}

function reemplazar(clave, valor) {
    if (valor instanceof Date) return { [MARCA_FECHA]: valor.getTime() }
    return valor
}

let datos = null

function asegurarCargado() {
    if (datos) return datos
    try {
        const crudo = localStorage.getItem(CLAVE)
        datos = crudo ? JSON.parse(crudo, revivir) : {}
    } catch {
        datos = {}
    }
    return datos
}

function persistir() {
    try {
        localStorage.setItem(CLAVE, JSON.stringify(asegurarCargado(), reemplazar))
    } catch { /* almacenamiento lleno o bloqueado */ }
}

export function existe(ruta) {
    return Object.prototype.hasOwnProperty.call(asegurarCargado(), ruta)
}

export function leer(ruta) {
    const valor = asegurarCargado()[ruta]
    return valor === undefined ? null : valor
}

export function escribir(ruta, valor) {
    asegurarCargado()[ruta] = valor
    persistir()
}

export function borrar(ruta) {
    const mapa = asegurarCargado()
    delete mapa[ruta]
    const prefijo = ruta + "/"
    for (const clave of Object.keys(mapa)) {
        if (clave.startsWith(prefijo)) delete mapa[clave]
    }
    persistir()
}

// Documentos directos de una colección: descendientes a exactamente un nivel.
export function hijosDeColeccion(rutaColeccion) {
    const mapa = asegurarCargado()
    const prefijo = rutaColeccion + "/"
    const salida = []
    for (const clave of Object.keys(mapa)) {
        if (!clave.startsWith(prefijo)) continue
        const resto = clave.slice(prefijo.length)
        if (resto === "" || resto.includes("/")) continue
        salida.push([resto, mapa[clave]])
    }
    return salida
}

export function reemplazarTodo(nuevo) {
    datos = nuevo || {}
    persistir()
}

export function volcar() {
    return asegurarCargado()
}

export function vaciar() {
    datos = {}
    persistir()
}
