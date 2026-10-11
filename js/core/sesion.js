// ============================================
// PREFERENCIAS · DEFAULTS Y FUSION
// ============================================
// Los defaults viven aqui y en ningun otro sitio. El documento de Firestore
// guarda SOLO lo que el usuario cambia de verdad: un usuario recien creado no
// tiene nada escrito, y volver a marcar un default borra la clave en vez de
// guardar el valor por escrito.
//
// Eso obliga a que la lectura complete siempre los huecos, y por eso la
// fusion es en profundidad: un grupo guardado parcialmente (por ejemplo
// `accesibilidad` con una sola clave) no puede reemplazar al grupo entero, o se
// perderian los defaults que no esten guardados.

export const PREFERENCIAS_POR_DEFECTO = Object.freeze({
    tema: "dark",
    divisaPrincipal: "pen",
    paginas: Object.freeze({
        dashboard: true,
        cuentas: true,
        movimientos: true,
        inversiones: true,
        trading: true,
        configuracion: true
    }),
    seg: Object.freeze({
        inactividadMinutos: 15,
        cerrarAlCerrarPestana: true
    }),
    accesibilidad: Object.freeze({
        modalesPersistentes: false,
        doodles: false,
        unClickSeleccion: false,
        lateralidadCuentaInfo: "derecha",
        resaltarIngresoGasto: true,
        // true = Panel (ajustes dentro del #panel, ruta propia). Es lo predeterminado.
// false = Modal (ventana grande sobre la página actual).
        configComoPagina: true
    }),
    tiposMovimiento: Object.freeze({
        cambioDivisa: true,
        compraActivo: false,
        ventaActivo: false,
        pagoTarjeta: false,
        p2pCompra: true,
        p2pVenta: true,
        trade: true
    }),
    movimientosRecientes: 5,
    periodoEvolucion: "30d",
    resaltarPatrimonio: 0,
    formatoDivisa: "simbolo",
    precios: Object.freeze({
        autoActualizar: false
    })
})

export function esObjetoPlano(valor) {
    return !!valor && typeof valor === "object" && !Array.isArray(valor)
}

/**
 * Fusiona `encima` sobre `base` entrando un nivel en los objetos. Los valores
 * de `encima` que no existen en `base` se anaden tal cual, para que las claves
 * antiguas o futuras no se pierdan al normalizar.
 */
export function fusionarProfundo(base, encima) {
    if (!esObjetoPlano(encima)) return esObjetoPlano(base) ? { ...base } : base
    const salida = esObjetoPlano(base) ? { ...base } : {}
    for (const [clave, valor] of Object.entries(encima)) {
        const actual = salida[clave]
        if (esObjetoPlano(actual) && esObjetoPlano(valor)) {
            salida[clave] = fusionarProfundo(actual, valor)
        } else if (esObjetoPlano(valor)) {
            // Grupo nuevo: se clona en profundidad. Si se asignara por
            // referencia, `sesion.preferencias` apuntaria a los defaults
            // CONGELADOS y cualquier mutacion lanzaria en modo estricto.
            salida[clave] = fusionarProfundo({}, valor)
        } else {
            salida[clave] = valor
        }
    }
    return salida
}

// Copia profunda a partir de los defaults congelados.
function defaultsClonados() {
    return fusionarProfundo({}, PREFERENCIAS_POR_DEFECTO)
}

class Sesion {
    constructor() {
        this.usuario = null
        this.cache = new Map()
        this.preferencias = defaultsClonados()
        // Intentar cargar preferencias guardadas al instanciar
        this.recargarPreferencias()
    }

    // ============================================
    // USUARIO
    // ============================================

    setUsuario(usuario) {
        this.usuario = usuario
        try {
            sessionStorage.setItem('escinco_usuario', JSON.stringify(usuario))
        } catch (e) {
            // Ignorar errores de storage
        }
    }

    getUsuario() {
        if (!this.usuario) {
            try {
                const saved = sessionStorage.getItem('escinco_usuario')
                if (saved) {
                    this.usuario = JSON.parse(saved)
                }
            } catch (e) {
                // Ignorar errores de storage
            }
        }
        return this.usuario
    }

    get uid() {
        return this.usuario?.uid || null
    }

    get nombre() {
        return this.usuario?.nombre || null
    }

    // ============================================
    // PREFERENCIAS
    // ============================================

