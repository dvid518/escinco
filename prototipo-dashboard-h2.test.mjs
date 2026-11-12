/* ============================================
   PRUEBAS AISLADAS DEL PROTOTIPO H2
   No toca el proyecto: carga prototipo-dashboard-h2.js en un DOM mínimo falso.
   Ejecutar con: node --test prototipo-dashboard-h2.test.mjs
   ============================================ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const FUENTE = readFileSync(new URL("./prototipo-dashboard-h2.js", import.meta.url), "utf8");

/* --- DOM mínimo --- */
class Nodo {
    constructor(tag = "div") {
        this.tagName = tag.toUpperCase();
        this.children = [];
        this.dataset = {};
        this._clases = new Set();
        this._attrs = new Map();
        this._listeners = {};
        this.textContent = "";
        this.checked = false;
        this._vars = {};
        this.style = { setProperty: (k, v) => { this._vars[k] = v; } };
        if (tag === "template") this.content = { firstElementChild: new Nodo("svg") };
        const self = this;
        this.classList = {
            add: (...c) => c.forEach(x => self._clases.add(x)),
            remove: (...c) => c.forEach(x => self._clases.delete(x)),
            contains: c => self._clases.has(c),
            toggle: (c, fuerza) => {
                const activo = fuerza === undefined ? !self._clases.has(c) : !!fuerza;
                if (activo) self._clases.add(c);
                else self._clases.delete(c);
                return activo;
            }
        };
    }
    get className() { return [...this._clases].join(" "); }
    set className(v) { this._clases = new Set(String(v).split(/\s+/).filter(Boolean)); }
    appendChild(n) {
        if (n.tagName === "FRAGMENT") this.children.push(...n.children);
        else this.children.push(n);
        return n;
    }
    replaceChildren() { this.children = []; }
    setAttribute(k, v) { this._attrs.set(k, v); }
    removeAttribute(k) { this._attrs.delete(k); }
    hasAttribute(k) { return this._attrs.has(k); }
    addEventListener(tipo, fn) { (this._listeners[tipo] ||= []).push(fn); }
    closest() { return null; }
    querySelectorAll(sel) {
        if (sel === ".dashboard-card") return this.children.filter(c => c.classList.contains("dashboard-card"));
        return [];
    }
}

function crearDocumento() {
    const registro = new Map();
    const doc = {
        body: new Nodo("body"),
        createElement: tag => new Nodo(tag),
        createDocumentFragment: () => new Nodo("fragment"),
        getElementById: id => {
            if (!registro.has(id)) registro.set(id, new Nodo("div"));
            return registro.get(id);
        },
        querySelectorAll: () => []
    };
    return doc;
}

function clic(el, extra = {}) {
    for (const fn of el._listeners.click || []) fn({ target: el, ...extra });
}

/* --- Carga del prototipo con entorno controlado --- */
function cargarPrototipo({ ancho = 1280 } = {}) {
    const documento = crearDocumento();
    const instancias = [];
    class SortableFalso {
        constructor(el, opciones) {
            this.el = el;
            this.opciones = opciones;
            this.destruido = false;
            instancias.push(this);
        }
        destroy() { this.destruido = true; }
        sort() {}
    }
    const contexto = {
        document: documento,
        window: { innerWidth: ancho },
        Sortable: SortableFalso,
        console
    };
    vm.createContext(contexto);

    const codigo = `(function() {
        ${FUENTE}
        ;return {
            calcularDistribucion, cambiarColumnas, activarModoEdicion, desactivarModoEdicion,
            renderizarGrid, abrirModalEditor,
            estado: () => ({ configuracionTemporal, configuracionConfirmada, configuracionInicial, cardsConfig, modoEdicion, columnasActuales, sortable }),
            el: { grid, btnGuardarModal, btnCancelarModal, btnResetModal, btnReset, btnAbrirCards, btnListo, btnModoEdicion, editorLista, modalOverlay }
        };
    })();`;

    const api = vm.runInContext(codigo, contexto);
    return { ...api, instancias };
}

const vivas = instancias => instancias.filter(i => !i.destruido);

/* --- Utilidades de algoritmo --- */
function celdas(distribucion) {
    const ocupadas = new Map();
    for (const d of distribucion) {
        for (let f = d.row; f < d.row + d.alto; f++) {
            for (let c = d.col; c < d.col + d.ancho; c++) {
                const clave = `${f}:${c}`;
                assert.ok(!ocupadas.has(clave), `solapamiento en ${clave} (${d.id} con ${ocupadas.get(clave)})`);
                ocupadas.set(clave, d.id);
            }
        }
    }
}

