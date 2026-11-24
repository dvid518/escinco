// Modal único de un favorito: Guardar (plantilla), Cancelar (descarta) y
// Ejecutar (movimiento con los valores actuales del formulario).
//
// Se extrae la función real de movimientos.js y se ejecuta con dobles mínimos
// de DOM y servicios, sin copiar su lógica.
import vm from "node:vm"
import { leer, extraerFuncion } from "./helpers.mjs"

const srcMov = leer("js/pages/movimientos.js")

function crearContexto(favorito = {}) {
    const favoritoBase = {
        id: "fav-1",
        nombre: "Café",
        tipo: "gasto",
        cuenta: "c1",
        monto: 10,
        divisa: "PEN",
        concepto: "Café",
        etiquetas: ["casa"],
        ...favorito
    }

    const campos = {
        "#editar-favorito-cuenta": { value: "c1", replaceChildren: () => {} },
        "#editar-favorito-nombre": { value: "" },
        "#editar-favorito-monto": { value: "" },
        "#editar-favorito-divisa": { value: "" },
        "#editar-favorito-concepto": { value: "" },
        "#editar-favorito-etiquetas": { value: "" }
    }

    const contenido = {
        querySelector: (sel) => campos[sel] || null
    }

    const llamadas = {
        editar: [],
        ejecutar: [],
        notificaciones: [],
        cerrado: false,
        cargado: false,
        modal: null
    }

    // Todos los elementos que crea la función (opciones de cuenta y el botón
    // Ejecutar). Se recogen para poder disparar el botón real.
    const creados = []

    const ctx = {
        console: { warn() {}, error() {}, info() {} },
        uid: "uid-1",
        favoritosCache: [favoritoBase],
        limpiarSeleccionFavoritos: () => {},
        contenidoDesdeTemplate: () => contenido,
        obtenerCuentas: async () => ([
            { id: "c1", nombre: "Caja", moneda: "PEN", estado: "activo" },
            { id: "c2", nombre: "Banco", moneda: "USD", estado: "activo" }
        ]),
        presentarDivisa: (m) => m,
        document: {
            createElement: (tag) => {
                const el = {
                    tag,
                    value: "",
                    textContent: "",
                    selected: false,
                    disabled: false,
                    listeners: {},
                    addEventListener(ev, fn) { this.listeners[ev] = fn }
                }
                creados.push(el)
                return el
            }
        },
        abrirModal: (opciones) => { llamadas.modal = opciones; return {} },
        renderFavoritos: async () => {},
        editarPlantillaFavorito: async (uid, fav, cambios) => {
            llamadas.editar.push({ uid, id: fav.id, cambios })
        },
        cacheCapa: { invalidarPrefijo: () => {} },
        mostrarNotificacion: (tipo, texto) => { llamadas.notificaciones.push({ tipo, texto }) },
        guardarInstanciaVinculada: async (uid, favoritoId, datos) => {
            llamadas.ejecutar.push({ uid, favoritoId, datos })
            return { id: "mov-1" }
        },
        getFechaHoy: () => "2026-11-22",
        cargarMovimientos: async () => { llamadas.cargado = true },
        cerrarModal: () => { llamadas.cerrado = true },
        Number, Object, String, Boolean, Array
    }

    vm.createContext(ctx)
    vm.runInContext(
        extraerFuncion(srcMov, "abrirModalFavorito").replace("export ", "") + ";",
        ctx
    )

    return { ctx, campos, llamadas, creados }
}

