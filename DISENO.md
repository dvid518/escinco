DISENO.md
Reglas
de
diseno
del
proyecto
escinco
Este
documento
reune
las
reglas
de
diseno
extraidas
del
codigo
real
del
proyecto.
Sirve
de
guia
para
decidir
que
componentes
reutilizar
donde
anyadir
estilos
y
cuando
crear
algo
nuevo.
 
## 1. Tokens de diseno
| Variable | Tema oscuro | Tema claro | Uso ejemplo |
Todas las variables CSS de :root viven en css/style.css. Se declaran una sola vez y se sobrescriben por tema ([data-theme=dark] y [data-theme=light]).
### 1.1 Colores
| Variable | Tema oscuro | Tema claro | Uso ejemplo |
| --- | --- | --- | --- |
| --background | --onyx (#141414) | --whiteSmoke (#F1F1F1) | Fondo del body |
| --backgroundAlt | --paleSky (#D4E9FF) | --graphite (#1F1F1F) | Fondo alternativo (cards seleccionadas) |
| --surface | --graphite (#1F1F1F) | --paleSky (#D4E9FF) | Superficie de cards, inputs, modales |
| --text | --whiteSmoke (#F1F1F1) | --onyx (#141414) | Texto principal |
| --textSecondary | --paleSky (#D4E9FF) | --slateGrey (#465B6D) | Texto secundario, pistas |
| --textAct | --whiteSmoke | --graphite | Texto activo |
| --textAlt | --graphite (#1F1F1F) | --whiteSmoke (#F1F1F1) | Texto de alto contraste sobre fondo alternativo |
| --border | --paleSky (#D4E9FF) | --slateGrey (#465B6D) | Bordes por defecto |
| --borderAlt | --slateGrey (#465B6D) | --graphite (#1F1F1F) | Bordes alternativos |
| --positive | --lightGreen (#96FFA1) | --tropicalMint (#00a269) | Colores positivos / exito |
| --positiveAlt | --tropicalMint (#00a269) | --lightGreen (#96FFA1) | Positivo sobre fondo alternativo |
| --negative | --cottonCandy (#FE8F8F) | --raspberryRed (#DC0051) | Colores negativos / error |
| --negativeAlt | --raspberryRed (#DC0051) | --cottonCandy (#FE8F8F) | Negativo sobre fondo alternativo |
| --ambar | --banana (#FECA6F) | --mustard (#f5a623) | Colores de aviso |
| --ambarAlt | --mustard (#f5a623) | --banana (#FECA6F) | Aviso sobre fondo alternativo |
| --lightHover | --lightSlateGrey (#465B6D5f) | --lightPaleSky (#D4E9FF5f) | Fondo al pasar el cursor |
| --lightBorder | --lightWhiteSmoke (#F1F1F136) | --lightGraphite (#1F1F1F36) | Borde sutil / hover |
| --shadow | --lightPaleSky (#D4E9FF5f) | --lightSlateGrey (#465B6D) | Sombra / glow interior |
| --glass-frosted | --frostedGraphite (#1F1F1FC0) | --frostedWhiteSmoke (#F1F1F1ae) | Superficie difuminada (.glass) |
| --blurBackground | --lightOnyx (#141414AE) | --lightPaleSky (#D4E9FF5f) | Fondo de overlays (.modal-overlay) |
Colores de marca/base (sin tema, usados directamente):
| Variable | Valor | Uso ejemplo |
| --- | --- | --- |
| --onyx | #141414 | Fondo oscuro base |
| --lightOnyx | #141414AE | Fondo oscuro semitransparente |
| --graphite | #1F1F1F | Superficie oscura base |
| --lightGraphite | #1F1F1F36 | Superficie oscura semitransparente |
| --frostedGraphite | #1F1F1FC0 | Grafito difuminado |
| --slateGrey | #465B6D | Gris pizarra |
| --lightSlateGrey | #465B6D5f | Gris pizarra semitransparente |
| --lightGreen | #96FFA1 | Verde claro |
| --cottonCandy | #FE8F8F | Rojo claro / algodon de azucar |
| --banana | #FECA6F | Amarillo / banana |
| --paleSky | #D4E9FF | Cielo palido |
| --lightPaleSky | #D4E9FF5f | Cielo palido semitransparente |
| --whiteSmoke | #F1F1F1 | Blanco humo |
| --lightWhiteSmoke | #F1F1F136 | Blanco humo semitransparente |
| --frostedWhiteSmoke | #F1F1F1ae | Blanco humo difuminado |
| --smoke | #cfcfcf | Humo |
| --tropicalMint | #00a269 | Menta tropical |
| --raspberryRed | #DC0051 | Frambuesa roja |
| --mustard | #f5a623 | Mostaza |
| --royalBlue | #2b6ff2 | Azul real |
### 1.2 Tipografia
| Variable | Valor | Uso ejemplo |
| --- | --- | --- |
| --font-primary | 
Inter, Arial, sans-serif | Fuente principal (texto general, inputs .form-input) |
| --font-secondary | 
Roboto
Mono, Courier
New, monospace | Fuente secundaria (cifras, monospaced, badges) |
Utilidades de texto (en css/style.css, seccion UTILITARIAS):
| Clase | Efecto |
| --- | --- |
| .text-secondary | color: var(--textSecondary) |
| .text-muted | opacity: 0.7 |
| .text-positive | color: var(--positive) |
| .text-negative | color: var(--negative) |
| .text-sm | font-size: 12px |
| .text-xs | font-size: 11px |
| .text-md | font-size: 13px |
| .text-center | text-align: center |
| .text-mono | font-family: var(--font-secondary) |
| .text-medium | font-weight: 500 |
| .text-semibold | font-weight: 600 |
### 1.3 Espaciados
No hay variables de espaciado definidas como --sp-*. Los espaciados se declaran inline en cada regla (padding, gap, margin con valores en px). Los mas usados:
padding: 12px 20px - cards y items de lista (.card-item, .movimiento-item)
gap: 12px / 16px / 20px - separacion entre elementos
gap: 4px / 8px - separacion interna compacta
margin-bottom: 20px / margin-top: 12px - margenes de seccion
Utilidades de espaciado (en css/style.css):
| Clase | Efecto |
| --- | --- |
| .gap-xs | gap: 4px |
| .gap-sm | gap: 8px |
| .gap-md | gap: 12px |
| .gap-lg | gap: 16px |
| .gap-xl | gap: 20px |
| .mb-0 | margin-bottom: 0 |
| .mb-sm | margin-bottom: 8px |
| .mb-md | margin-bottom: 12px |
| .mb-lg | margin-bottom: 20px |
| .mt-sm | margin-top: 8px |
| .mt-md | margin-top: 12px |
### 1.4 Radios
No hay variables de radio definidas como --radius-*. Los valores se declaran inline en cada regla. Los mas recurrentes:
- border-radius: 50px - píldoras, botones, badges, sidebar buttons
- border-radius: 40px - cards, items de movimiento, posicion, estrategia
- border-radius: 30px - inputs .form-input, notificaciones
- border-radius: 25px - paneles, cuenta-vista-info, feature cards (home)
- border-radius: 20px - modales, cards del dashboard
- border-radius: 16px - items de lista del dashboard, aviso de creditos
- border-radius: 12px - badges de chips, avatar
- border-radius: 8px - aviso de modal
- border-radius: 50% - circulos, avatares, toggle buttons circulares
### 1.5 Sombras
No hay variables de sombra definidas como --shadow-*. La variable --shadow se usa como color de sombra (no como offset/blur). Los patrones de sombra:
- box-shadow: inset 0 0 10px var(--shadow) - brillo interior en hover
- box-shadow: inset 0 0 0 1px var(--shadow) - borde interior en seleccionado
- box-shadow: 0 8px 24px var(--shadow) - sombra elevada (cards arrastrando)
- box-shadow: inset 0 0 20px var(--shadow) - glow en hover de modal
- box-shadow: var(--glow) - glow dinamico definido por componente
Utilidad .glass (en css/style.css, linea ~780):
| Propiedad | Valor |
| --- | --- |
| --glow | 0 2px 16px rgba(0,0,0,0.025), 0 4px 5px rgba(0,0,0,0.025) |
| --blur-frosted | 10px |
| background-color | var(--glass-frosted) |
| border | 1px solid var(--lightBorder) |
| backdrop-filter | blur(var(--blur-frosted)) |
### 1.6 Otros
| Variable | Valor | Uso ejemplo |
| --- | --- | --- |
| --skeleton-base | color-mix(in srgb, var(--surface) 78%, var(--border)) | Fondo de esqueletos |
| --skeleton-highlight | color-mix(in srgb, var(--text) 14%, transparent) | Brillo del shimmer de esqueletos |
| --seleccion-bg | var(--border) | Fondo de seleccion de texto (::selection) |
| --seleccion-color | var(--textAlt) | Color de texto seleccionado |
| --etiqueta-verde | var(--lightGreen) | Etiqueta verde |
| --etiqueta-rojo | var(--cottonCandy) | Etiqueta roja |
| --etiqueta-ambar | var(--banana) | Etiqueta ambar |
| --etiqueta-azul | var(--paleSky) | Etiqueta azul |
| --etiqueta-menta | var(--tropicalMint) | Etiqueta menta |
| --etiqueta-frambuesa | var(--raspberryRed) | Etiqueta frambuesa |
| --etiqueta-mostaza | var(--mustard) | Etiqueta mostaza |
| --etiqueta-cielo | var(--royalBlue) | Etiqueta cielo |
| --distribucion-liquidez | var(--lightGreen) | Barra de distribucion: liquidez |
| --distribucion-inversiones | var(--tropicalMint) | Barra de distribucion: inversiones |
| --distribucion-inmovil | var(--cottonCandy) | Barra de distribucion: inmovilizado |
| --distribucion-deudas | var(--raspberryRed) | Barra de distribucion: deudas |
## 1.2 Inventario de componentes reutilizables
Buscar en css/ las clases reutilizables (.btn, .card, .badge, .input, .modal, .glass, etc.). Para cada una: nombre de la clase, archivo donde esta definida, linea aproximada, y una descripcion breve de para que sirve. Incluir variantes.
### Clases globales (css/style.css)
| Clase | Linea aprox. | Descripcion |
| --- | --- | --- |
| .badge | 541 | Base para etiquetas tipo pastilla (tipo, estado, etiquetas de movimiento). Lo unico que cambia es el color via modificadores .badge--*. |
| .badge--positive | 562 | Variante positiva (color --positive). |
| .badge--negative | 567 | Variante negativa (color --negative). |
| .badge--aviso | 572 | Variante de aviso (color --ambar). |
| .badge--border | 577 | Variante con borde (color --border). |
| .badge--interactivo | 584 | Badge clicable con cursor, hover y foco. |
| .glass | 780 | Superficie difuminada (frosted glass) con backdrop-filter y borde sutil. |
| .form-input | 321 | Input con padding, borde redondeado (50px), fondo y transicion de hover/foco. |
| .skeleton-item | 427 | Esqueleto de item de lista con borde, fondo y animacion shimmer. |
### Clases de componentes (css/componentes.css)
| Clase | Linea aprox. | Descripcion |
| --- | --- | --- |
| .card-item | 338 | Card base para listas (movimientos, posiciones, estrategias). Con hover, seleccion y acciones reveladas. |
| .card-item.seleccionado | 406 | Estado seleccionado: borde --text, fondo --backgroundAlt, sombra interior. |
| .btn-sm | 517 | Boton compacto (padding 4px 12px, fuente 12px, radio 50px). |
| .btn-xs | 524 | Boton muy compacto (padding 2px 8px, fuente 11px, radio 50px). |
| .btn-danger | 531 | Boton de peligro (color --negative, fondo --negative en hover). |
| .lista-cards | 316 | Contenedor de lista de cards con gap y scroll vertical. |
| .panel-header | 218 | Cabecera de panel con espacio entre titulo y acciones. |
| .totales | 238 | Fila de totales con contadores y valores de movimiento. |
| .notificacion | 62 | Notificacion flotante con animacion de entrada/salida y variantes de estado. |
| .chip-etiqueta | 828 | Chip de etiqueta con punto de color, estados activo/semi/categoria. |
| .resumen-card | 660 | Card de resumen de cifras (usada por cuentas, inversiones, trading). |
| .aporte-progreso | 718 | Barra de progreso para aporte a meta o uso de credito. |
| .desact | 462 | Utilidad para desactivar elementos (opacity 0.45, pointer-events none). |
| .lista-vacia | 491 | Estado de lista vacia con texto centrado y opcional variante error. |
### Clases de modales (css/modal.css)
| Clase | Linea aprox. | Descripcion |
| --- | --- | --- |
| .modal-overlay | 6 | Overlay fijo con difuminado y animacion de entrada. |
| .modal | 28 | Contenedor del modal con radio 20px, max-width 560px, animacion slideUp. |
| .modal-info | 75 | Variante estrecha (max-width 420px). |
| .modal-confirm | 76 | Variante para confirmaciones (max-width 460px). |
| .modal-form | 77 | Variante para formularios (max-width 560px). |
| .modal-wide | 78 | Variante amplia (max-width 760px). |
| .modal-narrow | 79 | Variante angosta (max-width 400px). |
| .modal-xl | 83 | Ventana grande para paneles densos (max-width 1120px, altura 88vh). |
| .modal-header | 93 | Cabecera del modal con titulo y controles. |
| .modal-body | 206 | Cuerpo del modal con scroll vertical. |
| .modal-footer | 231 | Pie del modal con botones centrados. |
| .modal-btn | 261 | Boton base del modal (padding 10px 24px, radio 50px). |
| .modal-btn-primary | 272 | Boton primario del modal (fondo --border, color --textAlt). |
| .modal-btn-secondary | 283 | Boton secundario del modal (fondo --surface, color --text). |
| .modal-btn-danger | 292 | Boton de peligro del modal (fondo --surface, borde --negative). |
### Clases de configuracion (css/configuracion.css)
| Clase | Linea aprox. | Descripcion |
| --- | --- | --- |
| .glass-btn | 461 | Boton vidriado (fondo --background, borde --border, radio 50px). |
| .toggle-group | 375 | Grupo de opciones tipo toggle (fondo --background, radio 50px). |
| .toggle-option | 402 | Opcion de toggle (padding 4px 16px, radio 50px, estado activo). |
| .select | 429 | Select personalizado con flecha SVG y borde redondeado. |
| .switch | 664 | Switch/toggle con slider circular y estado checked. |
| .config-group | 325 | Grupo de configuracion con label y valor alineados. |
### Clases de navegacion (css/navegacion.css)
| Clase | Linea aprox. | Descripcion |
| --- | --- | --- |
| .nav-container | 57 | Contenedor de enlaces de navegacion con radio 50px. |
| #sidebar | 160 | Sidebar de navegacion con botones y scroll vertical. |
| .sidebar-wrap | 223 | Envoltura del sidebar con modo colapsado (solo iconos). |
| .lastbar | 415 | Barra inferior de navegacion con items expandibles al hover. |
#panel | 359 | Panel principal con scroll vertical y fondo de superficie. |
## 1.3 Reglas de composicion
- Para crear un boton, usar .btn o .glass-btn + variante. No crear clases nuevas.
- Para una card, usar .card-item + .glass si es necesario. No duplicar estilos.
- Para un input, usar .form-input. No reinventar el estilo.
- Para un badge, usar .badge + variante .badge--* segun el color semantico. |
- Para un modal, usar .modal-overlay + .modal + variante .modal-info/.modal-confirm/.modal-form/.modal-wide/.modal-narrow/.modal-xl. |
- Para una superficie difuminada, agregar la clase .glass. |
- Si necesitas un nuevo componente, primero buscar si existe algo similar en css/componentes.css. |
- Los estilos especificos de pagina van en css/[pagina].css, no en style.css. |
- Los tokens globales (colores, tipografia) se agregan en css/style.css seccion :root. |
- No usar estilos inline (style=
... o element.style.x) salvo excepciones documentadas. |
- No usar !important. |
## 1.4 Patrones de interaccion
- Las cards seleccionadas usan .seleccionado (borde --text, fondo --backgroundAlt, sombra interior). |
- Los botones tienen transicion de 0.15s a 0.3s en hover (background-color, color, border-color). |
- Los modales se abren con overlay --blurBackground y animacion fadeIn de 0.2s. |
- El modal se cierra con animacion fadeOut de 0.2s y slideDown de 0.3s. |
- Los inputs .form-input cambian a fondo --lightHover y borde --text en hover y foco. |
- Los elementos desactivados usan .desact (opacity 0.45, pointer-events none). |
- La seleccion de texto usa ::selection con fondo --seleccion-bg y color --seleccion-color. |
- Con @media (prefers-reduced-motion: reduce) se desactivan transiciones y animaciones. |
## 1.5 Convenciones de nombres
- Clases CSS en espanol (ej. .movimiento-item, .card-patrimonio, .posicion-item). |
- data-tpl para templates, data-tpl-attr para atributos dinamicos. |
- IDs en kebab-case (ej. #distribucion-lista, #lista-movimientos, #favoritos-movimientos). |
- Funciones en camelCase (ej. aplicoAnchoBarras, lateralidadInfo). |
- Templates en dashboard.html y demo.html con id=
tpl-nombre-componente. |
- Huecos de templates declarados con data-tpl=
nombre (sin @ dentro). |
## 1.6 Puntos de extension
- Componentes globales: css/componentes.css. |
- Estilos de pagina: css/[pagina].css (ej. css/dashboard.css, css/movimientos.css). |
- Tokens: css/style.css (seccion :root, [data-theme=
dark], [data-theme=light]). |
- Animaciones: css/style.css (seccion @media (prefers-reduced-motion: reduce)) y @keyframes en componentes.css / modal.css. |


