// Migraciones de preferencias M6-M8 (F7.6).
//
// Los casos usan cuentas de fixture, no el backup real: el objetivo es fijar
// las reglas (expansión de familias, huérfanos, 1×1 y nombres automáticos) y
// que un cambio futuro en ellas rompa el test.
import { leer, nuevoReporter } from "./helpers.mjs"
import {
    CARDS_ESTANDAR,
    migrarNombresM8,
    migrarPreferenciasM6,
    migrarPreferenciasM7
} from "../scripts/migraciones/preferencias.mjs"

const CUENTAS = [
    { id: "p1", nombre: "BANCO", moneda: "pen", saldoInicial: 100, tipo: "debito" },
    { id: "h1", padreId: "p1", nombre: "BANCO $", moneda: "usd", saldoInicial: 50, tieneNombrePropio: true },
    { id: "h2", padreId: "p1", moneda: "eur", saldoInicial: 10 },
    { id: "h1-archivada", padreId: "p1", nombre: "VIEJA", moneda: "usdt", saldoInicial: 0, estado: "archivada" },
    { id: "p2", nombre: "EFECTIVO", moneda: "pen", saldoInicial: 0, tipo: "efectivo", esAbstracta: true },
    { id: "h3", padreId: "p2", moneda: "pen", saldoInicial: 20 },
    { id: "p3", nombre: "LEMON", moneda: "pen", saldoInicial: 5, tipo: "debito" }
]

const ACTIVOS = [{ id: "a1", simbolo: "NFLX" }]

const dashboard = (orden, cardsVisibles = orden, dimensiones = {}) => ({ orden, cardsVisibles, dimensiones })

