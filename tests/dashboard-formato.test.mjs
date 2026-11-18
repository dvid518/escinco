// Pruebas unitarias del formateador numerico del dashboard (Fase A, Etapa 8).
//
// Valida formatearMontoDashboard(): separador de miles con espacio, coma decimal,
// respeto de simbolos y codigos de divisa de DivisaServicio.js.
import { nuevoReporter, leer, extraerFuncion } from "./helpers.mjs"
import vm from "node:vm"

const SRC = leer("js/pages/dashboard.js")
const DIVISA_SRC = leer("js/services/DivisaServicio.js")

// Contexto con dependencias minimas de DivisaServicio.
const ctx = {
    getDivisaPrincipal: () => "pen",
    getFormatoDivisa: () => "simbolo",
    DIVISAS_SYMBOLS: { pen: "S/", usd: "$", usdt: "₮", eur: "€" },
    DIVISAS_LABELS: { pen: "PEN", usd: "USD", usdt: "USDT", eur: "EUR" },
    console: { warn() {}, log() {}, error() {} }
}
vm.createContext(ctx)

// Extraer presentarDivisa real de DivisaServicio (usa DIVISAS_SYMBOLS/LABELS del contexto).
const presentarDivisaSrc = extraerFuncion(DIVISA_SRC, "presentarDivisa")
vm.runInContext(presentarDivisaSrc + ";", ctx)

// Extraer formatearMontoDashboard real del dashboard (usa presentarDivisa del contexto).
const formatoSrc = extraerFuncion(SRC, "formatearMontoDashboard")
vm.runInContext(formatoSrc + ";", ctx)

export default function ejecutar(t = nuevoReporter("dashboard-formato")) {
    // ---- Simbolo (formato por defecto) ----
    t.check(
        "PEN: 12500 con separador de miles y coma decimal",
        ctx.formatearMontoDashboard(12500, "pen") === "S/ 12 500,00",
        ctx.formatearMontoDashboard(12500, "pen")
    )
    t.check(
        "USD: 12500 con separador de miles y coma decimal",
        ctx.formatearMontoDashboard(12500, "usd") === "$ 12 500,00",
        ctx.formatearMontoDashboard(12500, "usd")
    )
    t.check(
        "EUR: 12500 con separador de miles y coma decimal",
        ctx.formatearMontoDashboard(12500, "eur") === "€ 12 500,00",
        ctx.formatearMontoDashboard(12500, "eur")
    )
    t.check(
        "USDT: 12500 con separador de miles y coma decimal",
        ctx.formatearMontoDashboard(12500, "usdt") === "₮ 12 500,00",
        ctx.formatearMontoDashboard(12500, "usdt")
    )
    t.check(
        "Valor negativo",
        ctx.formatearMontoDashboard(-500, "usd") === "$ -500,00",
        ctx.formatearMontoDashboard(-500, "usd")
    )
    t.check(
        "Valor cero",
        ctx.formatearMontoDashboard(0, "pen") === "S/ 0,00",
        ctx.formatearMontoDashboard(0, "pen")
    )
    t.check(
        "Valor decimal menor a 1",
        ctx.formatearMontoDashboard(0.5, "pen") === "S/ 0,50",
        ctx.formatearMontoDashboard(0.5, "pen")
    )
    t.check(
        "Gran valor con miles (1 234 567,89)",
        ctx.formatearMontoDashboard(1234567.89, "usd") === "$ 1 234 567,89",
        ctx.formatearMontoDashboard(1234567.89, "usd")
    )
    t.check(
        "Valor de un solo mil",
        ctx.formatearMontoDashboard(1000, "pen") === "S/ 1 000,00",
        ctx.formatearMontoDashboard(1000, "pen")
    )
    t.check(
        "Divisa por defecto cuando no se pasa divisa",
        ctx.formatearMontoDashboard(100) === "S/ 100,00",
        ctx.formatearMontoDashboard(100)
    )
    t.check(
        "Valor con decimales nulos (entero)",
        ctx.formatearMontoDashboard(97500, "pen") === "S/ 97 500,00",
        ctx.formatearMontoDashboard(97500, "pen")
    )

    // ---- Formato codigo ----
    ctx.getFormatoDivisa = () => "codigo"
    t.check(
        "Formato codigo: PEN",
        ctx.formatearMontoDashboard(12500, "pen") === "12 500,00 PEN",
        ctx.formatearMontoDashboard(12500, "pen")
    )
    t.check(
        "Formato codigo: USD",
        ctx.formatearMontoDashboard(12500, "usd") === "12 500,00 USD",
        ctx.formatearMontoDashboard(12500, "usd")
    )
    t.check(
        "Formato codigo: valor negativo",
        ctx.formatearMontoDashboard(-300, "eur") === "-300,00 EUR",
        ctx.formatearMontoDashboard(-300, "eur")
    )
    ctx.getFormatoDivisa = () => "simbolo"

    return t
}