const CONFIGS_PRUEBA = {
    porDefecto: [
        { id: "patrimonio", ancho: 2, alto: 1, visible: true, fijo: true },
        { id: "cuentas", ancho: 1, alto: 1, visible: true },
        { id: "inversiones", ancho: 1, alto: 1, visible: true },
        { id: "movimientos", ancho: 1, alto: 2, visible: true },
        { id: "grafico", ancho: 2, alto: 1, visible: true },
        { id: "metas", ancho: 1, alto: 1, visible: true },
        { id: "oculta", ancho: 2, alto: 3, visible: false }
    ],
    soloDosColumnas: [
        { id: "a", ancho: 2, alto: 1, visible: true },
        { id: "b", ancho: 2, alto: 1, visible: true },
        { id: "c", ancho: 2, alto: 1, visible: true }
    ],
    alturas: [
        { id: "a", ancho: 1, alto: 1, visible: true },
        { id: "b", ancho: 1, alto: 2, visible: true },
        { id: "c", ancho: 1, alto: 1, visible: true },
        { id: "d", ancho: 1, alto: 3, visible: true },
        { id: "e", ancho: 2, alto: 2, visible: true },
        { id: "f", ancho: 1, alto: 1, visible: true }
    ],
    relleno: [
        { id: "c1", ancho: 1, alto: 1, visible: true },
        { id: "c2", ancho: 1, alto: 1, visible: true },
        { id: "c3", ancho: 1, alto: 1, visible: true },
        { id: "c4", ancho: 1, alto: 1, visible: true },
        { id: "ancha", ancho: 2, alto: 1, visible: true },
        { id: "relleno", ancho: 1, alto: 1, visible: true }
    ]
};

/* --- 1. Algoritmo --- */

test("sin solapamientos ni desbordes para 1..5 columnas", () => {
    const { calcularDistribucion } = cargarPrototipo();
    for (const [nombre, config] of Object.entries(CONFIGS_PRUEBA)) {
        for (let columnas = 1; columnas <= 5; columnas++) {
            const dist = calcularDistribucion(config, columnas);
            assert.equal(dist.length, config.filter(c => c.visible).length, `${nombre} / ${columnas} col: faltan tarjetas`);
            celdas(dist);
            for (const d of dist) {
                assert.ok(d.col >= 0 && d.col + d.ancho <= columnas, `${nombre}: ${d.id} se sale del grid`);
            }
            const ids = dist.map(d => d.id);
            assert.equal(new Set(ids).size, ids.length, `${nombre}: ids duplicados`);
        }
    }
});

test("es determinista", () => {
    const { calcularDistribucion } = cargarPrototipo();
    for (const config of Object.values(CONFIGS_PRUEBA)) {
        for (let columnas = 1; columnas <= 5; columnas++) {
            assert.deepEqual(
                calcularDistribucion(config, columnas),
                calcularDistribucion(config, columnas)
            );
        }
    }
});

test("ancho 2 se recorta a 1 en una sola columna y la preferencia no se muta", () => {
    const { calcularDistribucion } = cargarPrototipo();
    const config = CONFIGS_PRUEBA.soloDosColumnas.map(c => ({ ...c }));
    const dist = calcularDistribucion(config, 1);
    assert.ok(dist.every(d => d.ancho === 1 && d.col === 0));
    assert.ok(config.every(c => c.ancho === 2), "la configuración original debe conservar ancho 2");
});

test("las cards fijas se colocan primero", () => {
    const { calcularDistribucion } = cargarPrototipo();
    const config = [
        { id: "suelta", ancho: 1, alto: 1, visible: true },
        { id: "fija", ancho: 1, alto: 1, visible: true, fijo: true }
    ];
    const dist = calcularDistribucion(config, 5);
    assert.equal(dist[0].id, "fija");
});

test("rellena el hueco con una tarjeta posterior en lugar de dejar el hueco", () => {
    const { calcularDistribucion } = cargarPrototipo();
    const dist = calcularDistribucion(CONFIGS_PRUEBA.relleno, 5);
    const porId = Object.fromEntries(dist.map(d => [d.id, d]));
    // c1..c4 ocupan 0..3; "ancha" no cabe en la columna 4, "relleno" sí.
    assert.equal(porId.relleno.row, 0);
    assert.equal(porId.relleno.col, 4);
    assert.equal(porId.ancha.row, 1);
    assert.equal(porId.ancha.col, 0);
    celdas(dist);
});

test("no entra en bucle con alturas 3 y columnas 1", () => {
    const { calcularDistribucion } = cargarPrototipo();
    const dist = calcularDistribucion(CONFIGS_PRUEBA.alturas, 1);
    assert.equal(dist.length, 6);
    celdas(dist);
});

/* --- 2. Estado y viewport --- */

