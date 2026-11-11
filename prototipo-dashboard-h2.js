/* ============================================
   PROTOTIPO H2 — ALGORITMO DE DISTRIBUCIÓN
   Adaptativo por columnas disponibles, sin alterar preferencias del usuario.
   ============================================ */

// --- Configuración de tarjetas (preferencias del usuario) ---
// Cada tarjeta tiene: id, label, ancho (1 o 2 columnas), alto (1, 2 o 3 filas), visible, orden.
const CARDS_CONFIG_INICIAL = [
    { id: "patrimonio",  label: "Patrimonio total",   ancho: 2, alto: 1, visible: true,  fijo: true  }, // fijo: no se oculta ni se mueve
    { id: "cuentas",     label: "Cuentas",            ancho: 1, alto: 1, visible: true },
    { id: "inversiones", label: "Inversiones",        ancho: 1, alto: 1, visible: true },
    { id: "vencimientos",label: "Próximos vencimientos", ancho: 1, alto: 1, visible: true },
    { id: "movimientos", label: "Últimos movimientos",ancho: 1, alto: 2, visible: true,  scroll: true },
    { id: "favoritos",   label: "Favoritos",          ancho: 1, alto: 1, visible: true },
    { id: "metas",       label: "Metas de ahorro",    ancho: 1, alto: 1, visible: true },
    { id: "presupuestos",label: "Presupuestos",       ancho: 1, alto: 1, visible: true },
    { id: "pendientes",  label: "Pendientes",         ancho: 1, alto: 1, visible: true },
    { id: "ordenes",     label: "Órdenes",            ancho: 1, alto: 1, visible: true },
    { id: "estrategias", label: "Estrategias",        ancho: 1, alto: 1, visible: true },
    { id: "grafico",     label: "Evolución patrimonial", ancho: 2, alto: 1, visible: true },
    { id: "distribucion",label: "Distribución",       ancho: 1, alto: 2, visible: false },
    { id: "alertas",     label: "Alertas",            ancho: 1, alto: 1, visible: false }
];

// --- Estado del prototipo ---
// Configuración inicial (preferencias originales, nunca se muta directamente)
const configuracionInicial = CARDS_CONFIG_INICIAL.map(c => ({ ...c }));
const CLONAR_INICIAL = () => configuracionInicial.map(c => ({ ...c }));

// Configuración confirmada (lo que se guarda al confirmar cambios)
let configuracionConfirmada = CLONAR_INICIAL();

// Configuración temporal de edición (lo que el usuario está modificando)
let configuracionTemporal = CLONAR_INICIAL();

// Referencia activa para renderizar (apunta a configuracionTemporal)
let cardsConfig = configuracionTemporal;

// Única fuente de verdad del número de columnas: la simulación, nunca el ancho real.
// El valor inicial sí parte del viewport para que el móvil arranque en 1 columna,
// pero elegir columnas después no lo vuelve a tocar.
let columnasActuales = window.innerWidth < 600 ? 1 : 5;
let modoEdicion = false;
let sortable = null;

// Reemplazar la configuración temporal manteniendo el alias que usa el render.
function usarTemporal(cards) {
    configuracionTemporal = cards;
    cardsConfig = configuracionTemporal;
}

// --- Referencias DOM ---
const grid = document.getElementById("dashboard-grid");
const btnModoEdicion = document.getElementById("btn-modo-edicion");
const btnAbrirCards = document.getElementById("btn-abrir-cards");
const btnListo = document.getElementById("btn-listo");
const btnReset = document.getElementById("btn-reset");
const btnCerrarModal = document.getElementById("btn-cerrar-modal");
const btnGuardarModal = document.getElementById("btn-guardar-modal");
const btnResetModal = document.getElementById("btn-reset-modal");
const btnCancelarModal = document.getElementById("btn-cancelar-modal");
const grupoColumnas = document.getElementById("grupo-columnas");
const modalOverlay = document.getElementById("modal-editor");
const editorLista = document.getElementById("editor-lista");

