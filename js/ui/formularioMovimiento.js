import { CONFIG_MOVIMIENTOS, TIPOS_MOVIMIENTO } from "../../constants/tiposMovimiento.js"
import { obtenerCuentas } from "../../firebase/firestore.js"
import { cuentasOperables } from "../core/familiaCuentas.js"
import { obtenerActivos } from "../repositories/ActivoRepositorio.js"
import { sesion } from "../core/sesion.js"
import { getFechaHoy } from "../core/fechas.js"
import { mostrarNotificacion } from "./notificaciones.js"
import { etiquetaDivisa, formatearMontoConDivisa, getDivisaPrincipal } from "../services/DivisaServicio.js"
import { MAX_LARGO_NOMBRE_FAVORITO } from "../services/FavoritoServicio.js"
import { contenidoDesdeTemplate, contenidoDesdeFilas } from "./modal.js"

// Activos del usuario cargados al abrir el formulario, indexados por símbolo
// en mayúsculas. La página no mantiene el modelo a mano: se rellena cada vez.
let activosPorSimbolo = new Map()

// ============================================
// GENERAR FORMULARIO SEGÚN TIPO
// ============================================

/**
 * Genera el <form> del tipo pedido como fragmento, listo para
 * `abrirModal({ contenido })`. Los campos se clonan de los <template> de
 * dashboard.html y sus textos van por textContent: el nombre de una cuenta o de
 * un activo nunca pasa por innerHTML.
 */
export async function generarFormularioMovimiento(tipo, divisaPreseleccionada = null, opciones = {}) {
    const uid = sesion.uid
    const config = CONFIG_MOVIMIENTOS[tipo]
    const cuentas = await obtenerCuentas(uid)

    // Un padre abstracto no es operable: se ofrecen sus hijas.
    const cuentasActivas = cuentasOperables(cuentas).filter(c => c.estado !== "archivada")

    // Al crear un movimiento con divisa predefinida (p. ej. al consolidar un
    // pendiente), solo se ofrecen cuentas de esa divisa que puedan aportar
    // directamente. Sin divisa predefinida se muestran todas las activas.
    const divisaObjetivo = divisaPreseleccionada ? String(divisaPreseleccionada).toLowerCase() : null
    const comparteDivisa = c => (c.moneda || "pen").toLowerCase() === divisaObjetivo

    // Una tarjeta de crédito no tiene saldo que mover: su deuda vive en el
    // campo `deuda`, no en `saldoInicial`. Ofrecérsela en un select de cuenta
    // que mueve saldos produce un `saldoInicial` basura (BUG-028).
    //
    //   · pagoTarjeta  → el origen es una cuenta con saldo; la tarjeta va en
    //     su propio select (`tarjeta`).
    //   · transferencia → origen y destino son cuentas con saldo. La deuda de
    //     una tarjeta se mueve con `pagoTarjeta` o con `gasto`.
    //   · resto        → solo se excluyen cuando hay divisa predefinida, que es
    //     el caso del consolidado de un pendiente (una compra con tarjeta es
    //     legítima: aumenta su deuda en vez de bajar su saldo).
    const esPagoTarjeta = tipo === TIPOS_MOVIMIENTO.PAGO_TARJETA
    const esTransferencia = tipo === TIPOS_MOVIMIENTO.TRANSFERENCIA
    const excluyeCredito = esPagoTarjeta || esTransferencia || !!divisaObjetivo

    const cuentasElegibles = excluyeCredito
        ? cuentasActivas.filter(c => c.tipo !== "credito" && (!divisaObjetivo || comparteDivisa(c)))
        : cuentasActivas

    // `contenidoDesdeFilas` devuelve UN único DocumentFragment, y `appendChild`
    // MUEVE nodos: si dos campos comparten ese fragmento (transferencia usa
    // cuentaOrigen + cuentaDestino), el primero se lo queda y el segundo recibe
    // un <select> vacío. Por eso las opciones se fabrican con una función y cada
    // select recibe su propia copia.
    const opcionesCuentas = () => contenidoDesdeFilas("tpl-opcion-cuenta", cuentasElegibles, c => ({
        valores: {
            "texto@value": c.id,
            "texto@data-moneda": (c.moneda || "pen").toLowerCase(),
            "texto@data-tipo": c.tipo || "otro",
            texto: `${c.nombre} (${etiquetaDivisa(c.moneda || "pen")})`
        }
    }))

    // Las tarjetas solo se filtran por divisa (siguen disponibles para pagar
    // el saldo de una tarjeta concreta de la misma moneda).
    const opcionesTarjetas = () => contenidoDesdeFilas(
        "tpl-opcion-cuenta",
        divisaObjetivo
            ? cuentasActivas.filter(c => c.tipo === "credito" && comparteDivisa(c))
            : cuentasActivas.filter(c => c.tipo === "credito"),
        c => ({
            valores: {
                "texto@value": c.id,
                "texto@data-moneda": (c.moneda || "pen").toLowerCase(),
                "texto@data-tipo": "credito",
                texto: `${c.nombre} (deuda: ${formatearMontoConDivisa(c.deuda || 0, c.moneda || "pen")})`
            }
        })
    )

    const contexto = {
        // Se pasan por parámetro para que cada select reciba una copia propia.
        nuevoCuentasOptions: opcionesCuentas,
        nuevoTarjetasOptions: opcionesTarjetas,

        hoy: getFechaHoy()
    }

    const obligatorios = config.camposObligatorios || []
    const opcionales = config.camposOpcionales || []
    const campos = [...new Set([...obligatorios, ...opcionales])]

    // El selector de activo ofrece en un datalist los símbolos que ya existen,
    // mostrando su nombre como descripción.
    if (campos.includes("activo")) {
        contexto.activosDatalist = await cargarActivosDatalist(uid)
    }

    const contenido = contenidoDesdeTemplate("tpl-form-movimiento")
    const form = contenido.querySelector("#form-movimiento")
    const etiquetas = form.querySelector("[data-tpl='etiquetas']")

    for (const campo of campos) {
        const nodo = generarCampo(campo, contexto, !obligatorios.includes(campo))
        if (nodo) form.insertBefore(nodo, etiquetas)
    }

    // Campo propio de la plantilla de favorito (id `campo-favoritoNombre`): va
    // arriba del todo porque es lo que identifica el favorito en la tira. Solo
    // se añade cuando quien lo pide va a editar la plantilla, no al registrar
    // un movimiento normal.
    if (opciones.nombreFavorito) {
        const nombre = campoTexto(
            "favoritoNombre",
            "Nombre del favorito",
            "Ej.: Arriendo",
            true,
            " span-full"
        )
        const campo = nombre.querySelector("#campo-favoritoNombre")
        if (campo) campo.maxLength = MAX_LARGO_NOMBRE_FAVORITO
        form.insertBefore(nombre, form.firstChild)
    }

    return contenido
}

