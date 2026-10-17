import { logout, tienePassword, configurarPassword, cambiarPasswordVerificada, actualizarNombre, reautenticarConPassword, reautenticarConGoogle, esSesionReciente, aplicarPersistenciaSesion, startInactivityTimer } from "../../firebase/auth.js"
import { sesion, PREFERENCIAS_POR_DEFECTO, fusionarProfundo, esObjetoPlano } from "../core/sesion.js"
import { cacheCapa } from "../core/cache.js"
import { obtenerCuentas, obtenerPreferencias, aplicarPreferenciasDiff, actualizarCuenta } from "../../firebase/firestore.js"
import { abrirModal, cerrarModal, contenidoDesdeTemplate, contenidoDesdeFilas } from "./modal.js"
import { mostrarNotificacion } from "./notificaciones.js"
import { VERSION } from "../../constants/version.js"
import { TIPO_CAMBIO_DEFAULT } from "../../constants/divisas.js"
import { getDivisaPrincipal, getTipoCambio, getFormatoDivisa, formatearMontoConDivisa, actualizarTipoCambioAuto, guardarDivisaPrincipal, guardarTipoCambio } from "../services/DivisaServicio.js"
import { aplicarTema, setTemaLocal } from "../core/tema.js"
import { icono, LOGO_ESCINCO_CARGA } from "../core/iconos.js"
import { accionExportar } from "./exportar.js"
import { skeletonMarkup, skeletonText } from "./skeletons.js"
import { envolverSidebar } from "./colapsoSidebar.js"

let uid = null
let hayCambios = false
let temaActual = "dark"
let lastbarModo = "hide"
let nombrePendiente = null
// El tema y el modo de la lastbar ya NO usan banderas "pendiente": el estado
// del Guardar se calcula comparando la pantalla con lo guardado. Con banderas,
// cambiar un valor y volver al original dejaba la bandera puesta y el Guardar
// se activaba solo, que es de donde salia el aviso fantasma.

// Fotografía de las preferencias tal como quedaron al abrir la pantalla. Es la
// referencia contra la que se compara para saber si hay algo que guardar: si
// el usuario cambia un valor y vuelve al anterior, deja de haber cambios.
let lineaBase = null

const CANTIDAD_MOVIMIENTOS_DEFAULT = 5

function normalizarNivelResalte(valor) {
    const nivel = Number(valor)
    return [0, 1, 2].includes(nivel) ? nivel : 0
}

// Sincroniza el panel de tema cuando el tema cambia desde el lastbar
// (u otra fuente), sin recargar la página.
window.addEventListener("tema-cambiado", (event) => {
    const tema = event.detail?.tema
    if (!tema) return

    temaActual = tema
    document.querySelectorAll("#toggle-tema .toggle-option").forEach(opt => {
        opt.classList.toggle("active", opt.dataset.tema === tema)
    })
})

// ============================================
// SECCIONES
// ============================================

const SECCIONES_CONFIGURACION = [
    { id: "cuenta", label: "Cuenta", icono: "circle-user" },
    { id: "apariencia", label: "Apariencia", icono: "palette" },
    { id: "moneda", label: "Moneda", icono: "coins" },
    { id: "seguridad", label: "Seguridad", icono: "shield" },
    { id: "accesibilidad", label: "Accesibilidad", icono: "accessibility" },
    { id: "datos", label: "Datos", icono: "database" }
]

// ============================================
// RENDER
// ============================================
// La configuración ya no es una página: es una ventana grande (modal-xl)
// que se abre sobre cualquier ruta. El markup se inyecta en el modal y se
// conecta por id, igual que antes dentro de #app-content.