export default async function ejecutar(t = nuevoReporter("migraciones-preferencias")) {
    // ---------------------------------------------------------------------
    // Catálogo sincronizado con la app
    // ---------------------------------------------------------------------
    const fuente = leer("js/pages/dashboard.js")
    const bloque = fuente.match(/const DASHBOARD_CARDS = \[([\s\S]*?)\n\]/)?.[1] || ""
    const catalogoApp = [...bloque.matchAll(/\{ id: "([^"]+)"/g)]
        .map(coincidencia => coincidencia[1])
        .filter(id => id !== "patrimonio")
    t.check(
        "el catálogo de cards coincide con DASHBOARD_CARDS",
        JSON.stringify(catalogoApp) === JSON.stringify(CARDS_ESTANDAR),
        `app=${catalogoApp.length} migracion=${CARDS_ESTANDAR.length}`
    )

    // ---------------------------------------------------------------------
    // M6
    // ---------------------------------------------------------------------
    const base = dashboard(
        ["inversiones", "cuenta:p1", "metas", "cuenta:p2", "grafico"],
        ["cuenta:p1", "cuenta:p2", "grafico"],
        {
            "cuenta:p1": { columnas: 2, filas: 2 },
            "cuenta:p2": { columnas: 1, filas: 2 },
            grafico: { columnas: 2, filas: 2 }
        }
    )
    const m6 = migrarPreferenciasM6(base, CUENTAS)

    t.check(
        "M6 expande el padre con saldo propio en su posición",
        JSON.stringify(m6.dashboard.orden) === JSON.stringify([
            "inversiones", "cuenta:p1", "cuenta:h1", "cuenta:h2", "metas", "cuenta:h3", "grafico"
        ]),
        m6.dashboard.orden.join(",")
    )
    t.check(
        "M6 sustituye el padre abstracto por sus hijas",
        !m6.dashboard.cardsVisibles.includes("cuenta:p2") &&
        JSON.stringify(m6.dashboard.cardsVisibles) === JSON.stringify([
            "cuenta:p1", "cuenta:h1", "cuenta:h2", "cuenta:h3", "grafico"
        ]),
        m6.dashboard.cardsVisibles.join(",")
    )
    t.check(
        "M6 no incluye hijas archivadas",
        !m6.dashboard.orden.includes("cuenta:h1-archivada")
    )
    t.check(
        "M6 reporta las listas afectadas y no descarta en silencio",
        m6.cambios.filter(cambio => cambio.tipo === "familia_expandida").length === 2 &&
        m6.cambios.every(cambio => cambio.motivo)
    )
    t.check(
        "M6 deja las instancias en 1×1 y conserva las estándar",
        JSON.stringify(m6.dashboard.dimensiones["cuenta:p1"]) === JSON.stringify({ columnas: 1, filas: 1 }) &&
        !("cuenta:p2" in m6.dashboard.dimensiones) &&
        JSON.stringify(m6.dashboard.dimensiones.grafico) === JSON.stringify({ columnas: 2, filas: 2 })
    )

    const m6bis = migrarPreferenciasM6(m6.dashboard, CUENTAS)
    t.check(
        "M6 es idempotente",
        m6bis.cambios.length === 0 &&
        JSON.stringify(m6bis.dashboard) === JSON.stringify(m6.dashboard)
    )

    const simple = migrarPreferenciasM6(dashboard(["cuenta:p3", "grafico"]), CUENTAS)
    t.check(
        "M6 no toca una cuenta sin familia",
        simple.cambios.length === 0 && simple.dashboard.orden[0] === "cuenta:p3"
    )

    // ---------------------------------------------------------------------
    // M7
    // ---------------------------------------------------------------------
    const m7 = migrarPreferenciasM7(
        dashboard(
            ["cuentas", "cuenta:fantasma", "activo:nope", "cuenta:p1", "cuenta:p1", ""],
            ["cuenta:fantasma", "cuenta:p1", "activo:a1"],
            {
                "cuenta:fantasma": { columnas: 3, filas: 2 },
                "cuenta:p1": { columnas: 2, filas: 3 },
                grafico: { columnas: 2, filas: 2 }
            }
        ),
        CUENTAS,
        ACTIVOS
    )

    t.check(
        "M7 elimina y reporta las cards huérfanas",
        !m7.dashboard.orden.includes("cuenta:fantasma") &&
        !m7.dashboard.orden.includes("activo:nope") &&
        !("cuenta:fantasma" in m7.dashboard.dimensiones) &&
        m7.cambios.filter(cambio => cambio.tipo === "card_huerfana").length === 2
    )
    t.check(
        "M7 deduplica el orden y completa el catálogo",
        m7.dashboard.orden.filter(id => id === "cuenta:p1").length === 1 &&
        CARDS_ESTANDAR.every(id => m7.dashboard.orden.includes(id)) &&
        m7.cambios.some(cambio => cambio.tipo === "orden_duplicado") &&
        m7.cambios.some(cambio => cambio.tipo === "orden_invalido")
    )
    t.check(
        "M7 descarta y reporta una visible que no está en el orden",
        !m7.dashboard.cardsVisibles.includes("activo:a1") &&
        m7.cambios.some(cambio => cambio.tipo === "visible_sin_orden" && cambio.cardId === "activo:a1")
    )
    t.check(
        "M7 fuerza 1×1 en instancias y conserva las dimensiones estándar",
        JSON.stringify(m7.dashboard.dimensiones["cuenta:p1"]) === JSON.stringify({ columnas: 1, filas: 1 }) &&
        JSON.stringify(m7.dashboard.dimensiones.grafico) === JSON.stringify({ columnas: 2, filas: 2 })
    )
    t.check(
        "M7 mantiene las cards activo: que existen",
        migrarPreferenciasM7(dashboard(["cuentas", "activo:a1"]), CUENTAS, ACTIVOS)
            .dashboard.orden.includes("activo:a1")
    )

    const m7bis = migrarPreferenciasM7(m7.dashboard, CUENTAS, ACTIVOS)
    t.check(
        "M7 es idempotente",
        m7bis.cambios.length === 0 &&
        JSON.stringify(m7bis.dashboard) === JSON.stringify(m7.dashboard)
    )

    // ---------------------------------------------------------------------
    // M8
    // ---------------------------------------------------------------------
    const cuentasM8 = [
        { id: "padre", nombre: "INTERBANK", moneda: "pen" },
        { id: "auto", padreId: "padre", nombre: "INTERBANK DÓLARES", moneda: "usd", tieneNombrePropio: false },
        { id: "custom", padreId: "padre", nombre: "CUENTA DE VIAJES", moneda: "usd", tieneNombrePropio: true },
        { id: "limpia", padreId: "padre", moneda: "eur" },
        { id: "renombrado", padreId: "padre", nombre: "NOMBRE VIEJO DÓLARES", moneda: "usd", tieneNombrePropio: false }
    ]
    const m8 = migrarNombresM8(cuentasM8)

    t.check(
        "M8 propone borrar el nombre de las subcuentas automáticas",
        m8.cuentas_propuestas.length === 2 &&
        m8.cuentas_propuestas.find(c => c.id === "auto")?.eliminar[0] === "nombre" &&
        m8.cuentas_propuestas.find(c => c.id === "auto")?.nombre_derivado === "INTERBANK DÓLARES"
    )
    t.check(
        "M8 recalcula el nombre automático si el padre cambió",
        m8.cambios.find(c => c.cuentaId === "renombrado")?.nombreDerivado === "INTERBANK DÓLARES"
    )
    t.check(
        "M8 conserva los nombres personalizados",
        !m8.cuentas_propuestas.some(c => c.id === "custom") &&
        m8.conservados.some(c => c.cuentaId === "custom")
    )
    t.check(
        "M8 conserva un nombre con flag ausente",
        migrarNombresM8([
            { id: "p", nombre: "BANCO" },
            { id: "h", padreId: "p", nombre: "MI CUENTA", moneda: "usd" }
        ]).cuentas_propuestas.length === 0
    )
    t.check(
        "M8 no toca una subcuenta que ya es automática",
        !m8.cuentas_propuestas.some(c => c.id === "limpia") &&
        !m8.cambios.some(c => c.cuentaId === "limpia")
    )

    const yaLimpio = cuentasM8.map(cuenta =>
        m8.cuentas_propuestas.some(p => p.id === cuenta.id) ? { ...cuenta, nombre: undefined } : cuenta
    )
    t.check(
        "M8 es idempotente",
        migrarNombresM8(yaLimpio).cambios.length === 0
    )

    t.check(
        "M8 usa el formato por código cuando se pide",
        migrarNombresM8(
            [{ id: "p", nombre: "BANCO" }, { id: "h", padreId: "p", nombre: "X", moneda: "usd", tieneNombrePropio: false }],
            { formato: "codigo" }
        ).cuentas_propuestas[0].nombre_derivado === "BANCO USD"
    )
}
