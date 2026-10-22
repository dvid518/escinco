// ============================================
// GRÁFICOS CON CHART.JS
// ============================================

// DivisaServicio se importa en caliente, no estático: arrastra el módulo de
// Firestore y con él el SDK de Firebase, y la landing pública dibuja sus
// gráficos de ejemplo sin necesitar nada de eso. Se pide solo cuando el gráfico
// se pinta sin `opciones.formatear`, que es el caso de la app. Quien pase ese
// formateador (la maqueta del panel) no carga Firebase en absoluto.

let divisorServicio = null

async function cargarDivisaServicio() {
    if (!divisorServicio) {
        divisorServicio = import("../services/DivisaServicio.js")
    }
    return divisorServicio
}

let chartInstance = null
const patrimonioCharts = new Map()
const configuracionesPatrimonio = new Map()
const distribucionCharts = new Map()
const configuracionesDistribucion = new Map()

// Última configuración usada, para poder redibujar al cambiar el tema
let ultimoGraficoLinea = null
let observadorTema = null

// ============================================
// CARGA DE CHART.JS (local)
// ============================================

let promesaChartJS = null

async function cargarChartJS() {
    if (window.Chart) return window.Chart
    if (promesaChartJS) return promesaChartJS

    promesaChartJS = new Promise((resolve, reject) => {
        const script = document.createElement("script")
        script.src = "/js/lib/chart.umd.min.js"
        script.onload = () => resolve(window.Chart)
        script.onerror = () => {
            promesaChartJS = null
            reject(new Error("No se pudo cargar Chart.js"))
        }
        document.head.appendChild(script)
    })

    return promesaChartJS
}

// ============================================
// TEMA DINÁMICO
// ============================================
// Los colores se leen de las variables CSS con getComputedStyle al
// crear cada gráfico. Un único MutationObserver sobre data-theme
// redibuja los gráficos existentes con los colores del nuevo tema.

function configurarObservadorTema() {
    if (observadorTema) return

    observadorTema = new MutationObserver(() => {
        if (ultimoGraficoLinea) {
            const { canvasId, datos, opciones } = ultimoGraficoLinea
            crearGraficoLinea(canvasId, datos, opciones)
        }
        for (const [chartKey, configuracion] of configuracionesPatrimonio) {
            const { canvasId, datos, opciones } = configuracion
            crearGraficoPatrimonio(canvasId, datos, { ...opciones, chartKey })
        }
        for (const [chartKey, configuracion] of configuracionesDistribucion) {
            const { canvasId, datos, opciones } = configuracion
            crearGraficoDistribucion(canvasId, datos, { ...opciones, chartKey })
        }
    })

    observadorTema.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"]
    })
}

function leerColores() {
    const estilos = getComputedStyle(document.documentElement)
    return {
        positive: estilos.getPropertyValue('--positive').trim() || '#00E695',
        text: estilos.getPropertyValue('--text').trim() || '#F3F3F3',
        textSecondary: estilos.getPropertyValue('--textSecondary').trim() || '#738391',
        border: estilos.getPropertyValue('--border').trim() || '#D0DCE8',
        textAct: estilos.getPropertyValue('--textAct').trim() || '#F3F3F3',
        paleSky: estilos.getPropertyValue('--paleSky').trim() || '#D0DCE8',
        distribucionLiquidez: estilos.getPropertyValue('--distribucion-liquidez').trim() || '#BFE8C8',
        distribucionInversiones: estilos.getPropertyValue('--distribucion-inversiones').trim() || '#7FE3D2',
        distribucionInmovil: estilos.getPropertyValue('--distribucion-inmovil').trim() || '#F6C9D8',
        distribucionDeudas: estilos.getPropertyValue('--distribucion-deudas').trim() || '#E96A7E'
    }
}

// ============================================
// GRÁFICO DE LÍNEA
// ============================================