/**
 * Carga los activos del usuario y devuelve los <option> del datalist como
 * fragmento. Deja también el índice símbolo→nombre en `activosPorSimbolo` para
 * el nombre bloqueado.
 */
async function cargarActivosDatalist(uid) {
    try {
        const activos = await obtenerActivos(uid)
        activosPorSimbolo = new Map()
        activos.forEach(activo => {
            const simbolo = (activo.simbolo || "").toUpperCase()
            if (!simbolo) return
            activosPorSimbolo.set(simbolo, activo.nombre || activo.simbolo)
        })
        return contenidoDesdeFilas("tpl-opcion-activo", [...activosPorSimbolo.entries()], ([simbolo, nombre]) => ({
            valores: { "opcion@value": simbolo, "opcion@label": nombre }
        }))
    } catch (error) {
        console.warn("No se pudieron cargar los activos para el selector:", error)
        activosPorSimbolo = new Map()
        return null
    }
}

// ============================================
// ETIQUETAS
// ============================================
// La normalización vive en core/etiquetas.js (también la usa el selector de
// chips); se re-exporta para no romper a quien ya la importaba de aquí.
import { normalizarEtiquetas, MAX_ETIQUETAS } from "../core/etiquetas.js"
export { normalizarEtiquetas, MAX_ETIQUETAS, MAX_LARGO_ETIQUETA } from "../core/etiquetas.js"

// ============================================
// GENERADOR DE CAMPO
// ============================================

const CAMPOS_ANCHO_COMPLETO = [
    "cuenta",
    "cuentaOrigen",
    "cuentaDestino",
    "tarjeta",
    "activo",
    "concepto",
    "tasa",
    "exchange",
    "nombreVendedor",
    "nombreComprador",
    "cuentaPago",
    "cuentaCobro",
    "comision",
    "fechaRealizacion"
]