function plantillaConfiguracion() {
    return `
        <div class="config-modal" aria-busy="true">
            <div id="configuracion-cargando">
                ${skeletonMarkup({ variant: "settings", rows: 6 })}
            </div>
            <div id="configuracion-contenido" class="configuracion-cargando" hidden>
                <div class="config-layout">
                <nav class="config-nav" aria-label="Secciones de configuración">
                    ${SECCIONES_CONFIGURACION.map((seccion, indice) => `
                        <button class="glass${indice === 0 ? " act" : ""}" type="button" data-section="${seccion.id}">
                            ${icono(seccion.icono, 18)}<span>${seccion.label}</span>
                        </button>
                    `).join("")}
                    <div class="config-nav-pie">
                        <a class="footer-brand" href="/" target="_blank" rel="noopener noreferrer">${VERSION.nombre}</a>
                        <span class="footer-version">v${VERSION.numero}</span>
                        <span class="footer-copy">© ${VERSION.ano} ${VERSION.nombre}</span>
                        <span class="footer-legal"><a href="/privacidad" target="_blank" rel="noopener noreferrer">Privacidad</a> · <a href="/terminos" target="_blank" rel="noopener noreferrer">Términos</a></span>
                    </div>
                </nav>
                <div class="config-body">

            <!-- APARIENCIA -->
            <div class="panel-section hidden-section" id="section-apariencia">

                <div class="config-group">
                    <span class="config-label">Tema</span>
                    <div class="toggle-group" id="toggle-tema">
                        <span class="toggle-option" data-tema="dark">Oscuro</span>
                        <span class="toggle-option" data-tema="light">Claro</span>
                        <span class="toggle-option" data-tema="system">Sistema</span>
                    </div>
                </div>

                <div class="config-group">
                    <span class="config-label">Resaltar patrimonio</span>
                    <div class="toggle-group" id="resaltar-patrimonio">
                        <span class="toggle-option active" data-nivel="0">0</span>
                        <span class="toggle-option" data-nivel="1">1</span>
                        <span class="toggle-option" data-nivel="2">2</span>
                    </div>
                    <span class="config-hint">0 sin resalte · 1 resalte tenue · 2 resalte intenso</span>
                </div>

                <div class="config-group">
                    <span class="config-label visible-pages">Páginas visibles</span>
                    <div class="pages-toggle-group">
                        <div class="toggle-row">
                            <span>Dashboard</span>
                            <label class="switch">
                                <input type="checkbox" id="toggle-dashboard" checked>
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="toggle-row">
                            <span>Movimientos</span>
                            <label class="switch">
                                <input type="checkbox" id="toggle-movimientos" checked>
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="toggle-row">
                            <span>Inversiones</span>
                            <label class="switch">
                                <input type="checkbox" id="toggle-inversiones" checked>
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="toggle-row">
                            <span>Trading</span>
                            <label class="switch">
                                <input type="checkbox" id="toggle-trading" checked>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                </div>

                <div class="config-group">
                    <span class="config-label">Últimos movimientos en el dashboard</span>
                    <div class="toggle-group" id="movimientos-recientes" role="group" aria-label="Cantidad de últimos movimientos en el dashboard">
                        ${[2, 3, 4, 5].map(cantidad => `
                            <span class="toggle-option${cantidad === CANTIDAD_MOVIMIENTOS_DEFAULT ? " active" : ""}" data-cantidad="${cantidad}">${cantidad}</span>
                        `).join("")}
                    </div>
                    <span class="config-hint">
                        Cantidad de movimientos a mostrar en la tarjeta
                        "Últimos movimientos" del dashboard.
                    </span>
                </div>

                <div class="config-group">
                    <span class="config-label">Tipos de movimiento en el selector</span>
                    <div class="pages-toggle-group">
                        <div class="toggle-row">
                            <span>Cambio de divisa</span>
                            <label class="switch">
                                <input type="checkbox" id="toggle-tipo-cambio-divisa" checked>
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="toggle-row">
                            <span>Compra de activo</span>
                            <label class="switch">
                                <input type="checkbox" id="toggle-tipo-compra-activo">
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="toggle-row">
                            <span>Venta de activo</span>
                            <label class="switch">
                                <input type="checkbox" id="toggle-tipo-venta-activo">
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="toggle-row">
                            <span>Pago de tarjeta</span>
                            <label class="switch">
                                <input type="checkbox" id="toggle-tipo-pago-tarjeta">
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="toggle-row">
                            <span>Compra P2P</span>
                            <label class="switch">
                                <input type="checkbox" id="toggle-tipo-p2p-compra" checked>
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="toggle-row">
                            <span>Venta P2P</span>
                            <label class="switch">
                                <input type="checkbox" id="toggle-tipo-p2p-venta" checked>
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="toggle-row">
                            <span>Trade</span>
                            <label class="switch">
                                <input type="checkbox" id="toggle-tipo-trade" checked>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                    <span class="config-hint">
                        Qué tipos se ofrecen al crear un movimiento nuevo. Compra/venta de activo y pago de
                        tarjeta solo se registran desde sus propias páginas salvo que los actives aquí.
                    </span>
                </div>

                </div>

            <!-- MONEDA -->
            <div class="panel-section hidden-section" id="section-moneda">

                <div class="config-group">
                    <span class="config-label">Divisa principal</span>
                    <select class="select" id="divisa-principal">
                        <option value="pen">PEN (S/)</option>
                        <option value="usd">USD ($)</option>
                        <option value="usdt">USDT (₮)</option>
                        <option value="eur">EUR (€)</option>
                    </select>
                </div>

                <div class="config-group">
                    <span class="config-label">Formato de divisa</span>
                    <div class="toggle-group" id="formato-divisa">
                        <span class="toggle-option active" data-formato="simbolo">Símbolo ($)</span>
                        <span class="toggle-option" data-formato="codigo">Código (USD)</span>
                    </div>
                </div>

                <div class="config-group">
                    <span class="config-label">Periodo de evolución patrimonial</span>
                    <div class="toggle-group" id="periodo-evolucion">
                        <span class="toggle-option" data-periodo="7d">7D</span>
                        <span class="toggle-option" data-periodo="30d">30D</span>
                        <span class="toggle-option" data-periodo="90d">90D</span>
                        <span class="toggle-option" data-periodo="1a">1A</span>
                        <span class="toggle-option" data-periodo="todo">Todo</span>
                    </div>
                </div>

                <div class="config-group">
                    <span class="config-label">Tipo de cambio</span>

                    <div class="toggle-group" id="tc-modo">
                        <span class="toggle-option" data-modo="manual">Manual</span>
                        <span class="toggle-option" data-modo="auto">Automático</span>
                    </div>

                    <div class="exchange-rate-inputs" id="tc-input-manual" hidden>
                        <div class="exchange-input">
                            <label>1 USD =</label>
                            <input type="number" id="tc-pen-usd" class="form-input" step="0.01" min="0.01" placeholder="${TIPO_CAMBIO_DEFAULT.pen_usd}">
                            <span>PEN</span>
                        </div>
                        <div class="exchange-input">
                            <label>1 USD =</label>
                            <input type="number" id="tc-eur-usd" class="form-input" step="0.01" min="0.01" placeholder="${TIPO_CAMBIO_DEFAULT.eur_usd}">
                            <span>EUR</span>
                        </div>
                    </div>

                    <div class="tc-auto-box" id="tc-input-auto" hidden>
                        <div class="exchange-notes">
                            <p class="exchange-note" id="tc-valor-auto"></p>
                            <p class="exchange-note" id="tc-fecha-auto"></p>
                        </div>
                        <div class="tc-auto-actions">
                            <button class="glass-btn" id="tc-actualizar-btn">
                                <span class="tc-btn-text">Actualizar ahora</span>
                            </button>
                            <span class="tc-status" id="tc-status" hidden></span>
                        </div>
                    </div>
                </div>
                <div class="config-group">
                    <span class="config-label">Precios de activos</span>
                    <div class="toggle-row">
                        <span>Actualizar automáticamente al entrar a Inversiones</span>
                        <label class="switch">
                            <input type="checkbox" id="toggle-precios-auto">
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
            </div>

            <!-- CUENTA -->
            <div class="panel-section" id="section-cuenta">

                <div class="config-group">
                    <span class="config-label">Usuario</span>
                    <input type="text" id="cuenta-nombre" class="form-input" placeholder="Tu nombre" maxlength="50">
                </div>
                <div class="config-group">
                    <span class="config-label">Correo</span>
                    <span class="config-value" id="cuenta-email">—</span>
                </div>

                <div class="config-group">
                    <span class="config-label">Contraseña</span>
                    <button class="glass-btn" id="password-btn">Configurar contraseña</button>
                </div>
                <div class="config-group">
                    <span class="config-label">Sesión</span>
                    <button class="glass-btn danger" id="logout-btn">Cerrar sesión</button>
                </div>
                <div class="config-group danger-zone">
                    <span class="config-label danger">Eliminar cuenta</span>
                    <button class="glass-btn danger" id="delete-account">Eliminar cuenta</button>
                    <span class="config-hint">Se eliminarán todos tus datos permanentemente</span>
                </div>
            </div>

            <!-- SEGURIDAD -->
            <div class="panel-section hidden-section" id="section-seguridad">

                <div class="config-group">
                    <span class="config-label">Cerrar sesión por inactividad</span>
                    <select class="select" id="seg-inactividad">
                        <option value="5">5 minutos</option>
                        <option value="15">15 minutos</option>
                        <option value="30">30 minutos</option>
                        <option value="60">1 hora</option>
                        <option value="0">Nunca</option>
                    </select>
                    <span class="config-hint">
                        Si no hay actividad durante este tiempo, la sesión se cierra automáticamente.
                        Con "Nunca", la sesión permanece abierta hasta que la cierres manualmente.
                    </span>
                </div>

                <div class="config-group">
                    <span class="config-label">Sesión en el navegador</span>
                    <div class="pages-toggle-group">
                        <div class="toggle-row">
                            <span>Cerrar sesión al cerrar la pestaña</span>
                            <label class="switch">
                                <input type="checkbox" id="seg-cerrar-pestana" checked>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                    <span class="config-hint">
                        Activado: la sesión se cierra al cerrar la pestaña o ventana (más seguro).
                        Desactivado: la sesión se mantiene hasta que cierres sesión manualmente.
                    </span>
                </div>

                <div class="config-group">
                    <span class="config-label">Operaciones sensibles</span>
                    <span class="config-hint">
                        Eliminar la cuenta, eliminar todos los datos y cambiar la contraseña piden
                        confirmar tu identidad si la sesión tiene más de 5 minutos.
                    </span>
                </div>
            </div>

            <!-- ACCESIBILIDAD -->
            <div class="panel-section hidden-section" id="section-accesibilidad">

                <div class="config-group">
                    <span class="config-label">Configuración como</span>
                    <div class="toggle-group" id="toggle-config-modo">
                        <span class="toggle-option active" data-config-modo="panel">Panel</span>
                        <span class="toggle-option" data-config-modo="modal">Modal</span>
                    </div>
                    <span class="config-hint">
                        Panel: los ajustes van dentro del panel de la app, con su
                        ruta <strong>/configuración</strong> y el pie fijo abajo.
                        Modal: se abre como ventana grande sobre la página en la
                        que estás, sin cambiar de ruta.
                    </span>
                </div>

                <div class="config-group">
                    <span class="config-label">Modales persistentes</span>
                    <div class="pages-toggle-group">
                        <div class="toggle-row">
                            <span>Habilitar ventanas de modales que no bloquean la app</span>
                            <label class="switch">
                                <input type="checkbox" id="acc-modales-persistentes">
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                    <span class="config-hint">
                        Desactiva el overlay oscuro de los modales: podrás seguir usando la aplicación
                        mientras están abiertos y abrir varios a la vez, como ventanas.
                    </span>
                </div>

                <div class="config-group">
                    <span class="config-label">Habilitar escinco doodles</span>
                    <div class="pages-toggle-group">
                        <div class="toggle-row">
                            <span>Habilitar doodles</span>
                            <label class="switch">
                                <input type="checkbox" id="acc-doodles">
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                </div>

                <div class="config-group">
                    <span class="config-label">Un click para seleccionar</span>
                    <div class="pages-toggle-group">
                        <div class="toggle-row">
                            <span>Seleccionar con un click</span>
                            <label class="switch">
                                <input type="checkbox" id="acc-un-click-seleccion">
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                    <span class="config-hint">
                        Con la opción activa, el doble click abre el detalle del movimiento en lugar de
                        seleccionarlo. Desactivada, el click abre el detalle como siempre. En móvil se
                        mantiene desactivada por defecto.
                    </span>
                </div>

                <div class="config-group">
                    <span class="config-label">Lateralidad de la información de cuenta</span>
                    <div class="toggle-group toggle-lateralidad-cuenta" id="toggle-lateralidad-cuenta">
                        <span class="toggle-option" data-lateralidad="izquierda">Izquierda</span>
                        <span class="toggle-option active" data-lateralidad="derecha">Derecha</span>
                    </div>
                </div>

                <div class="config-group">
                    <span class="config-label">Lastbar auto-hide</span>
                    <div class="toggle-group" id="toggle-lastbar">
                        <span class="toggle-option" data-lastbar="hide">Ocultar</span>
                        <span class="toggle-option" data-lastbar="show">Siempre visible</span>
                    </div>
                    <span class="config-hint">
                        Ocultar: los botones aparecen al pasar el mouse. Siempre visible: los botones se muestran siempre.
                    </span>
                </div>

                <div class="config-group">
                    <span class="config-label">Resaltar ingreso y gasto</span>
                    <div class="pages-toggle-group">
                        <div class="toggle-row">
                            <span>Mostrar Ingreso y Gasto resaltados en el selector</span>
                            <label class="switch">
                                <input type="checkbox" id="acc-resaltar-ingreso-gasto" checked>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                    <span class="config-hint">
                        Con la opción activa, Ingreso y Gasto se muestran como botones destacados en el
                        selector de movimientos. Desactivada, se ven como los demás tipos.
                    </span>
                </div>

                <div class="config-group">
                    <span class="config-label">Atajos de teclado</span>
                    <button class="glass-btn" id="abrir-atajos" type="button">Ver atajos de teclado</button>
                    <span class="config-hint">
                        Consulta todas las combinaciones de teclas disponibles.
                    </span>
                </div>
            </div>

            <!-- DATOS -->
            <div class="panel-section hidden-section" id="section-datos">
                <div class="config-group">
                    <span class="config-label">Exportar respaldo</span>
                    <button class="glass-btn" id="export-dvid">Exportar .dvid</button>
                    <span class="config-hint">Respaldo completo de todos tus datos</span>
                </div>
                <div class="config-group">
                    <span class="config-label">Importar respaldo</span>
                    <button class="glass-btn" id="import-dvid">Importar .dvid</button>
                    <span class="config-hint">Solo archivos .dvid generados por escinco</span>
                </div>
                <div class="config-group">
                    <span class="config-label">Cuentas archivadas</span>
                    <button class="glass-btn" id="restore-cuentas">Restaurar cuentas archivadas</button>
                    <span class="config-hint" id="restore-cuentas-hint">
                        Ocultas, no borradas. Sus movimientos y saldos se conservan
                        tal cual y vuelven a aparecer al restaurarlas.
                    </span>
                </div>
<div class="config-group danger-zone">
                    <span class="config-label danger">Eliminar datos</span>
                    <button class="glass-btn danger" id="delete-data">Eliminar todos los datos</button>
                    <span class="config-hint">Esta acción no se puede deshacer</span>
                </div>
                </div>

                </div>
            </div>

            <!-- La versión vive en el pie del menú lateral (.config-nav-pie),
                 para que quede alineada con la columna de secciones y no como
                 una barra de ancho completo. El Guardar está en la lastbar y el
                 Cerrar es el propio navegador (o el engranaje). -->
    </div>
    </div>
    `
}

