// ============================================
// TESTER · DEMO INTERACTIVA CON DATOS DE PRUEBA
// ============================================
// Sin Firebase ni sesión: los datos viven en localStorage
// (`escinco_tester_v1`) y cada edición se guarda ahí. Sirve para aprender
// la interfaz —dashboard, cuentas, movimientos e inversiones— sin cuenta.

const CLAVE = "escinco_tester_v1"
const TC = 3.75

const SIMBOLOS = { pen: "S/", usd: "$", eur: "€", usdt: "₮" }
const PALABRAS = { pen: "SOLES", usd: "DÓLARES", eur: "EUROS", usdt: "USDT" }

function semilla() {
    return {
        divisa: "pen",
        vista: "dashboard",
        cuentaVista: "c-efectivo",
        filtroMov: "todos",
        cuentas: [
            { id: "c-efectivo", nombre: "EFECTIVO SOLES", tipo: "efectivo", moneda: "pen", saldo: 1250.50, patrimonial: true },
            { id: "c-bbva", nombre: "BBVA DÓLARES", tipo: "banco", moneda: "usd", saldo: 820.00, patrimonial: true },
            { id: "c-bcp", nombre: "TARJETA BCP", tipo: "credito", moneda: "pen", limite: 5000, deuda: 1230.40, patrimonial: false },
            { id: "c-exchange", nombre: "EXCHANGE USDT", tipo: "exchange", moneda: "usdt", saldo: 300.00, patrimonial: true }
        ],
        movimientos: [
            { id: "m1", tipo: "ingreso", cuenta: "c-efectivo", concepto: "Sueldo", monto: 3000, divisa: "pen", fecha: "2026-10-01" },
            { id: "m2", tipo: "gasto", cuenta: "c-efectivo", concepto: "Mercado", monto: 320.50, divisa: "pen", fecha: "2026-10-03", etiquetas: ["esencial"] },
            { id: "m3", tipo: "gasto", cuenta: "c-bcp", concepto: "Restaurante", monto: 180.40, divisa: "pen", fecha: "2026-10-04", etiquetas: ["ocio"] },
            { id: "m4", tipo: "transferencia", origen: "c-efectivo", destino: "c-bbva", monto: 200, divisa: "pen", concepto: "Ahorro dólares", fecha: "2026-10-05" },
            { id: "m5", tipo: "cambioDivisa", origen: "c-bbva", destino: "c-efectivo", montoOrigen: 100, montoDestino: 375, concepto: "Cambio a soles", fecha: "2026-10-06" },
            { id: "m6", tipo: "pagoTarjeta", tarjeta: "c-bcp", cuenta: "c-efectivo", monto: 500, divisa: "pen", concepto: "Pago tarjeta", fecha: "2026-10-07" },
            { id: "m7", tipo: "compraActivo", cuenta: "c-bbva", activo: "BTC", cantidad: 0.002, precio: 60000, divisa: "usd", concepto: "Compra BTC", fecha: "2026-10-08", etiquetas: ["inversión"] },
            { id: "m8", tipo: "ingreso", cuenta: "c-exchange", concepto: "Venta P2P", monto: 150, divisa: "usdt", fecha: "2026-10-09", etiquetas: ["p2p"] }
        ],
        activos: [
            { simbolo: "BTC", nombre: "Bitcoin", tipo: "crypto", precio: 97500, cantidad: 0.002 },
            { simbolo: "VOO", nombre: "Vanguard S&P 500", tipo: "etf", precio: 512.30, cantidad: 2 }
        ],
        metas: [
            { nombre: "Viaje", objetivo: 5000, actual: 3200, divisa: "pen" },
            { nombre: "Fondo emergencia", objetivo: 10000, actual: 7800, divisa: "pen" }
        ],
        trades: [
            { id: "t1", activo: "BTC", tipo: "long", entrada: 96000, actual: 97500, lotaje: 0.002, estado: "abierto" },
            { id: "t2", activo: "VOO", tipo: "long", entrada: 500, actual: 512.30, lotaje: 2, estado: "abierto" },
            { id: "t3", activo: "ETH", tipo: "short", entrada: 3400, salida: 3350, actual: 3350, lotaje: 0.5, estado: "cerrado" }
        ],
        ordenes: [
            { id: "o1", activo: "BTC", tipoOrden: "limite", direccion: "long", precioDisparo: 90000, lotaje: 0.001, estado: "pendiente" },
            { id: "o2", activo: "ETH", tipoOrden: "stop", direccion: "long", precioDisparo: 3600, lotaje: 0.2, estado: "pendiente" }
        ]
    }
}

