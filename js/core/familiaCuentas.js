// ============================================
// FAMILIA DE CUENTAS (subcuentas)
// ============================================
// Una subcuenta es una CUENTA REAL: tiene su propio `moneda` y su propio
// `saldoInicial`, y se vincula a su padre con `padreId`. No existe ningun
// campo `subcuentas` en ningun documento.
//
// El padre ES la subcuenta de su propia divisa: crear una cuenta en PEN+USD
// son 3 documentos (el padre en PEN y 2 hijas), no 4, y no hay que migrar nada
// al anadir subcuentas a una cuenta que ya tiene movimientos, porque la cuenta
// ya es su propia subcuenta.
//
// La ventaja de que sean cuentas de verdad es que todo lo demas —el formulario
// de movimientos, MovimientoServicio, calcularPatrimonio, la busqueda y la
// exportacion— las trata como cuentas normales, sin ningun caso especial.
//
// Vive en su propio modulo (y no en cuentas.js) porque lo necesitan tanto la
// pagina de cuentas como el dashboard, y duplicar estas reglas en dos sitios
// es como se desincroniza el saldo entre panels.

import { DIVISAS_LABELS, DIVISAS_PALABRAS, compararDivisas } from "../../constants/divisas.js"

// Una cuenta es hija si tiene `padreId`.
export function esHija(cuenta) {
    return !!cuenta?.padreId
}

// Hijas de una cuenta, en orden absoluto de divisas (PEN, USD, EUR, USDT).
// Las archivadas no cuentan.
export function hijasDe(cuenta, lista = []) {
    if (!cuenta?.id) return []
    return lista
        .filter(c => c.padreId === cuenta.id && c.estado !== "archivada")
        .sort((a, b) => compararDivisas(a.moneda, b.moneda))
}

// Una cuenta "es padre" si tiene al menos una hija. Sin esto no hay forma de
// distinguir "esta cuenta tiene subcuentas" de "esta cuenta es una hija".
export function tieneHijas(cuenta, lista = []) {
    if (esHija(cuenta)) return false
    return hijasDe(cuenta, lista).length > 0
}

// La familia completa: si el padre es abstracto solo las hijas (el padre no
// es instancia y no tiene tab propia); si es legacy, el padre primero (su
// propia divisa) y despues las hijas.
export function familiaDe(cuenta, lista = []) {
    if (!cuenta) return []
    if (esHija(cuenta)) return [cuenta]
    const hijas = hijasDe(cuenta, lista)
    if (esAbstracta(cuenta)) return [...hijas]
    return [cuenta, ...hijas]
}

// Saldo total de la familia, TODO en la divisa del padre. Sirve para la card
// del dashboard, que muestra el conjunto y no cada pata por separado.
//
// Se suman los nominales sin convertir a proposito: las cifras estan en
// divisas distintas, as que sumarlas entre si no quiere decir nada. El
// dashboard convierte el resultado al Pintar, igual que hacia con el saldo de
// una cuenta normal, y ahi queda claro que es un agregado.
export function saldoFamilia(cuenta, lista = []) {
    return familiaDe(cuenta, lista).reduce((total, c) => total + (Number(c.saldoInicial) || 0), 0)
}

// Cuentas que aparecen como tales en sidebar, selector de movimientos y editor
// del dashboard: los padres, nunca las hijas (que se alcanzan por las tabs).
export function cuentasVisibles(lista = []) {
    return lista.filter(c => !esHija(c))
}

// La divisa base de la cuenta: la suya, o la del padre cuando es una
// subcuenta. Es la moneda en la que la cuenta se opera: el USDT de un
// exchange, el PEN de un broker.
export function divisaBaseDe(cuenta, lista = []) {
    if (!cuenta) return "pen"
    if (!cuenta.padreId) return String(cuenta.moneda || "pen").toLowerCase()
    const padre = lista.find(c => c.id === cuenta.padreId)
    return String(padre?.moneda || cuenta.moneda || "pen").toLowerCase()
}