// ============================================
// APERTURA: PANEL (VENTANA) O PÁGINA
// ============================================
// Hay dos formas de mostrar exactamente la misma pantalla, elegidas en
// Accesibilidad › "Configuración como":
//
// · Panel  → abrirConfiguracion(): una ventana modal-xl sobre la ruta actual.
//            El Guardar es el botón de confirmar del modal y el aviso de
//            cambios sin guardar salta al cerrarlo.
// · Página → render() + init(): el router la carga en #app-content como una
//            ruta más. El Guardar vive en la lastbar y el aviso salta al
//            cambiar de pestaña.
//
// Ambas comparten el mismo markup, los mismos ids y el mismo cableado: solo
// cambia quién pone el Guardar y dónde se avisa de los cambios pendientes.

let modalConfiguracion = null
// "ruta"  = los ajustes van dentro del #panel con ruta propia (modo Panel).
// "modal" = ventana grande sobre la página actual (modo Modal).
let modoActual = "modal"

/**
 * Abre la configuración en una ventana grande. Es idempotente: si ya está
 * abierta, no se duplica.
 */
export function abrirConfiguracion() {
    if (document.getElementById("configuracion-contenido")) return null
    if (!sesion.uid) return null

    uid = sesion.uid
    hayCambios = false
    nombrePendiente = null
    lineaBase = null
    modoActual = "modal"
    console.log("[INFO] Configuración abierta como modal para UID:", uid)

    modalConfiguracion = abrirModal({
        titulo: "Configuración",
        variante: "xl",
        contenido: plantillaConfiguracion(),
        confirmText: "Guardar",
        cancelText: "Cerrar",
        onConfirm: async () => {
            if (!hayCambios) return true
            await guardarPreferencias()
            return true
        },
        onCancel: () => {
            // El modal se cierra igual, pero si había cambios se ofrece
            // guardarlos desde la notificación (el DOM ya no existe para
            // releerlo más tarde). Si ya se descartó una vez, no se repite
            // hasta que el usuario vuelva a tocar algo.
            if (!hayCambios || avisoDescartado) return
            const preferenciasPendientes = construirPreferencias()
            mostrarNotificacion("warning", "Hay cambios sin guardar en la configuración", 0, [
                {
                    texto: "Guardar",
                    primaria: true,
                    alClick: () => aplicarPreferencias(preferenciasPendientes)
                },
                {
                    texto: "Descartar",
                    clase: "cancel",
                    alClick: () => { avisoDescartado = true }
                }
            ], () => { avisoDescartado = true })
        }
    })

    iniciarConfiguracion()
    return modalConfiguracion
}

// ============================================
// MODO PÁGINA (lo que espera el router)
// ============================================
// El router llama a render() para pintar el HTML y luego a init(). Se apoya
// en la misma plantilla y el mismo iniciarConfiguracion() que el panel.

// En modo Panel la configuración es una página del router como las demás:
// tiene su propio sidebar y su panel, por separado. El #panel no incluye el
// sidebar: el nav vive en #sidebar y el cuerpo en #panel.
export function render() {
    return `
        ${envolverSidebar(`
            <section id="sidebar" aria-label="Secciones de configuración"></section>
        `)}
        <section id="panel" class="glass config-pagina">
            ${plantillaConfiguracion()}
        </section>
    `
}

export async function init() {
    if (!sesion.uid) return
    uid = sesion.uid
    hayCambios = false
    nombrePendiente = null
    lineaBase = null
    modoActual = "ruta"
    separarSidebarDePanel()
    await iniciarConfiguracion()
}

// Mueve el nav de configuración a #sidebar y el pie de versión al final del
// #panel a todo el ancho. En modal se quedan donde están.
function separarSidebarDePanel() {
    const panel = document.getElementById("panel")
    const sidebar = document.getElementById("sidebar")
    if (!panel || !sidebar) return
    const nav = panel.querySelector(".config-nav")
    if (nav && nav.parentElement !== sidebar) {
        sidebar.prepend(nav)
    }
    const pie = sidebar.querySelector(".config-nav-pie") || panel.querySelector(".config-nav-pie")
    if (pie && pie.parentElement !== panel) {
        pie.classList.add("config-pie-pagina")
        panel.appendChild(pie)
    } else if (pie) {
        pie.classList.add("config-pie-pagina")
        panel.appendChild(pie)
    }
}

// Botón "Guardar" de la lastbar (solo en modo página).
export function guardarDesdePagina() {
    if (hayCambios) guardarPreferencias()
}

// ============================================
// INIT
// ============================================

async function iniciarConfiguracion() {
    try {
        await cargarPreferencias()
    } catch (error) {
        console.error("Error al iniciar la configuración:", error)
    }

    document.getElementById("configuracion-cargando")?.remove()
    document.getElementById("configuracion-contenido")?.removeAttribute("hidden")
    document.querySelector(".config-modal")?.removeAttribute("aria-busy")

    configurarSidebar()
    configurarTema()
    configurarCuenta()
    configurarBotones()
    configurarModoConfiguracion()
    configurarLastbar()
    configurarDetectorCambios()
    configurarTipoCambio()
    configurarFormatoDivisa()
    configurarLateralidadCuenta()
    configurarPeriodoEvolucion()
    configurarResaltarPatrimonio()
    refrescarContadorArchivadas()

    // Referencia para detectar cambios: se toma DESPUÉS de que todos los
    // controles estén conectados y con los valores guardados ya pintados, así
    // que abrir la pantalla y no tocar nada da "sin cambios" con certeza.
    lineaBase = construirPreferencias()
    hayCambios = false
    actualizarEstadoGuardar()
}

// ============================================
// SIDEBAR
// ============================================

function configurarSidebar() {
    const botones = document.querySelectorAll(".config-nav button")
    botones.forEach(btn => {
        btn.addEventListener("click", () => {
            botones.forEach(b => b.classList.remove("act"))
            btn.classList.add("act")

            document.querySelectorAll(".config-body .panel-section").forEach(s => {
                s.classList.add("hidden-section")
            })

            const section = btn.dataset.section
            const target = document.getElementById(`section-${section}`)
            if (target) target.classList.remove("hidden-section")
        })
    })
}

// ============================================
// TEMA
// ============================================

function configurarTema() {
    const opciones = document.querySelectorAll("#toggle-tema .toggle-option")

    // Marcar la activa según el tema actual
    opciones.forEach(opt => {
        opt.classList.toggle("active", opt.dataset.tema === temaActual)
    })

    opciones.forEach(opt => {
        opt.addEventListener("click", () => {
            const tema = opt.dataset.tema
            if (tema === temaActual) return

            opciones.forEach(o => o.classList.remove("active"))
            opt.classList.add("active")

            // Aplicar visualmente sin persistir (se guarda con el botón Guardar)
            temaActual = tema
            marcarCambioNuevo()
            aplicarTema(tema)
            window.dispatchEvent(new CustomEvent("tema-cambiado", { detail: { tema } }))

            actualizarEstadoGuardar()
        })
    })
}

// ============================================
// CUENTA
// ============================================

function configurarCuenta() {
    const usuario = sesion.getUsuario()
    const nombreInput = document.getElementById("cuenta-nombre")
    const emailEl = document.getElementById("cuenta-email")
    const botonPassword = document.getElementById("password-btn")

    if (nombreInput) {
        nombreInput.value = usuario?.nombre || "Usuario"

        nombreInput.addEventListener("input", () => {
            const base = (usuario?.nombre || "Usuario").trim()
            const nuevo = nombreInput.value.trim()

            if (!nuevo) {
                nombreInput.value = usuario?.nombre || "Usuario"
            } else if (nuevo !== base) {
                nombrePendiente = nuevo
                marcarCambioNuevo()
            } else {
                nombrePendiente = null
            }

            actualizarEstadoGuardar()
        })
    }
    if (emailEl) emailEl.textContent = usuario?.email || "—"

    // Cambiar texto del botón según si ya tiene contraseña
    if (botonPassword) {
        botonPassword.textContent = tienePassword()
            ? "Cambiar contraseña"
            : "Configurar contraseña"

        botonPassword.addEventListener("click", () => {
            if (!tienePassword()) {
                abrirModalConfigurarPassword()
                return
            }

            // Operación sensible: si la sesión es vieja, se pide reautenticación
            // antes de abrir el modal de cambio de contraseña.
            conReautenticacion(() => abrirModalCambiarPassword())
        })
    }
}

// ============================================
// MODAL: CONFIGURAR CONTRASEÑA (primera vez)
// ============================================

function abrirModalConfigurarPassword() {
    abrirModal({
        titulo: "Configurar contraseña",
        contenido: contenidoDesdeTemplate("tpl-form-password", {
            valores: {
                form: "form-config-password",
                "etiqueta-confirmar": "Confirmar contraseña"
            }
        }),
        variante: "narrow",
        confirmText: "Guardar",
        cancelText: "Cancelar",
        onConfirm: async () => {
            const nueva = document.getElementById("nueva-password")?.value
            const confirmar = document.getElementById("confirmar-password")?.value
            const errorEl = document.getElementById("password-error")

            if (!nueva || nueva.length < 6) {
                mostrarErrorPassword(errorEl, "La contraseña debe tener al menos 6 caracteres.")
                return false
            }
            if (nueva !== confirmar) {
                mostrarErrorPassword(errorEl, "Las contraseñas no coinciden.")
                return false
            }

            try {
                await configurarPassword(nueva)
                await cerrarSesionConAviso(
                    "Contraseña configurada",
                    "Ya puedes iniciar sesión con tu correo y contraseña."
                )
                return true
            } catch (error) {
                console.error("Error configurando contraseña:", error)
                mostrarErrorPassword(errorEl, mensajeErrorPassword(error))
                return false
            }
        }
    })
}

// ============================================
// MODAL: CAMBIAR CONTRASEÑA (ya tiene)
// ============================================

