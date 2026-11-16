// Migraciones M6-M8 sobre preferencias.dashboard y nombres de subcuentas.
//
// Funciones puras: reciben el estado, no lo mutan y devuelven la propuesta con
// la lista de cambios. No escriben Firestore (Node no puede cargar el SDK web);
// los scripts de scripts/migraciones/ solo serializan el resultado.

import {
    esAbstracta,
    esHija,
    familiaDe,
    nombrePorDefectoSubcuenta,
    normalizarNombre
} from "../../js/core/familiaCuentas.js"

export const PREFIJO_CARD_CUENTA = "cuenta:"
export const PREFIJO_CARD_ACTIVO = "activo:"

// Mismo catálogo que DASHBOARD_CARDS en js/pages/dashboard.js, sin
// "patrimonio" (se pinta siempre y no es personalizable).
// tests/migraciones-preferencias.test.mjs comprueba que no se desincronice.
export const CARDS_ESTANDAR = [
    "cuentas",
    "inversiones",
    "vencimientos",
    "movimientos",
    "favoritos",
    "metas",
    "presupuestos",
    "pendientes",
    "ordenes",
    "estrategias",
    "flujo-caja",
    "gastos-periodo",
    "ingresos-periodo",
    "balance-periodo",
    "deudas",
    "distribucion",
    "patrimonio-divisa",
    "programados",
    "alertas",
    "grafico"
]

const REGEX_INSTANCIA = /^(cuenta|activo):[A-Za-z0-9_-]{1,128}$/

export function esCardInstancia(id) {
    return typeof id === "string" && REGEX_INSTANCIA.test(id)
}

export function entidadDeInstancia(id) {
    const [tipo, entidadId] = String(id).split(":")
    return { tipo, entidadId }
}

export function idCardCuenta(cuentaId) {
    return PREFIJO_CARD_CUENTA + cuentaId
}

export function idCardActivo(activoId) {
    return PREFIJO_CARD_ACTIVO + activoId
}

export function clonarDashboard(dashboard) {
    const datos = dashboard || {}
    return {
        orden: Array.isArray(datos.orden) ? [...datos.orden] : [],
        cardsVisibles: Array.isArray(datos.cardsVisibles) ? [...datos.cardsVisibles] : [],
        dimensiones: datos.dimensiones && typeof datos.dimensiones === "object"
            ? { ...datos.dimensiones }
            : {}
    }
}

function mismasListas(a, b) {
    return a.length === b.length && a.every((valor, i) => valor === b[i])
}

// Sustituye `cardId` por `ids` en su posición. Si ya están todos los ids, la
// lista se devuelve igual: así el segundo pase de M6 no mueve nada. El Set final
// conserva la primera aparición, de modo que una hija que ya tenía card no se
// duplica ni se desplaza.
function expandirLista(lista, cardId, ids) {
    const indice = lista.indexOf(cardId)
    if (indice === -1) return lista
    if (ids.every(id => lista.includes(id))) return lista
    const expandida = [...lista]
    expandida.splice(indice, 1, ...ids)
    return [...new Set(expandida)]
}

function quitarDeLista(lista, cardId) {
    return lista.includes(cardId) ? lista.filter(id => id !== cardId) : lista
}

//----------------------------------------------------------------------------
// M6: card agregada de familia -> una card por cuenta
//----------------------------------------------------------------------------

/**
 * Convierte cada `cuenta:<padre>` que hoy representa a toda la familia en una
 * card por miembro: el padre (si no es abstracto) y sus hijas no archivadas.
 * El grupo ocupa la posición que tenía el padre y ningún saldo deja de verse.
 *
 * @param {Object} dashboard - { orden, cardsVisibles, dimensiones }
 * @param {Array} cuentas - Cuentas del usuario
 * @returns {{ dashboard: Object, cambios: Array }}
 */
