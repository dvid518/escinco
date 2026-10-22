import { initTemaLocal, getTemaLocal, cambiarTemaLocal } from "../core/tema.js"
import { initPWA } from "../core/pwa.js"
import { contenidoDesdeTemplate } from "../ui/modal.js"
import { crearGraficoPatrimonio, crearGraficoDistribucion } from "../ui/graficos.js"

// ============================================
// LANDING
// ============================================
// Página pública en "/": no redirige a ninguna parte; siempre muestra la
// landing. El dashboard se carga solo en /dashboard (y /app), y es él quien
// expulsa a /login cuando no hay sesión.

// El arranque está al FINAL del módulo, a propósito: initLanding() usa las
// constantes de más abajo y las declaraciones `const` no existen hasta que se
// ejecutan. Llamarla desde arriba las encontraría en su zona muerta temporal.

// ============================================
// INICIO DE LA LANDING
// ============================================

function initLanding() {
    initBotonTema()
    initMarca()
    initNavMaqueta()
    initFaq()
    initGraficosMaqueta().catch(error => {
        console.error("[ERROR] No se pudieron pintar los gráficos de la maqueta:", error)
    })
}

// ============================================
// NAVBAR DE LA MAQUETA · NO NAVEGA
// ============================================
// Los tabs y el engranaje son los de la app, con sus rutas reales, pero en una
// maqueta no hay nada detrás: pinchar "Cuentas" llevaría a /cuentas, el
// dashboard vería que no hay sesión y devolvería a /login, y el visitante
// volvería donde estaba. Se corta el clic aquí.

function initNavMaqueta() {
    document.querySelector(".home-maqueta-nav")?.addEventListener("click", evento => {
        if (evento.target.closest("a")) evento.preventDefault()
    })
}

// ============================================
// MARCA · EL NOMBRE SE REPLIEGA
// ============================================
// Al entrar se lee "escinco" entero. A los 3 segundos el "inco" se retira hacia
// la derecha y queda solo "esc" junto al logo; al pasar el cursor por el
// contenedor vuelve a salir. El enlace sigue siendo "/".
//
// El texto no se quita del DOM en ningún momento: el corte es visual (max-width
// + overflow), así que el nombre completo sigue en el marcado y el aria-label
// del enlace lo dice entero para quien no ve la animación.

const RETRAPOSO_MARCA_MS = 3000

function initMarca() {
    const nombre = document.getElementById("home-marca-nombre")
    if (!nombre) return

    // Con movimiento reducido no hay nada que enseñar: se deja el nombre
    // entero en vez de animarlo y esperar tres segundos para nada.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    setTimeout(() => {
        nombre.classList.add("home-marca-replegada")
    }, RETRAPOSO_MARCA_MS)
}

// ============================================
// PREGUNTAS · ENTRADA Y SALIDA ANIMADAS
// ============================================
// El <details> nativo abre y cierra de golpe: no hay altura que transicionar
// porque la decide el navegador. Se sustituye el comportamiento por defecto con
// height + opacity sobre la respuesta.
//
// El detalle que hace funcionar el CIERRE es no quitar `open` hasta que termina
// la animación. Un <details> sin `open` oculta su contenido por sí solo, así
// que si se quitara al empezar, el colapso se dibujaría sobre algo ya
// invisible: abriría y cerraría a la vez. Por eso `open` se retira en
// `onfinish`, y para que un segundo clic a mitad de cierre no se pierda por el
// camino, el estado va explícito en vez de leerse de `item.open`.
//
// Se anima la altura y no un `max-height` fijo porque la respuesta se mide, y
// así da igual cuánto texto tenga. Sin JS, o con movimiento reducido, el
// elemento se abre y cierra igual, solo que sin animación.

const DURACION_FAQ_MS = 260
const CURVA_FAQ = "cubic-bezier(0.2, 0.8, 0.2, 1)"

function initFaq() {
    const items = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? []
        : [...document.querySelectorAll(".home-faq-item")]

    items.forEach(item => {
        const resumen = item.querySelector(".home-faq-pregunta")
        const respuesta = item.querySelector(".home-faq-respuesta")
        if (!resumen || !respuesta) return

        // cerrado | abriendo | abierto | cerrando
        let estado = "cerrado"
        let animacion = null

        // El teclado dispara un click en <summary>, así que no hace falta un
        // listener aparte: Enter y Espacio siguen funcionando.
        resumen.addEventListener("click", evento => {
            evento.preventDefault()
            if (estado === "cerrado" || estado === "cerrando") abrir()
            else cerrar()
        })

        function abrir() {
            animacion?.cancel()
            estado = "abriendo"
            item.open = true
            animacion = respuesta.animate(
                [
                    { height: "0px", opacity: 0 },
                    { height: `${respuesta.scrollHeight}px`, opacity: 1 }
                ],
                { duration: DURACION_FAQ_MS, easing: CURVA_FAQ }
            )
            animacion.onfinish = () => {
                estado = "abierto"
                // Se sueltan las alturas fijadas por la animación para que el
                // texto pueda reflujar (rotar el móvil, cambiar el ancho).
                respuesta.style.height = ""
                respuesta.style.opacity = ""
            }
        }

        function cerrar() {
            animacion?.cancel()
            estado = "cerrando"
            // La altura actual se congela antes de colapsar: si se midiera
            // scrollHeight durante el colapso, el elemento daría un salto.
            const desde = respuesta.getBoundingClientRect().height
            animacion = respuesta.animate(
                [
                    { height: `${desde}px`, opacity: 1 },
                    { height: "0px", opacity: 0 }
                ],
                { duration: DURACION_FAQ_MS, easing: CURVA_FAQ }
            )
            animacion.onfinish = () => {
                estado = "cerrado"
                item.open = false
                respuesta.style.height = ""
                respuesta.style.opacity = ""
            }
        }
    })
}