function abrirModalCambiarPassword() {
    abrirModal({
        titulo: "Cambiar contraseña",
        contenido: contenidoDesdeTemplate("tpl-form-password", {
            valores: {
                form: "form-cambiar-password",
                "etiqueta-confirmar": "Confirmar nueva contraseña"
            }
        }),
        variante: "narrow",
        confirmText: "Cambiar",
        cancelText: "Cancelar",
        onConfirm: async () => {
            const nueva = document.getElementById("nueva-password")?.value
            const confirmar = document.getElementById("confirmar-password")?.value
            const errorEl = document.getElementById("password-error")

            if (!nueva || nueva.length < 6) {
                mostrarErrorPassword(errorEl, "La nueva contraseña debe tener al menos 6 caracteres.")
                return false
            }
            if (nueva !== confirmar) {
                mostrarErrorPassword(errorEl, "Las contraseñas nuevas no coinciden.")
                return false
            }

            try {
                await cambiarPasswordVerificada(nueva)
                await cerrarSesionConAviso(
                    "Contraseña actualizada",
                    "Inicia sesión de nuevo con tu nueva contraseña."
                )
                return true
            } catch (error) {
                console.error("Error cambiando contraseña:", error)
                mostrarErrorPassword(errorEl, mensajeErrorPassword(error))
                return false
            }
        }
    })
}

function mostrarErrorPassword(el, mensaje) {
    if (!el) return
    el.textContent = mensaje
    el.hidden = false
}

function mensajeErrorPassword(error) {
    switch (error.code) {
        case "auth/wrong-password":
        case "auth/invalid-credential":
            return "La contraseña actual es incorrecta."
        case "auth/weak-password":
            return "La contraseña es demasiado débil."
        case "auth/requires-recent-login":
            return "Debes iniciar sesión de nuevo para cambiar la contraseña."
        case "auth/provider-already-linked":
            return "Esta cuenta ya tiene contraseña configurada."
        case "auth/credential-already-in-use":
            return "Ese correo ya está vinculado a otra cuenta."
        default:
            return "No se pudo actualizar la contraseña. Inténtalo de nuevo."
    }
}

// ============================================
// LOGOUT CON AVISO
// ============================================

function cerrarSesionConAviso(titulo, mensaje) {
    return new Promise((resolve) => {
        // Cerrar cualquier modal existente primero
        cerrarModal()

        setTimeout(() => {
            abrirModal({
                titulo,
                contenido: contenidoDesdeTemplate("tpl-mensaje", { valores: { mensaje } }),
                variante: "narrow",
                confirmText: "Ir al login",
                cerrarAlClickFuera: false,
                cerrarConEsc: false,
                onConfirm: async () => {
                    await logout()
                    window.location.replace("/login")
                    return true
                },
                onCancel: async () => {
                    await logout()
                    window.location.replace("/login")
                    resolve()
                }
            })
        }, 100)
    })
}

// ============================================
// PREFERENCIAS
// ============================================

// Ajusta un valor de "cantidad de últimos movimientos" a 2-5 (por defecto 5).
function validarCantidadMovimientos(valor) {
    const n = Number.parseInt(valor, 10)
    if (!Number.isFinite(n)) return CANTIDAD_MOVIMIENTOS_DEFAULT
    return Math.min(5, Math.max(2, n))
}

function leerCantidadMovimientos() {
    const activo = document.querySelector("#movimientos-recientes .toggle-option.active")
    const n = Number.parseInt(activo?.dataset.cantidad, 10)
    return Number.isFinite(n) ? validarCantidadMovimientos(n) : null
}

async function cargarPreferencias() {
    try {
        const prefs = await obtenerPreferencias(uid)

        // Tema
        temaActual = prefs?.tema || "dark"

        // Últimos movimientos en el dashboard
        const cantidadMovimientos = validarCantidadMovimientos(prefs?.movimientosRecientes)
        document.querySelectorAll("#movimientos-recientes .toggle-option").forEach(opcion => {
            opcion.classList.toggle("active", Number(opcion.dataset.cantidad) === cantidadMovimientos)
        })

        // Páginas: los guardados del servidor tienen prioridad; si no hay,
        // se usan los valores por defecto de la sesión (cuentas nuevas).
        const paginas = prefs?.paginas || sesion.getPaginasVisibles() || {}
        const marcarPagina = (id, valor) => {
            const el = document.getElementById(id)
            if (el) el.checked = valor !== false
        }
        marcarPagina("toggle-dashboard", paginas.dashboard)
        marcarPagina("toggle-movimientos", paginas.movimientos)
        marcarPagina("toggle-inversiones", paginas.inversiones)
        marcarPagina("toggle-trading", paginas.trading)

        // Seguridad
        const seg = prefs?.seg || sesion.getPreferencias().seg || {}
        const segInactividad = document.getElementById("seg-inactividad")
        if (segInactividad) {
            segInactividad.value = String(seg.inactividadMinutos ?? 15)
        }
        const segCerrarPestana = document.getElementById("seg-cerrar-pestana")
        if (segCerrarPestana) {
            segCerrarPestana.checked = seg.cerrarAlCerrarPestana !== false
        }

        // Accesibilidad
        const acc = prefs?.accesibilidad || {}
        const modoConfig = acc.configComoPagina === false ? "modal" : "panel"
        document.querySelectorAll("#toggle-config-modo .toggle-option").forEach(opcion => {
            opcion.classList.toggle("active", opcion.dataset.configModo === modoConfig)
        })
        const modalesPersistentes = document.getElementById("acc-modales-persistentes")
        if (modalesPersistentes) {
            modalesPersistentes.checked = acc.modalesPersistentes === true
        }
        const accDoodles = document.getElementById("acc-doodles")
        if (accDoodles) {
            accDoodles.checked = acc.doodles === true
        }
        const accUnClick = document.getElementById("acc-un-click-seleccion")
        const esMovil = window.matchMedia("(max-width: 760px)").matches
        if (accUnClick) {
            accUnClick.checked = !esMovil && acc.unClickSeleccion === true
            accUnClick.disabled = esMovil
        }
        const lateralidad = acc.lateralidadCuentaInfo === "izquierda" ? "izquierda" : "derecha"
        document.querySelectorAll("#toggle-lateralidad-cuenta .toggle-option").forEach(opcion => {
            opcion.classList.toggle("active", opcion.dataset.lateralidad === lateralidad)
        })
        const accResaltar = document.getElementById("acc-resaltar-ingreso-gasto")
        if (accResaltar) {
            accResaltar.checked = acc.resaltarIngresoGasto !== false
        }

        // Precios de activos
        const preciosAuto = document.getElementById("toggle-precios-auto")
        if (preciosAuto) {
            preciosAuto.checked = prefs?.precios?.autoActualizar === true
        }

        // Tipos de movimiento en el selector (Apariencia)
        const tipos = prefs?.tiposMovimiento || {}
        const marcarTipo = (id, valor) => {
            const el = document.getElementById(id)
            if (el) el.checked = valor !== false
        }
        marcarTipo("toggle-tipo-cambio-divisa", tipos.cambioDivisa)
        marcarTipo("toggle-tipo-compra-activo", tipos.compraActivo)
        marcarTipo("toggle-tipo-venta-activo", tipos.ventaActivo)
        marcarTipo("toggle-tipo-pago-tarjeta", tipos.pagoTarjeta)
        marcarTipo("toggle-tipo-p2p-compra", tipos.p2pCompra)
        marcarTipo("toggle-tipo-p2p-venta", tipos.p2pVenta)
        marcarTipo("toggle-tipo-trade", tipos.trade)

        const periodoEvolucion = prefs?.periodoEvolucion || "30d"
        document.querySelectorAll("#periodo-evolucion .toggle-option").forEach(opcion => {
            opcion.classList.toggle("active", opcion.dataset.periodo === periodoEvolucion)
        })

        const nivelPatrimonio = normalizarNivelResalte(prefs?.resaltarPatrimonio)
        document.querySelectorAll("#resaltar-patrimonio .toggle-option").forEach(opcion => {
            opcion.classList.toggle("active", Number(opcion.dataset.nivel) === nivelPatrimonio)
        })

        actualizarEstadoGuardar()
    } catch (error) {
        console.error("Error cargando preferencias:", error)
    }

    // Divisa
    const divisaSelect = document.getElementById("divisa-principal")
    if (divisaSelect) divisaSelect.value = getDivisaPrincipal()
    const formato = getFormatoDivisa()
    document.querySelectorAll("#formato-divisa .toggle-option").forEach(opcion => {
        opcion.classList.toggle("active", opcion.dataset.formato === formato)
    })

    // Tipo de cambio
    const tc = getTipoCambio()
    refrescarModoTipoCambio(tc.modo === "auto" ? "auto" : "manual")
    const tcUSD = document.getElementById("tc-pen-usd")
    if (tcUSD) {
        tcUSD.value = tc.pen_usd || TIPO_CAMBIO_DEFAULT.pen_usd
    }
}

// El nombre se compara aparte porque vive en el doc del usuario, no en sus
// preferencias.
function hayCambioDeNombre() {
    return nombrePendiente !== null &&
        nombrePendiente !== (sesion.getUsuario()?.nombre || "Usuario").trim()
}

/**
 * ¿Hay algo que guardar?
 *
 * Compara el estado que se lee de la pantalla contra una FOTOGRAFÍA de cómo
 * estaba al abrirse (lineaBase), no contra `sesion.getPreferencias()`.
 * Comparar con la sesión era lo que producía el aviso fantasma: el tema, por
 * ejemplo, se escribe en localStorage cuando se cambia desde la lastbar y en
 * las preferencias cuando se guarda desde aquí, así que las dos fuentes
 * divergen solas y la pantalla aparecía "modificada" sin haber tocado nada.
 *
 * La foto se toma al terminar de cargar, con la pantalla ya pintada con los
 * valores guardados: a partir de ahí, "cambios" significa exactamente "el
 * usuario tocó algo", y volver al valor original deja de contarlo.
 *
 * Se excluye el tipo de cambio porque lo gestiona DivisaServicio y su campo
 * `actualizacion` cambia en cada guardado: compararlo siempre daría "cambios".
 */