// --- Algoritmo de distribución inteligente ---

/**
 * Calcula la posición (columna, fila) de cada tarjeta visible para el número
 * de columnas dado, respetando el orden preferido y buscando rellenar huecos
 * con tarjetas posteriores cuando una no quepa en el espacio restante.
 *
 * @param {Array} cards - array de configuraciones de tarjetas (con ancho, alto, visible, orden)
 * @param {number} columnas - columnas disponibles
 * @returns {Array} array de { id, col, row, ancho, alto }
 */
function calcularDistribucion(cards, columnas) {
    // Forzar ancho a 1 si solo hay 1 columna (sin perder configuración original)
    const efectivo = cards.map(c => {
        const anchoEfectivo = columnas === 1 ? 1 : c.ancho;
        return { ...c, anchoEfectivo };
    });

    // Filtrar visibles y ordenar por el orden preferido del usuario
    const visibles = efectivo
        .filter(c => c.visible)
        .sort((a, b) => {
            // tarjetas fijas primero, luego por orden de array original
            if (a.fijo && !b.fijo) return -1;
            if (!a.fijo && b.fijo) return 1;
            return efectivo.indexOf(a) - efectivo.indexOf(b);
        });

    // Mapa de ocupación: fila -> Set de columnas ocupadas
    // Usamos una estructura simple: array de filas, cada una con columnas ocupadas
    const ocupado = {}; // fila -> Set de columnas
    function estaOcupado(fila, col, ancho, alto) {
        for (let f = fila; f < fila + alto; f++) {
            for (let c = col; c < col + ancho; c++) {
                if (ocupado[f] && ocupado[f].has(c)) return true;
            }
        }
        return false;
    }
    function ocupar(fila, col, ancho, alto, id) {
        for (let f = fila; f < fila + alto; f++) {
            if (!ocupado[f]) ocupado[f] = new Set();
            for (let c = col; c < col + ancho; c++) {
                ocupado[f].add(c);
            }
        }
    }

    const resultado = [];
    const pendientes = [...visibles];
    let filaActual = 0;
    let colActual = 0;

    // Índice para recorrer pendientes sin perder el orden relativo
    let i = 0;
    while (i < pendientes.length) {
        const card = pendientes[i];
        const ancho = card.anchoEfectivo;
        const alto = card.alto;

        // Si el ancho es mayor que columnas disponibles, forzar a 1 (protección)
        const anchoReal = Math.min(ancho, columnas);

        // Buscar una posición válida a partir de (filaActual, colActual)
        let colocada = false;

        // Primero intentar en la posición actual
        if (colActual + anchoReal <= columnas && !estaOcupado(filaActual, colActual, anchoReal, alto)) {
            ocupar(filaActual, colActual, anchoReal, alto, card.id);
            resultado.push({ id: card.id, col: colActual, row: filaActual, ancho: anchoReal, alto });
            colActual += anchoReal;
            i++;
            colocada = true;
        }

        if (!colocada) {
            // No cabe en el espacio restante de esta fila.
            // Buscar entre las tarjetas posteriores la primera que quepa.
            let reemplazoIdx = -1;
            for (let j = i + 1; j < pendientes.length; j++) {
                const c2 = pendientes[j];
                const a2 = Math.min(c2.anchoEfectivo, columnas);
                const h2 = c2.alto;
                if (colActual + a2 <= columnas && !estaOcupado(filaActual, colActual, a2, h2)) {
                    reemplazoIdx = j;
                    break;
                }
            }

            if (reemplazoIdx !== -1) {
                const c2 = pendientes.splice(reemplazoIdx, 1)[0];
                const a2 = Math.min(c2.anchoEfectivo, columnas);
                ocupar(filaActual, colActual, a2, c2.alto, c2.id);
                resultado.push({ id: c2.id, col: colActual, row: filaActual, ancho: a2, alto: c2.alto });
                colActual += a2;
                // No incrementar i: seguimos intentando colocar la card original en esta fila
            } else {
                // Ninguna tarjeta posterior cabe aquí. Pasar a la siguiente fila.
                filaActual++;
                colActual = 0;
                // No incrementar i: reintentar la misma card en la nueva fila
            }
        }

        // Si colActual se pasó o llegó al final, ir a siguiente fila
        if (colActual >= columnas) {
            filaActual++;
            colActual = 0;
        }
    }

    return resultado;
}

