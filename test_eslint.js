function abrirModalDistribucionPatrimonial() {
    if (modoEdicionDashboard) return
    if (!analiticaData) return

    const wrapper = contenidoDesdeTemplate("tpl-distribucion-patrimonial")

    // --- Datos para la dona (categorias) ---
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

    // --- Categorias (lista) ---
    const categorias = itemsDonaConPct
        .map(item => contenidoDesdeTemplate("tpl-distribucion-modal-item", {
            valores: {
                etiqueta: item.etiqueta,
                valor: formatearMontoDashboard(item.valor, divisaActual)
            }
        }))