export const VERSION = {
    numero: "1.0.0-beta.29",
    nombre: "escinco",
    descripcion: "tucson",
    ano: 2026,
    autor: "david",
    
    fechaLanzamiento: "2026-10-18",
    fase: "beta",
    
    notasVersion: [
        "Bloque 2 completo: UI polish y Favoritos feature completion",
        "Última barra de favoritos con botón eliminar dual",
        "Favoritos: modelo, repositorio, servicio y UI base",
        "Movimientos: restaurar init() para cargar cuentas y movimientos",
        "Declarar favoritosCache y timers de favorito en movimientos",
        "Quitar estrella de favorito de la lista de movimientos",
        "Alinear descripción del JSON-LD con el copy nuevo",
        "Unificar metadatos OG y canonical en www.escinco.com",
        "Cerrar bloque 1: modales, snapshots, selector de cuentas",
        "UI polish: lastbar de favoritos con botón eliminar dual",
        "UI polish: card background fix (quitar background: inherit/z-index de .card-item-main)",
        "UI polish: eliminar .lastbar .item[hidden] y .lastbar-contexto",
        "UI polish: lastbar solo con 5 items (movimiento, editar, etiquetar, eliminar, extracto)",
        "UI polish: contenedor de favoritos solo visible cuando existen (selector de atributo [hidden], sin !important)",
        "UI polish: botón Etiquetar siempre activo",
        "UI polish: selector de etiquetas en modal de crear/editar movimiento ya funcionaba",
        "Categorías del sistema (vivienda, alimentación, transporte, ahorro, ocio) viven en el código, no en Firestore",
        "Categorías del sistema siempre primero, no eliminables, color positive",
        "Quitar sembrado de 8 etiquetas principales (Comida, Transporte, Ocio, Vivienda, Salud, Educación, Inversiones, Otros)",
        "Limpieza puntual al arranque: borrar etiquetas con esPrincipal === true",
        "Presupuestos: modelo, repositorio y servicio (mensual/anual, categoría o etiquetas, split igual entre tags, alertas 50/75/90% y superado)",
        "Presupuestos: UI con botón en lastbar persistente, modal y card de dashboard",
        "Presupuestos: crear y editar con toggle categoría/etiquetas",
        "Editar plantilla de favorito: abrir modal precargado, guardar cambios en plantilla",
        "CSS: colores de selección al estándar de inversiones (border var(--positive), background var(--backgroundAlt))",
        "CSS: botones de acción circulares (border-radius 50%) en vez de cápsula",
        "CSS: card-item-main padding reducido (12px 24px) para menos espacio entre estrella y texto",
        "CSS: #lista-movimientos padding-bottom 40px (menos hueco vacío al final)",
        "CSS: #panel .filtros con padding, border y background para definir contenedor visual",
        "CSS: .filtro-limpiar height 40px (alineación con el resto de controles)",
        "CSS: #favoritos-movimientos min-height auto (no ocupar espacio cuando hay pocos favoritos)",
        "CSS: agregar ícono receipt-text de Lucide, cambiar ícono de presupuestos",
        "Favoritos: eliminar plantilla (editarPlantillaFavorito) en repositorio y servicio",
        "Favoritos: abrir formulario precargado con valores (no valoresIniciales)",
        "Favoritos: tocar sobre favorito selecciona/deseleciona (clic simple), doble clic ejecuta",
        "Favoritos: eliminar seleccionados (dual con movimientos)",
        "Favoritos: máximo 1 favorito para editar",
        "Tests: 23 suites, TODO OK",
        "CSS: mover estilos inline a CSS (dashboard.html, demo.html, index.html)",
        "firebase/firestore.rules: agregar colección presupuestos/{presupuestoId}"
    ]
}

export function getVersionLabel() {
    return `${VERSION.nombre} · v${VERSION.numero}`
}

export function getVersionInfo() {
    return {
        version: VERSION.numero,
        nombre: VERSION.nombre,
        descripcion: VERSION.descripcion,
        copyright: `© ${VERSION.ano} ${VERSION.nombre}`
    }
}