function crearIconoSVG(html) {
    // Los SVG son markup estático del propio prototipo (no datos de usuario).
    const tpl = document.createElement("template");
    tpl.innerHTML = html;
    return tpl.content.firstElementChild;
}

/**
 * Renderiza las tarjetas en el grid según la distribución calculada.
 *
 * Decisión A2 — por qué se usan estilos inline de grid:
 * `calcularDistribucion()` calcula posiciones exactas (línea de columna y de fila)
 * para evitar solapamientos y rellenar huecos. Las clases de span (`card-span-2`,
 * `card-span-row-2/3`) solo expresan "ocupa N celdas", no "empieza en la columna 4",
 * así que forzarlas obligaría a renunciar a la distribución inteligente o a generar
 * clases dinámicas por posición (peor: CSS generado en runtime y sin valor reutilizable).
 * Las cuatro propiedades gridColumn/RowStart/End son, por tanto, el mecanismo más simple
 * y mantenible para representar el resultado del algoritmo; no son estilos de presentación
 * (color, tipografía, radios) y siguen la excepción documentada de AGENTS.md §3.
 * Las clases de span se mantienen además para que el CSS de escinco siga siendo compatible.
 */
function renderizarGrid() {
    // Una sola fuente de verdad de columnas: la simulación manda sobre el CSS.
    grid.style.setProperty("--columnas-simuladas", String(columnasActuales));

    // Destruir Sortable antes de reconstruir nodos para evitar referencias obsoletas
    destruirSortable();

    const distribucion = calcularDistribucion(cardsConfig, columnasActuales);

    // Limpiar grid
    grid.replaceChildren();

    // Crear un fragmento para insertar todas las tarjetas de una vez
    const fragmento = document.createDocumentFragment();

    // Ordenar resultado por fila y luego columna para insertar en orden visual
    const ordenVisual = [...distribucion].sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
    });

    for (const d of ordenVisual) {
        const cfg = cardsConfig.find(c => c.id === d.id);
        if (!cfg) continue;

        const card = document.createElement("div");
        card.className = "dashboard-card";
        card.dataset.dashboardCard = d.id;
        card.draggable = modoEdicion && !cfg.fijo;

        // Posicionamiento en el grid (estilo inline: cálculo de layout, no presentación)
        card.style.gridColumnStart = d.col + 1;
        card.style.gridColumnEnd = d.col + d.ancho + 1;
        card.style.gridRowStart = d.row + 1;
        card.style.gridRowEnd = d.row + d.alto + 1;

        // Clases de span para CSS (coherente con escinco)
        if (d.ancho === 2) card.classList.add("card-span-2");
        if (d.alto === 2) card.classList.add("card-span-row-2");
        if (d.alto === 3) card.classList.add("card-span-row-3");

        // Contenido de la card (sin innerHTML: todo por createElement + textContent)
        const contenido = document.createElement("div");
        contenido.className = "card-contenido";

        const titulo = document.createElement("div");
        titulo.className = "card-titulo";
        titulo.dataset.tpl = "titulo";
        titulo.textContent = cfg.label;
        contenido.appendChild(titulo);

        const valor = document.createElement("div");
        valor.className = "card-valor";
        valor.dataset.tpl = "valor";
        valor.textContent = "—";
        contenido.appendChild(valor);

        const detalle = document.createElement("div");
        detalle.className = "card-detalle";
        detalle.dataset.tpl = "detalle";
        detalle.textContent = `${cfg.alto} fila${d.alto > 1 ? "s" : ""} · ${d.ancho} col${d.ancho > 1 ? "s" : ""}`;
        contenido.appendChild(detalle);

        if (cfg.scroll) {
            const lista = document.createElement("div");
            lista.className = "skeleton-lista";
            contenido.appendChild(lista);
        }

        const skelTitle = document.createElement("div");
        skelTitle.className = "skeleton-base skeleton-title";
        contenido.appendChild(skelTitle);

        const skelValue = document.createElement("div");
        skelValue.className = "skeleton-base skeleton-value";
        contenido.appendChild(skelValue);

        const skelText = document.createElement("div");
        skelText.className = "skeleton-base skeleton-text";
        contenido.appendChild(skelText);

        card.appendChild(contenido);

        // Si es fija (patrimonio), marcar visualmente
        if (cfg.fijo) {
            card.classList.add("card-fija");
            card.title = "Fija: no se puede mover ni ocultar";
        }

        // Controles de edición (solo cards movibles; una card fija no tiene asa)
        if (!cfg.fijo) {
            const controles = document.createElement("div");
            controles.className = "dashboard-card-edicion";

            const btnHandle = document.createElement("button");
            btnHandle.type = "button";
            btnHandle.className = "card-accion-btn handle";
            btnHandle.setAttribute("data-dashboard-drag-handle", "");
            btnHandle.title = "Arrastrar card";
            btnHandle.appendChild(crearIconoSVG('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>'));

            const btnEliminar = document.createElement("button");
            btnEliminar.type = "button";
            btnEliminar.className = "card-accion-btn eliminar";
            btnEliminar.dataset.accion = "eliminar";
            btnEliminar.dataset.id = d.id;
            btnEliminar.title = "Ocultar card";
            btnEliminar.appendChild(crearIconoSVG('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'));

            controles.appendChild(btnHandle);
            controles.appendChild(btnEliminar);
            card.appendChild(controles);
        }

        fragmento.appendChild(card);
    }

    grid.appendChild(fragmento);

    // Recrear Sortable si estamos en modo edición (nodos nuevos)
    if (modoEdicion) {
        inicializarSortable();
    }
}

