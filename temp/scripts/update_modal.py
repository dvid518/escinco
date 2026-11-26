import re

with open('js/pages/dashboard.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Buscar la función actual
pattern = r'(function abrirModalDistribucionPatrimonial\(\) \{[\s\S]*?^\})'
match = re.search(pattern, content, re.MULTILINE)

if match:
    old_func = match.group(1)
    print(f"Encontrada función de {len(old_func)} chars")
    
    new_func = '''function abrirModalDistribucionPatrimonial() {
    if (modoEdicionDashboard) return
    if (!analiticaData) return

    const wrapper = contenidoDesdeTemplate("tpl-distribucion-patrimonial")

    // --- Datos para la dona (categorías) ---
    const itemsDona = [
        { etiqueta: "Liquidez", valor: analiticaData.liquidez, clase: "liquidez" },
        { etiqueta: "Inversiones", valor: analiticaData.inversiones, clase: "inversiones" },
        { etiqueta: "Inmovilizado", valor: analiticaData.inmovil, clase: "inmovil" },
        { etiqueta: "Deudas", valor: analiticaData.deudas, clase: "deudas" }
    ].filter(item => Math.abs(Number(item.valor) || 0) > 0)

    const totalDona = itemsDona.reduce((sum, item) => sum + item.valor, 0)
    const itemsDonaConPct = itemsDona.map(item => ({
        ...item,
        porcentaje: totalDona > 0 ? (item.valor / totalDona) * 100 : 0
    })

    // --- Categorías (lista) ---
    const categorias = itemsDonaConPct
        .map(item => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: item.etiqueta,
                valor: formatearMontoDashboard(item.valor, divisaActual)
            }
        }))

    // --- Por tipo de activo ---
    const porTipo = new Map()
    for (const posicion of posicionesData || []) {
        const activo = posicion.activo || {}
        const tipo = String(activo.tipo || "accion").toLowerCase()
        const cantidad = Number(posicion.cantidad) || 0
        const ultimoPrecio = Number(activo.ultimoPrecio) || 0
        if (cantidad <= 0 || ultimoPrecio <= 0) continue
        const valor = convertirMonto(cantidad * ultimoPrecio, posicion.divisa || "usd", divisaActual)
        porTipo.set(tipo, (porTipo.get(tipo) || 0) + valor)
    }
    const tiposActivo = [...porTipo.entries()]
        .filter(([, valor]) => valor > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([tipo, valor]) => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: ETIQUETAS_TIPO_ACTIVO[tipo] || "Otros",
                valor: formatearMontoDashboard(valor, divisaActual)
            }
        }))

    // --- Por divisa ---
    const desgloseDivisa = patrimonioStats?.porDivisa || {}
    const divisas = Object.keys(desgloseDivisa)
        .filter(clave => Math.abs(Number(desgloseDivisa[clave]) || 0) > 0)
        .sort((a, b) => {
            const ia = ORDEN_DIVISAS_PATRIMONIO.indexOf(a)
            const ib = ORDEN_DIVISAS_PATRIMONIO.indexOf(b)
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (a < b ? -1 : 1)
        })
        .map(clave => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: etiquetaDivisa(clave),
                valor: formatearMontoDashboard(desgloseDivisa[clave], clave)
            }
        }))

    // --- Cuentas involucradas ---
    const cuentasInvolucradas = (cuentas || [])
        .filter(cuenta => {
            if (cuenta.estado === "archivada") return false
            if (cuenta.esPatrimonio === false) return false
            if (esHija(cuenta)) return false
            if (cuenta.tipo === "credito") return Number(cuenta.deuda) > 0
            if (esAbstracta(cuenta)) return true
            if (esSaldoInmovil(cuenta, cuentas)) return Number(cuenta.saldoInicial) !== 0
            return Number(cuenta.saldoInicial) !== 0
        })
        .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")))
        .map(cuenta => {
            const esCredito = cuenta.tipo === "credito"
            const moneda = String(cuenta.moneda || cuenta.divisa || "pen").toLowerCase()
            const monto = esCredito ? Math.max(0, Number(cuenta.deuda) || 0) : Number(cuenta.saldoInicial) || 0
            const etiqueta = esCredito ? "Deuda" : (esSaldoInmovil(cuenta, cuentas) ? "Inmovilizado" : "Liquidez")
            return contenidoDesdeTemplate("tpl-distribucion-modal-item", {
                valores: {
                    etiqueta: `${cuenta.nombre} · ${etiqueta}`,
                    valor: esCredito
                        ? formatearMontoDashboard(convertirMonto(monto, moneda, divisaActual), divisaActual)
                        : formatearMontoDashboard(convertirMonto(monto, moneda, divisaActual), divisaActual),
                    detalle: etiquetaDivisa(moneda)
                }
            })
        })
    })

    const contenedorCategorias = wrapper.querySelector('[data-tpl="categorias"]')
    const contenedorTipos = wrapper.querySelector('[data-tpl="tipos-activo"]')
    const contenedorDivisas = wrapper.querySelector('[data-tpl="divisas"]')
    const contenedorCuentas = wrapper.querySelector('[data-tpl="cuentas"]')

    if (contenedorCategorias) contenedorCategorias.replaceChildren(...categorias)
    if (contenedorTipos) contenedorTipos.replaceChildren(...tiposActivo)
    if (contenedorDivisas) contenedorDivisas.replaceChildren(...divisas)
    if (contenedorCuentas) contenedorCuentas.replaceChildren(...cuentasInvolucradas)

    // Abrir modal y luego dibujar dona
    abrirModal({
        titulo: "Distribución patrimonial",
        contenido: wrapper,
        variante: "wide",
        confirmText: "Cerrar",
        onConfirm: () => true,
        onOpen: () => {
            // Dibujar dona en el modal
            const canvas = wrapper.querySelector("#distribucion-modal-dona")
            const totalEl = wrapper.querySelector("#distribucion-modal-dona-total")
            if (canvas && itemsDonaConPct.length > 0) {
                // Total en el centro
                if (totalEl) {
                    totalEl.innerHTML = `
                        <span class="distribucion-modal-dona-total-label">Total</span>
                        <span class="distribucion-modal-dona-total-valor">${formatearMontoDashboard(totalDona, divisaActual)}</span>
                    `
                }
                // Dibujar dona
                import("../ui/graficos.js").then(({ crearGraficoDistribucion }) => {
                    crearGraficoDistribucion("distribucion-modal-dona", {
                        labels: itemsDonaConPct.map(item => item.etiqueta),
                        data: itemsDonaConPct.map(item => item.valor),
                        colores: itemsDonaConPct.map(item => COLORES_DISTRIBUCION[item.clase])
                    }, {
                        chartKey: "distribucion-modal",
                        formatear: monto => formatearMontoDashboard(monto, divisaActual)
                    })
                })
            }
        }
    })
}'''

with open('js/pages/dashboard.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Buscar la función usando regex
pattern = r'function abrirModalDistribucionPatrimonial\(\) \{[\s\S]*?^\}'
match = re.search(r'function abrirModalDistribucionPatrimonial\(\) \{[\s\S]*?^\}', content, re.MULTILINE)

if match:
    old_func = match.group(0)
    print(f"Encontrada función de {len(old_func)} chars")
    
    new_func = '''function abrirModalDistribucionPatrimonial() {
    if (modoEdicionDashboard) return
    if (!analiticaData) return

    const wrapper = contenidoDesdeTemplate("tpl-distribucion-patrimonial")

    // --- Datos para la dona (categorías) ---
    const itemsDona = [
        { etiqueta: "Liquidez", valor: analiticaData.liquidez, clase: "liquidez" },
        { etiqueta: "Inversiones", valor: analiticaData.inversiones, clase: "inversiones" },
        { etiqueta: "Inmovilizado", valor: analiticaData.inmovil, clase: "inmovil" },
        { etiqueta: "Deudas", valor: analiticaData.deudas, clase: "deudas" }
    ].filter(item => Math.abs(Number(item.valor) || 0) > 0)

    const totalDona = itemsDona.reduce((sum, item) => sum + item.valor, 0)
    const itemsDonaConPct = itemsDona.map(item => ({
        ...item,
        porcentaje: totalDona > 0 ? (item.valor / totalDona) * 100 : 0
    })

    // --- Categorías (lista) ---
    const categorias = itemsDonaConPct
        .map(item => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: item.etiqueta,
                valor: formatearMontoDashboard(item.valor, divisaActual)
            }
        }))

    // --- Por tipo de activo ---
    const porTipo = new Map()
    for (const posicion of posicionesData || []) {
        const activo = posicion.activo || {}
        const tipo = String(activo.tipo || "accion").toLowerCase()
        const cantidad = Number(posicion.cantidad) || 0
        const ultimoPrecio = Number(activo.ultimoPrecio) || 0
        if (cantidad <= 0 || ultimoPrecio <= 0) continue
        const valor = convertirMonto(cantidad * ultimoPrecio, posicion.divisa || "usd", divisaActual)
        porTipo.set(tipo, (porTipo.get(tipo) || 0) + valor)
    }
    const tiposActivo = [...porTipo.entries()]
        .filter(([, valor]) => valor > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([tipo, valor]) => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: ETIQUETAS_TIPO_ACTIVO[tipo] || "Otros",
                valor: formatearMontoDashboard(valor, divisaActual)
            }
        }))

    // --- Por divisa ---
    const desgloseDivisa = patrimonioStats?.porDivisa || {}
    const divisas = Object.keys(desgloseDivisa)
        .filter(clave => Math.abs(Number(desgloseDivisa[clave]) || 0) > 0)
        .sort((a, b) => {
            const ia = ORDEN_DIVISAS_PATRIMONIO.indexOf(a)
            const ib = ORDEN_DIVISAS_PATRIMONIO.indexOf(b)
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (a < b ? -1 : 1)
        })
        .map(clave => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: etiquetaDivisa(clave),
                valor: formatearMontoDashboard(desgloseDivisa[clave], clave)
            }
        }))

    // --- Cuentas involucradas ---
    const cuentasInvolucradas = (cuentas || [])
        .filter(cuenta => {
            if (cuenta.estado === "archivada") return false
            if (cuenta.esPatrimonio === false) return false
            if (esHija(cuenta)) return false
            if (cuenta.tipo === "credito") return Number(cuenta.deuda) > 0
            if (esAbstracta(cuenta)) return true
            if (esSaldoInmovil(cuenta, cuentas)) return Number(cuenta.saldoInicial) !== 0
            return Number(cuenta.saldoInicial) !== 0
        })
        .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")))
        .map(cuenta => {
            const esCredito = cuenta.tipo === "credito"
            const moneda = String(cuenta.moneda || cuenta.divisa || "pen").toLowerCase()
            const monto = esCredito ? Math.max(0, Number(cuenta.deuda) || 0) : Number(cuenta.saldoInicial) || 0
            const etiqueta = esCredito ? "Deuda" : (esSaldoInmovil(cuenta, cuentas) ? "Inmovilizado" : "Liquidez")
            return contenidoDesdeTemplate("tpl-distribucion-modal-item", {
                valores: {
                    etiqueta: `${cuenta.nombre} · ${etiqueta}`,
                    valor: esCredito
                        ? formatearMontoDashboard(convertirMonto(monto, moneda, divisaActual), divisaActual)
                        : formatearMontoDashboard(convertirMonto(monto, moneda, divisaActual), divisaActual),
                    detalle: etiquetaDivisa(moneda)
                }
            })
        })
    })

    const contenedorCategorias = wrapper.querySelector('[data-tpl="categorias"]')
    const contenedorTipos = wrapper.querySelector('[data-tpl="tipos-activo"]')
    const contenedorDivisas = wrapper.querySelector('[data-tpl="divisas"]')
    const contenedorCuentas = wrapper.querySelector('[data-tpl="cuentas"]')

    if (contenedorCategorias) contenedorCategorias.replaceChildren(...categorias)
    if (contenedorTipos) contenedorTipos.replaceChildren(...tiposActivo)
    if (contenedorDivisas) contenedorDivisas.replaceChildren(...divisas)
    if (contenedorCuentas) contenedorCuentas.replaceChildren(...cuentasInvolucradas)

    // Abrir modal y luego dibujar dona
    abrirModal({
        titulo: "Distribución patrimonial",
        contenido: wrapper,
        variante: "wide",
        confirmText: "Cerrar",
        onConfirm: () => true,
        onOpen: () => {
            // Dibujar dona en el modal
            const canvas = wrapper.querySelector("#distribucion-modal-dona")
            const totalEl = wrapper.querySelector("#distribucion-modal-dona-total")
            if (canvas && itemsDonaConPct.length > 0) {
                // Total en el centro
                if (totalEl) {
                    totalEl.innerHTML = `
                        <span class="distribucion-modal-dona-total-label">Total</span>
                        <span class="distribucion-modal-dona-total-valor">${formatearMontoDashboard(totalDona, divisaActual)}</span>
                    `
                }
                // Dibujar dona
                import("../ui/graficos.js").then(({ crearGraficoDistribucion }) => {
                    crearGraficoDistribucion("distribucion-modal-dona", {
                        labels: itemsDonaConPct.map(item => item.etiqueta),
                        data: itemsDonaConPct.map(item => item.valor),
                        colores: itemsDonaConPct.map(item => COLORES_DISTRIBUCION[item.clase])
                    }, {
                        chartKey: "distribucion-modal",
                        formatear: monto => formatearMontoDashboard(monto, divisaActual)
                    })
                })
            }
        }
    })
}'''

with open('js/pages/dashboard.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Buscar la función usando regex con patrones más flexibles
pattern = r'function abrirModalDistribucionPatrimonial\(\) \{[\s\S]*?^\}'
match = re.search(pattern, content, re.MULTILINE)

if match:
    old_func = match.group(0)
    print(f"Encontrada función de {len(old_func)} chars")
    
    new_func = '''function abrirModalDistribucionPatrimonial() {
    if (modoEdicionDashboard) return
    if (!analiticaData) return

    const wrapper = contenidoDesdeTemplate("tpl-distribucion-patrimonial")

    // --- Datos para la dona (categorías) ---
    const itemsDona = [
        { etiqueta: "Liquidez", valor: analiticaData.liquidez, clase: "liquidez" },
        { etiqueta: "Inversiones", valor: analiticaData.inversiones, clase: "inversiones" },
        { etiqueta: "Inmovilizado", valor: analiticaData.inmovil, clase: "inmovil" },
        { etiqueta: "Deudas", valor: analiticaData.deudas, clase: "deudas" }
    ].filter(item => Math.abs(Number(item.valor) || 0) > 0)

    const totalDona = itemsDona.reduce((sum, item) => sum + item.valor, 0)
    const itemsDonaConPct = itemsDona.map(item => ({
        ...item,
        porcentaje: totalDona > 0 ? (item.valor / totalDona) * 100 : 0
    })

    // --- Categorías (lista) ---
    const categorias = itemsDonaConPct
        .map(item => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: item.etiqueta,
                valor: formatearMontoDashboard(item.valor, divisaActual)
            }
        }))

    // --- Por tipo de activo ---
    const porTipo = new Map()
    for (const posicion of posicionesData || []) {
        const activo = posicion.activo || {}
        const tipo = String(activo.tipo || "accion").toLowerCase()
        const cantidad = Number(posicion.cantidad) || 0
        const ultimoPrecio = Number(activo.ultimoPrecio) || 0
        if (cantidad <= 0 || ultimoPrecio <= 0) continue
        const valor = convertirMonto(cantidad * ultimoPrecio, posicion.divisa || "usd", divisaActual)
        porTipo.set(tipo, (porTipo.get(tipo) || 0) + valor)
    }
    const tiposActivo = [...porTipo.entries()]
        .filter(([, valor]) => valor > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([tipo, valor]) => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: ETIQUETAS_TIPO_ACTIVO[tipo] || "Otros",
                valor: formatearMontoDashboard(valor, divisaActual)
            }
        }))

    // --- Por divisa ---
    const desgloseDivisa = patrimonioStats?.porDivisa || {}
    const divisas = Object.keys(desgloseDivisa)
        .filter(clave => Math.abs(Number(desgloseDivisa[clave]) || 0) > 0)
        .sort((a, b) => {
            const ia = ORDEN_DIVISAS_PATRIMONIO.indexOf(a)
            const ib = ORDEN_DIVISAS_PATRIMONIO.indexOf(b)
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (a < b ? -1 : 1)
        })
        .map(clave => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: etiquetaDivisa(clave),
                valor: formatearMontoDashboard(desgloseDivisa[clave], clave)
            }
        }))

    // --- Cuentas involucradas ---
    const cuentasInvolucradas = (cuentas || [])
        .filter(cuenta => {
            if (cuenta.estado === "archivada") return false
            if (cuenta.esPatrimonio === false) return false
            if (esHija(cuenta)) return false
            if (cuenta.tipo === "credito") return Number(cuenta.deuda) > 0
            if (esAbstracta(cuenta)) return true
            if (esSaldoInmovil(cuenta, cuentas)) return Number(cuenta.saldoInicial) !== 0
            return Number(cuenta.saldoInicial) !== 0
        })
        .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")))
        .map(cuenta => {
            const esCredito = cuenta.tipo === "credito"
            const moneda = String(cuenta.moneda || cuenta.divisa || "pen").toLowerCase()
            const monto = esCredito ? Math.max(0, Number(cuenta.deuda) || 0) : Number(cuenta.saldoInicial) || 0
            const etiqueta = esCredito ? "Deuda" : (esSaldoInmovil(cuenta, cuentas) ? "Inmovilizado" : "Liquidez")
            return contenidoDesdeTemplate("tpl-distribucion-modal-item", {
                valores: {
                    etiqueta: `${cuenta.nombre} · ${etiqueta}`,
                    valor: esCredito
                        ? formatearMontoDashboard(convertirMonto(monto, moneda, divisaActual), divisaActual)
                        : formatearMontoDashboard(convertirMonto(monto, moneda, divisaActual), divisaActual),
                    detalle: etiquetaDivisa(moneda)
                }
            })
        })
    })

    const contenedorCategorias = wrapper.querySelector('[data-tpl="categorias"]')
    const contenedorTipos = wrapper.querySelector('[data-tpl="tipos-activo"]')
    const contenedorDivisas = wrapper.querySelector('[data-tpl="divisas"]')
    const contenedorCuentas = wrapper.querySelector('[data-tpl="cuentas"]')

    if (contenedorCategorias) contenedorCategorias.replaceChildren(...categorias)
    if (contenedorTipos) contenedorTipos.replaceChildren(...tiposActivo)
    if (contenedorDivisas) contenedorDivisas.replaceChildren(...divisas)
    if (contenedorCuentas) contenedorCuentas.replaceChildren(...cuentasInvolucradas)

    // Abrir modal y luego dibujar dona
    abrirModal({
        titulo: "Distribución patrimonial",
        contenido: wrapper,
        variante: "wide",
        confirmText: "Cerrar",
        onConfirm: () => true,
        onOpen: () => {
            // Dibujar dona en el modal
            const canvas = wrapper.querySelector("#distribucion-modal-dona")
            const totalEl = wrapper.querySelector("#distribucion-modal-dona-total")
            if (canvas && itemsDonaConPct.length > 0) {
                // Total en el centro
                if (totalEl) {
                    totalEl.innerHTML = `
                        <span class="distribucion-modal-dona-total-label">Total</span>
                        <span class="distribucion-modal-dona-total-valor">${formatearMontoDashboard(totalDona, divisaActual)}</span>
                    `
                }
                // Dibujar dona
                import("../ui/graficos.js").then(({ crearGraficoDistribucion }) => {
                    crearGraficoDistribucion("distribucion-modal-dona", {
                        labels: itemsDonaConPct.map(item => item.etiqueta),
                        data: itemsDonaConPct.map(item => item.valor),
                        colores: itemsDonaConPct.map(item => COLORES_DISTRIBUCION[item.clase])
                    }, {
                        chartKey: "distribucion-modal",
                        formatear: monto => formatearMontoDashboard(monto, divisaActual)
                    })
                })
            }
        }
    })
}'''

with open('js/pages/dashboard.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Buscar la función usando regex
pattern = r'function abrirModalDistribucionPatrimonial\(\) \{[\s\S]*?^\}'
match = re.search(pattern, content, re.MULTILINE)

if match:
    old_func = match.group(0)
    print(f"Encontrada función de {len(old_func)} chars")
    
    new_func = '''function abrirModalDistribucionPatrimonial() {
    if (modoEdicionDashboard) return
    if (!analiticaData) return

    const wrapper = contenidoDesdeTemplate("tpl-distribucion-patrimonial")

    // --- Datos para la dona (categorías) ---
    const itemsDona = [
        { etiqueta: "Liquidez", valor: analiticaData.liquidez, clase: "liquidez" },
        { etiqueta: "Inversiones", valor: analiticaData.inversiones, clase: "inversiones" },
        { etiqueta: "Inmovilizado", valor: analiticaData.inmovil, clase: "inmovil" },
        { etiqueta: "Deudas", valor: analiticaData.deudas, clase: "deudas" }
    ].filter(item => Math.abs(Number(item.valor) || 0) > 0)

    const totalDona = itemsDona.reduce((sum, item) => sum + item.valor, 0)
    const itemsDonaConPct = itemsDona.map(item => ({
        ...item,
        porcentaje: totalDona > 0 ? (item.valor / totalDona) * 100 : 0
    })

    // --- Categorías (lista) ---
    const categorias = itemsDonaConPct
        .map(item => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: item.etiqueta,
                valor: formatearMontoDashboard(item.valor, divisaActual)
            }
        }))

    // --- Por tipo de activo ---
    const porTipo = new Map()
    for (const posicion of posicionesData || []) {
        const activo = posicion.activo || {}
        const tipo = String(activo.tipo || "accion").toLowerCase()
        const cantidad = Number(posicion.cantidad) || 0
        const ultimoPrecio = Number(activo.ultimoPrecio) || 0
        if (cantidad <= 0 || ultimoPrecio <= 0) continue
        const valor = convertirMonto(cantidad * ultimoPrecio, posicion.divisa || "usd", divisaActual)
        porTipo.set(tipo, (porTipo.get(tipo) || 0) + valor)
    }
    const tiposActivo = [...porTipo.entries()]
        .filter(([, valor]) => valor > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([tipo, valor]) => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: ETIQUETAS_TIPO_ACTIVO[tipo] || "Otros",
                valor: formatearMontoDashboard(valor, divisaActual)
            }
        }))

    // --- Por divisa ---
    const desgloseDivisa = patrimonioStats?.porDivisa || {}
    const divisas = Object.keys(desgloseDivisa)
        .filter(clave => Math.abs(Number(desgloseDivisa[clave]) || 0) > 0)
        .sort((a, b) => {
            const ia = ORDEN_DIVISAS_PATRIMONIO.indexOf(a)
            const ib = ORDEN_DIVISAS_PATRIMONIO.indexOf(b)
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (a < b ? -1 : 1)
        })
        .map(clave => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: etiquetaDivisa(clave),
                valor: formatearMontoDashboard(desgloseDivisa[clave], clave)
            }
        }))

    // --- Cuentas involucradas ---
    const cuentasInvolucradas = (cuentas || [])
        .filter(cuenta => {
            if (cuenta.estado === "archivada") return false
            if (cuenta.esPatrimonio === false) return false
            if (esHija(cuenta)) return false
            if (cuenta.tipo === "credito") return Number(cuenta.deuda) > 0
            if (esAbstracta(cuenta)) return true
            if (esSaldoInmovil(cuenta, cuentas)) return Number(cuenta.saldoInicial) !== 0
            return Number(cuenta.saldoInicial) !== 0
        })
        .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")))
        .map(cuenta => {
            const esCredito = cuenta.tipo === "credito"
            const moneda = String(cuenta.moneda || cuenta.divisa || "pen").toLowerCase()
            const monto = esCredito ? Math.max(0, Number(cuenta.deuda) || 0) : Number(cuenta.saldoInicial) || 0
            const etiqueta = esCredito ? "Deuda" : (esSaldoInmovil(cuenta, cuentas) ? "Inmovilizado" : "Liquidez")
            return contenidoDesdeTemplate("tpl-distribucion-modal-item", {
                valores: {
                    etiqueta: `${cuenta.nombre} · ${etiqueta}`,
                    valor: esCredito
                        ? formatearMontoDashboard(convertirMonto(monto, moneda, divisaActual), divisaActual)
                        : formatearMontoDashboard(convertirMonto(monto, moneda, divisaActual), divisaActual),
                    detalle: etiquetaDivisa(moneda)
                }
            })
        })
    })

    const contenedorCategorias = wrapper.querySelector('[data-tpl="categorias"]')
    const contenedorTipos = wrapper.querySelector('[data-tpl="tipos-activo"]')
    const contenedorDivisas = wrapper.querySelector('[data-tpl="divisas"]')
    const contenedorCuentas = wrapper.querySelector('[data-tpl="cuentas"]')

    if (contenedorCategorias) contenedorCategorias.replaceChildren(...categorias)
    if (contenedorTipos) contenedorTipos.replaceChildren(...tiposActivo)
    if (contenedorDivisas) contenedorDivisas.replaceChildren(...divisas)
    if (contenedorCuentas) contenedorCuentas.replaceChildren(...cuentasInvolucradas)

    // Abrir modal y luego dibujar dona
    abrirModal({
        titulo: "Distribución patrimonial",
        contenido: wrapper,
        variante: "wide",
        confirmText: "Cerrar",
        onConfirm: () => true,
        onOpen: () => {
            // Dibujar dona en el modal
            const canvas = wrapper.querySelector("#distribucion-modal-dona")
            const totalEl = wrapper.querySelector("#distribucion-modal-dona-total")
            if (canvas && itemsDonaConPct.length > 0) {
                // Total en el centro
                if (totalEl) {
                    totalEl.innerHTML = `
                        <span class="distribucion-modal-dona-total-label">Total</span>
                        <span class="distribucion-modal-dona-total-valor">${formatearMontoDashboard(totalDona, divisaActual)}</span>
                    `
                }
                // Dibujar dona
                import("../ui/graficos.js").then(({ crearGraficoDistribucion }) => {
                    crearGraficoDistribucion("distribucion-modal-dona", {
                        labels: itemsDonaConPct.map(item => item.etiqueta),
                        data: itemsDonaConPct.map(item => item.valor),
                        colores: itemsDonaConPct.map(item => COLORES_DISTRIBUCION[item.clase])
                    }, {
                        chartKey: "distribucion-modal",
                        formatear: monto => formatearMontoDashboard(monto, divisaActual)
                    })
                })
            }
        }
    })
}'''

with open('js/pages/dashboard.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Buscar la función usando regex
pattern = r'function abrirModalDistribucionPatrimonial\(\) \{[\s\S]*?^\}'
match = re.search(pattern, content, re.MULTILINE)

if match:
    old_func = match.group(0)
    print(f"Encontrada función de {len(old_func)} chars")
    
    new_func = '''function abrirModalDistribucionPatrimonial() {
    if (modoEdicionDashboard) return
    if (!analiticaData) return

    const wrapper = contenidoDesdeTemplate("tpl-distribucion-patrimonial")

    // --- Datos para la dona (categorías) ---
    const itemsDona = [
        { etiqueta: "Liquidez", valor: analiticaData.liquidez, clase: "liquidez" },
        { etiqueta: "Inversiones", valor: analiticaData.inversiones, clase: "inversiones" },
        { etiqueta: "Inmovilizado", valor: analiticaData.inmovil, clase: "inmovil" },
        { etiqueta: "Deudas", valor: analiticaData.deudas, clase: "deudas" }
    ].filter(item => Math.abs(Number(item.valor) || 0) > 0)

    const totalDona = itemsDona.reduce((sum, item) => sum + item.valor, 0)
    const itemsDonaConPct = itemsDona.map(item => ({
        ...item,
        porcentaje: totalDona > 0 ? (item.valor / totalDona) * 100 : 0
    })

    // --- Categorías (lista) ---
    const categorias = itemsDonaConPct
        .map(item => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: item.etiqueta,
                valor: formatearMontoDashboard(item.valor, divisaActual)
            }
        }))

    // --- Por tipo de activo ---
    const porTipo = new Map()
    for (const posicion of posicionesData || []) {
        const activo = posicion.activo || {}
        const tipo = String(activo.tipo || "accion").toLowerCase()
        const cantidad = Number(posicion.cantidad) || 0
        const ultimoPrecio = Number(activo.ultimoPrecio) || 0
        if (cantidad <= 0 || ultimoPrecio <= 0) continue
        const valor = convertirMonto(cantidad * ultimoPrecio, posicion.divisa || "usd", divisaActual)
        porTipo.set(tipo, (porTipo.get(tipo) || 0) + valor)
    }
    const tiposActivo = [...porTipo.entries()]
        .filter(([, valor]) => valor > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([tipo, valor]) => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: ETIQUETAS_TIPO_ACTIVO[tipo] || "Otros",
                valor: formatearMontoDashboard(valor, divisaActual)
            }
        }))

    // --- Por divisa ---
    const desgloseDivisa = patrimonioStats?.porDivisa || {}
    const divisas = Object.keys(desgloseDivisa)
        .filter(clave => Math.abs(Number(desgloseDivisa[clave]) || 0) > 0)
        .sort((a, b) => {
            const ia = ORDEN_DIVISAS_PATRIMONIO.indexOf(a)
            const ib = ORDEN_DIVISAS_PATRIMONIO.indexOf(b)
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (a < b ? -1 : 1)
        })
        .map(clave => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: etiquetaDivisa(clave),
                valor: formatearMontoDashboard(desgloseDivisa[clave], clave)
            }
        }))

    // --- Cuentas involucradas ---
    const cuentasInvolucradas = (cuentas || [])
        .filter(cuenta => {
            if (cuenta.estado === "archivada") return false
            if (cuenta.esPatrimonio === false) return false
            if (esHija(cuenta)) return false
            if (cuenta.tipo === "credito") return Number(cuenta.deuda) > 0
            if (esAbstracta(cuenta)) return true
            if (esSaldoInmovil(cuenta, cuentas)) return Number(cuenta.saldoInicial) !== 0
            return Number(cuenta.saldoInicial) !== 0
        })
        .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")))
        .map(cuenta => {
            const esCredito = cuenta.tipo === "credito"
            const moneda = String(cuenta.moneda || cuenta.divisa || "pen").toLowerCase()
            const monto = esCredito ? Math.max(0, Number(cuenta.deuda) || 0) : Number(cuenta.saldoInicial) || 0
            const etiqueta = esCredito ? "Deuda" : (esSaldoInmovil(cuenta, cuentas) ? "Inmovilizado" : "Liquidez")
            return contenidoDesdeTemplate("tpl-distribucion-modal-item", {
                valores: {
                    etiqueta: `${cuenta.nombre} · ${etiqueta}`,
                    valor: esCredito
                        ? formatearMontoDashboard(convertirMonto(monto, moneda, divisaActual), divisaActual)
                        : formatearMontoDashboard(convertirMonto(monto, moneda, divisaActual), divisaActual),
                    detalle: etiquetaDivisa(moneda)
                }
            })
        })
    })

    const contenedorCategorias = wrapper.querySelector('[data-tpl="categorias"]')
    const contenedorTipos = wrapper.querySelector('[data-tpl="tipos-activo"]')
    const contenedorDivisas = wrapper.querySelector('[data-tpl="divisas"]')
    const contenedorCuentas = wrapper.querySelector('[data-tpl="cuentas"]')

    if (contenedorCategorias) contenedorCategorias.replaceChildren(...categorias)
    if (contenedorTipos) contenedorTipos.replaceChildren(...tiposActivo)
    if (contenedorDivisas) contenedorDivisas.replaceChildren(...divisas)
    if (contenedorCuentas) contenedorCuentas.replaceChildren(...cuentasInvolucradas)

    // Abrir modal y luego dibujar dona
    abrirModal({
        titulo: "Distribución patrimonial",
        contenido: wrapper,
        variante: "wide",
        confirmText: "Cerrar",
        onConfirm: () => true,
        onOpen: () => {
            // Dibujar dona en el modal
            const canvas = wrapper.querySelector("#distribucion-modal-dona")
            const totalEl = wrapper.querySelector("#distribucion-modal-dona-total")
            if (canvas && itemsDonaConPct.length > 0) {
                // Total en el centro
                if (totalEl) {
                    totalEl.innerHTML = `
                        <span class="distribucion-modal-dona-total-label">Total</span>
                        <span class="distribucion-modal-dona-total-valor">${formatearMontoDashboard(totalDona, divisaActual)}</span>
                    `
                }
                // Dibujar dona
                import("../ui/graficos.js").then(({ crearGraficoDistribucion }) => {
                    crearGraficoDistribucion("distribucion-modal-dona", {
                        labels: itemsDonaConPct.map(item => item.etiqueta),
                        data: itemsDonaConPct.map(item => item.valor),
                        colores: itemsDonaConPct.map(item => COLORES_DISTRIBUCION[item.clase])
                    }, {
                        chartKey: "distribucion-modal",
                        formatear: monto => formatearMontoDashboard(monto, divisaActual)
                    })
                })
            }
        }
    })
}'''

with open('js/pages/dashboard.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Buscar la función usando regex
pattern = r'function abrirModalDistribucionPatrimonial\(\) \{[\s\S]*?^\}'
match = re.search(pattern, content, re.MULTILINE)

if match:
    old_func = match.group(0)
    print(f"Encontrada función de {len(old_func)} chars")
    
    new_func = '''function abrirModalDistribucionPatrimonial() {
    if (modoEdicionDashboard) return
    if (!analiticaData) return

    const wrapper = contenidoDesdeTemplate("tpl-distribucion-patrimonial")

    // --- Datos para la dona (categorías) ---
    const itemsDona = [
        { etiqueta: "Liquidez", valor: analiticaData.liquidez, clase: "liquidez" },
        { etiqueta: "Inversiones", valor: analiticaData.inversiones, clase: "inversiones" },
        { etiqueta: "Inmovilizado", valor: analiticaData.inmovil, clase: "inmovil" },
        { etiqueta: "Deudas", valor: analiticaData.deudas, clase: "deudas" }
    ].filter(item => Math.abs(Number(item.valor) || 0) > 0)

    const totalDona = itemsDona.reduce((sum, item) => sum + item.valor, 0)
    const itemsDonaConPct = itemsDona.map(item => ({
        ...item,
        porcentaje: totalDona > 0 ? (item.valor / totalDona) * 100 : 0
    })

    // --- Categorías (lista) ---
    const categorias = itemsDonaConPct
        .map(item => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: item.etiqueta,
                valor: formatearMontoDashboard(item.valor, divisaActual)
            }
        }))

    // --- Por tipo de activo ---
    const porTipo = new Map()
    for (const posicion of posicionesData || []) {
        const activo = posicion.activo || {}
        const tipo = String(activo.tipo || "accion").toLowerCase()
        const cantidad = Number(posicion.cantidad) || 0
        const ultimoPrecio = Number(activo.ultimoPrecio) || 0
        if (cantidad <= 0 || ultimoPrecio <= 0) continue
        const valor = convertirMonto(cantidad * ultimoPrecio, posicion.divisa || "usd", divisaActual)
        porTipo.set(tipo, (porTipo.get(tipo) || 0) + valor)
    }
    const tiposActivo = [...porTipo.entries()]
        .filter(([, valor]) => valor > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([tipo, valor]) => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: ETIQUETAS_TIPO_ACTIVO[tipo] || "Otros",
                valor: formatearMontoDashboard(valor, divisaActual)
            }
        }))

    // --- Por divisa ---
    const desgloseDivisa = patrimonioStats?.porDivisa || {}
    const divisas = Object.keys(desgloseDivisa)
        .filter(clave => Math.abs(Number(desgloseDivisa[clave]) || 0) > 0)
        .sort((a, b) => {
            const ia = ORDEN_DIVISAS_PATRIMONIO.indexOf(a)
            const ib = ORDEN_DIVISAS_PATRIMONIO.indexOf(b)
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (a < b ? -1 : 1)
        })
        .map(clave => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: etiquetaDivisa(clave),
                valor: formatearMontoDashboard(desgloseDivisa[clave], clave)
            }
        }))

    // --- Cuentas involucradas ---
    const cuentasInvolucradas = (cuentas || [])
        .filter(cuenta => {
            if (cuenta.estado === "archivada") return false
            if (cuenta.esPatrimonio === false) return false
            if (esHija(cuenta)) return false
            if (cuenta.tipo === "credito") return Number(cuenta.deuda) > 0
            if (esAbstracta(cuenta)) return true
            if (esSaldoInmovil(cuenta, cuentas)) return Number(cuenta.saldoInicial) !== 0
            return Number(cuenta.saldoInicial) !== 0
        })
        .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")))
        .map(cuenta => {
            const esCredito = cuenta.tipo === "credito"
            const moneda = String(cuenta.moneda || cuenta.divisa || "pen").toLowerCase()
            const monto = esCredito ? Math.max(0, Number(cuenta.deuda) || 0) : Number(cuenta.saldoInicial) || 0
            const etiqueta = esCredito ? "Deuda" : (esSaldoInmovil(cuenta, cuentas) ? "Inmovilizado" : "Liquidez")
            return contenidoDesdeTemplate("tpl-distribucion-modal-item", {
                valores: {
                    etiqueta: `${cuenta.nombre} · ${etiqueta}`,
                    valor: esCredito
                        ? formatearMontoDashboard(convertirMonto(monto, moneda, divisaActual), divisaActual)
                        : formatearMontoDashboard(convertirMonto(monto, moneda, divisaActual), divisaActual),
                    detalle: etiquetaDivisa(moneda)
                }
            })
        })
    })

    const contenedorCategorias = wrapper.querySelector('[data-tpl="categorias"]')
    const contenedorTipos = wrapper.querySelector('[data-tpl="tipos-activo"]')
    const contenedorDivisas = wrapper.querySelector('[data-tpl="divisas"]')
    const contenedorCuentas = wrapper.querySelector('[data-tpl="cuentas"]')

    if (contenedorCategorias) contenedorCategorias.replaceChildren(...categorias)
    if (contenedorTipos) contenedorTipos.replaceChildren(...tiposActivo)
    if (contenedorDivisas) contenedorDivisas.replaceChildren(...divisas)
    if (contenedorCuentas) contenedorCuentas.replaceChildren(...cuentasInvolucradas)

    // Abrir modal y luego dibujar dona
    abrirModal({
        titulo: "Distribución patrimonial",
        contenido: wrapper,
        variante: "wide",
        confirmText: "Cerrar",
        onConfirm: () => true,
        onOpen: () => {
            // Dibujar dona en el modal
            const canvas = wrapper.querySelector("#distribucion-modal-dona")
            const totalEl = wrapper.querySelector("#distribucion-modal-dona-total")
            if (canvas && itemsDonaConPct.length > 0) {
                // Total en el centro
                if (totalEl) {
                    totalEl.innerHTML = `
                        <span class="distribucion-modal-dona-total-label">Total</span>
                        <span class="distribucion-modal-dona-total-valor">${formatearMontoDashboard(totalDona, divisaActual)}</span>
                    `
                }
                // Dibujar dona
                import("../ui/graficos.js").then(({ crearGraficoDistribucion }) => {
                    crearGraficoDistribucion("distribucion-modal-dona", {
                        labels: itemsDonaConPct.map(item => item.etiqueta),
                        data: itemsDonaConPct.map(item => item.valor),
                        colores: itemsDonaConPct.map(item => COLORES_DISTRIBUCION[item.clase])
                    }, {
                        chartKey: "distribucion-modal",
                        formatear: monto => formatearMontoDashboard(monto, divisaActual)
                    })
                })
            }
        }
    })
}'''

if old_func in content:
    content = content.replace(old_func, new_func)
    with open('js/pages/dashboard.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print('OK: Función reemplazada')
else:
    print('ERROR: No se encontró la función exacta')
    # Buscar la función
    idx = content.find('function abrirModalDistribucionPatrimonial()')
    if idx >= 0:
        print(f'Encontrada en posición {idx}')
        # Mostrar contexto
        print(content[idx:idx+200])