function claseAncho(campo) {
    return CAMPOS_ANCHO_COMPLETO.includes(campo) ? " span-full" : ""
}

// Generador de campos: reemplaza el switch de generarCampo por templates.
function plantillaSelectBuscable({ id, etiqueta, opciones, req, placeholderSelect, placeholderBuscar }) {
    const contenido = contenidoDesdeTemplate("tpl-campo-select-buscable", {
        valores: {
            "etiqueta@for": id,
            etiqueta,
            "buscador@data-select": id,
            "select@id": id,
            "select@required": req,
            placeholder: placeholderSelect
        }
    })
    // Las <option> van dentro del <select>, que no admite otro elemento.
    const buscador = contenido.querySelector("[data-tpl='buscador']")
    buscador.placeholder = placeholderBuscar
    const select = contenido.querySelector("[data-tpl='select']")
    if (opciones) select.appendChild(opciones)
    return contenido
}

function generarCampo(campo, contexto, opcional) {
    const { nuevoCuentasOptions, nuevoTarjetasOptions, activosDatalist, hoy } = contexto
    const req = !opcional

    // Cada selector de cuenta pide sus propias <option>: `appendChild` las
    // movería al <select> anterior y dejaría este vacío (ver generarFormularioMovimiento).
    const opcionesCuentas = () => nuevoCuentasOptions()
    const opcionesTarjetas = () => nuevoTarjetasOptions()

    // Un solo <div class="form-group"> con el ancho que le toca al campo.
    const grupo = (extra = "") => `form-group${extra ? ` ${extra}` : ""}`

    switch (campo) {
        case "cuenta":
            return plantillaSelectBuscable({
                id: "campo-cuenta",
                etiqueta: "Cuenta",
                opciones: opcionesCuentas(),
                req,
                placeholderSelect: "Seleccionar cuenta",
                placeholderBuscar: "Buscar cuenta..."
            })
        case "cuentaOrigen":
            return plantillaSelectBuscable({
                id: "campo-cuentaOrigen",
                etiqueta: "Cuenta origen",
                opciones: opcionesCuentas(),
                req,
                placeholderSelect: "Seleccionar cuenta",
                placeholderBuscar: "Buscar cuenta..."
            })
        case "cuentaDestino":
            return plantillaSelectBuscable({
                id: "campo-cuentaDestino",
                etiqueta: "Cuenta destino",
                opciones: opcionesCuentas(),
                req,
                placeholderSelect: "Seleccionar cuenta",
                placeholderBuscar: "Buscar cuenta..."
            })
        case "tarjeta":
            return plantillaSelectBuscable({
                id: "campo-tarjeta",
                etiqueta: "Tarjeta de crédito",
                opciones: opcionesTarjetas(),
                req,
                placeholderSelect: "Seleccionar tarjeta",
                placeholderBuscar: "Buscar tarjeta..."
            })
        case "activo": {
            const contenido = contenidoDesdeTemplate("tpl-campo-activo", {
                valores: { "grupo@class": grupo(claseAncho(campo)), requerido: req },
                html: { activos: activosDatalist || "" }
            })
            return contenido
        }
        case "concepto":
            return contenidoDesdeTemplate("tpl-campo-texto", {
                valores: {
                    "grupo@class": grupo(claseAncho(campo)),
                    "etiqueta@for": "campo-concepto",
                    etiqueta: "Concepto",
                    "campo@id": "campo-concepto",
                    "campo@placeholder": "Descripción",
                    "campo@required": req
                }
            })
        case "monto":
            return contenidoDesdeTemplate("tpl-campo-monto", {
                valores: {
                    "grupo@class": grupo(claseAncho(campo)),
                    "etiqueta@for": "campo-monto",
                    "titulo": "Monto",
                    "simbolo@id": "simbolo-monto",
                    "campo@id": "campo-monto",
                    "campo@required": req
                }
            })
        case "operacion":
            return campoSelectOperacion(grupo(claseAncho(campo)), req)
        case "montoOrigen":
            return contenidoDesdeTemplate("tpl-campo-monto", {
                valores: {
                    "grupo@class": grupo(claseAncho(campo)),
                    "etiqueta@for": "campo-montoOrigen",
                    "titulo": "Monto origen",
                    "simbolo@id": "simbolo-montoOrigen",
                    "campo@id": "campo-montoOrigen",
                    "campo@required": req
                }
            })
        case "montoDestino":
            return contenidoDesdeTemplate("tpl-campo-monto", {
                valores: {
                    "grupo@class": grupo(claseAncho(campo)),
                    "etiqueta@for": "campo-montoDestino",
                    "titulo": "Monto destino",
                    "simbolo@id": "simbolo-montoDestino",
                    "campo@id": "campo-montoDestino",
                    "campo@required": req
                }
            })
        case "cantidad":
            return campoNumero("cantidad", "Cantidad", "0.0001", "0.0001", "0", req, claseAncho(campo))
        case "precio":
            return campoNumero("precio", "Precio unitario", "0.01", "0.01", "0.00", req, claseAncho(campo))
        case "comision":
            return campoNumero("comision", "Comisión", "0.01", "0", "0.00", true, claseAncho(campo), "0")
        case "divisa":
            return null
        case "tasa":
            return campoTasa(grupo(claseAncho(campo)), req)
        case "exchange":
            return campoTexto("exchange", "Exchange", "Ej: Binance, Kraken", req, claseAncho(campo))
        case "nombreVendedor":
            return campoTexto("nombreVendedor", "Nombre del vendedor", "Nombre", req, claseAncho(campo))
        case "nombreComprador":
            return campoTexto("nombreComprador", "Nombre del comprador", "Nombre", req, claseAncho(campo))
        case "cuentaPago":
            return campoTexto("cuentaPago", "Cuenta de pago", "Número de cuenta", req, claseAncho(campo))
        case "cuentaCobro":
            return campoTexto("cuentaCobro", "Cuenta de cobro", "Número de cuenta", req, claseAncho(campo))
        case "fechaRealizacion":
            return contenidoDesdeTemplate("tpl-campo-fecha", {
                valores: {
                    "grupo@class": grupo(claseAncho(campo)),
                    "etiqueta@for": "campo-fecha",
                    etiqueta: "Fecha de realización",
                    "campo@id": "campo-fecha",
                    "campo@value": hoy,
                    "campo@max": hoy,
                    "campo@required": req
                }
            })
        default:
            return campoTexto(campo, campo, campo, req, claseAncho(campo))
    }
}

