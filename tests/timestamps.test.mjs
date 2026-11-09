// Timestamps en backups (hallazgo #7).
//
// Verifica que los Timestamps de Firestore ({seconds, nanoseconds}) se
// serializan/deserializan y reviven a Date correctamente, tanto en la caché
// de localStorage como al exportar/importar un .dvid.
import { revivirTimestamps } from "../js/core/cache.js"
import { extraerFuncion, nuevoReporter, leer } from "./helpers.mjs"

const serializarFechas = new Function(
    `${extraerFuncion(leer("js/services/ExportarServicio.js"), "serializarFechas")}\nreturn serializarFechas`
)()

const deserializarFechas = new Function(
    `${extraerFuncion(leer("js/services/ImportarServicio.js"), "deserializarFechas")}\nreturn deserializarFechas`
)()

const ts = { seconds: 1765000000, nanoseconds: 123000000 } // ~2025-12-06T15:33:20.123Z

export default async function ejecutar(t = nuevoReporter("timestamps")) {
    // 1. revivirTimestamps convierte {seconds, nanoseconds} a Date.
    const vivo = revivirTimestamps(ts)
    t.check("revivirTimestamps: mapa -> Date", vivo instanceof Date)
    t.check("revivirTimestamps: fecha correcta",
        vivo.getTime() === ts.seconds * 1000 + Math.round(ts.nanoseconds / 1e6))

    // 2. Arrays y objetos anidados también se reviven.
    const anidado = revivirTimestamps({ a: [ts, { b: ts }], c: "no-fecha" })
    t.check("revivirTimestamps: array anidado", anidado.a[0] instanceof Date && anidado.a[1].b instanceof Date)
    t.check("revivirTimestamps: valores no-timestamp intactos", anidado.c === "no-fecha")

    // 3. serializarFechas convierte {seconds, nanoseconds} a ISO string.
    const serializado = serializarFechas(ts)
    t.check("serializarFechas: mapa -> ISO string", typeof serializado === "string")
    t.check("serializarFechas: ISO equivale al Date revivido",
        new Date(serializado).getTime() === vivo.getTime())

    // 4. serializarFechas recorre objetos anidados.
    const serializadoAnidado = serializarFechas({ registro: ts })
    t.check("serializarFechas: objeto anidado", typeof serializadoAnidado.registro === "string")

    // 5. deserializarFechas convierte {seconds, nanoseconds} de un campo de
    //    fecha a Date (roundtrip del importador).
    const deserializado = deserializarFechas({ fechaRegistro: ts }, ["fechaRegistro"])
    t.check("deserializarFechas: mapa -> Date", deserializado.fechaRegistro instanceof Date)
    t.check("deserializarFechas: fecha correcta",
        deserializado.fechaRegistro.getTime() === vivo.getTime())

    // 6. deserializarFechas deja intacto lo que no es campo de fecha.
    const sinFecha = deserializarFechas({ nombre: "x" }, ["fechaRegistro"])
    t.check("deserializarFechas: no-fecha intacto", sinFecha.nombre === "x")

    return t
}