test("cambiar de 5 a 1 y volver no altera las preferencias", () => {
    const p = cargarPrototipo();
    const antes = JSON.stringify(p.estado().configuracionTemporal);
    p.cambiarColumnas(1);
    p.cambiarColumnas(5);
    assert.equal(JSON.stringify(p.estado().configuracionTemporal), antes);
    assert.equal(p.estado().columnasActuales, 5);
    assert.equal(p.el.grid._vars["--columnas-simuladas"], "5");
});

test("el simulador manda aunque el viewport sea móvil", () => {
    const p = cargarPrototipo({ ancho: 380 });
    assert.equal(p.estado().columnasActuales, 1, "arranca en 1 columna en móvil");
    p.cambiarColumnas(4);
    assert.equal(p.estado().columnasActuales, 4);
    assert.equal(p.el.grid._vars["--columnas-simuladas"], "4");
});

/* --- 3. Sortable --- */

test("activar edición inicializa una única instancia de Sortable", () => {
    const p = cargarPrototipo();
    clic(p.el.btnAbrirCards);
    assert.equal(vivas(p.instancias).length, 1);
    assert.equal(p.estado().modoEdicion, true);
    assert.ok(vivas(p.instancias)[0].el === p.el.grid);
});

test("renderizar de nuevo no acumula instancias", () => {
    const p = cargarPrototipo();
    clic(p.el.btnAbrirCards);
    p.cambiarColumnas(3);
    p.cambiarColumnas(2);
    assert.equal(vivas(p.instancias).length, 1);
    assert.equal(p.instancias.length, 3, "las anteriores deben destruirse");
});

test("salir de edición destruye Sortable", () => {
    const p = cargarPrototipo();
    clic(p.el.btnAbrirCards);
    clic(p.el.btnListo);
    assert.equal(vivas(p.instancias).length, 0);
    assert.equal(p.estado().sortable, null);
    assert.equal(p.estado().modoEdicion, false);
});

test("Patrimonio es el único nodo fijo y no es arrastrable", () => {
    const p = cargarPrototipo();
    clic(p.el.btnAbrirCards);
    const cards = p.el.grid.children;
    const patrimonio = cards.find(c => c.dataset.dashboardCard === "patrimonio");
    const cuentas = cards.find(c => c.dataset.dashboardCard === "cuentas");
    assert.equal(patrimonio.draggable, false);
    assert.equal(cuentas.draggable, true);
});

test("reordenar actualiza el orden preferido y excluye Patrimonio", () => {
    const p = cargarPrototipo();
    clic(p.el.btnAbrirCards);
    const sortable = vivas(p.instancias)[0];
    // Simular que el DOM quedó con "cuentas" al final
    const cards = p.el.grid.children;
    const cuentas = cards.find(c => c.dataset.dashboardCard === "cuentas");
    p.el.grid.children = [...cards.filter(c => c !== cuentas), cuentas];
    sortable.opciones.onEnd({ item: cuentas });

    const orden = p.estado().configuracionTemporal.map(c => c.id);
    const visibles = p.estado().configuracionTemporal.filter(c => c.visible).map(c => c.id);
    assert.equal(orden[0], "patrimonio", "Patrimonio sigue primero");
    assert.equal(visibles.at(-1), "cuentas", "cuentas pasa al final del orden visible");
    assert.equal(orden.at(-1), "alertas", "las cards ocultas quedan al final del array");
    assert.equal(vivas(p.instancias).length, 1, "Sortable se recrea una sola vez");
});

test("reordenar y después cambiar el viewport conserva el nuevo orden", () => {    const p = cargarPrototipo();
    clic(p.el.btnAbrirCards);
    const sortable = vivas(p.instancias)[0];
    const cards = p.el.grid.children;
    const metas = cards.find(c => c.dataset.dashboardCard === "metas");
    p.el.grid.children = [metas, ...cards.filter(c => c !== metas)];
    sortable.opciones.onEnd({ item: metas });
    const ordenTrasArrastre = p.estado().configuracionTemporal.map(c => c.id);

    p.cambiarColumnas(2);
    p.cambiarColumnas(5);
    assert.deepEqual(p.estado().configuracionTemporal.map(c => c.id), ordenTrasArrastre);
});

/* --- 4. Flujo confirmar / cancelar / restaurar --- */

test("Listo confirma el orden arrastrado", () => {
    const p = cargarPrototipo();
    clic(p.el.btnAbrirCards);
    const sortable = vivas(p.instancias)[0];
    const cards = p.el.grid.children;
    const inversiones = cards.find(c => c.dataset.dashboardCard === "inversiones");
    p.el.grid.children = [...cards.filter(c => c !== inversiones), inversiones];
    sortable.opciones.onEnd({ item: inversiones });
    clic(p.el.btnListo);

    const visibles = p.estado().configuracionConfirmada.filter(c => c.visible).map(c => c.id);
    assert.equal(visibles.at(-1), "inversiones");
    assert.equal(p.estado().modoEdicion, false);
});

