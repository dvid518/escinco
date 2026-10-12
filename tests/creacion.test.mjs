// Creacion de familias de cuentas: extrae la funcion REAL
// crearCuentaConSubcuentas de cuentas.js y la ejecuta contra una base simulada
// que registra cada documento escrito.
//
// Modelo actual: el padre es ABSTRACTO (sin divisa operativa ni saldo), y cada
// divisa —incluida la del padre— es una hija real. Con N divisas salen N+1
// documentos.
import { leer, extraerFuncion, nuevoReporter } from "./helpers.mjs"
import { normalizarNombre } from "../js/core/familiaCuentas.js"

const src = leer("js/pages/cuentas.js")

export default async function ejecutar(t = nuevoReporter("creacion")) {
    const escritos = []
    let contador = 0
    async function crearCuenta(uid, datos) {
        const doc = { id: `doc${++contador}`, ...datos }
        escritos.push(doc)
        return doc
    }

    const crear = new Function("crearCuenta", "normalizarNombre", `return (${extraerFuncion(src, "crearCuentaConSubcuentas")})`)(crearCuenta, normalizarNombre)

    const base = { nombre: "BBVA", tipo: "broker", estado: "activa", esPatrimonio: true, orden: 3 }

    console.log("A) PEN + USD + USDT -> 1 padre abstracto + 3 hijas")
    escritos.length = 0
    await crear("u", { ...base, moneda: "pen", divisasExtras: ["usd", "usdt"] }, { pen: 100, usd: 200, usdt: 50 })
    t.check("4 documentos", escritos.length === 4, escritos.length + " documento(s)")
    t.check("el padre es abstracto", escritos[0].esAbstracta === true)
    t.check("el padre no lleva saldo", escritos[0].saldoInicial === 0)
    t.check("el padre no tiene padreId", !("padreId" in escritos[0]))
    t.check("el padre normaliza el nombre", escritos[0].nombre === "BBVA")
    t.check("el padre NO persiste divisasExtras", !("divisasExtras" in escritos[0]), Object.keys(escritos[0]).join(","))
    const hijas = escritos.slice(1)
    t.check("3 hijas", hijas.length === 3)
    t.check("todas apuntan al padre", hijas.every(h => h.padreId === escritos[0].id))
    t.check("una hija por divisa, en orden", hijas.map(h => h.moneda).join(",") === "pen,usd,usdt")
    t.check("cada hija con su saldo", hijas.map(h => h.saldoInicial).join(",") === "100,200,50")
    t.check("las hijas no escriben nombre (se deriva)", hijas.every(h => !("nombre" in h)))
    t.check("las hijas heredan tipo y estado", hijas.every(h => h.tipo === "broker" && h.estado === "activa"))
    t.check("las hijas son patrimonio", hijas.every(h => h.esPatrimonio === true))
    t.check("orden correlativo desde el del padre (4,5,6)", hijas.map(h => h.orden).join(",") === "4,5,6")

    console.log("\nB) Una sola divisa -> 1 documento, sin padre abstracto")
    escritos.length = 0
    await crear("u", { ...base, moneda: "usd", divisasExtras: [] }, { usd: 75 })
    t.check("1 documento", escritos.length === 1)
    t.check("no es abstracto", escritos[0].esAbstracta !== true)
    t.check("sin padreId", !("padreId" in escritos[0]))
    t.check("con su saldo", escritos[0].saldoInicial === 75)

    console.log("\nC) credito -> nunca genera familia")
    escritos.length = 0
    await crear("u", { ...base, tipo: "credito", moneda: "pen", divisasExtras: ["usd", "usdt"] }, { pen: 0, usd: 10, usdt: 10 }, { esCredito: true })
    t.check("solo el documento del padre", escritos.length === 1, escritos.length + " documento(s)")
    t.check("saldo del padre en 0", escritos[0].saldoInicial === 0)
    t.check("sin esAbstracta", escritos[0].esAbstracta !== true)

    console.log("\nD) Saldo ausente en una divisa -> 0, no undefined")
    escritos.length = 0
    await crear("u", { ...base, moneda: "pen", divisasExtras: ["usd"] }, { pen: 40 })
    t.check("padre abstracto + 2 hijas", escritos.length === 3, escritos.length + " documento(s)")
    t.check("hija PEN en 40", escritos[1].saldoInicial === 40)
    t.check("hija USD en 0", escritos[2].saldoInicial === 0, String(escritos[2].saldoInicial))

    return t
}