// --- Modo edición ---

function activarModoEdicion() {
    modoEdicion = true;
    document.getElementById("dashboard-edicion-bar").removeAttribute("hidden");
    grid.classList.add("dashboard-edicion-activo");
    // renderizarGrid() ya recrea Sortable al final porque modoEdicion es true.
    renderizarGrid();
    btnModoEdicion.textContent = "Desactivar edición";
    btnModoEdicion.classList.add("activo");
}

function desactivarModoEdicion() {
    modoEdicion = false;
    document.getElementById("dashboard-edicion-bar").setAttribute("hidden", "");
    grid.classList.remove("dashboard-edicion-activo");
    destruirSortable();
    renderizarGrid();
    btnModoEdicion.textContent = "Activar edición";
    btnModoEdicion.classList.remove("activo");
    cerrarModal();
}

// --- SortableJS (arrastrar y soltar) ---

function destruirSortable() {
    if (sortable) {
        sortable.destroy();
        sortable = null;
    }
}

function inicializarSortable() {
    destruirSortable();
    // El prototipo carga SortableJS por CDN; si no está disponible, el resto del editor sigue funcionando.
    if (typeof Sortable === "undefined") {
        console.warn("SortableJS no disponible: arrastre deshabilitado en el prototipo.");
        return;
    }
    sortable = new Sortable(grid, {
        handle: "[data-dashboard-drag-handle]",
        draggable: ".dashboard-card:not(.card-fija)",
        animation: 150,
        ghostClass: "dashboard-card-arrastrando",
        dragClass: "dashboard-card-arrastrando",
        disabled: !modoEdicion,
        onStart: () => {
            document.body.classList.add("dashboard-card-dragging");
        },
        onEnd: (evt) => {
            document.body.classList.remove("dashboard-card-dragging");
            // Leer el nuevo orden del DOM (solo cards visibles)
            const nuevosIds = [];
            grid.querySelectorAll(".dashboard-card").forEach(c => {
                const id = c.dataset.dashboardCard;
                if (id && id !== "patrimonio") nuevosIds.push(id);
            });
            // Reordenar cardsConfig manteniendo fijos al principio
            const fijos = cardsConfig.filter(c => c.fijo);
            const noFijos = cardsConfig.filter(c => !c.fijo && c.visible);
            const ordenActualizado = [];
            nuevosIds.forEach(id => {
                const c = noFijos.find(nc => nc.id === id);
                if (c) ordenActualizado.push(c);
            });
            // Añadir las que no estaban en el orden del DOM (ocultas, si las hubiera)
            noFijos.forEach(c => {
                if (!ordenActualizado.includes(c)) ordenActualizado.push(c);
            });
            usarTemporal([...fijos, ...ordenActualizado, ...cardsConfig.filter(c => !c.visible)]);
            renderizarGrid();
        }
    });
}