function botonDimension(editorLista, id, tipo, valor) {
    const fila = editorLista.children.find(f => f.dataset.card === id);
    const dims = fila.children.find(c => c.classList.contains("editor-dimensiones"));
    return dims.children.find(b => String(b.dataset[tipo]) === String(valor));
}

test("confirmar guarda la temporal en la confirmada", () => {
    const p = cargarPrototipo();
    clic(p.el.btnAbrirCards);
    clic(botonDimension(p.el.editorLista, "cuentas", "ancho", 2));

    assert.equal(p.estado().configuracionTemporal.find(c => c.id === "cuentas").ancho, 2);
    assert.equal(p.estado().configuracionConfirmada.find(c => c.id === "cuentas").ancho, 1);

    clic(p.el.btnGuardarModal);
    assert.equal(p.estado().configuracionConfirmada.find(c => c.id === "cuentas").ancho, 2);
    assert.deepEqual(
        p.estado().configuracionTemporal.map(c => ({ ...c })),
        p.estado().configuracionConfirmada.map(c => ({ ...c }))
    );
    assert.equal(p.el.modalOverlay.classList.contains("visible"), false);
});

test("cancelar descarta los cambios y respeta la confirmada", () => {
    const p = cargarPrototipo();
    clic(p.el.btnAbrirCards);
    clic(botonDimension(p.el.editorLista, "cuentas", "alto", 3));
    clic(p.el.btnCancelarModal);

    assert.equal(p.estado().configuracionTemporal.find(c => c.id === "cuentas").alto, 1);
    assert.equal(p.estado().configuracionConfirmada.find(c => c.id === "cuentas").alto, 1);
});

test("cancelar tras confirmar vuelve a lo último confirmado, no a lo inicial", () => {
    const p = cargarPrototipo();
    clic(p.el.btnAbrirCards);
    clic(botonDimension(p.el.editorLista, "cuentas", "ancho", 2));
    clic(p.el.btnGuardarModal);

    clic(p.el.btnAbrirCards);
    clic(botonDimension(p.el.editorLista, "inversiones", "alto", 2));
    clic(p.el.btnCancelarModal);

    assert.equal(p.estado().configuracionTemporal.find(c => c.id === "cuentas").ancho, 2);
    assert.equal(p.estado().configuracionTemporal.find(c => c.id === "inversiones").alto, 1);
    assert.equal(p.estado().configuracionConfirmada.find(c => c.id === "inversiones").alto, 1);
});

test("restaurar lleva la temporal a la configuración inicial sin tocar la confirmada", () => {
    const p = cargarPrototipo();
    clic(p.el.btnAbrirCards);
    clic(botonDimension(p.el.editorLista, "cuentas", "ancho", 2));
    clic(p.el.btnGuardarModal);

    clic(p.el.btnAbrirCards);
    clic(p.el.btnResetModal);
    assert.deepEqual(
        p.estado().configuracionTemporal.map(c => ({ ...c })),
        p.estado().configuracionInicial.map(c => ({ ...c }))
    );
    assert.equal(p.estado().configuracionConfirmada.find(c => c.id === "cuentas").ancho, 2);
});

test("restablecer global limpia temporal y confirmada", () => {
    const p = cargarPrototipo();
    clic(p.el.btnAbrirCards);
    clic(botonDimension(p.el.editorLista, "cuentas", "ancho", 2));
    clic(p.el.btnGuardarModal);
    clic(p.el.btnReset);
    assert.equal(p.estado().configuracionConfirmada.find(c => c.id === "cuentas").ancho, 1);
    assert.equal(p.estado().columnasActuales, 5);
});

/* --- 5. Renderizado sin innerHTML de datos --- */

test("el contenido de las cards se construye con nodos y textContent", () => {
    const p = cargarPrototipo();
    const card = p.el.grid.children.find(c => c.dataset.dashboardCard === "patrimonio");
    const contenido = card.children.find(c => c.classList.contains("card-contenido"));
    const titulo = contenido.children.find(c => c.classList.contains("card-titulo"));
    assert.equal(titulo.textContent, "Patrimonio total");
});

test("no queda innerHTML dinámico en el render de tarjetas", () => {
    const usos = [...FUENTE.matchAll(/\.innerHTML\s*=/g)].length;
    // Solo se admite el innerHTML estático de los iconos SVG (crearIconoSVG).
    assert.equal(usos, 1, `asignaciones innerHTML encontradas: ${usos}`);
    assert.ok(FUENTE.includes("crearIconoSVG"));
});