function hayCambiosEnVivo() {
    if (hayCambioDeNombre()) return true

    // El modo de la lastbar vive en localStorage, no en las preferencias, así
    // que no entra en la comparación profunda. Se compara con lo guardado en
    // vez de fiarse del flag: si el usuario lo cambia y vuelve al valor que
    // tenía, no hay nada que guardar.
    const lastbarGuardado = localStorage.getItem("escinco_lastbar_mode") || "hide"
    if (lastbarModo !== lastbarGuardado) return true

    if (!lineaBase) return false

    const enPantalla = construirPreferencias()

    // El nombre no forma parte de las preferencias.
    delete enPantalla.nombre

    // La divisa y el tipo de cambio SÍ cuentan como cambio (antes se excluían y
    // el Guardar nunca se habilitaba al tocarlos). Lo único que se ignora es el
    // sello `actualizacion`, que `construirPreferencias()` renueva en cada
    // llamada y haría ver siempre "cambios".
    return !sonIgualEnProfundidad(
        sinSelloActualizacion(enPantalla),
        sinSelloActualizacion(lineaBase)
    )
}

// Copia profunda de las preferencias sin el sello temporal del tipo de cambio.
function sinSelloActualizacion(preferencias) {
    const copia = fusionarProfundo({}, preferencias)
    if (copia.tipoCambio) delete copia.tipoCambio.actualizacion
    return copia
}

function sonIgualEnProfundidad(a, b, ignorar = []) {
    for (const clave of ignorar) delete a[clave]
    for (const clave of ignorar) delete b[clave]

    const clavesA = Object.keys(a)
    const clavesB = Object.keys(b)
    if (clavesA.length !== clavesB.length) return false

    for (const clave of clavesA) {
        const va = a[clave]
        const vb = b[clave]
        if (esObjetoSimple(va) && esObjetoSimple(vb)) {
            if (!sonIgualEnProfundidad(va, vb)) return false
            continue
        }
        if (!esIgual(va, vb)) return false
    }
    return true
}

function configurarDetectorCambios() {
    const ids = [
        "toggle-dashboard",
        "toggle-movimientos",
        "toggle-inversiones",
        "toggle-trading",
        "toggle-tipo-cambio-divisa",
        "toggle-tipo-compra-activo",
        "toggle-tipo-venta-activo",
        "toggle-tipo-pago-tarjeta",
        "toggle-tipo-p2p-compra",
        "toggle-tipo-p2p-venta",
        "toggle-tipo-trade",
        "divisa-principal",
        "tc-pen-usd",
        "tc-eur-usd",
        "seg-inactividad",
        "seg-cerrar-pestana",
        "acc-modales-persistentes",
        "acc-doodles",
        "acc-un-click-seleccion",
        "acc-resaltar-ingreso-gasto",
        "toggle-precios-auto"
    ]

    ids.forEach(id => {
        const el = document.getElementById(id)
        if (el) {
            el.addEventListener("change", () => {
                marcarCambioNuevo()
                actualizarEstadoGuardar()
            })
        }
    })

    const opcionesMovimientos = document.querySelectorAll("#movimientos-recientes .toggle-option")
    opcionesMovimientos.forEach(opcion => {
        opcion.addEventListener("click", () => {
            opcionesMovimientos.forEach(otra => otra.classList.remove("active"))
            opcion.classList.add("active")
            marcarCambioNuevo()
            actualizarEstadoGuardar()
        })
    })
}

function configurarFormatoDivisa() {
    const opciones = document.querySelectorAll("#formato-divisa .toggle-option")
    opciones.forEach(opcion => {
        opcion.addEventListener("click", () => {
            opciones.forEach(otra => otra.classList.remove("active"))
            opcion.classList.add("active")
            marcarCambioNuevo()
            actualizarEstadoGuardar()
        })
    })
}

function configurarLateralidadCuenta() {
    const opciones = document.querySelectorAll("#toggle-lateralidad-cuenta .toggle-option")
    opciones.forEach(opcion => {
        opcion.addEventListener("click", () => {
            opciones.forEach(otra => otra.classList.remove("active"))
            opcion.classList.add("active")
            marcarCambioNuevo()
            actualizarEstadoGuardar()
        })
    })
}

function getLateralidadCuentaUI() {
    return document.querySelector("#toggle-lateralidad-cuenta .toggle-option.active")?.dataset.lateralidad || "derecha"
}

function configurarPeriodoEvolucion() {
    const opciones = document.querySelectorAll("#periodo-evolucion .toggle-option")
    opciones.forEach(opcion => {
        opcion.addEventListener("click", () => {
            opciones.forEach(otra => otra.classList.remove("active"))
            opcion.classList.add("active")
            marcarCambioNuevo()
            actualizarEstadoGuardar()
        })
    })
}

function getPeriodoEvolucionUI() {
    return document.querySelector("#periodo-evolucion .toggle-option.active")?.dataset.periodo || "30d"
}

function configurarResaltarPatrimonio() {
    const opciones = document.querySelectorAll("#resaltar-patrimonio .toggle-option")
    opciones.forEach(opcion => {
        opcion.addEventListener("click", () => {
            opciones.forEach(otra => otra.classList.remove("active"))
            opcion.classList.add("active")
            marcarCambioNuevo()
            actualizarEstadoGuardar()
        })
    })
}

function getNivelResalteUI() {
    return normalizarNivelResalte(document.querySelector("#resaltar-patrimonio .toggle-option.active")?.dataset.nivel)
}

function getFormatoDivisaUI() {
    return document.querySelector("#formato-divisa .toggle-option.active")?.dataset.formato || "simbolo"
}

function getModoTipoCambioUI() {
    const opt = document.querySelector("#tc-modo .toggle-option.active")
    return opt?.dataset.modo || null
}

function refrescarModoTipoCambio(modo = null) {
    const modoActual = modo || (getTipoCambio().modo === "auto" ? "auto" : "manual")
    const opciones = document.querySelectorAll("#tc-modo .toggle-option")

    opciones.forEach(opt => {
        opt.classList.toggle("active", opt.dataset.modo === modoActual)
    })

    const esAuto = modoActual === "auto"
    const inputManual = document.getElementById("tc-input-manual")
    const inputAuto = document.getElementById("tc-input-auto")
    const tcUSD = document.getElementById("tc-pen-usd")
    const tcEUR = document.getElementById("tc-eur-usd")

    if (inputManual) inputManual.hidden = esAuto
    if (inputAuto) inputAuto.hidden = !esAuto
    if (tcUSD) tcUSD.disabled = esAuto
    if (tcEUR) tcEUR.disabled = esAuto

    actualizarInfoAuto()
}

function actualizarInfoAuto() {
    const tc = getTipoCambio()
    const penUSD = tc.pen_usd || TIPO_CAMBIO_DEFAULT.pen_usd
    const eurUSD = tc.eur_usd || TIPO_CAMBIO_DEFAULT.eur_usd

    const valorAuto = document.getElementById("tc-valor-auto")
    if (valorAuto) {
        valorAuto.textContent = `1 USD = ${Number(penUSD).toFixed(2)} PEN · ${Number(eurUSD).toFixed(2)} EUR`
    }

    const fechaAuto = document.getElementById("tc-fecha-auto")
    if (fechaAuto) {
        if (tc.modo === "auto" && tc.actualizacion) {
            const fecha = new Date(tc.actualizacion)
            fechaAuto.textContent = `Última actualización: ${fecha.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}`
        } else {
            fechaAuto.textContent = "Aún sin actualización automática"
        }
    }
}

function configurarTipoCambio() {
    const opciones = document.querySelectorAll("#tc-modo .toggle-option")

    opciones.forEach(opt => {
        opt.addEventListener("click", () => {
            opciones.forEach(o => o.classList.remove("active"))
            opt.classList.add("active")
            refrescarModoTipoCambio(opt.dataset.modo)
            actualizarEstadoGuardar()
        })
    })

    const btnActualizar = document.getElementById("tc-actualizar-btn")
    if (btnActualizar) {
        btnActualizar.addEventListener("click", actualizarTipoCambioAutomatico)
    }
}

async function actualizarTipoCambioAutomatico() {
    const btn = document.getElementById("tc-actualizar-btn")
    const btnText = btn?.querySelector(".tc-btn-text")
    const status = document.getElementById("tc-status")
    const autoBox = document.getElementById("tc-input-auto")
    const valorAuto = document.getElementById("tc-valor-auto")
    const fechaAuto = document.getElementById("tc-fecha-auto")

    autoBox?.setAttribute("aria-busy", "true")
    if (valorAuto) valorAuto.innerHTML = skeletonMarkup({ rows: 1, className: "skeleton-exchange" })
    if (fechaAuto) fechaAuto.innerHTML = skeletonText()

    if (status) {
        status.hidden = true
        status.textContent = ""
    }

    if (btn) {
        btn.disabled = true
        if (btnText) btnText.textContent = "Actualizando..."
    }

    try {
        const penUSD = await actualizarTipoCambioAuto(uid)

        const tcUSD = document.getElementById("tc-pen-usd")
        if (tcUSD) tcUSD.value = penUSD

        actualizarInfoAuto()
        marcarCambioNuevo()
        actualizarEstadoGuardar()
        mostrarNotificacion("exito", `Tipo de cambio actualizado: 1 USD = ${penUSD.toFixed(2)} PEN`)
    } catch (error) {
        if (status) {
            status.textContent = "No se pudo actualizar; se mantiene el valor actual"
            status.hidden = false
        }
        mostrarNotificacion("error", `No se pudo actualizar el tipo de cambio: ${error.message}`)
    } finally {
        actualizarInfoAuto()
        autoBox?.removeAttribute("aria-busy")
        if (btn) {
            btn.disabled = false
            if (btnText) btnText.textContent = "Actualizar ahora"
        }
    }
}

// ============================================
// AVISO DE CAMBIOS SIN GUARDAR
// ============================================
// El aviso depende de cómo se esté viendo la configuración:
//
// · Panel → no hay navegación que abandonar; salta al cerrar la ventana
//   (onCancel de abrirConfiguracion).
// · Página → salta al cambiar de pestaña (router → "pagina-cambiando"), con
//   el snapshot de las preferencias tomado ANTES de que el router desmonte
//   la página, porque después el DOM ya no existe.
//
// La navegación nunca se bloquea. Si el usuario descarta el aviso, no se
// vuelve a mostrar hasta que vuelva a tocar algún control o guarde.

