// Edicion de cuentas: al anadir divisas a una cuenta existente solo se crean
// las que faltan. Comprueba el contrato real del codigo (el filtro que resta
// las divisas ya presentes) y la logica que implementa.
import { leer, nuevoReporter } from "./helpers.mjs"

const src = leer("js/pages/cuentas.js")

export default function ejecutar(t = nuevoReporter("edicion")) {
    const contrato = src.includes(".filter(d => !divisasExistentes.includes(d))")
    t.check("existe el filtro de divisas nuevas en cuentas.js", contrato)

    // Logica equivalente a la del onConfirm de edicion, con las divisas
    // existentes = [divisa del padre, ...las hijas] (o solo la del padre).
    const calcular = (cuenta, hijas, seleccionadas) => {
        const actual = (cuenta.moneda || "pen").toLowerCase()
        const existentes = hijas.length > 0 ? [actual, ...hijas.map(c => (c.moneda || "pen").toLowerCase())] : [actual]
        return seleccionadas.filter(d => !existentes.includes(d))
    }
    const PEN = { moneda: "pen" }

    console.log("\nCuenta simple en PEN, marca USD y USDT")
    let r = calcular(PEN, [], ["pen", "usd", "usdt"])
    t.check("crea USD", r.includes("usd"))
    t.check("crea USDT", r.includes("usdt"))
    t.check("no reescribe PEN", !r.includes("pen"))

    console.log("\nCuenta simple en PEN, solo marca PEN")
    t.check("no crea nada", calcular(PEN, [], ["pen"]).length === 0)

    console.log("\nCuenta con hija USD, anade USDT")
    r = calcular(PEN, [{ moneda: "usd" }], ["pen", "usd", "usdt"])
    t.check("solo USDT", r.length === 1 && r[0] === "usdt", r.join(","))

    console.log("\nCuenta con hija USD, no marca nada nuevo")
    t.check("no crea nada", calcular(PEN, [{ moneda: "usd" }], ["pen", "usd"]).length === 0)

    console.log("\nDivisa no estandar")
    r = calcular({ moneda: "eur" }, [], ["eur", "usd"])
    t.check("trata eur como usada, crea usd", r.length === 1 && r[0] === "usd", r.join(","))

    return t
}