export function migrarPreferenciasM6(dashboard, cuentas = []) {
    const original = clonarDashboard(dashboard)
    const propuesto = clonarDashboard(dashboard)
    const cambios = []
    const porId = new Map(cuentas.map(cuenta => [cuenta.id, cuenta]))
    const procesadas = new Set()

    for (const cardId of [...original.orden, ...original.cardsVisibles]) {
        if (!cardId?.startsWith(PREFIJO_CARD_CUENTA) || procesadas.has(cardId)) continue
        procesadas.add(cardId)

        const cuenta = porId.get(cardId.slice(PREFIJO_CARD_CUENTA.length))
        // Una hija ya es una instancia individual; una cuenta sin familia no
        // cambia de significado.
        if (!cuenta || esHija(cuenta)) continue

        const miembros = familiaDe(cuenta, cuentas)
        const abstracta = esAbstracta(cuenta)
        // Un padre normal sin hijas no cambia de significado. Uno abstracto sí:
        // el padre no es instancia, así que su card debe salir aunque solo tenga
        // una hija (o ninguna, en cuyo caso no queda nada que mostrar).
        if (!abstracta && miembros.length < 2) continue

        const ids = miembros.map(miembro => idCardCuenta(miembro.id))
        const antesOrden = propuesto.orden
        const antesVisibles = propuesto.cardsVisibles
        if (ids.length === 0) {
            propuesto.orden = quitarDeLista(antesOrden, cardId)
            propuesto.cardsVisibles = quitarDeLista(antesVisibles, cardId)
        } else {
            propuesto.orden = expandirLista(antesOrden, cardId, ids)
            propuesto.cardsVisibles = expandirLista(antesVisibles, cardId, ids)
        }

        const listas = []
        if (!mismasListas(antesOrden, propuesto.orden)) listas.push("orden")
        if (!mismasListas(antesVisibles, propuesto.cardsVisibles)) listas.push("cardsVisibles")
        if (listas.length === 0) continue

        cambios.push({
            tipo: ids.length === 0 ? "familia_sin_instancias" : "familia_expandida",
            cardId,
            listas,
            antes: miembros.length > 0
                ? miembros.map(miembro => miembro.nombre || miembro.id)
                : [cuenta.nombre || cuenta.id],
            despues: ids,
            motivo: ids.length === 0
                ? `"${cuenta.nombre}" es abstracta y no tiene subcuentas: su card no representa ninguna cuenta`
                : abstracta
                    ? `"${cuenta.nombre}" es abstracta: su card agregada se sustituye por sus subcuentas`
                    : `"${cuenta.nombre}" pasa a cuentas independientes: su saldo propio y sus subcuentas`
        })
    }

    // Las instancias son 1×1 y no redimensionables. Las dimensiones de una card
    // que dejó de existir (padre abstracto) se retiran y se reportan.
    for (const [cardId, valor] of Object.entries(original.dimensiones)) {
        if (!esCardInstancia(cardId)) continue
        const sigueExistiendo = propuesto.orden.includes(cardId) || propuesto.cardsVisibles.includes(cardId)
        if (!sigueExistiendo) {
            delete propuesto.dimensiones[cardId]
            cambios.push({
                tipo: "dimension_eliminada",
                cardId,
                antes: valor,
                motivo: "la card ya no existe tras la migración; las instancias son 1×1"
            })
            continue
        }
        if (Number(valor?.columnas) !== 1 || Number(valor?.filas) !== 1) {
            propuesto.dimensiones[cardId] = { columnas: 1, filas: 1 }
            cambios.push({
                tipo: "dimension_ajustada",
                cardId,
                antes: valor,
                despues: { columnas: 1, filas: 1 },
                motivo: "las cards de cuenta/activo son 1×1"
            })
        }
    }

    return { dashboard: propuesto, cambios }
}

//----------------------------------------------------------------------------
// M7: coherencia de orden, visibilidad y dimensiones
//----------------------------------------------------------------------------

/**
 * Deja las preferencias coherentes con los datos actuales: quita ids
 * huérfanos y duplicados, completa el orden con el catálogo (lo hace también
 * la app al leer) y fuerza 1×1 en las instancias. No toca el tamaño de las
 * cards estándar.
 *
 * @param {Object} dashboard - { orden, cardsVisibles, dimensiones }
 * @param {Array} cuentas - Cuentas del usuario
 * @param {Array} activos - Activos del usuario (con id)
 * @returns {{ dashboard: Object, cambios: Array }}
 */