// --- Modal de editor (activar/desactivar cards, dimensiones) ---

function abrirModalEditor() {
    renderizarEditorLista();
    modalOverlay.classList.add("visible");
}

function cerrarModal() {
    modalOverlay.classList.remove("visible");
}

function renderizarEditorLista() {
    editorLista.replaceChildren();
    // Se listan todas las cards editables (también las ocultas, para poder reactivarlas)
    const editables = cardsConfig.filter(c => !c.fijo);
    editables.forEach(cfg => {
        const fila = document.createElement("div");
        fila.className = "editor-fila";
        fila.dataset.card = cfg.id;

        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.checked = cfg.visible;
        chk.dataset.id = cfg.id;
        chk.addEventListener("change", () => {
            cfg.visible = chk.checked;
            renderizarGrid();
        });

        const nombre = document.createElement("span");
        nombre.className = "editor-nombre";
        nombre.textContent = cfg.label;

        const dims = document.createElement("div");
        dims.className = "editor-dimensiones";

        // Botones de ancho
        [1, 2].forEach(a => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = `btn-dimensione ${cfg.ancho === a ? "activo" : ""} ${columnasActuales === 1 ? "disabled" : ""}`;
            b.dataset.ancho = a;
            b.dataset.id = cfg.id;
            b.textContent = a + "C";
            b.title = "Ancho " + a + " columna" + (a > 1 ? "s" : "");
            b.addEventListener("click", () => {
                if (b.classList.contains("disabled")) return;
                document.querySelectorAll(`.btn-dimensione[data-id="${cfg.id}"]`).forEach(x => x.classList.remove("activo"));
                b.classList.add("activo");
                cfg.ancho = a;
                renderizarGrid();
            });
            dims.appendChild(b);
        });

        // Botones de alto
        [1, 2, 3].forEach(h => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = `btn-dimensione ${cfg.alto === h ? "activo" : ""}`;
            b.dataset.alto = h;
            b.dataset.id = cfg.id;
            b.textContent = h + "F";
            b.title = "Alto " + h + " fila" + (h > 1 ? "s" : "");
            b.addEventListener("click", () => {
                document.querySelectorAll(`.btn-dimensione[data-id="${cfg.id}"][data-alto]`).forEach(x => x.classList.remove("activo"));
                b.classList.add("activo");
                cfg.alto = h;
                renderizarGrid();
            });
            dims.appendChild(b);
        });

        fila.appendChild(chk);
        fila.appendChild(nombre);
        fila.appendChild(dims);
        editorLista.appendChild(fila);
    });
}

// --- Eventos ---

function cambiarColumnas(n) {
    columnasActuales = n;
    actualizarBotonesColumnas();
    renderizarGrid();
}

