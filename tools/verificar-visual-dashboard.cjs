// Script temporal de verificación visual del dashboard (Etapa 8 / Subfase 2).
// No forma parte del proyecto: se usa desde fuera del repo con Playwright global.
// Genera capturas y detecta desbordamientos, recortes y solapamientos.
const { chromium } = require("C:/Users/david/node_modules/playwright")
const fs = require("node:fs")
const path = require("node:path")

const SALIDA = process.env.SALIDA || path.join(process.env.TEMP || ".", "verif-dashboard")
const URL_BASE = process.env.URL_BASE || "http://localhost:5080/demo/dashboard"
const ANCHO = Number(process.env.ANCHO || 1400)
const ALTO = Number(process.env.ALTO || 1000)
const TEMA = process.env.TEMA || "oscuro"
const NOMBRE = process.env.NOMBRE || "captura"
const CONFIG_DIM = process.env.CONFIG_DIM || "" // JSON: { "movimientos": {columnas:1,filas:1} , ... }

fs.mkdirSync(SALIDA, { recursive: true })

// Métrica de desbordamiento: compara scrollHeight/scrollWidth con clientHeight/Width
// de cada tarjeta y de sus contenedores de lista.
const MEDIR = () => {
    const filas = []
    const tarjetas = document.querySelectorAll(".dashboard [data-dashboard-card]")
    tarjetas.forEach(card => {
        const id = card.dataset.dashboardCard
        const r = card.getBoundingClientRect()
        const desbordaY = card.scrollHeight - card.clientHeight
        const desbordaX = card.scrollWidth - card.clientWidth
        // Elementos con overflow visibles que se salgan de la tarjeta
        const fuera = []
        card.querySelectorAll("*").forEach(el => {
            const er = el.getBoundingClientRect()
            if (er.width === 0 || er.height === 0) return
            if (er.bottom > r.bottom + 1 || er.right > r.right + 1 || er.top < r.top - 1) {
                fuera.push({
                    tag: el.tagName.toLowerCase(),
                    cls: (el.className || "").toString().slice(0, 40),
                    id: el.id || ""
                })
            }
        })
        filas.push({
            id,
            altoPx: Math.round(r.height),
            anchoPx: Math.round(r.width),
            desbordaY,
            desbordaX,
            elementosFuera: fuera.slice(0, 4),
            texto: (card.innerText || "").replace(/\s+/g, " ").trim().slice(0, 140)
        })
    })
    return filas
}

;(async () => {
    const navegador = await chromium.launch()
    const contexto = await navegador.newContext({ viewport: { width: ANCHO, height: ALTO } })
    const pagina = await contexto.newPage()
    const errores = []
    pagina.on("console", m => { if (m.type() === "error") errores.push(m.text().slice(0, 200)) })
    pagina.on("pageerror", e => errores.push("PAGEERROR: " + e.message.slice(0, 200)))

    await pagina.goto(URL_BASE, { waitUntil: "networkidle", timeout: 45000 })
    // Espera a que desaparezcan los esqueletos del dashboard
    await pagina.waitForTimeout(2500)

    if (TEMA === "claro") {
        await pagina.evaluate(() => {
            document.documentElement.setAttribute("data-tema", "claro")
            if (document.body) document.body.classList.add("tema-claro")
        })
        await pagina.waitForTimeout(600)
    }

    // Aplica dimensiones concretas vía preferencias en localStorage, si procede.
    if (CONFIG_DIM) {
        await pagina.evaluate(cfg => {
            const clave = Object.keys(localStorage).find(k => /prefer/i.test(k))
            if (!clave) return false
            const datos = JSON.parse(localStorage.getItem(clave))
            const dash = datos?.dashboard || datos?.preferencias?.dashboard
            if (dash) dash.dimensiones = Object.assign({}, dash.dimensiones, cfg)
            localStorage.setItem(clave, JSON.stringify(datos))
            return true
        }, JSON.parse(CONFIG_DIM))
        await pagina.reload({ waitUntil: "networkidle" })
        await pagina.waitForTimeout(2500)
    }

    const medidas = await pagina.evaluate(MEDIR)
    const archivo = path.join(SALIDA, NOMBRE + ".png")
    await pagina.screenshot({ path: archivo, fullPage: true })

    const informe = { url: URL_BASE, ancho: ANCHO, alto: ALTO, tema: TEMA, errores, medidas }
    fs.writeFileSync(path.join(SALIDA, NOMBRE + ".json"), JSON.stringify(informe, null, 2), "utf8")

    console.log(JSON.stringify({ captura: archivo, errores: errores.slice(0, 5), tarjetas: medidas.length }, null, 2))
    for (const m of medidas) {
        const problemas = []
        if (m.desbordaY > 1) problemas.push(`desbordaY=${m.desbordaY}`)
        if (m.desbordaX > 1) problemas.push(`desbordaX=${m.desbordaX}`)
        if (m.elementosFuera.length) problemas.push("fuera=" + m.elementosFuera.map(f => f.id || f.cls || f.tag).join(","))
        console.log(`${m.id.padEnd(22)} ${String(m.anchoPx).padStart(4)}x${String(m.altoPx).padStart(4)} ${problemas.length ? "!! " + problemas.join(" ") : "ok"}`)
    }

    await navegador.close()
})().catch(e => { console.error("FALLO:", e.message); process.exit(1) })