export default async function ejecutar(t) {
    // ------------------------------------------------------------------
    // A) El modal ofrece Guardar, Cancelar y Ejecutar
    // ------------------------------------------------------------------
    {
        const { ctx, llamadas, creados } = crearContexto()
        await ctx.abrirModalFavorito("fav-1")

        t.check("A1 el modal se titula con el favorito",
            llamadas.modal?.titulo === "Favorito: Café", llamadas.modal?.titulo)
        t.check("A2 confirmar dice Guardar",
            llamadas.modal?.confirmText === "Guardar", llamadas.modal?.confirmText)
        t.check("A3 existe el botón Cancelar (onCancel definido)",
            llamadas.modal?.cancelText === "Cancelar" && typeof llamadas.modal?.onCancel === "function")
        const boton = creados.find(el => el.tag === "button")
        t.check("A4 existe un botón Ejecutar en el pie",
            boton?.textContent === "Ejecutar" && llamadas.modal?.footerExtra === boton)
    }

    // ------------------------------------------------------------------
    // B) Guardar actualiza SOLO la plantilla, sin crear movimiento
    // ------------------------------------------------------------------
    {
        const { ctx, llamadas } = crearContexto()
        await ctx.abrirModalFavorito("fav-1")
        const resultado = await llamadas.modal.onConfirm()

        t.check("B1 Guardar actualiza la plantilla una vez",
            llamadas.editar.length === 1, String(llamadas.editar.length))
        t.check("B2 Guardar no registra ningún movimiento",
            llamadas.ejecutar.length === 0)
        t.check("B3 Guardar conserva los valores del formulario",
            llamadas.editar[0]?.cambios.nombre === "Café" &&
            llamadas.editar[0]?.cambios.monto === 10 &&
            llamadas.editar[0]?.cambios.cuenta === "c1",
            JSON.stringify(llamadas.editar[0]?.cambios))
        t.check("B4 Guardar cierra el modal al terminar", resultado === true)
    }

    // ------------------------------------------------------------------
    // C) Ejecutar crea un movimiento con los valores actuales del formulario
    // ------------------------------------------------------------------
    {
        const { ctx, llamadas, campos, creados } = crearContexto()
        await ctx.abrirModalFavorito("fav-1")

        // El usuario cambia el monto y el concepto antes de ejecutar.
        campos["#editar-favorito-monto"].value = "25"
        campos["#editar-favorito-concepto"].value = "Café doble"

        const boton = creados.find(el => el.tag === "button")
        await boton.listeners.click()

        const datos = llamadas.ejecutar[0]?.datos
        t.check("C1 Ejecutar crea el movimiento vinculado al favorito",
            llamadas.ejecutar.length === 1 && llamadas.ejecutar[0].favoritoId === "fav-1")
        t.check("C2 Ejecutar usa el monto actual del formulario, no el guardado",
            datos?.monto === 25, String(datos?.monto))
        t.check("C3 Ejecutar usa el concepto actual del formulario",
            datos?.concepto === "Café doble", String(datos?.concepto))
        t.check("C4 Ejecutar añade la fecha de hoy",
            datos?.fechaRealizacion === "2026-11-22", String(datos?.fechaRealizacion))
        t.check("C5 Ejecutar no guarda la plantilla",
            llamadas.editar.length === 0)
        t.check("C6 Ejecutar refresca la lista y cierra el modal",
            llamadas.cargado === true && llamadas.cerrado === true)
    }

    // ------------------------------------------------------------------
    // D) Si el concepto está vacío, se usa el nombre para no romper el alta
    // ------------------------------------------------------------------
    {
        const { ctx, llamadas, creados } = crearContexto({ concepto: "" })
        await ctx.abrirModalFavorito("fav-1")
        const boton = creados.find(el => el.tag === "button")
        await boton.listeners.click()
        t.check("D1 concepto vacío: se usa el nombre del favorito",
            llamadas.ejecutar[0]?.datos.concepto === "Café",
            String(llamadas.ejecutar[0]?.datos.concepto))
    }

    // ------------------------------------------------------------------
    // E) El clic simple abre el modal; el doble clic ya no existe
    // ------------------------------------------------------------------
    {
        t.check("E1 el clic simple de la tarjeta abre el modal",
            /await abrirModalFavorito\(id\)/.test(srcMov))
        t.check("E2 no queda el temporizador del doble clic",
            !/favoritoClickTimer/.test(srcMov))
        t.check("E3 la tarjeta no abre el formulario de movimiento",
            !/abrirFormularioConFavorito/.test(srcMov))
    }
}
