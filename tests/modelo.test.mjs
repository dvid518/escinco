// Modelo de familia de cuentas (subcuentas). Importa el modulo REAL:
// js/core/familiaCuentas.js es JS puro (solo depende de constants/divisas.js),
// asi que no hace falta extraer nada.
import * as fam from "../js/core/familiaCuentas.js"
import { nuevoReporter } from "./helpers.mjs"

export default function ejecutar(t = nuevoReporter("modelo")) {
    // Familia legacy: padre con divisa propia (PEN, 100) e hijas USD y USDT.
    const legacy = [
        { id: "p1", nombre: "BBVA", moneda: "pen", saldoInicial: 100 },
        { id: "h1", nombre: "BBVA $", moneda: "usd", saldoInicial: 200, padreId: "p1" },
        { id: "h2", nombre: "BBVA ₮", moneda: "usdt", saldoInicial: 50, padreId: "p1" },
        { id: "otro", nombre: "Efectivo", moneda: "pen", saldoInicial: 30 },
        { id: "arq", nombre: "Vieja USD", moneda: "usd", padreId: "p1", estado: "archivada" }
    ]
    // Familia nueva: padre ABSTRACTO (sin divisa ni saldo, solo sostiene hijas).
    const abstracta = [
        { id: "a1", nombre: "BCP", moneda: "pen", saldoInicial: 0, esAbstracta: true },
        { id: "ah1", moneda: "pen", saldoInicial: 500, padreId: "a1" },
        { id: "ah2", moneda: "usd", saldoInicial: 120, padreId: "a1" }
    ]

    console.log("esHija")
    t.check("el padre no es hija", fam.esHija(legacy[0]) === false)
    t.check("una hija si lo es", fam.esHija(legacy[1]) === true)
    t.check("sin padreId no es hija", fam.esHija({ id: "x" }) === false)
    t.check("undefined no es hija", fam.esHija(undefined) === false)

    console.log("\nhijasDe (orden de divisa, sin archivadas)")
    const hijas = fam.hijasDe(legacy[0], legacy)
    t.check("2 hijas activas", hijas.length === 2, hijas.map(c => c.moneda).join(","))
    t.check("orden PEN, USD, EUR, USDT: usd antes que usdt", hijas.map(c => c.moneda).join(",") === "usd,usdt")
    t.check("excluye la archivada", !hijas.some(c => c.id === "arq"))
    t.check("cuenta sin hijas devuelve []", fam.hijasDe(legacy[3], legacy).length === 0)
    t.check("id invalido devuelve []", fam.hijasDe({}, legacy).length === 0)

    console.log("\ntieneHijas")
    t.check("el padre tiene hijas", fam.tieneHijas(legacy[0], legacy) === true)
    t.check("la cuenta suelta no", fam.tieneHijas(legacy[3], legacy) === false)
    t.check("una hija nunca es padre", fam.tieneHijas(legacy[1], legacy) === false)

    console.log("\nfamiliaDe")
    t.check("legacy: padre primero y luego hijas", fam.familiaDe(legacy[0], legacy).map(c => c.id).join(",") === "p1,h1,h2")
    t.check("la familia de una hija es solo ella", fam.familiaDe(legacy[1], legacy).length === 1)
    t.check("abstracto: solo las hijas", fam.familiaDe(abstracta[0], abstracta).map(c => c.id).join(",") === "ah1,ah2")

    console.log("\nsaldoFamilia")
    t.check("legacy 100 + 200 + 50 = 350", fam.saldoFamilia(legacy[0], legacy) === 350)
    t.check("cuenta simple = su saldo", fam.saldoFamilia(legacy[3], legacy) === 30)
    t.check("abstracto suma solo las hijas 500 + 120", fam.saldoFamilia(abstracta[0], abstracta) === 620)

    console.log("\ncuentasVisibles (padres y cuentas sueltas, nunca hijas)")
    t.check("legacy: p1 y otro", fam.cuentasVisibles(legacy).map(c => c.id).join(",") === "p1,otro")
    t.check("lista vacia -> vacia", fam.cuentasVisibles([]).length === 0)

    console.log("\ncuentasOperables (selectores de movimientos)")
    t.check("legacy: el padre se ofrece", fam.cuentasOperables([legacy[0], legacy[1]]).map(c => c.id).join(",") === "p1")
    t.check("abstracto: se ofrecen las hijas, no el padre", fam.cuentasOperables(abstracta).map(c => c.id).join(",") === "ah1,ah2")

    console.log("\nnombrePorDefectoSubcuenta")
    t.check("simbolo: BBVA + pen -> 'BBVA SOLES'", fam.nombrePorDefectoSubcuenta("BBVA", "pen") === "BBVA SOLES")
    t.check("simbolo: BBVA + usd -> 'BBVA DÓLARES'", fam.nombrePorDefectoSubcuenta("BBVA", "usd") === "BBVA DÓLARES")
    t.check("codigo: BBVA + pen -> 'BBVA PEN'", fam.nombrePorDefectoSubcuenta("BBVA", "pen", "codigo") === "BBVA PEN")
    t.check("normaliza el nombre del padre", fam.nombrePorDefectoSubcuenta("bbva", "usd") === "BBVA DÓLARES")

    console.log("\nresolverNombresCuentas (rellena huecos, no escribe)")
    const resueltas = fam.resolverNombresCuentas(abstracta)
    t.check("el padre se normaliza", resueltas[0].nombre === "BCP")
    t.check("la hija sin nombre toma el del padre", resueltas[1].nombre === "BCP SOLES", resueltas[1].nombre)
    t.check("marca tieneNombrePropio=false", resueltas[1].tieneNombrePropio === false)
    t.check("no muta el original (hija sigue sin nombre)", abstracta[1].nombre === undefined)

    console.log("\nnormalizarNombre")
    t.check("recorta y sube a mayusculas", fam.normalizarNombre("  bbva  ") === "BBVA")
    t.check("vacio -> ''", fam.normalizarNombre(undefined) === "")

    return t
}
