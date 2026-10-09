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

// Una cuenta es hija si tiene `padreId`.
export function esHija(cuenta) {
    return !!cuenta?.padreId
}

// Hijas de una cuenta, en el orden en que se crearon. Las archivadas no
// cuentan: una familia con la USD archivada muestra solo PEN y USDT.
export function hijasDe(cuenta, lista = []) {
    if (!cuenta?.id) return []
    return lista.filter(c => c.padreId === cuenta.id && c.estado !== "archivada")
}

// Una cuenta "es padre" si tiene al menos una hija. Sin esto no hay forma de
// distinguir "esta cuenta tiene subcuentas" de "esta cuenta es una hija".
export function tieneHijas(cuenta, lista = []) {
    if (esHija(cuenta)) return false
    return hijasDe(cuenta, lista).length > 0
}

// La familia completa: el padre primero (su propia divisa) y despues las
// hijas. Es la lista que se dibuja como tabs en el panel.
export function familiaDe(cuenta, lista = []) {
    if (!cuenta) return []
    if (esHija(cuenta)) return [cuenta]
    return [cuenta, ...hijasDe(cuenta, lista)]
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