function campoTexto(campo, etiqueta, placeholder, req, ancho) {
    return contenidoDesdeTemplate("tpl-campo-texto", {
        valores: {
            "grupo@class": `form-group${ancho ? ` ${ancho}` : ""}`,
            "etiqueta@for": `campo-${campo}`,
            etiqueta,
            "campo@id": `campo-${campo}`,
            "campo@placeholder": placeholder,
            "campo@required": req
        }
    })
}

function campoNumero(campo, etiqueta, step, min, placeholder, req, ancho, valor = "") {
    return contenidoDesdeTemplate("tpl-campo-numero", {
        valores: {
            "grupo@class": `form-group${ancho ? ` ${ancho}` : ""}`,
            "etiqueta@for": `campo-${campo}`,
            etiqueta,
            "campo@id": `campo-${campo}`,
            "campo@step": step,
            "campo@min": min,
            "campo@placeholder": placeholder,
            "campo@value": valor,
            "campo@required": req
        }
    })
}

function campoSelectOperacion(claseGrupo, req) {
    const contenido = contenidoDesdeTemplate("tpl-campo-select", {
        valores: {
            "grupo@class": claseGrupo,
            "etiqueta@for": "campo-operacion",
            etiqueta: "Operación",
            "select@id": "campo-operacion",
            "select@required": req
        }
    })
    const select = contenido.querySelector("[data-tpl='select']")
    for (const [valor, texto] of [["sumar", "Suma al saldo (+)"], ["restar", "Resta del saldo (−)"]]) {
        const opcion = document.createElement("option")
        opcion.value = valor
        opcion.textContent = texto
        select.appendChild(opcion)
    }
    return contenido
}

function campoTasa(claseGrupo, req) {
    const contenido = contenidoDesdeTemplate("tpl-campo-numero", {
        valores: {
            "grupo@class": claseGrupo,
            "etiqueta@for": "campo-tasa",
            etiqueta: "Tasa de cambio",
            "campo@id": "campo-tasa",
            "campo@step": "0.0001",
            "campo@min": "0.0001",
            "campo@placeholder": "0.00",
            "campo@required": req
        }
    })
    const grupo = contenido.querySelector("[data-tpl='grupo']")
    const pista = document.createElement("span")
    pista.className = "form-hint"
    pista.textContent = "Se calcula automáticamente al completar montos"
    grupo.appendChild(pista)
    return contenido
}// ============================================
// SÍMBOLO DE DIVISA SEGÚN CUENTA
// ============================================

