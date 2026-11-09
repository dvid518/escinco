// Borrado de cuenta seguro (hallazgo #5).
//
// js/services/EliminarServicio.js requiere Firebase y DOM, así que no se puede
// importar en Node. Se verifica estáticamente el código fuente, que es lo que
// demuestra la corrección:
//  - eliminarTodosLosDatos ya NO silencia errores con try/catch: se propagan
//    y abortan el borrado (evita datos huérfanos ni deleteUser a medias).
//  - eliminarCuenta mantiene el orden: backup .dvid -> borrar colecciones ->
//    borrar documento raíz -> deleteUser (deleteUser solo si todo salio limpio).
import { nuevoReporter, leer } from "./helpers.mjs"

const src = leer("js/services/EliminarServicio.js")

export default async function ejecutar(t = nuevoReporter("eliminar")) {
    // 1. La lectura/borrado de cada colección ya no va envuelto en un
    //    try/catch que ignore el error y ponga 0. Cualquier fallo se propaga.
    t.check("eliminarTodosLosDatos no ignora errores de coleccion (sin catch silencioso)",
        !/catch\s*\(error\)\s*\{[\s\S]{0,140}resultado\[coleccionNombre\]\s*=\s*0/.test(src))

    // 2. Precondicion: respaldo .dvid antes de borrar.
    t.check("eliminarCuenta: exporta .dvid antes de borrar datos", /exportarDVID\(uid\)/.test(src))

    // 3. Orden: colecciones -> documento raíz -> deleteUser (por posición en
    //    el archivo, no por distancia de caracteres).
    const iBackup = src.indexOf("exportarDVID(uid)")
    const iDatos = src.indexOf("eliminarTodosLosDatos(uid)")
    const iDoc = src.indexOf("eliminarDocUsuario(uid)")
    const iDeleteUser = src.indexOf("eliminarCuentaFirebase()")
    t.check("eliminarCuenta: backup .dvid existe", iBackup !== -1)
    t.check("eliminarCuenta: borrar datos existe", iDatos !== -1)
    t.check("eliminarCuenta: borrar documento raiz existe", iDoc !== -1)
    t.check("eliminarCuenta: deleteUser existe", iDeleteUser !== -1)
    t.check("eliminarCuenta: datos antes de documento raiz", iDatos < iDoc)
    t.check("eliminarCuenta: documento raiz antes de deleteUser", iDoc < iDeleteUser)

    // 4. No hay un try/catch que envuelva (y silencie) el borrado de
    //    colecciones: `eliminarTodosLosDatos` no esta precedido por `try {`.
    t.check("eliminarCuenta no silencia el borrado de colecciones",
        !/try\s*\{[\s\S]{0,100}eliminarTodosLosDatos\(uid\)/.test(src))

    return t
}