// ============================================
// BOTÓN DE TEMA
// ============================================
// En la app el tema se cambia desde la lastbar. La landing no tiene lastbar, así
// que el botón del header hace lo mismo con el mismo ciclo dark → light →
// system, y con los mismos iconos. Se guarda solo en localStorage: sin sesión no
// hay a quién sincronizarlo en Firestore.
//
// No se reutiliza ciclarTema() porque su firma pide el uid para escribir en
// Firestore, y aquí no hay ninguno.

const MODOS_TEMA = ["dark", "light"]

const NOMBRES_TEMA = {
    dark: "Modo oscuro",
    light: "Modo claro"
}

function initBotonTema() {
    const boton = document.getElementById("home-tema")
    const iconoSlot = document.getElementById("home-tema-icono")
    if (!boton || !iconoSlot) return

    const pintar = (modo = getTemaLocal()) => {
        const efectivo = modo === "light" ? "light" : "dark"
        const fragmento = contenidoDesdeTemplate(efectivo === "dark" ? "tpl-icono-luna" : "tpl-icono-sol")
        iconoSlot.replaceChildren(fragmento.firstElementChild)
        boton.setAttribute("aria-label", `Tema: ${NOMBRES_TEMA[efectivo] || "Modo de color"}`)
    }

    boton.addEventListener("click", () => {
        const actual = getTemaLocal()
        const siguiente = actual === "light" ? "dark" : "light"
        try {
            localStorage.setItem("escinco_tema", siguiente)
        } catch (e) {
            // Sin storage el cambio dura lo que la página
        }
        cambiarTemaLocal(siguiente)
        pintar(siguiente)
    })

    pintar()
}

// ============================================
// GRÁFICOS DE LA MAQUETA
// ============================================
// Datos inventados y fijos: la maqueta enseña cómo se ve el panel, no calcula
// nada. El de patrimonio usa crearGraficoPatrimonio() —el mismo que el
// dashboard— y el reparto por tipo de activo usa crearGraficoDistribucion().
// Los dos leen los colores del tema activo y se redibujan solos al cambiarlo,
// así que no hay que repintarlos a mano desde el botón de tema.

const TASA_EJEMPLO = 3.75

// Serie que sube con algo de ruido, sin picos absurdos que no se parezcan a un
// patrimonio real. El último punto es el que muestra la card de patrimonio.
const PATRIMONIO_PEN = [
    168200, 168940, 169310, 168770, 170120, 171480, 170960, 172340, 171880, 173050,
    172610, 173940, 174420, 173880, 175260, 174700, 176140, 175520, 176980, 176340,
    177620, 178050, 177580, 179240, 178760, 180120, 179680, 181340, 180820, 182460,
    184320.55
]

// Etiquetas del eje X con el formato que usa el dashboard: dd/mm.
function fechasEjemplo(cantidad) {
    const etiquetas = []
    const hoy = new Date()
    for (let indice = cantidad - 1; indice >= 0; indice--) {
        const fecha = new Date(hoy)
        fecha.setDate(hoy.getDate() - indice)
        const dia = String(fecha.getDate()).padStart(2, "0")
        const mes = String(fecha.getMonth() + 1).padStart(2, "0")
        etiquetas.push(`${dia}/${mes}`)
    }
    return etiquetas
}

function datosPatrimonioEjemplo() {
    // La serie está en soles; el gráfico espera las tres divisas. USD y USDT
    // salen de la misma serie convertida, que es como las calcula la app.
    const enDolares = PATRIMONIO_PEN.map(valor => Number((valor / TASA_EJEMPLO).toFixed(2)))
    return {
        labels: fechasEjemplo(PATRIMONIO_PEN.length),
        dataPEN: PATRIMONIO_PEN,
        dataUSD: enDolares,
        dataUSDT: enDolares
    }
}

function formatearSoles(monto) {
    const importe = Number(monto).toLocaleString("es-PE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })
    return `S/ ${importe}`
}

async function initGraficosMaqueta() {
    // Destruir gráficos previos si existen (recarga de página o SW cache)
    const { destruirGrafico } = await import("../ui/graficos.js")
    destruirGrafico("home-patrimonio")
    destruirGrafico("home-distribucion")

    await crearGraficoPatrimonio("home-grafico-patrimonio", datosPatrimonioEjemplo(), {
        chartKey: "home-patrimonio",
        divisa: "PEN",
        etiquetaDivisa: "S/",
        // Al pasar el formateador, graficos.js no carga DivisaServicio ni, por
        // arrastre, el SDK de Firebase: la landing se mantiene sin él.
        formatear: formatearSoles
    })

    await crearGraficoDistribucion("home-grafico-distribucion", {
        labels: ["Cripto", "Acción", "ETF", "Bono"],
        data: [42, 28, 20, 10],
        // Las mismas variables que pinta las barras .distribucion-barra de abajo
        // (cripto, accion, etf, bono), para que el anillo y la lista se lean
        // como una sola pieza y cambien de color con el tema.
        colores: ["--ambar", "--positive", "--positiveAlt", "--border"]
    }, {
        chartKey: "home-distribucion",
        formatear: formatearSoles
    })
}

// ============================================
// ARRANQUE
// ============================================
// El tema se aplica SIEMPRE y antes de cualquier otra cosa: evita el
// destello de tema claro en oscuro al cargar la landing.

initTemaLocal()
initPWA()
initLanding()