    setPreferencias(preferencias) {
        if (preferencias?.paginas) {
            this.preferencias.paginas = {
                ...this.preferencias.paginas,
                ...preferencias.paginas
            }
        }
        if (preferencias?.divisaPrincipal) {
            this.preferencias.divisaPrincipal = preferencias.divisaPrincipal
        }
        if (preferencias?.tipoCambio) {
            this.preferencias.tipoCambio = preferencias.tipoCambio
        }
        if (preferencias?.tema) {
            this.preferencias.tema = preferencias.tema
        }
        if (preferencias?.seg) {
            this.preferencias.seg = {
                ...this.preferencias.seg,
                ...preferencias.seg
            }
        }
        if (preferencias?.accesibilidad) {
            this.preferencias.accesibilidad = {
                ...this.preferencias.accesibilidad,
                ...preferencias.accesibilidad
            }
        }
        if (preferencias?.tiposMovimiento) {
            this.preferencias.tiposMovimiento = {
                ...this.preferencias.tiposMovimiento,
                ...preferencias.tiposMovimiento
            }
        }
        if (preferencias?.movimientosRecientes !== undefined) {
            this.preferencias.movimientosRecientes = preferencias.movimientosRecientes
        }
        if (preferencias?.periodoEvolucion) {
            this.preferencias.periodoEvolucion = preferencias.periodoEvolucion
        }
        if (preferencias?.resaltarPatrimonio !== undefined) {
            this.preferencias.resaltarPatrimonio = Number(preferencias.resaltarPatrimonio) || 0
        }
        if (preferencias?.formatoDivisa) {
            this.preferencias.formatoDivisa = preferencias.formatoDivisa
        }
        if (preferencias?.dashboard) {
            this.preferencias.dashboard = {
                ...this.preferencias.dashboard,
                ...preferencias.dashboard
            }
        }
        try {
            sessionStorage.setItem('escinco_preferencias', JSON.stringify(this.preferencias))
        } catch (e) {}
    }

    getPreferencias() {
        try {
            const saved = sessionStorage.getItem('escinco_preferencias')
            if (saved) {
                // Fusion en profundidad: lo guardado puede ser parcial (solo
                // los cambios) y no debe pisar los defaults que faltan.
                this.preferencias = fusionarProfundo(this.preferencias, JSON.parse(saved))
            }
        } catch (e) {}
        return this.preferencias
    }

    recargarPreferencias() {
        try {
            const saved = sessionStorage.getItem('escinco_preferencias')
            if (saved) {
                this.preferencias = fusionarProfundo(this.preferencias, JSON.parse(saved))
                return true
            }
        } catch (e) {
            // Ignorar errores de storage
        }
        return false
    }

    getPaginasVisibles() {
        const prefs = this.getPreferencias()
        return prefs.paginas || {}
    }

    isPaginaVisible(page) {
        const paginas = this.getPaginasVisibles()
        return paginas[page] !== false
    }

    // ============================================
    // CACHE
    // ============================================

    setCache(key, data, maxAge = 30000) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            maxAge
        })
    }

    getCache(key) {
        const cached = this.cache.get(key)
        if (!cached) return null
        if (Date.now() - cached.timestamp > cached.maxAge) {
            this.cache.delete(key)
            return null
        }
        return cached.data
    }

    clearCache() {
        this.cache.clear()
    }

    // ============================================
    // LIMPIEZA
    // ============================================

    limpiar() {
        this.usuario = null
        this.cache.clear()
        this.preferencias = {
            paginas: {
                dashboard: true,
                cuentas: true,
                movimientos: true,
                inversiones: true,
                trading: true,
                configuracion: true
            },
            seg: {
                inactividadMinutos: 15,
                cerrarAlCerrarPestana: true
            },
            accesibilidad: {
                modalesPersistentes: false,
                doodles: false,
                unClickSeleccion: false,
                lateralidadCuentaInfo: "derecha",
                resaltarIngresoGasto: true
            },
            tiposMovimiento: {
                cambioDivisa: true,
                compraActivo: false,
                ventaActivo: false,
                pagoTarjeta: false,
                p2pCompra: true,
                p2pVenta: true,
                trade: true
            },
            movimientosRecientes: 5,
            periodoEvolucion: "30d",
            resaltarPatrimonio: 0,
            formatoDivisa: "simbolo"
        }
        try {
            sessionStorage.removeItem('escinco_usuario')
            sessionStorage.removeItem('escinco_preferencias')
        } catch (e) {
            // Ignorar errores de storage
        }
    }
}

export const sesion = new Sesion()