btnModoEdicion.addEventListener("click", () => {
    if (modoEdicion) {
        // Salir de edición equivale a confirmar: el arrastre no tiene otro guardado.
        confirmarEdicion();
        desactivarModoEdicion();
    } else activarModoEdicion();
});

btnAbrirCards.addEventListener("click", () => {
    // Iniciar la edición desde la configuración confirmada
    usarTemporal(configuracionConfirmada.map(c => ({ ...c })));
    activarModoEdicion();
    abrirModalEditor();
});

btnListo.addEventListener("click", () => {
    // "Listo" confirma lo editado (incluido el orden arrastrado) y sale del modo edición.
    confirmarEdicion();
    desactivarModoEdicion();
});

btnReset.addEventListener("click", () => {
    // Restaurar preferencias originales: temporal y confirmada vuelven al inicio
    usarTemporal(CLONAR_INICIAL());
    configuracionConfirmada = CLONAR_INICIAL();
    cambiarColumnas(5);
});

// Simulación de columnas
grupoColumnas.addEventListener("click", (evt) => {
    const btn = evt.target.closest(".proto-btn[data-cols]");
    if (!btn) return;
    cambiarColumnas(parseInt(btn.dataset.cols, 10));
});

function actualizarBotonesColumnas() {
    grupoColumnas.querySelectorAll(".proto-btn").forEach(b => {
        b.classList.toggle("activo", parseInt(b.dataset.cols, 10) === columnasActuales);
    });
}

// Modal: confirmar / cancelar / restaurar (sin persistencia real)
btnCerrarModal.addEventListener("click", cerrarModal);

// Confirmar: temporal -> confirmada (en memoria).
function confirmarEdicion() {
    configuracionConfirmada = configuracionTemporal.map(c => ({ ...c }));
    usarTemporal(configuracionConfirmada.map(c => ({ ...c })));
}

btnGuardarModal.addEventListener("click", () => {
    confirmarEdicion();
    renderizarGrid();
    cerrarModal();
});

// Cancelar: descartar la edición temporal y volver a lo confirmado.
function cancelarEdicion() {
    usarTemporal(configuracionConfirmada.map(c => ({ ...c })));
    renderizarGrid();
    cerrarModal();
}
btnCancelarModal.addEventListener("click", cancelarEdicion);

// Restaurar: la temporal vuelve a la configuración inicial (la confirmada no se toca).
btnResetModal.addEventListener("click", () => {
    usarTemporal(CLONAR_INICIAL());
    renderizarEditorLista();
    renderizarGrid();
});

// Delegación para eliminar (ocultar) card desde controles de edición
grid.addEventListener("click", (evt) => {
    const btn = evt.target.closest("[data-accion='eliminar']");
    if (!btn || !modoEdicion) return;
    const id = btn.dataset.id;
    const cfg = cardsConfig.find(c => c.id === id);
    if (cfg && !cfg.fijo) {
        cfg.visible = false;
        renderizarGrid();
        // Mantener el modal sincronizado si está abierto
        if (modalOverlay.classList.contains("visible")) renderizarEditorLista();
    }
});

// --- Pruebas visuales (requisito 9) ---

const pruebas = document.querySelectorAll(".prueba-btn");
pruebas.forEach(btn => {
    btn.addEventListener("click", () => {
        const tipo = btn.dataset.prueba;
        aplicarPrueba(tipo);
    });
});