function cargar() {
    try {
        const crudo = localStorage.getItem(CLAVE)
        if (!crudo) {
            const datos = semilla()
            localStorage.setItem(CLAVE, JSON.stringify(datos))
            return datos
        }
        return { ...semilla(), ...JSON.parse(crudo) }
    } catch {
        return semilla()
    }
}

let estado = cargar()

function guardar() {
    try {
        localStorage.setItem(CLAVE, JSON.stringify(estado))
    } catch { /* almacenamiento lleno o bloqueado */ }
}

// ---------- formato ----------

function aPrincipal(monto, divisa) {
    const d = String(divisa || "pen").toLowerCase()
    const enUSD = d === "pen" ? monto / TC : monto
    return estado.divisa === "pen" ? enUSD * TC : enUSD
}

function fmt(monto, divisa) {
    const d = String(divisa || estado.divisa).toLowerCase()
    return `${SIMBOLOS[d] || "S/"} ${Number(monto || 0).toFixed(2)}`
}

// Los datos son de prueba y viven en localStorage, pero el texto que escribe el
// usuario (conceptos, activos) se interpola en HTML: se escapa para que no
// rompa el marcado de la demo.
function esc(txt) {
    return String(txt ?? "").replace(/[&<>"']/g, c => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ))
}

function nombreCuenta(id) {
    return esc(estado.cuentas.find(c => c.id === id)?.nombre || "Cuenta eliminada")
}

// ---------- patrimonio ----------

function patrimonio() {
    let total = 0
    const porDivisa = {}
    for (const c of estado.cuentas) {
        if (c.patrimonial === false) continue
        if (c.tipo === "credito") {
            total -= aPrincipal(c.deuda || 0, c.moneda)
            porDivisa[c.moneda] = (porDivisa[c.moneda] || 0) - (c.deuda || 0)
        } else {
            total += aPrincipal(c.saldo || 0, c.moneda)
            porDivisa[c.moneda] = (porDivisa[c.moneda] || 0) + (c.saldo || 0)
        }
    }
    for (const a of estado.activos) {
        const valor = (a.cantidad || 0) * (a.precio || 0)
        total += estado.divisa === "pen" ? valor * TC : valor
    }
    return { total, porDivisa }
}

// ---------- vistas ----------

const panel = () => document.getElementById("tester-panel")

function pintar() {
    document.querySelectorAll(".tester-nav button").forEach(b => {
        b.classList.toggle("act", b.dataset.vista === estado.vista)
    })
    document.querySelectorAll("#tester-divisa .toggle-option").forEach(o => {
        o.classList.toggle("active", o.dataset.divisa === estado.divisa)
    })
    panel().setAttribute("aria-busy", "true")
    const vistas = { dashboard: vistaDashboard, cuentas: vistaCuentas, movimientos: vistaMovimientos, inversiones: vistaInversiones, trading: vistaTrading, guia: vistaGuia }
    panel().innerHTML = (vistas[estado.vista] || vistaDashboard)()
    panel().removeAttribute("aria-busy")
    enlazar()
}

function vistaDashboard() {
    const { total, porDivisa } = patrimonio()
    const recientes = [...estado.movimientos].slice(-5).reverse()
    const claves = Object.keys(porDivisa).sort()
    const totalPEN = claves.reduce((s, k) => s + (k === "pen" ? porDivisa[k] : porDivisa[k] * TC), 0) || 1
    return `
        <h2 class="tester-h2">Patrimonio ${fmt(total, estado.divisa)}</h2>
        <p class="tester-hint">Suma de cuentas patrimoniales e inversiones, en tu divisa.</p>
        <div class="tester-grid">
            <div class="glass tester-card">
                <div class="tester-card-titulo">Cuentas</div>
                <div class="tester-card-valor">${estado.cuentas.length}</div>
                <div class="tester-card-detalle">Tarjetas: ${estado.cuentas.filter(c => c.tipo === "credito").length}</div>
            </div>
            <div class="glass tester-card">
                <div class="tester-card-titulo">Movimientos</div>
                <div class="tester-card-valor">${estado.movimientos.length}</div>
                <div class="tester-card-detalle">De prueba, editables</div>
            </div>
            <div class="glass tester-card">
                <div class="tester-card-titulo">Inversiones</div>
                <div class="tester-card-valor">${estado.activos.length} activos</div>
                <div class="tester-card-detalle">${fmt(estado.activos.reduce((s, a) => s + a.cantidad * a.precio, 0), "usd")}</div>
            </div>
        </div>
        <h2 class="tester-h2" style="margin-top:20px">Por divisa</h2>
        <div class="tester-lista">
            ${claves.map(k => {
                const eq = k === "pen" ? porDivisa[k] : porDivisa[k] * TC
                const pct = Math.max(0, Math.min(100, (eq / totalPEN) * 100))
                return `<div class="tester-item"><span><strong>${PALABRAS[k] || k.toUpperCase()}</strong><small>${pct.toFixed(0)}% del patrimonio</small></span><span class="tester-valor">${fmt(porDivisa[k], k)}</span></div>
                <div class="tester-barra"><span style="width:${pct}%"></span></div>`
            }).join("")}
        </div>
        <h2 class="tester-h2" style="margin-top:20px">Metas</h2>
        <div class="tester-lista">
            ${estado.metas.map(m => {
                const pct = Math.min(100, (m.actual / m.objetivo) * 100)
                return `<div class="tester-item"><span><strong>${esc(m.nombre)}</strong><small>${fmt(m.actual, m.divisa)} de ${fmt(m.objetivo, m.divisa)}</small></span><span class="tester-valor">${pct.toFixed(0)}%</span></div>
                <div class="tester-barra"><span style="width:${pct}%"></span></div>`
            }).join("")}
        </div>
        <h2 class="tester-h2" style="margin-top:20px">Últimos movimientos</h2>
        <div class="tester-lista">${recientes.map(filaMovimiento).join("")}</div>
    `
}

function vistaCuentas() {
    const cuenta = estado.cuentas.find(c => c.id === estado.cuentaVista) || estado.cuentas[0]
    estado.cuentaVista = cuenta?.id
    const movs = estado.movimientos.filter(m =>
        m.cuenta === cuenta.id || m.origen === cuenta.id || m.destino === cuenta.id || m.tarjeta === cuenta.id
    ).slice(-10).reverse()
    const esCredito = cuenta.tipo === "credito"
    return `
        <div class="tester-dos-columnas">
            <div class="tester-lista" style="margin-top:0">
                ${estado.cuentas.map(c => `
                    <button type="button" class="tester-item${c.id === cuenta.id ? " act" : ""}" data-cuenta="${c.id}">
                        <span><strong>${esc(c.nombre)}</strong><small>${PALABRAS[c.moneda] || c.moneda.toUpperCase()}${c.patrimonial === false ? " · no patrimonial" : ""}</small></span>
                    </button>`).join("")}
            </div>
            <div>
                <h2 class="tester-h2">${esc(cuenta.nombre)}</h2>
                <p class="tester-hint">${cuenta.tipo} · ${PALABRAS[cuenta.moneda] || cuenta.moneda.toUpperCase()} · Patrimonio: ${cuenta.patrimonial === false ? "No" : "Sí"}</p>
                <div class="tester-grid">
                    <div class="glass tester-card">
                        <div class="tester-card-titulo">${esCredito ? "Deuda" : "Saldo actual"}</div>
                        <div class="tester-card-valor ${esCredito ? "negative" : "positive"}">${fmt(esCredito ? cuenta.deuda : cuenta.saldo, cuenta.moneda)}</div>
                    </div>
                    ${esCredito ? `
                    <div class="glass tester-card">
                        <div class="tester-card-titulo">Línea de crédito</div>
                        <div class="tester-card-valor">${fmt(cuenta.limite, cuenta.moneda)}</div>
                    </div>` : `
                    <div class="glass tester-card">
                        <div class="tester-card-titulo">En ${estado.divisa.toUpperCase()}</div>
                        <div class="tester-card-valor">${fmt(aPrincipal(cuenta.saldo, cuenta.moneda), estado.divisa)}</div>
                    </div>`}
                </div>
                <h2 class="tester-h2" style="margin-top:16px">Movimientos</h2>
                <div class="tester-lista">${movs.length ? movs.map(filaMovimiento).join("") : `<p class="tester-hint">Sin movimientos.</p>`}</div>
            </div>
        </div>
    `
}

function filaMovimiento(m) {
    const esPositivo = ["ingreso"].includes(m.tipo)
    const monto = m.monto ?? m.montoOrigen ?? 0
    const cuenta = m.cuenta || m.origen || m.tarjeta || ""
    const etiquetas = (m.etiquetas || []).filter(Boolean)
    return `<div class="tester-item">
        <span><strong>${esc(m.concepto || m.activo || m.tipo)}${etiquetas.map(e => `<span class="tester-etiqueta">${esc(e)}</span>`).join("")}</strong><small>${m.fecha} · ${m.tipo} · ${nombreCuenta(cuenta)}</small></span>
        <span class="tester-valor ${esPositivo ? "positive" : "negative"}">${esPositivo ? "+" : "−"}${fmt(monto, m.divisa)}</span>
    </div>`
}

function vistaMovimientos() {
    const tipos = { todos: "Todos", ingreso: "Ingresos", gasto: "Gastos", transferencia: "Transferencias", cambioDivisa: "Cambios", compraActivo: "Compras", pagoTarjeta: "Pagos" }
    const lista = estado.movimientos.filter(m =>
        estado.filtroMov === "todos" || m.tipo === estado.filtroMov
    ).slice().reverse()
    const total = lista.reduce((s, m) => s + (["ingreso"].includes(m.tipo) ? (m.monto || 0) : -(m.monto || m.montoOrigen || 0)), 0)
    return `
        <h2 class="tester-h2">Movimientos</h2>
        <p class="tester-hint">Filtra y añade movimientos de prueba. Todo se guarda en tu navegador.</p>
        <div class="tester-form" role="group" aria-label="Filtro">
            ${Object.entries(tipos).map(([id, label]) => `
                <button type="button" class="glass-btn${estado.filtroMov === id ? " act" : ""}" data-filtro="${id}">${label}</button>`).join("")}
        </div>
        <form class="tester-form" id="tester-nuevo-mov">
            <select id="tm-tipo" aria-label="Tipo">
                <option value="ingreso">Ingreso</option>
                <option value="gasto">Gasto</option>
            </select>
            <select id="tm-cuenta" aria-label="Cuenta">
                ${estado.cuentas.filter(c => c.tipo !== "credito").map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join("")}
            </select>
            <input id="tm-concepto" placeholder="Concepto" maxlength="40" required>
            <input id="tm-monto" type="number" step="0.01" min="0.01" placeholder="0.00" required>
            <button type="submit" class="glass-btn">Añadir</button>
        </form>
        <p class="tester-hint">Balance del filtro: <strong class="${total >= 0 ? "positive" : "negative"}">${fmt(total, estado.divisa)}</strong> (en tu divisa, aproximado)</p>
        <div class="tester-lista">${lista.length ? lista.map(filaMovimiento).join("") : `<p class="tester-hint">Sin movimientos con ese filtro.</p>`}</div>
    `
}

function vistaInversiones() {
    return `
        <h2 class="tester-h2">Inversiones</h2>
        <p class="tester-hint">Actualiza un precio para ver cómo cambia el valor. Se guarda en tu navegador.</p>
        <div class="tester-lista">
            ${estado.activos.map(a => {
                const valor = a.cantidad * a.precio
                return `<div class="tester-item">
                    <span><strong>${esc(a.simbolo)}</strong><small>${esc(a.nombre)} · ${a.cantidad} × ${fmt(a.precio, "usd")}</small></span>
                    <span class="tester-valor">${fmt(valor, "usd")}</span>
                </div>
                <form class="tester-form" data-precio="${a.simbolo}">
                    <input type="number" step="0.01" min="0.01" value="${a.precio}" aria-label="Nuevo precio de ${a.simbolo}">
                    <button type="submit" class="glass-btn">Actualizar precio</button>
                </form>`
            }).join("")}
        </div>
    `
}

function vistaTrading() {
    const abiertos = estado.trades.filter(t => t.estado === "abierto")
    const cerrados = estado.trades.filter(t => t.estado === "cerrado")
    const pnlCerrado = cerrados.reduce((s, t) => {
        const dif = t.tipo === "long" ? (t.salida - t.entrada) : (t.entrada - t.salida)
        return s + (dif * t.lotaje)
    }, 0)
    return `
        <h2 class="tester-h2">Trading</h2>
        <p class="tester-hint">Añade un trade, ciérralo o ejecuta una orden. Todo se guarda en tu navegador.</p>
        <div class="tester-grid">
            <div class="glass tester-card">
                <div class="tester-card-titulo">Trades abiertos</div>
                <div class="tester-card-valor">${abiertos.length}</div>
            </div>
            <div class="glass tester-card">
                <div class="tester-card-titulo">Trades cerrados</div>
                <div class="tester-card-valor">${cerrados.length}</div>
            </div>
            <div class="glass tester-card">
                <div class="tester-card-titulo">P&L (cerrados)</div>
                <div class="tester-card-valor ${pnlCerrado >= 0 ? "positive" : "negative"}">${fmt(pnlCerrado, "usd")}</div>
            </div>
        </div>
        <form class="tester-form" id="tester-nuevo-trade">
            <input id="tt-activo" placeholder="Activo (BTC)" maxlength="12" required aria-label="Activo">
            <select id="tt-tipo" aria-label="Tipo">
                <option value="long">Long</option>
                <option value="short">Short</option>
            </select>
            <input id="tt-entrada" type="number" step="0.01" min="0.01" placeholder="Entrada" required aria-label="Entrada">
            <input id="tt-lotaje" type="number" step="0.0001" min="0.0001" placeholder="Lotaje" required aria-label="Lotaje">
            <button type="submit" class="glass-btn">Añadir trade</button>
        </form>
        <h2 class="tester-h2" style="margin-top:16px">Abiertos</h2>
        <div class="tester-lista">${abiertos.length ? abiertos.map(filaTrade).join("") : `<p class="tester-hint">Sin trades abiertos.</p>`}</div>
        <h2 class="tester-h2" style="margin-top:16px">Cerrados</h2>
        <div class="tester-lista">${cerrados.length ? cerrados.map(filaTrade).join("") : `<p class="tester-hint">Sin trades cerrados.</p>`}</div>
        <h2 class="tester-h2" style="margin-top:16px">Órdenes</h2>
        <div class="tester-lista" id="tester-ordenes">${estado.ordenes.length ? estado.ordenes.map(filaOrden).join("") : `<p class="tester-hint">Sin órdenes.</p>`}</div>
    `
}

function filaTrade(t) {
    const esAbierto = t.estado === "abierto"
    const cierre = esAbierto ? (t.actual ?? t.entrada) : t.salida
    const dif = t.tipo === "long" ? (cierre - t.entrada) : (t.entrada - cierre)
    const pnl = dif * t.lotaje
    return `<div class="tester-item">
        <span><strong>${esc(t.activo)}</strong><small>${t.tipo} · ${t.lotaje} lotes · ${fmt(t.entrada, "usd")} → ${fmt(cierre, "usd")}</small></span>
        <span class="tester-valor ${pnl >= 0 ? "positive" : "negative"}">${pnl >= 0 ? "+" : "−"}${fmt(Math.abs(pnl), "usd")}</span>
        <button type="button" class="glass-btn tester-accion" data-trade="${t.id}" data-acc="${esAbierto ? "cerrar" : "reabrir"}">${esAbierto ? "Cerrar" : "Reabrir"}</button>
    </div>`
}

function filaOrden(o) {
    const pendiente = o.estado === "pendiente"
    return `<div class="tester-item">
        <span><strong>${esc(o.activo)}</strong><small>${o.tipoOrden} · ${o.direccion} · disparo ${fmt(o.precioDisparo, "usd")} · ${o.lotaje} lotes</small></span>
        <span class="tester-valor">${o.estado}</span>
        ${pendiente ? `<button type="button" class="glass-btn tester-accion" data-orden="${o.id}">Ejecutar</button>` : ""}
    </div>`
}

function vistaGuia() {
    const pasos = [
        ["Dashboard", "Ves tu patrimonio total, su reparto por divisa, tus metas y tus últimos movimientos. Cambia arriba la divisa principal (PEN/USD) y todo se convierte al instante."],
        ["Cuentas", "Haz clic en cada cuenta para ver su saldo, la deuda (tarjetas) y sus movimientos. Las tarjetas solo registran gastos, pagos y compras."],
        ["Movimientos", "Filtra por tipo y añade un ingreso o un gasto: así registras operaciones como lo harás con tu cuenta real. Las etiquetas salen junto al nombre."],
        ["Inversiones", "Actualiza el precio de un activo y mira cómo cambia su valor. En la app real puedes comprar sin cuenta eligiendo “Sin cuenta (solo posición)”."],
        ["Trading", "Añade un trade, ciérralo y ejecuta una orden para entender long/short, SL y TP."],
        ["Tu app real", "Regístrate y verifica tu correo: escinco crea tu cuenta de efectivo inicial. El resto de la interfaz es igual a esta demo, con tus datos en Firestore."]
    ]
    return `
        <h2 class="tester-h2">Aprende a usar escinco</h2>
        <p class="tester-hint">Nada de lo que toques aquí se guarda en tu cuenta: solo vive en este navegador.</p>
        <div class="tester-guia">
            ${pasos.map(([t, d], i) => `
                <div class="tester-guia-paso">
                    <span class="tester-guia-num">${i + 1}</span>
                    <div><strong>${t}</strong><p>${d}</p></div>
                </div>`).join("")}
        </div>
    `
}

// ---------- eventos ----------

function enlazar() {
    document.querySelectorAll(".tester-nav button").forEach(b => {
        b.addEventListener("click", () => {
            estado.vista = b.dataset.vista
            guardar()
            pintar()
        })
    })
    document.querySelectorAll("[data-cuenta]").forEach(b => {
        b.addEventListener("click", () => {
            estado.cuentaVista = b.dataset.cuenta
            guardar()
            pintar()
        })
    })
    document.querySelectorAll("[data-filtro]").forEach(b => {
        b.addEventListener("click", () => {
            estado.filtroMov = b.dataset.filtro
            guardar()
            pintar()
        })
    })
    document.getElementById("tester-nuevo-mov")?.addEventListener("submit", (e) => {
        e.preventDefault()
        const tipo = document.getElementById("tm-tipo").value
        const cuenta = document.getElementById("tm-cuenta").value
        const concepto = document.getElementById("tm-concepto").value.trim()
        const monto = Number(document.getElementById("tm-monto").value) || 0
        if (!concepto || monto <= 0 || !cuenta) return
        const c = estado.cuentas.find(x => x.id === cuenta)
        estado.movimientos.push({
            id: `m-${Date.now()}`, tipo, cuenta, concepto, monto,
            divisa: c?.moneda || "pen", fecha: new Date().toISOString().slice(0, 10)
        })
        if (c && c.tipo !== "credito") c.saldo = Number((c.saldo + (tipo === "ingreso" ? monto : -monto)).toFixed(2))
        guardar()
        pintar()
    })
    document.querySelectorAll("[data-precio]").forEach(form => {
        form.addEventListener("submit", (e) => {
            e.preventDefault()
            const simbolo = form.dataset.precio
            const precio = Number(form.querySelector("input").value) || 0
            if (precio <= 0) return
            const activo = estado.activos.find(a => a.simbolo === simbolo)
            if (activo) activo.precio = precio
            guardar()
            pintar()
        })
    })
    document.getElementById("tester-nuevo-trade")?.addEventListener("submit", (e) => {
        e.preventDefault()
        const activo = document.getElementById("tt-activo").value.trim().toUpperCase()
        const tipo = document.getElementById("tt-tipo").value
        const entrada = Number(document.getElementById("tt-entrada").value) || 0
        const lotaje = Number(document.getElementById("tt-lotaje").value) || 0
        if (!activo || entrada <= 0 || lotaje <= 0) return
        estado.trades.push({
            id: `t-${Date.now()}`, activo, tipo, entrada,
            actual: entrada, lotaje, estado: "abierto"
        })
        guardar()
        pintar()
    })
    document.querySelectorAll("[data-trade]").forEach(b => {
        b.addEventListener("click", () => {
            const t = estado.trades.find(x => x.id === b.dataset.trade)
            if (!t) return
            if (b.dataset.acc === "cerrar") {
                t.estado = "cerrado"
                t.salida = t.actual ?? t.entrada
            } else {
                t.estado = "abierto"
                t.salida = null
            }
            guardar()
            pintar()
        })
    })
    document.querySelectorAll("[data-orden]").forEach(b => {
        b.addEventListener("click", () => {
            const o = estado.ordenes.find(x => x.id === b.dataset.orden)
            if (!o) return
            o.estado = "ejecutada"
            estado.trades.push({
                id: `t-${Date.now()}`,
                activo: o.activo,
                tipo: o.direccion,
                entrada: o.precioDisparo,
                actual: o.precioDisparo,
                lotaje: o.lotaje,
                estado: "abierto"
            })
            guardar()
            pintar()
        })
    })
}

document.querySelectorAll("#tester-divisa .toggle-option").forEach(o => {
    o.addEventListener("click", () => {
        estado.divisa = o.dataset.divisa
        guardar()
        pintar()
    })
})

document.getElementById("tester-tema")?.addEventListener("click", () => {
    const html = document.documentElement
    html.dataset.theme = html.dataset.theme === "dark" ? "light" : "dark"
})

document.getElementById("tester-reset")?.addEventListener("click", () => {
    estado = semilla()
    guardar()
    pintar()
})

pintar()