export async function crearGraficoLinea(canvasId, datos, opciones = {}) {
    try {
        const Chart = await cargarChartJS()

        if (chartInstance) {
            chartInstance.destroy()
        }

        const canvas = document.getElementById(canvasId)
        if (!canvas) {
            console.warn(`Canvas no encontrado: ${canvasId}`)
            return null
        }

        const ctx = canvas.getContext('2d')

        const colores = leerColores()
        const colorPositive = colores.positive
        const colorText = colores.text
        const colorTextSecondary = colores.textSecondary
        const colorBorder = colores.border

        const gradient = ctx.createLinearGradient(0, 0, 0, 300)
        gradient.addColorStop(0, colorPositive + '40')
        gradient.addColorStop(1, colorPositive + '00')

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: datos.labels || [],
                datasets: [{
                    label: opciones.label || 'Precio',
                    data: datos.data || [],
                    borderColor: colorPositive,
                    backgroundColor: gradient,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: colorPositive,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: colorText,
                        bodyColor: colorText,
                        padding: 10,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: (context) => {
                                return `${opciones.simbolo || ''} ${context.parsed.y.toFixed(2)}`
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: colorTextSecondary,
                            font: { size: 10, family: 'Roboto Mono' }
                        }
                    },
                    y: {
                        grid: {
                            color: colorBorder + '30',
                            drawBorder: false
                        },
                        ticks: {
                            color: colorTextSecondary,
                            font: { size: 10, family: 'Roboto Mono' },
                            callback: (value) => value.toFixed(2)
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        })

        // Recordar para redibujar al cambiar el tema
        ultimoGraficoLinea = { canvasId, datos, opciones }
        configurarObservadorTema()

        return chartInstance
    } catch (error) {
        console.error("Error creando gráfico:", error)
        return null
    }
}

// ============================================
// GRÁFICO DE EVOLUCIÓN DE PRECIO (últimos 7 días)
// ============================================
// Línea simple, sin velas ni indicadores. Reutiliza la configuración
// de crearGraficoLinea (misma instancia, colores del tema y redibujado).

export async function crearGraficoEvolucionPrecio(canvasId, datos, opciones = {}) {
    return crearGraficoLinea(canvasId, datos, {
        label: opciones.label || "Precio",
        simbolo: opciones.simbolo || ""
    })
}

// ============================================
// DESTRUIR GRÁFICO
// ============================================

export function destruirGrafico() {
    if (chartInstance) {
        chartInstance.destroy()
        chartInstance = null
    }
    ultimoGraficoLinea = null
}

// ============================================
// GRÁFICO DE PATRIMONIO (múltiples líneas)
// ============================================

function simplificarEtiquetasPatrimonio(labels) {
    if (labels.length <= 8) return [...labels]
    const step = Math.ceil(labels.length / 8)
    return labels.map((label, indice) => indice % step === 0 || indice === labels.length - 1 ? label : "")
}

export async function crearGraficoPatrimonio(canvasId, datos, opciones = {}) {
    const { chartKey = "dashboard", ...opcionesGrafico } = opciones

    try {
        const Chart = await cargarChartJS()

        const instanciaAnterior = patrimonioCharts.get(chartKey)
        if (instanciaAnterior) {
            instanciaAnterior.destroy()
        }

        const canvas = document.getElementById(canvasId)
        if (!canvas) {
            console.warn(`Canvas no encontrado: ${canvasId}`)
            return null
        }

        const ctx = canvas.getContext('2d')

        const colores = leerColores()
        const colorText = colores.text
        const colorTextSecondary = colores.textSecondary
        const colorBorder = colores.border

        const divisa = opcionesGrafico.divisa || 'PEN'
        const categoria = opcionesGrafico.categoria || 'todo'

        // Si quien llama no pasó `formatear` ni `etiquetaDivisa`, hace falta
        // DivisaServicio. Se espera una sola vez, aquí: los callbacks de
        // Chart.js son síncronos y no pueden esperar un import.
        const monedaGrafico = divisa.toLowerCase()
        let formatearConDivisa = null
        let presentarDivisa = () => ""
        if (!opcionesGrafico.formatear || !opcionesGrafico.etiquetaDivisa) {
            const servicio = await cargarDivisaServicio()
            formatearConDivisa = servicio.formatearMontoConDivisa
            if (!opcionesGrafico.etiquetaDivisa) {
                presentarDivisa = servicio.presentarDivisa
            }
        }

        // El formateador del tooltip. Si no vino en las opciones, es el de la
        // app: formatearConDivisa, que acaba de cargarse.
        const formatear = opcionesGrafico.formatear
            || (monto => formatearConDivisa(monto, monedaGrafico))

        const etiquetaDivisa = opcionesGrafico.etiquetaDivisa || presentarDivisa(monedaGrafico)
        const etiquetasOriginales = datos.labels || []
        const etiquetasVisibles = simplificarEtiquetasPatrimonio(etiquetasOriginales)

        // La serie "todo" es la evolución patrimonial general y usa --text.
        // Las categorías conservan la paleta de la dona para que el color del
        // gráfico y el de su bloque en la card de distribución coincidan.
        const COLORES_CATEGORIA = {
            liquidez: colores.distribucionLiquidez,
            inversiones: colores.distribucionInversiones,
            inmovil: colores.distribucionInmovil,
            deudas: colores.distribucionDeudas
        }
        const color = categoria === 'todo'
            ? colorText
            : (COLORES_CATEGORIA[categoria] || colorText)

        // `datos.categorias` es el formato nuevo. El fallback mantiene vivo el
        // gráfico si algún llamador antiguo solo pasa dataPEN/dataUSD/dataUSDT.
        const seriesCategoria = datos.categorias?.[categoria]
        let data
        if (seriesCategoria) {
            // EUR no tiene serie propia en los snapshots. Se mantiene el
            // comportamiento anterior: cae a USD (que es lo mismo que USDT).
            data = seriesCategoria[monedaGrafico]
                ?? seriesCategoria.usdt
                ?? seriesCategoria.usd
                ?? []
        } else if (divisa === 'PEN') {
            data = datos.dataPEN
        } else if (divisa === 'USD') {
            data = datos.dataUSD
        } else {
            data = datos.dataUSDT
        }

        const gradient = ctx.createLinearGradient(0, 0, 0, 300)
        gradient.addColorStop(0, color + '40')
        gradient.addColorStop(1, color + '00')

        const instancia = new Chart(ctx, {
            type: 'line',
            data: {
                labels: etiquetasVisibles,
                datasets: [{
                    label: `${opcionesGrafico.etiqueta || 'Patrimonio'} ${etiquetaDivisa}`,
                    data: data || [],
                    borderColor: color,
                    backgroundColor: gradient,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointBackgroundColor: color,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: colorText,
                        bodyColor: colorText,
                        padding: 10,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            title: (items) => {
                                const indice = items?.[0]?.dataIndex ?? 0
                                return etiquetasOriginales[indice] || ""
                            },
                            label: (context) => formatear(context.parsed.y)
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: colorTextSecondary,
                            font: { size: 10, family: 'Roboto Mono' },
                            maxRotation: 0,
                            autoSkip: false,
                            maxTicksLimit: 8
                        }
                    },
                    y: {
                        beginAtZero: true,
                        min: 0,
                        suggestedMin: 0,
                        grid: {
                            color: colorBorder + '30',
                            drawBorder: false
                        },
                        ticks: {
                            color: colorTextSecondary,
                            font: { size: 10, family: 'Roboto Mono' },
                            callback: (value) => value.toFixed(0)
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                }
            }
        })

        // Recordar para redibujar al cambiar el tema
        patrimonioCharts.set(chartKey, instancia)
        configuracionesPatrimonio.set(chartKey, { canvasId, datos, opciones: opcionesGrafico })
        configurarObservadorTema()

        return instancia
    } catch (error) {
        console.error("Error creando gráfico de patrimonio:", error)
        return null
    }
}

export function destruirGraficoPatrimonio(chartKey = "dashboard") {
    const instancia = patrimonioCharts.get(chartKey)
    if (instancia) {
        instancia.destroy()
        patrimonioCharts.delete(chartKey)
    }
    configuracionesPatrimonio.delete(chartKey)
}

// ============================================
// GRÁFICO DE DISTRIBUCIÓN (dona)
// ============================================
// Anillo de proporciones para repartos que suman 100% (tipo de activo,
// peso por divisa). Cada segmento trae su color en `datos.colores`, en el
// mismo orden que las etiquetas: es lo que permite que el anillo y la lista
// de al lado cuenten lo mismo sin repetir la paleta en dos sitios.

export async function crearGraficoDistribucion(canvasId, datos, opciones = {}) {
    const { chartKey = "distribucion", ...opcionesGrafico } = opciones

    try {
        const Chart = await cargarChartJS()

        const instanciaAnterior = distribucionCharts.get(chartKey)
        if (instanciaAnterior) {
            instanciaAnterior.destroy()
        }

        const canvas = document.getElementById(canvasId)
        if (!canvas) {
            console.warn(`Canvas no encontrado: ${canvasId}`)
            return null
        }

        const colores = leerColores()
        const colorText = colores.text
        const colorTextSecondary = colores.textSecondary
        const colorBorder = colores.border

        const etiquetas = datos.labels || []
        const valores = datos.data || []

        // Cada color puede venir como valor literal ("#00a269") o como nombre de
        // variable CSS ("--ambar"). Con el nombre se resuelve contra el tema
        // activo, que es lo que permite que el anillo accompany al cambio de
        // tema junto con las barras que lo acompañan en pantalla.
        const paleta = (datos.colores || [colores.positive, colores.paleSky, colorBorder])
            .map(color => (typeof color === "string" && color.startsWith("--"))
                ? (getComputedStyle(document.documentElement).getPropertyValue(color).trim() || colorBorder)
                : color)

        const total = valores.reduce((suma, valor) => suma + (Number(valor) || 0), 0)

        const instancia = new Chart(canvas.getContext("2d"), {
            type: "doughnut",
            data: {
                labels: etiquetas,
                datasets: [{
                    data: valores,
                    backgroundColor: paleta,
                    borderColor: "transparent",
                    borderWidth: 2,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "68%",
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "rgba(0, 0, 0, 0.8)",
                        titleColor: colorText,
                        bodyColor: colorText,
                        padding: 10,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: (context) => {
                                const porcentaje = total > 0
                                    ? ((context.parsed / total) * 100).toFixed(1)
                                    : "0.0"
                                const importe = opcionesGrafico.formatear
                                    ? opcionesGrafico.formatear(context.parsed)
                                    : context.parsed.toFixed(2)
                                return `${importe} · ${porcentaje}%`
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: "nearest"
                }
            }
        })

        distribucionCharts.set(chartKey, instancia)
        configuracionesDistribucion.set(chartKey, { canvasId, datos, opciones: opcionesGrafico })
        configurarObservadorTema()

        return instancia
    } catch (error) {
        console.error("Error creando gráfico de distribución:", error)
        return null
    }
}

export function destruirGraficoDistribucion(chartKey = "distribucion") {
    const instancia = distribucionCharts.get(chartKey)
    if (instancia) {
        instancia.destroy()
        distribucionCharts.delete(chartKey)
    }
    configuracionesDistribucion.delete(chartKey)
}