let avisoDescartado = false
let avisoCambiosActivo = false

// El usuario volvió a tocar un control → el aviso descartado se rehabilita.
function marcarCambioNuevo() {
    avisoDescartado = false
}

document.addEventListener("pagina-cambiando", (event) => {
    if (modoActual !== "ruta") return
    if (event.detail?.desde !== "configuracion") return
    if (!hayCambios || avisoDescartado || avisoCambiosActivo) return

    const preferenciasPendientes = construirPreferencias()
    avisoCambiosActivo = true

    mostrarNotificacion("warning", "¿Guardar cambios?", 0, [
        {
            texto: "Aceptar",
            primaria: true,
            alClick: () => aplicarPreferencias(preferenciasPendientes)
        },
        {
            texto: "Cancelar",
            clase: "cancel",
            alClick: () => {}
        }
    ], () => {
        avisoCambiosActivo = false
        avisoDescartado = true
    })
})

// ============================================
// ESTADO DEL BOTÓN GUARDAR
// ============================================
// El Guardar se atenúa mientras no haya nada que guardar. En modo Modal es el
// botón de confirmar del modal; en modo Panel, el del pie y el de la lastbar.

function actualizarEstadoGuardar() {
    hayCambios = hayCambiosEnVivo()

    if (modoActual === "ruta") {
        document.querySelector('.lastbar .item[data-accion="guardar"]')
            ?.classList.toggle("desact", !hayCambios)
        return
    }

    const botonGuardar = modalConfiguracion?.querySelector("#modal-confirm")
    if (botonGuardar) {
        botonGuardar.classList.toggle("desact", !hayCambios)
        if (hayCambios) botonGuardar.removeAttribute("disabled")
        else botonGuardar.setAttribute("disabled", "true")
    }
}

function construirPreferencias() {
    const divisaPrincipal = document.getElementById("divisa-principal")?.value || "pen"
    const modoTCUI = getModoTipoCambioUI()
    const tcActual = getTipoCambio()

    const penUSD = modoTCUI === "auto"
        ? tcActual.pen_usd || TIPO_CAMBIO_DEFAULT.pen_usd
        : parseFloat(document.getElementById("tc-pen-usd")?.value) || TIPO_CAMBIO_DEFAULT.pen_usd

    const eurUSD = modoTCUI === "auto"
        ? tcActual.eur_usd || TIPO_CAMBIO_DEFAULT.eur_usd
        : parseFloat(document.getElementById("tc-eur-usd")?.value) || TIPO_CAMBIO_DEFAULT.eur_usd

    const tipoCambio = {
        pen_usd: penUSD,
        eur_usd: eurUSD,
        usdt_usd: tcActual.usdt_usd || TIPO_CAMBIO_DEFAULT.usdt_usd,
        modo: modoTCUI,
        actualizacion: modoTCUI === "auto"
            ? tcActual.actualizacion || new Date().toISOString()
            : new Date().toISOString()
    }

    const segInactividadUI = parseInt(document.getElementById("seg-inactividad")?.value, 10)
    const seg = {
        inactividadMinutos: Number.isFinite(segInactividadUI) ? segInactividadUI : 15,
        cerrarAlCerrarPestana: document.getElementById("seg-cerrar-pestana")?.checked !== false
    }

    const accesibilidad = {
        modalesPersistentes: document.getElementById("acc-modales-persistentes")?.checked === true,
        doodles: document.getElementById("acc-doodles")?.checked === true,
        unClickSeleccion: document.getElementById("acc-un-click-seleccion")?.checked === true,
        lateralidadCuentaInfo: getLateralidadCuentaUI(),
        resaltarIngresoGasto: document.getElementById("acc-resaltar-ingreso-gasto")?.checked !== false,
        configComoPagina: document.querySelector("#toggle-config-modo .toggle-option.active")?.dataset.configModo !== "modal"
    }

    const tiposMovimiento = {
        cambioDivisa: document.getElementById("toggle-tipo-cambio-divisa")?.checked !== false,
        compraActivo: document.getElementById("toggle-tipo-compra-activo")?.checked === true,
        ventaActivo: document.getElementById("toggle-tipo-venta-activo")?.checked === true,
        pagoTarjeta: document.getElementById("toggle-tipo-pago-tarjeta")?.checked === true,
        p2pCompra: document.getElementById("toggle-tipo-p2p-compra")?.checked !== false,
        p2pVenta: document.getElementById("toggle-tipo-p2p-venta")?.checked !== false,
        trade: document.getElementById("toggle-tipo-trade")?.checked !== false
    }

    const precios = {
        autoActualizar: document.getElementById("toggle-precios-auto")?.checked === true
    }

    return {
        tema: temaActual,
        periodoEvolucion: getPeriodoEvolucionUI(),
        resaltarPatrimonio: getNivelResalteUI(),
        movimientosRecientes: leerCantidadMovimientos() ?? (sesion.getPreferencias().movimientosRecientes ?? CANTIDAD_MOVIMIENTOS_DEFAULT),
        paginas: {
            dashboard: document.getElementById("toggle-dashboard")?.checked !== false,
            cuentas: true,
            movimientos: document.getElementById("toggle-movimientos")?.checked !== false,
            inversiones: document.getElementById("toggle-inversiones")?.checked !== false,
            trading: document.getElementById("toggle-trading")?.checked !== false,
            configuracion: true
        },
        divisaPrincipal,
        formatoDivisa: getFormatoDivisaUI(),
        tipoCambio,
        seg,
        accesibilidad,
        tiposMovimiento,
        precios
    }
}

async function aplicarPreferencias(preferencias) {
    try {
        // Nombre pendiente → auth + doc de usuario
        if (nombrePendiente && nombrePendiente !== sesion.getUsuario()?.nombre) {
            await actualizarNombre(nombrePendiente)
            sesion.setUsuario({ ...sesion.getUsuario(), nombre: nombrePendiente })
            nombrePendiente = null
        }

        const tc = preferencias.tipoCambio

        // Divisa y tipo de cambio se persisten vía DivisaServicio. En modo
        // "auto" se conserva la actualizacion previa (el TC no cambió).
        await guardarDivisaPrincipal(uid, preferencias.divisaPrincipal)
        await guardarTipoCambio(
            uid,
            tc.pen_usd,
            tc.modo,
            tc.modo === "auto" && tc.actualizacion ? tc.actualizacion : null,
            { eur_usd: tc.eur_usd, usdt_usd: tc.usdt_usd }
        )

        // En Firestore solo queda lo que se aparta del default. Volver a marcar
        // un default borra su clave en vez de reescribirla, y un usuario que
        // nunca toco nada no tiene documento de preferencias.
        const { set, unset } = diferenciasContraDefaults(preferencias)
        await aplicarPreferenciasDiff(uid, { set, unset })

        // En memoria si se guarda el estado completo (defaults incluidos): la
        // app lee siempre desde ahi.
        sesion.setPreferencias(preferencias)

        // Aplicar de inmediato la seguridad configurada
        try {
            await aplicarPersistenciaSesion(preferencias.seg.cerrarAlCerrarPestana)
        } catch (error) {
            console.warn("[WARN] No se pudo aplicar la persistencia de sesión:", error)
        }
        startInactivityTimer()

        // Persistir tema y modo de lastbar en localStorage
        setTemaLocal(temaActual)
        localStorage.setItem("escinco_lastbar_mode", lastbarModo)

        actualizarNavegacion(preferencias.paginas)
        nombrePendiente = null
        hayCambios = false
        avisoDescartado = false
        // Lo recién guardado pasa a ser la nueva referencia: a partir de aquí
        // solo cuenta como cambio lo que se toque después.
        lineaBase = construirPreferencias()
        actualizarEstadoGuardar()

        mostrarNotificacion("exito", "Cambios guardados")
    } catch (error) {
        console.error("Error guardando preferencias:", error)
        mostrarNotificacion("error", "No se pudieron guardar las preferencias")
    }
}

// ============================================
// PREFERENCIAS · DIFF CONTRA LOS DEFAULTS
// ============================================
// El documento de Firestore guarda solo lo que se aparta del default: un
// usuario recien creado no tiene nada escrito, y volver a marcar un default
// BORRA la clave en vez de guardar el valor por escrito.
//
// Se comparan contra PREFERENCIAS_POR_DEFECTO (js/core/sesion.js), que es la
// unica fuente de verdad. Antes esta comparacion vivia aqui, con los defaults
// repetidos a mano, y por eso la slightest desincronizacion hacia que el
// Guardar se activara solo.

// Una hoja (no un grupo): se compara con igualdad estricta.
function esIgual(a, b) {
    if (typeof a === "number" && typeof b === "number") {
        return Number.isNaN(a) && Number.isNaN(b) ? true : a === b
    }
    return a === b
}

// Un grupo es un objeto; una hoja es un valor simple.
function esObjetoSimple(valor) {
    return esObjetoPlano(valor)
}

/**
 * Calcula que hay que escribir y que hay que borrar para que Firestore guarde
 * exactamente lo que se aparta de los defaults.
 *
 * No necesita saber que hay guardado ahora mismo: borrar una clave que no
 * existe no hace nada en Firestore, asi que el resultado es idempotente y se
 * puede reaplicar sin riesgo.
 *
 * @param {Object} preferencias  estado completo de la pantalla
 * @returns {{set: Object, unset: string[]}}
 */
export function diferenciasContraDefaults(preferencias) {
    const set = {}
    const unset = []

    const recorrer = (valor, porDefecto, ruta) => {
        for (const [clave, porDefectoHijo] of Object.entries(porDefecto)) {
            const rutaHija = ruta ? `${ruta}.${clave}` : clave

            if (esObjetoSimple(porDefectoHijo)) {
                // Se baja al grupo de la PANTALLA que corresponde a este grupo
                // del default, no al valor padre: `valor.accesibilidad.doodles`.
                recorrer(valor?.[clave] || {}, porDefectoHijo, rutaHija)
                continue
            }

            // Si la pantalla no tiene el campo, no hay nada que decidir.
            if (!valor || typeof valor !== "object" || !(clave in valor)) continue

            const valorHijo = valor[clave]
            if (esIgual(valorHijo, porDefectoHijo)) unset.push(rutaHija)
            else set[rutaHija] = valorHijo
        }
    }

    recorrer(preferencias, PREFERENCIAS_POR_DEFECTO, "")
    return { set, unset: [...new Set(unset)] }
}