function aplicarPrueba(tipo) {
    // Las pruebas escriben solo en la configuración temporal; la confirmada no se toca.

    switch (tipo) {
        case "dos-col-final":
            // 1. Una tarjeta de dos columnas al final de una fila
            // Con 5 columnas: 4 de 1 col + 1 de 2 col al final → hueco de 1 col
            columnasActuales = 5;
            cardsConfig = [
                { id: "c1", label: "Card 1 (1×1)", ancho: 1, alto: 1, visible: true },
                { id: "c2", label: "Card 2 (1×1)", ancho: 1, alto: 1, visible: true },
                { id: "c3", label: "Card 3 (1×1)", ancho: 1, alto: 1, visible: true },
                { id: "c4", label: "Card 4 (1×1)", ancho: 1, alto: 1, visible: true },
                { id: "c5", label: "Card 5 (2×1)", ancho: 2, alto: 1, visible: true },
                { id: "c6", label: "Card 6 (1×1)", ancho: 1, alto: 1, visible: true }
            ];
            break;
        case "relleno-espacio":
            // 2. Búsqueda de tarjeta posterior que rellene espacio
            columnasActuales = 5;
            cardsConfig = [
                { id: "a", label: "A (1×1)", ancho: 1, alto: 1, visible: true },
                { id: "b", label: "B (2×1)", ancho: 2, alto: 1, visible: true },
                { id: "c", label: "C (1×1)", ancho: 1, alto: 1, visible: true },
                { id: "d", label: "D (1×1)", ancho: 1, alto: 1, visible: true },
                { id: "e", label: "E (1×1)", ancho: 1, alto: 1, visible: true }
            ];
            break;
        case "dos-col-consecutivas":
            // 3. Varias tarjetas de dos columnas consecutivas
            columnasActuales = 5;
            cardsConfig = [
                { id: "a", label: "A (2×1)", ancho: 2, alto: 1, visible: true },
                { id: "b", label: "B (2×1)", ancho: 2, alto: 1, visible: true },
                { id: "c", label: "C (1×1)", ancho: 1, alto: 1, visible: true },
                { id: "d", label: "D (1×1)", ancho: 1, alto: 1, visible: true }
            ];
            break;
        case "alturas-distintas":
            // 4. Tarjetas de distintas alturas
            columnasActuales = 4;
            cardsConfig = [
                { id: "a", label: "A (1×1)", ancho: 1, alto: 1, visible: true },
                { id: "b", label: "B (1×2)", ancho: 1, alto: 2, visible: true },
                { id: "c", label: "C (1×1)", ancho: 1, alto: 1, visible: true },
                { id: "d", label: "D (1×3)", ancho: 1, alto: 3, visible: true },
                { id: "e", label: "E (1×1)", ancho: 1, alto: 1, visible: true },
                { id: "f", label: "F (2×2)", ancho: 2, alto: 2, visible: true }
            ];
            break;
        case "cambiar-ancho":
            // 5. Cambiar de 5 a 1 columna
            columnasActuales = 1;
            cardsConfig = CARDS_CONFIG_INICIAL.map(c => ({ ...c }));
            break;
        case "ocultar-mostrar":
            // 6. Ocultar y mostrar tarjetas
            columnasActuales = 4;
            cardsConfig = CARDS_CONFIG_INICIAL.map(c => ({ ...c, visible: c.id === "patrimonio" || c.id === "cuentas" || c.id === "grafico" }));
            break;
        case "reordenar":
            // 7. Reordenar manualmente y volver a cambiar viewport
            columnasActuales = 3;
            cardsConfig = [
                { id: "grafico", label: "Gráfico (primero ahora)", ancho: 2, alto: 1, visible: true },
                { id: "cuentas", label: "Cuentas", ancho: 1, alto: 1, visible: true },
                { id: "movimientos", label: "Movimientos (1×2)", ancho: 1, alto: 2, visible: true },
                { id: "inversiones", label: "Inversiones", ancho: 1, alto: 1, visible: true },
                { id: "patrimonio", label: "Patrimonio (fijo)", ancho: 2, alto: 1, visible: true, fijo: true },
                { id: "metas", label: "Metas", ancho: 1, alto: 1, visible: true }
            ];
            break;
    }

    // Reenganchar el alias de estado temporal y recalcular
    usarTemporal(cardsConfig);
    cambiarColumnas(columnasActuales);
}

// Inicialización
actualizarBotonesColumnas();
renderizarGrid();