/**
 * ¿El saldo de esta cuenta es "inmovil"? Lo es el dinero en la divisa base de
 * un broker o de un exchange: está en la cuenta, pero no está invertido en
 * ninguna posición y tampoco está accesible al momento, así que no es
 * liquidez. Las subcuentas en otra divisa (los USD de un exchange, por
 * ejemplo) no entran aquí: su divisa no es la base de la cuenta.
 *
 * Vive aquí porque lo usan el dashboard y SnapshotServicio: si cada uno
 * clasificara a su manera, la card de distribución y la evolución histórica
 * contarían cosas distintas.
 */
export function esSaldoInmovil(cuenta, todasCuentas = []) {
    // Un depósito a plazo es dinero inmovilizado por definición: no se puede
    // retirar hasta el vencimiento, sin importar en qué divisa esté.
    if (cuenta?.tipo === "plazo") return true
    if (cuenta?.tipo !== "exchange" && cuenta?.tipo !== "broker") return false
    const moneda = String(cuenta.moneda || "pen").toLowerCase()
    return moneda === divisaBaseDe(cuenta, todasCuentas)
}

// ============================================
// NOMBRES DE SUBCUENTAS
// ============================================
// El nombre de una hija se genera por defecto a partir del del padre y puede
// borrarse: una hija sin `nombre` en Firestore se muestra aquí con el nombre
// derivado, pero el campo no se escribe para no petrificar el texto.

// Un padre abstracto (clase base) no es una instancia: no tiene divisa propia
// ni saldo, solo sostiene a sus hijas. Las instancias son las subcuentas.
export function esAbstracta(cuenta) {
    return cuenta?.esAbstracta === true
}

// Nombre por defecto de una hija: "Padre SOLES/PEN" según el formato.
// formato "simbolo" → palabra (SOLES, DÓLARES), "codigo" → código (PEN, USD).
export function nombrePorDefectoSubcuenta(nombrePadre, moneda, formato = "simbolo") {
    const clave = String(moneda || "").toLowerCase()
    const palabra = formato === "codigo"
        ? (DIVISAS_LABELS[clave]?.toUpperCase() || String(clave).toUpperCase())
        : (DIVISAS_PALABRAS[clave] || DIVISAS_LABELS[clave]?.toUpperCase() || String(clave).toUpperCase())
    return `${normalizarNombre(nombrePadre)} ${palabra}`
}

// Nombres de cuenta normalizados: en mayúsculas. Se aplica al guardar y al
// mostrar, para que los datos viejos escritos en minúscula se vean iguales.
export function normalizarNombre(nombre) {
    return String(nombre || "").trim().toUpperCase()
}

// Rellena los huecos de nombre en memoria: una hija sin `nombre` muestra el
// derivado del padre y el resto se normaliza a mayúsculas. No escribe nada.
// `formato` es "simbolo" o "codigo" y decide SOLES/DÓLARES frente a PEN/USD.
export function resolverNombresCuentas(lista = [], formato = "simbolo") {
    const porId = new Map(lista.map(c => [c.id, c]))
    return lista.map(cuenta => {
        const copia = { ...cuenta }
        if (esHija(copia)) {
            const padre = porId.get(copia.padreId)
            const base = normalizarNombre(padre?.nombre) || normalizarNombre(copia.nombre)
            copia.nombre = normalizarNombre(copia.nombre) || nombrePorDefectoSubcuenta(base, copia.moneda, formato)
            copia.tieneNombrePropio = Boolean(String(cuenta.nombre || "").trim())
        } else {
            copia.nombre = normalizarNombre(copia.nombre)
        }
        return copia
    })
}

// Cuentas operables en selectores de movimientos: un padre abstracto no se
// ofrece (no es instancia); se ofrecen sus hijas. Los padres legacy (con su
// propia moneda y saldo) sí se ofrecen.
export function cuentasOperables(lista = []) {
    const salida = []
    for (const c of lista) {
        if (esHija(c)) continue
        if (esAbstracta(c)) {
            salida.push(...hijasDe(c, lista))
        } else {
            salida.push(c)
        }
    }
    return salida
}