async function guardarPreferencias() {
    await aplicarPreferencias(construirPreferencias())
}

function actualizarNavegacion(paginas) {
    document.querySelectorAll(".nav-container a").forEach(link => {
        const page = link.dataset.page
        if (page && paginas[page] === false) {
            link.classList.add("nav-oculto")
        } else {
            link.classList.remove("nav-oculto")
        }
    })
}

// ============================================
// LASTRAR · AUTO-HIDE
// ============================================

function configurarLastbar() {
    lastbarModo = localStorage.getItem("escinco_lastbar_mode") || "hide"
    const opciones = document.querySelectorAll("#toggle-lastbar .toggle-option")

    opciones.forEach(opt => {
        opt.classList.toggle("active", opt.dataset.lastbar === lastbarModo)
    })

    aplicarModoLastbar(lastbarModo)

    opciones.forEach(opt => {
        opt.addEventListener("click", () => {
            opciones.forEach(o => o.classList.remove("active"))
            opt.classList.add("active")

            // Aplicar visualmente sin persistir (se guarda con el botón Guardar)
            lastbarModo = opt.dataset.lastbar
            marcarCambioNuevo()
            aplicarModoLastbar(lastbarModo)

            actualizarEstadoGuardar()
        })
    })
}

function aplicarModoLastbar(modo) {
    const lastbar = document.querySelector(".lastbar")
    if (!lastbar) return

    lastbar.classList.toggle("lastbar-always-visible", modo === "show")
}

// ============================================
// BOTONES · LOGOUT, EXPORT, IMPORT, DELETE
// ============================================

function configurarBotones() {
    document.getElementById("logout-btn")?.addEventListener("click", abrirModalLogout)
    document.getElementById("export-dvid")?.addEventListener("click", exportarDVID)
    document.getElementById("import-dvid")?.addEventListener("click", importarDVID)
    document.getElementById("delete-data")?.addEventListener("click", eliminarTodosLosDatos)
    document.getElementById("delete-account")?.addEventListener("click", abrirModalEliminarCuenta)
    document.getElementById("restore-cuentas")?.addEventListener("click", abrirRestaurarCuentasArchivadas)
    document.getElementById("abrir-atajos")?.addEventListener("click", () => {
        import("../core/atajos.js").then(m => m.abrirModalAtajos())
    })
}

// ============================================
// PÁGINA O PANEL
// ============================================
// La ventana (panel) es el comportamiento por defecto. Como página, la
// configuración vuelve a ser una ruta más del router: el engranaje navega,
// el botón Guardar vive en la lastbar y el aviso de cambios sin guardar
// salta al cambiar de pestaña.

export function configComoPagina() {
    // Antes que undefined significaba "panel ventana"; ahora el predeterminado
    // es el panel con #panel, asi que solo un false explicito pide el modal.
    return sesion.getPreferencias()?.accesibilidad?.configComoPagina !== false
}

function configurarModoConfiguracion() {
    const opciones = document.querySelectorAll("#toggle-config-modo .toggle-option")
    const activo = modoConfigActual()

    opciones.forEach(opt => {
        opt.classList.toggle("active", opt.dataset.configModo === activo)
        opt.addEventListener("click", () => {
            if (opt.dataset.configModo === activo) return
            opciones.forEach(o => o.classList.remove("active"))
            opt.classList.add("active")
            marcarCambioNuevo()
            // No se persiste al instante: la pantalla tiene su propio Guardar.
            // Mientras tanto el engranaje sigue con el modo viejo, que es lo
            // coherente con el resto de cambios de esta pantalla.
        })
    })
}

// "panel" = los ajustes dentro del #panel con ruta propia (lo predeterminado).
// "modal"  = la ventana grande sobre la página actual.
//
// Se sigue guardando en `accesibilidad.configComoPagina`, donde true significaba
// "página con #panel". La variable mantiene el nombre para no invalidar lo que
// ya tienen guardado los usuarios: false = modal (lo que antes era "panel"
// ventana), true = panel.
function modoConfigActual() {
    return configComoPagina() ? "panel" : "modal"
}

export function abrirModalLogout() {
    abrirModal({
        titulo: "Cerrar sesión",
        contenido: contenidoDesdeTemplate("tpl-confirmar-logout"),
        variante: "confirm",
        confirmText: "Cerrar sesión",
        cancelText: "Cancelar",
        onConfirm: async () => {
            await logout()
            window.location.replace("/login")
            return true
        }
    })
}

// ============================================
// EXPORTAR (reutiliza js/ui/exportar.js)
// ============================================

async function exportarDVID() {
    await accionExportar()
}

// ============================================
// RESTAURAR CUENTAS ARCHIVADAS
// ============================================
// Archivar no borra nada: solo marca la cuenta con estado "archivada" y a
// partir de ahí desaparece del sidebar, de los selectores de movimientos y
// del dashboard. Los movimientos no se tocan, así que restaurar la cuenta
// los devuelve a la vista con su saldo intacto.

async function obtenerCuentasArchivadas() {
    const todas = await obtenerCuentas(sesion.uid)
    return todas.filter(cuenta => cuenta.estado === "archivada")
        .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0))
}

async function refrescarContadorArchivadas() {
    const hint = document.getElementById("restore-cuentas-hint")
    if (!hint) return
    try {
        const archivadas = await obtenerCuentasArchivadas()
        const boton = document.getElementById("restore-cuentas")
        if (boton) boton.disabled = archivadas.length === 0
        hint.textContent = archivadas.length === 0
            ? "No tienes cuentas archivadas."
            : `Tienes ${archivadas.length} archivada${archivadas.length === 1 ? "" : "s"}. ` +
              "Ocultas, no borradas: sus movimientos y saldos se conservan tal cual."
    } catch (error) {
        console.warn("No se pudo contar las cuentas archivadas:", error)
    }
}

async function abrirRestaurarCuentasArchivadas() {
    let archivadas
    try {
        archivadas = await obtenerCuentasArchivadas()
    } catch (error) {
        console.error("Error al leer las cuentas archivadas:", error)
        mostrarNotificacion("error", "No se pudieron leer las cuentas archivadas")
        return
    }

    if (archivadas.length === 0) {
        mostrarNotificacion("info", "No tienes cuentas archivadas")
        return
    }

    const opciones = contenidoDesdeFilas("tpl-cuenta-archivable", archivadas, cuenta => ({
        valores: {
            id: cuenta.id,
            nombre: cuenta.nombre || "Cuenta",
            saldo: formatearMontoConDivisa(cuenta.saldoInicial || 0, cuenta.moneda)
        }
    }))

    const modal = abrirModal({
        titulo: "Restaurar cuentas archivadas",
        contenido: contenidoDesdeTemplate("tpl-restaurar-cuentas", { html: { opciones } }),
        confirmText: "Restaurar",
        cancelText: "Cancelar",
        onConfirm: async () => {
            const elegidas = [...modal.querySelectorAll('input[type="checkbox"]:checked')]
                .map(input => input.value)
            if (elegidas.length === 0) {
                mostrarNotificacion("info", "No seleccionaste ninguna cuenta")
                return false
            }

            try {
                for (const id of elegidas) {
                    await actualizarCuenta(sesion.uid, id, { estado: "activa" })
                }
                cacheCapa.invalidar(sesion.uid, "cuentas")
                mostrarNotificacion(
                    "exito",
                    `${elegidas.length} cuenta${elegidas.length === 1 ? "" : "s"} restaurada${elegidas.length === 1 ? "" : "s"}`
                )
                // La página de cuentas mantiene su propia copia en memoria: hay
                // que avisarla para que repinte al volver.
                window.dispatchEvent(new CustomEvent("cuentas-actualizadas"))
                await refrescarContadorArchivadas()
                return true
            } catch (error) {
                console.error("Error restaurando cuentas:", error)
                mostrarNotificacion("error", `No se pudieron restaurar: ${error.message}`)
                return false
            }
        }
    })
}

// ============================================
// IMPORTAR
// ============================================

async function importarDVID() {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".dvid,application/x-escinco-backup"

    input.onchange = async (e) => {
        const archivo = e.target.files[0]
        if (!archivo) return

        try {
            const { previsualizarImportacion } = await import("../services/ImportarServicio.js")
            const preview = await previsualizarImportacion(archivo)

            abrirModalPreviewImportacion(archivo, preview)
        } catch (error) {
            console.error("Error previsualizando:", error)
            abrirModal({
                titulo: "Archivo inválido",
                contenido: contenidoDesdeTemplate("tpl-archivo-invalido", {
                    valores: { error: error.message }
                }),
                variante: "info",
                confirmText: "Cerrar",
                onConfirm: () => true
            })
        }
    }

    input.click()
}

