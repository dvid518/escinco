// Tests de la infraestructura global de animaciones (js/ui/animaciones.js).
// El módulo se ejecuta en vm con mocks de animate y matchMedia.
import vm from "node:vm"
import { leer } from "./helpers.mjs"

const src = leer("js/ui/animaciones.js")
const clean = src.replace(/^import .*$/gm, "").replace(/export /g, "")

export default async function ejecutar(t) {
    // ---------------------------------------------------------------
    // Entrada y salida
    // ---------------------------------------------------------------
    {
        const instancias = []
        function mockAnimate() {
            let resolver
            const instancia = {
                pause: () => { instancia.pausada = true },
                get finished() { return instancia._promesa },
            }
            instancia._promesa = new Promise(resolve => { resolver = resolve })
            instancia._resolver = resolver
            instancias.push(instancia)
            return instancia
        }
        const ctx = {
            Map, Set, Array, Object, Promise,
            animate: mockAnimate,
            matchMedia: () => ({ matches: false }),
            document: undefined,
            instancias,
        }
        vm.createContext(ctx)
        vm.runInContext(clean, ctx)

        const el = { style: {} }
        const promesa = ctx.animarEntrada(el, { duracion: 50 })
        t.check("entrada registra animación", ctx.estaAnimando(el) === true)
        t.check("se creó instancia", instancias.length === 1)
        t.check("devuelve promesa", promesa instanceof Promise === true)
        instancias[0]._resolver()
        await promesa
        t.check("se desregistra al finalizar", ctx.estaAnimando(el) === false)
    }

    // ---------------------------------------------------------------
    // Cancelación individual
    // ---------------------------------------------------------------
    {
        const instancias = []
        function mockAnimate() {
            let resolver
            const instancia = {
                pause: () => { instancia.pausada = true },
                get finished() { return instancia._promesa },
            }
            instancia._promesa = new Promise(resolve => { resolver = resolve })
            instancia._resolver = resolver
            instancias.push(instancia)
            return instancia
        }
        const ctx = {
            Map, Set, Array, Object, Promise,
            animate: mockAnimate,
            matchMedia: () => ({ matches: false }),
            document: undefined,
            instancias,
        }
        vm.createContext(ctx)
        vm.runInContext(clean, ctx)

        const el = { style: {} }
        ctx.animarEntrada(el, { duracion: 500 })
        t.check("está animando", ctx.estaAnimando(el) === true)
        ctx.cancelarAnimacion(el)
        t.check("tras cancelar individual", ctx.estaAnimando(el) === false)
        t.check("instancia pausada", instancias[0].pausada === true)
    }

    // ---------------------------------------------------------------
    // Cancelación por contexto
    // ---------------------------------------------------------------
    {
        const instancias = []
        function mockAnimate() {
            let resolver
            const instancia = {
                pause: () => { instancia.pausada = true },
                get finished() { return instancia._promesa },
            }
            instancia._promesa = new Promise(resolve => { resolver = resolve })
            instancia._resolver = resolver
            instancias.push(instancia)
            return instancia
        }
        const ctx = {
            Map, Set, Array, Object, Promise,
            animate: mockAnimate,
            matchMedia: () => ({ matches: false }),
            document: undefined,
            instancias,
        }
        vm.createContext(ctx)
        vm.runInContext(clean, ctx)

        const a = { style: {} }
        const b = { style: {} }
        const c = { style: {} }
        ctx.animarEntrada(a, { duracion: 500, contexto: "ctx1" })
        ctx.animarEntrada(b, { duracion: 500, contexto: "ctx1" })
        ctx.animarEntrada(c, { duracion: 500, contexto: "ctx2" })
        t.check("tres activas", ctx.estaAnimando(a) && ctx.estaAnimando(b) && ctx.estaAnimando(c))
        ctx.cancelarPorContexto("ctx1")
        t.check("ctx1 cancelada", ctx.estaAnimando(a) === false && ctx.estaAnimando(b) === false)
        t.check("ctx2 sigue activa", ctx.estaAnimando(c) === true)
    }

    // ---------------------------------------------------------------
    // Cancelación global
    // ---------------------------------------------------------------
    {
        const instancias = []
        function mockAnimate() {
            let resolver
            const instancia = {
                pause: () => { instancia.pausada = true },
                get finished() { return instancia._promesa },
            }
            instancia._promesa = new Promise(resolve => { resolver = resolve })
            instancia._resolver = resolver
            instancias.push(instancia)
            return instancia
        }
        const ctx = {
            Map, Set, Array, Object, Promise,
            animate: mockAnimate,
            matchMedia: () => ({ matches: false }),
            document: undefined,
            instancias,
        }
        vm.createContext(ctx)
        vm.runInContext(clean, ctx)

        const a = { style: {} }
        const b = { style: {} }
        ctx.animarEntrada(a, { duracion: 500 })
        ctx.animarSalida(b, { duracion: 500 })
        t.check("dos activas globales", ctx.estaAnimando(a) && ctx.estaAnimando(b))
        ctx.cancelarTodasLasAnimaciones()
        t.check("tras cancelar global", ctx.estaAnimando(a) === false && ctx.estaAnimando(b) === false)
    }

    // ---------------------------------------------------------------
    // prefers-reduced-motion
    // ---------------------------------------------------------------
    {
        const instancias = []
        function mockAnimate() {
            let resolver
            const instancia = {
                pause: () => { instancia.pausada = true },
                get finished() { return instancia._promesa },
            }
            instancia._promesa = new Promise(resolve => { resolver = resolve })
            instancia._resolver = resolver
            instancias.push(instancia)
            return instancia
        }
        const ctx = {
            Map, Set, Array, Object, Promise,
            animate: mockAnimate,
            matchMedia: () => ({ matches: true }),
            document: undefined,
            instancias,
        }
        vm.createContext(ctx)
        vm.runInContext(clean, ctx)

        const el = { style: {} }
        const antes = instancias.length
        const promesa = ctx.animarEntrada(el, { duracion: 50 })
        t.check("reducido: no crea animación", instancias.length === antes)
        t.check("reducido: no está animando", ctx.estaAnimando(el) === false)
        t.check("reducido: promesa resuelta", await promesa === undefined)
    }

    // ---------------------------------------------------------------
    // Sin animación previa
    // ---------------------------------------------------------------
    {
        const ctx = {
            Map, Set, Array, Object, Promise,
            animate: () => ({ finished: Promise.resolve(), pause: () => {} }),
            matchMedia: () => ({ matches: false }),
            document: undefined,
        }
        vm.createContext(ctx)
        vm.runInContext(clean, ctx)
        const el = { style: {} }
        t.check("sin animación previa", ctx.estaAnimando(el) === false)
    }
}