const SIMBOLO_MONEDA = { pen: "S/", usd: "$", usdt: "₮", eur: "€" }

// Para cada tipo, qué select de cuenta define la divisa del movimiento.
const CUENTA_FUENTE_DIVISA = {
    ingreso: "campo-cuenta",
    gasto: "campo-cuenta",
    transferencia: "campo-cuentaOrigen",
    compraActivo: "campo-cuenta",
    ventaActivo: "campo-cuenta",
    p2pCompra: "campo-cuenta",
    p2pVenta: "campo-cuenta",
    compraTarjeta: "campo-cuenta",
    pagoTarjeta: "campo-cuentaOrigen",
    error: "campo-cuenta"
}

/**
 * Normaliza texto para buscar sin acentos ni mayúsculas.
 */
function normalizarBusqueda(valor) {
    return (valor || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
}

/**
 * Obtiene solo el nombre de la cuenta del texto de la opción (ej. "BCP"
 * de "BCP (S/ 1234)"). Si no hay paréntesis, devuelve el texto completo.
 */
function obtenerNombreCuenta(textoOpcion) {
    const match = textoOpcion?.match(/^(.+?)\s*\(/);
    return match ? match[1].trim() : (textoOpcion || "").trim()
}

/**
 * Activa los buscadores de los <select> de cuenta/tarjeta. El input filtra las
 * opciones por texto combinándolo con la disponibilidad (`data-disponible`) que
 * marcan los filtros de compatibilidad (pago de tarjeta, transferencias).
 * El <select> sigue siendo la fuente del id elegido.
 */
export function activarSelectsBuscables(raiz = document) {
    raiz.querySelectorAll(".form-buscador[data-select]").forEach(entrada => {
        if (entrada.dataset.buscableListo === "1") return
        entrada.dataset.buscableListo = "1"

        const select = document.getElementById(entrada.dataset.select)
        if (!select) return

        const aplicar = () => {
            const texto = normalizarBusqueda(entrada.value)
            Array.from(select.options).forEach((opcion, indice) => {
                if (indice === 0) return
                const disponible = opcion.dataset.disponible !== "0"
                const coincide = !texto || normalizarBusqueda(opcion.textContent).includes(texto)
                const visible = disponible && coincide
                opcion.hidden = !visible
                opcion.disabled = !visible
            })
            // Si la opción seleccionada se volvió invisible/deshabilitada,
            // elegimos "Todas las cuentas" en lugar de borrar en silencio.
            if (select.selectedOptions[0] && select.selectedOptions[0].disabled) {
                select.value = ""
            }
        }

        // Los filtros de compatibilidad llaman a esto tras marcar disponibilidad.
        select._aplicarBusqueda = aplicar

        const sincronizarEntrada = () => {
            const elegida = select.selectedOptions[0]
            // Mostrar solo el nombre de la cuenta, sin "(S/ ...)" ni "(deuda: ...)"
            if (elegida && elegida.value) {
                entrada.value = obtenerNombreCuenta(elegida.textContent)
            } else {
                entrada.value = ""
            }
        }

        entrada.addEventListener("input", () => {
            aplicar()
            const visibles = Array.from(select.options).filter((o, i) => i > 0 && !o.hidden)
            if (normalizarBusqueda(entrada.value) && visibles.length === 1) {
                const anterior = select.value
                select.value = visibles[0].value
                // Los filtros de compatibilidad (pago de tarjeta, transferencias)
                // se enganchan al `change` del <select>. Al elegir por texto el
                // valor cambia sin evento, así que lo emitimos para que reaccionen.
                if (select.value !== anterior) select.dispatchEvent(new Event("change"))
            }
            // Si no hay opciones visibles, no borrar la selección en silencio:
            // el usuario puede borrar el texto manualmente para elegir "Todas".
        })

        entrada.addEventListener("keydown", evento => {
            if (evento.key === "Enter") {
                evento.preventDefault()
                select.focus()
            }
        })

        select.addEventListener("change", sincronizarEntrada)

        // Estado inicial coherente (incluye el caso de edición, donde el select
        // ya viene con un valor puesto por rellenarFormulario).
        aplicar()
        sincronizarEntrada()
    })
}

/**
 * Sincroniza el nombre bloqueado del activo con el símbolo escrito. Si ya
 * existe se muestra su nombre; si no, se anuncia que se creará.
 */
export function vincularSelectActivo() {
    const entrada = document.getElementById("campo-activo")
    const nombre = document.getElementById("campo-activo-nombre")
    if (!entrada || !nombre) return

    const actualizar = () => {
        const simbolo = (entrada.value || "").trim().toUpperCase()
        if (!simbolo) {
            nombre.value = ""
            return
        }
        nombre.value = activosPorSimbolo.get(simbolo) || `Nuevo activo (${simbolo})`
    }

    entrada.addEventListener("input", actualizar)
    actualizar()
}

/**
 * Vincula el cambio de cuenta con el símbolo que acompaña al label Monto
 * y actualiza la divisa guardada. Llamar justo después de abrir el modal.
 * También activa los buscadores de los selectores de cuenta.
 */
export function vincularSimboloDivisa() {
    activarSelectsBuscables()
    vincularSelectActivo()
    const ids = [...new Set(Object.values(CUENTA_FUENTE_DIVISA))]

    const simboloDe = select => {
        const moneda = select?.selectedOptions?.[0]?.dataset?.moneda
        return moneda ? (SIMBOLO_MONEDA[moneda] || "$") : null
    }

    const pintar = (idElemento, simbolo) => {
        if (!simbolo) return
        const objetivo = document.getElementById(idElemento)
        if (objetivo) objetivo.textContent = simbolo
    }

    const cuenta = document.getElementById("campo-cuenta")
    const origen = document.getElementById("campo-cuentaOrigen")
    const destino = document.getElementById("campo-cuentaDestino")

    const actualizar = () => {
        pintar("simbolo-monto", simboloDe(cuenta) || simboloDe(origen))
        pintar("simbolo-montoOrigen", simboloDe(origen))
        pintar("simbolo-montoDestino", simboloDe(destino))
    }

    ids.forEach(id => {
        const select = document.getElementById(id)
        select?.addEventListener("change", actualizar)
    })

    actualizar()
}

// ============================================
// RECOGER DATOS DEL FORMULARIO
// ============================================

export function recogerDatosFormulario(tipo) {
    const config = CONFIG_MOVIMIENTOS[tipo]
    const obligatorios = config.camposObligatorios || []
    const opcionales = config.camposOpcionales || []
    const campos = [...new Set([...obligatorios, ...opcionales])]
    const datos = {}
    const errores = []

    for (const campo of campos) {
        const input = document.getElementById(`campo-${campo}`)
        if (!input) continue

        // Un campo oculto por otro (p. ej. `monto` cuando la transferencia cruza
        // divisas) se deshabilita: no se recoge ni cuenta como obligatorio.
        if (input.disabled) continue

        const esObligatorio = obligatorios.includes(campo)
        const valor = input.value.trim()

        if (!valor) {
            if (esObligatorio) {
                errores.push(campo)
                input.classList.add("input-error")
            }
            continue
        }

        input.classList.remove("input-error")
        datos[campo] = input.type === "number" ? parseFloat(valor) : valor
    }

    const comisionInput = document.getElementById("campo-comision")
    if (comisionInput && comisionInput.value) {
        datos.comision = parseFloat(comisionInput.value) || 0
    }

    // Las etiquetas van siempre (aunque quede lista vacía): así un movimiento
    // editado puede quedarse sin ninguna.
    datos.etiquetas = normalizarEtiquetas(document.getElementById("campo-etiquetas")?.value)

    // La divisa no se elige: se deriva de la cuenta seleccionada.
    const idFuente = CUENTA_FUENTE_DIVISA[tipo]
    if (idFuente) {
        const selectCuenta = document.getElementById(idFuente)
        const moneda = selectCuenta?.selectedOptions?.[0]?.dataset?.moneda
        if (moneda) datos.divisa = moneda
    }

    // Compra/venta de activo sin cuenta (regalo, aportación): no hay moneda de
    // la que derivarla, así que se usa la divisa principal del usuario.
    if (!datos.divisa && (tipo === TIPOS_MOVIMIENTO.COMPRA_ACTIVO || tipo === TIPOS_MOVIMIENTO.VENTA_ACTIVO)) {
        datos.divisa = getDivisaPrincipal()
    }

    if (errores.length > 0) {
        mostrarNotificacion("error", `Campos obligatorios faltantes: ${errores.join(", ")}`)
        return null
    }

    return datos
}