function abrirModalPreviewImportacion(archivo, preview) {
    abrirModal({
        titulo: "Previsualización",
        contenido: contenidoDesdeTemplate("tpl-preview-importacion", {
            valores: {
                formato: `${preview.formato} v${preview.version}`,
                "version-minima": `v${preview.versionMinima || "2.0.0"}`,
                exportado: new Date(preview.fechaExportacion).toLocaleString(),
                cuentas: preview.resumen.cuentas,
                movimientos: preview.resumen.movimientos,
                activos: preview.resumen.activos,
                pendientes: preview.resumen.pendientes,
                posiciones: preview.resumen.posiciones || 0,
                historial: preview.resumen.historial || 0,
                snapshots: preview.resumen.snapshots
            }
        }),
        variante: "form",
        confirmText: "Importar",
        cancelText: "Cancelar",
        onConfirm: async () => {
            cerrarModal()

            setTimeout(() => {
                abrirModal({
                    titulo: "Importando...",
                    contenido: contenidoDesdeTemplate("tpl-cargando", {
                        valores: { texto: "Importando datos..." },
                        html: { logo: LOGO_ESCINCO_CARGA }
                    }),
                    variante: "narrow",
                    confirmText: null,
                    cancelText: null,
                    // La importación no se puede deshacer: el modal de progreso
                    // no se cierra hasta que la operación termine (ver BUG-019).
                    cerrarAlClickFuera: false,
                    cerrarConEsc: false,
                    cerrarConBotonX: false
                })
            }, 100)

            try {
                const { importarDVID: importar } = await import("../services/ImportarServicio.js")
                const resultado = await importar(uid, archivo)

                cerrarModal()

                setTimeout(() => {
                    abrirModal({
                        titulo: "Importación completada",
                        contenido: contenidoDesdeTemplate("tpl-resultado-importacion", {
                            valores: {
                                cuentas: resultado.cuentas,
                                movimientos: resultado.movimientos,
                                activos: resultado.activos,
                                pendientes: resultado.pendientes,
                                posiciones: resultado.posiciones || 0,
                                historial: resultado.historial || 0,
                                snapshots: resultado.snapshots,
                                errores: resultado.errores?.length
                                    ? `${resultado.errores.length} errores menores`
                                    : ""
                            }
                        }),
                        variante: "info",
                        confirmText: "Recargar",
                        onConfirm: () => {
                            window.location.reload()
                            return true
                        }
                    })
                }, 100)
            } catch (error) {
                console.error("Error importando:", error)
                cerrarModal()
                setTimeout(() => {
                    abrirModal({
                        titulo: "Error al importar",
                        contenido: contenidoDesdeTemplate("tpl-error", {
                            valores: { error: error.message }
                        }),
                        variante: "info",
                        confirmText: "Cerrar",
                        onConfirm: () => true
                    })
                }, 100)
            }

            return false
        }
    })
}

// ============================================
// ELIMINAR DATOS
// ============================================

function eliminarTodosLosDatos() {
    abrirModal({
        titulo: "Eliminar todos los datos",
        contenido: contenidoDesdeTemplate("tpl-eliminar-todos"),
        variante: "confirm",
        confirmText: "Continuar",
        cancelText: "Cancelar",
        onConfirm: () => {
            cerrarModal()
            setTimeout(() => conReautenticacion(confirmarEliminacionFinal), 100)
            return false
        }
    })
}

function confirmarEliminacionFinal() {
    abrirModal({
        titulo: "Confirmación final",
        contenido: contenidoDesdeTemplate("tpl-confirmar-escritura", {
            valores: { campo: "confirmar-eliminar" }
        }),
        variante: "confirm",
        confirmText: "Eliminar todo",
        cancelText: "Cancelar",
        onConfirm: async () => {
            const input = document.getElementById("confirmar-eliminar")
            const valor = input?.value.trim().toUpperCase()

            if (valor !== "ELIMINAR") {
                input.classList.add("input-error")
                input.focus()
                return false
            }

            cerrarModal()
            await new Promise(resolve => setTimeout(resolve, 100))

            const modalCargando = abrirModal({
                titulo: "Eliminando datos",
                contenido: contenidoDesdeTemplate("tpl-cargando", {
                    valores: { texto: "Descargando respaldo..." },
                    html: { logo: LOGO_ESCINCO_CARGA }
                }),
                variante: "narrow",
                confirmText: null,
                cancelText: null,
                // El borrado no se puede deshacer: el modal de progreso no se
                // cierra hasta que la operación termine (ver BUG-019).
                cerrarAlClickFuera: false,
                cerrarConEsc: false,
                cerrarConBotonX: false
            })

            try {
                const status = modalCargando.querySelector(".modal-loading-text")

                const { exportarDVID } = await import("../services/ExportarServicio.js")
                await exportarDVID(uid)

                if (status) status.textContent = "Eliminando datos..."

                const { eliminarTodosLosDatos: eliminar } = await import("../services/EliminarServicio.js")
                const resultado = await eliminar(uid)

                cerrarModal()
                await new Promise(resolve => setTimeout(resolve, 100))

                const total = Object.values(resultado).reduce((a, b) => a + b, 0)

                abrirModal({
                    titulo: "Datos eliminados",
                    contenido: contenidoDesdeTemplate("tpl-resultado-simple", {
                        valores: {
                            descripcion: "Todos los datos han sido eliminados.",
                            "etiqueta-total": "Total eliminados",
                            total
                        }
                    }),
                    variante: "info",
                    confirmText: "Recargar",
                    onConfirm: () => {
                        window.location.reload()
                        return true
                    }
                })
            } catch (error) {
                console.error("Error eliminando:", error)
                cerrarModal()
                await new Promise(resolve => setTimeout(resolve, 100))

                abrirModal({
                    titulo: "Error al eliminar",
                    contenido: contenidoDesdeTemplate("tpl-error", {
                        valores: { error: error.message }
                    }),
                    variante: "info",
                    confirmText: "Cerrar",
                    onConfirm: () => true
                })
            }

            return false
        }
    })
}

// ============================================
// ELIMINAR CUENTA
// ============================================

function abrirModalEliminarCuenta() {
    abrirModal({
        titulo: "Eliminar cuenta",
        contenido: contenidoDesdeTemplate("tpl-eliminar-cuenta"),
        variante: "confirm",
        confirmText: "Continuar",
        cancelText: "Cancelar",
        onConfirm: () => {
            cerrarModal()
            setTimeout(() => conReautenticacion(abrirModalConfirmacionFinal), 100)
            return false
        }
    })
}

/**
 * Ejecuta `alContinuar` cuando la sesión es reciente. Si no lo es, pide
 * reautenticación (contraseña o Google). Si el usuario cancela, no continúa.
 */
function conReautenticacion(alContinuar) {
    if (esSesionReciente()) {
        alContinuar()
        return
    }

    if (tienePassword()) {
        abrirModalReauthPassword(alContinuar)
    } else {
        abrirModalReauthGoogle(alContinuar)
    }
}

function abrirModalReauthPassword(alContinuar) {
    abrirModal({
        titulo: "Reautenticación requerida",
        contenido: contenidoDesdeTemplate("tpl-reauth-password"),
        variante: "confirm",
        confirmText: "Verificar",
        cancelText: "Cancelar",
        onConfirm: async () => {
            const input = document.getElementById("reauth-password")
            const password = input?.value || ""

            if (!password) {
                input.classList.add("input-error")
                input.focus()
                return false
            }

            try {
                await reautenticarConPassword(password)
            } catch (error) {
                const msg = document.getElementById("reauth-error")
                input.classList.add("input-error")
                if (msg) {
                    msg.textContent = error.message || "Contraseña incorrecta"
                    msg.hidden = false
                }
                input.focus()
                return false
            }

            cerrarModal()
            setTimeout(() => alContinuar(), 100)
            return false
        }
    })
}

function abrirModalReauthGoogle(alContinuar) {
    abrirModal({
        titulo: "Reautenticación requerida",
        contenido: contenidoDesdeTemplate("tpl-reauth-google"),
        variante: "confirm",
        confirmText: "Continuar con Google",
        cancelText: "Cancelar",
        onConfirm: async () => {
            // El popup se dispara aquí, en contexto de clic (onConfirm se
            // ejecuta de forma síncrona desde el botón), para que el
            // navegador no lo bloquee.
            try {
                await reautenticarConGoogle()
            } catch (error) {
                cerrarModal()
                await new Promise(resolve => setTimeout(resolve, 100))
                abrirModalErrorEliminar(error)
                return false
            }

            cerrarModal()
            setTimeout(() => alContinuar(), 100)
            return false
        }
    })
}

function abrirModalConfirmacionFinal() {
    abrirModal({
        titulo: "Confirmación final",
        contenido: contenidoDesdeTemplate("tpl-confirmar-escritura", {
            valores: { campo: "confirmar-eliminar-cuenta" }
        }),
        variante: "confirm",
        confirmText: "Eliminar cuenta",
        cancelText: "Cancelar",
        onConfirm: async () => {
            const input = document.getElementById("confirmar-eliminar-cuenta")
            const valor = input?.value.trim().toUpperCase()

            if (valor !== "ELIMINAR") {
                input.classList.add("input-error")
                input.focus()
                return false
            }

            cerrarModal()
            await new Promise(resolve => setTimeout(resolve, 100))

            const modalCargando = abrirModal({
                titulo: "Eliminando cuenta",
                contenido: contenidoDesdeTemplate("tpl-cargando", {
                    valores: { texto: "Descargando respaldo..." },
                    html: { logo: LOGO_ESCINCO_CARGA }
                }),
                variante: "narrow",
                confirmText: null,
                cancelText: null,
                // El borrado no se puede deshacer: el modal de progreso no se
                // cierra hasta que la operación termine (ver BUG-019).
                cerrarAlClickFuera: false,
                cerrarConEsc: false,
                cerrarConBotonX: false
            })

            try {
                const status = modalCargando.querySelector(".modal-loading-text")

                const { eliminarCuenta } = await import("../services/EliminarServicio.js")
                await eliminarCuenta(uid)

                if (status) status.textContent = "Cuenta eliminada. Redirigiendo..."

                await new Promise(resolve => setTimeout(resolve, 600))
                window.location.replace("/login")
            } catch (error) {
                console.error("Error eliminando cuenta:", error)
                cerrarModal()
                await new Promise(resolve => setTimeout(resolve, 100))
                abrirModalErrorEliminar(error)
            }

            return false
        }
    })
}

function abrirModalErrorEliminar(error) {
    abrirModal({
        titulo: "Error al eliminar la cuenta",
        contenido: contenidoDesdeTemplate("tpl-error", {
            valores: { error: error.message }
        }),
        variante: "info",
        confirmText: "Cerrar",
        onConfirm: () => true
    })
}