export function migrarPreferenciasM7(dashboard, cuentas = [], activos = []) {
    const original = clonarDashboard(dashboard)
    const cambios = []
    const idsCuenta = new Set(cuentas.map(cuenta => cuenta.id))
    const idsActivo = new Set(activos.map(activo => activo.id))

    const existe = id => {
        if (!esCardInstancia(id)) return CARDS_ESTANDAR.includes(id)
        const { tipo, entidadId } = entidadDeInstancia(id)
        return tipo === "cuenta" ? idsCuenta.has(entidadId) : idsActivo.has(entidadId)
    }

    const reportados = new Set()
    const reportarHuerfano = (cardId, lista) => {
        if (reportados.has(cardId)) return
        reportados.add(cardId)
        cambios.push({
            tipo: "card_huerfana",
            cardId,
            lista,
            motivo: "la cuenta o el activo al que apunta ya no existe"
        })
    }

    const orden = []
    const enOrden = new Set()
    for (const cardId of original.orden) {
        if (typeof cardId !== "string" || cardId === "") {
            cambios.push({ tipo: "orden_invalido", antes: cardId, motivo: "entrada no válida en orden" })
            continue
        }
        if (enOrden.has(cardId)) {
            cambios.push({ tipo: "orden_duplicado", cardId, motivo: "id repetido en orden" })
            continue
        }
        if (!existe(cardId)) {
            reportarHuerfano(cardId, "orden")
            continue
        }
        orden.push(cardId)
        enOrden.add(cardId)
    }
    for (const cardId of CARDS_ESTANDAR) {
        if (enOrden.has(cardId)) continue
        orden.push(cardId)
        enOrden.add(cardId)
        cambios.push({
            tipo: "orden_completado",
            cardId,
            motivo: "card del catálogo ausente del orden; se añade al final"
        })
    }

    const cardsVisibles = []
    const enVisibles = new Set()
    for (const cardId of original.cardsVisibles) {
        if (cardId === "patrimonio") {
            cambios.push({
                tipo: "card_no_personalizable",
                cardId,
                lista: "cardsVisibles",
                motivo: "patrimonio se pinta siempre y no se guarda como card visible"
            })
            continue
        }
        if (enVisibles.has(cardId)) {
            cambios.push({ tipo: "visible_duplicada", cardId, motivo: "id repetido en cardsVisibles" })
            continue
        }
        if (!existe(cardId)) {
            reportarHuerfano(cardId, "cardsVisibles")
            continue
        }
        if (!enOrden.has(cardId)) {
            cambios.push({
                tipo: "visible_sin_orden",
                cardId,
                motivo: "la card no estaba en el orden; se descarta de visibles"
            })
            continue
        }
        cardsVisibles.push(cardId)
        enVisibles.add(cardId)
    }

    const dimensiones = {}
    for (const [cardId, valor] of Object.entries(original.dimensiones)) {
        if (!existe(cardId)) {
            cambios.push({
                tipo: "dimension_huerfana",
                cardId,
                antes: valor,
                motivo: "la card ya no existe"
            })
            continue
        }
        if (!esCardInstancia(cardId)) {
            // Las cards estándar conservan el tamaño que eligió el usuario.
            dimensiones[cardId] = valor
            continue
        }
        if (Number(valor?.columnas) === 1 && Number(valor?.filas) === 1) {
            dimensiones[cardId] = valor
            continue
        }
        dimensiones[cardId] = { columnas: 1, filas: 1 }
        cambios.push({
            tipo: "dimension_ajustada",
            cardId,
            antes: valor,
            despues: { columnas: 1, filas: 1 },
            motivo: "las cards de cuenta/activo son 1×1"
        })
    }

    return { dashboard: { orden, cardsVisibles, dimensiones }, cambios }
}

//----------------------------------------------------------------------------
// M8: nombres automáticos de subcuentas
//----------------------------------------------------------------------------

/**
 * Las subcuentas automáticas no deben guardar `nombre`: el contrato
 * (resolverNombresCuentas) deriva el texto de padre + divisa y considera
 * personalizada cualquier hija con `nombre` guardado. Por eso M8 propone
 * borrar el campo en las automáticas, no reescribirlo. Las personalizadas
 * (`tieneNombrePropio: true`) no se tocan.
 *
 * @param {Array} cuentas - Cuentas del usuario
 * @param {Object} opciones - { formato: "simbolo" | "codigo" }
 * @returns {{ cambios: Array, cuentas_propuestas: Array, conservados: Array }}
 */
export function migrarNombresM8(cuentas = [], { formato = "simbolo" } = {}) {
    const porId = new Map(cuentas.map(cuenta => [cuenta.id, cuenta]))
    const cambios = []
    const cuentasPropuestas = []
    const conservados = []

    for (const cuenta of cuentas) {
        if (!esHija(cuenta)) continue

        // Solo se toca lo que el dato marca explícitamente como automático. Un
        // nombre con el flag ausente se conserva: el contrato lo considera
        // personalizado al leer y borrarlo destruiría una elección del usuario.
        if (cuenta.tieneNombrePropio !== false) {
            conservados.push({ cuentaId: cuenta.id, nombre: cuenta.nombre || null })
            continue
        }

        const nombreActual = String(cuenta.nombre || "").trim()
        if (!nombreActual) continue

        const padre = porId.get(cuenta.padreId)
        const base = normalizarNombre(padre?.nombre) || nombreActual
        const nombreDerivado = nombrePorDefectoSubcuenta(base, cuenta.moneda, formato)

        cambios.push({
            tipo: "nombre_automatico",
            cuentaId: cuenta.id,
            accion: "borrar_nombre",
            nombreActual,
            nombreDerivado,
            motivo: "subcuenta automática: el nombre se deriva de padre + divisa y el campo guardado lo petrifica"
        })
        cuentasPropuestas.push({
            id: cuenta.id,
            eliminar: ["nombre"],
            nombre_derivado: nombreDerivado
        })
    }

    return { cambios, cuentas_propuestas: cuentasPropuestas, conservados }
}

//----------------------------------------------------------------------------
// Argumentos y lectura de propuestas
//----------------------------------------------------------------------------

export function argumentosMigracion(argv = process.argv.slice(2)) {
    const valor = prefijo => argv.find(arg => arg.startsWith(prefijo))?.slice(prefijo.length) || null
    return {
        dryRun: argv.includes("--dry-run"),
        uid: valor("--uid="),
        backupPath: valor("--backup="),
        desde: valor("--desde="),
        formato: valor("--formato=") || "simbolo"
    }
}

export function resumenCambios(cambios) {
    const resumen = {}
    for (const cambio of cambios) resumen[cambio.tipo] = (resumen[cambio.tipo] || 0) + 1
    return resumen
}
