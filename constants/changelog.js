// ============================================
// NOVEDADES (CHANGELOG)
// ============================================
// Única fuente del modal de novedades: la versión más reciente va primero.
// Cada entrada lleva la versión, su fecha de lanzamiento y la lista de cambios.
// El tipo es solo una etiqueta de color: "nuevo" | "mejora" | "arreglo".
//
// Al publicar una versión nueva, se añade su bloque al principio de la lista.

export const CHANGELOG = [
    {
        version: "1.0.0-beta.28",
        fecha: "2026-10-17",
        cambios: [
            { tipo: "nuevo", texto: "Las transferencias ya admiten cuentas en distintas divisas: indicas cuánto sale de la cuenta de origen y cuánto entra en la de destino, y la tasa queda anotada en el movimiento para revisarla." },
            { tipo: "mejora", texto: "La app funciona sin conexión: tus datos se guardan en el dispositivo y se sincronizan solos al volver internet." }
        ]
    },
    {
        version: "1.0.0-beta.27",
        fecha: "2026-09-13",
        cambios: [
            { tipo: "nuevo", texto: "Atajos de teclado: Alt+K para buscar, Alt+P pendientes, Alt+M metas, Alt+N notificaciones y Alt+A para ver todos los atajos." },
            { tipo: "nuevo", texto: "Al crear una cuenta te invitamos a habilitar la versión inversionista (Inversiones y Trading) con un clic." },
            { tipo: "mejora", texto: "Las cuentas nuevas nacen sin Inversiones ni Trading; esas páginas se activan solo si las usas." },
            { tipo: "mejora", texto: "El panel de inicio arranca con solo las tarjetas esenciales (cuentas, movimientos, inversiones, metas y gráfico); el resto se añade a tu gusto." },
            { tipo: "mejora", texto: "Mientras se inicia sesión o se crea la cuenta, el logo gira y el formulario queda bloqueado para evitar envíos duplicados." },
            { tipo: "arreglo", texto: "Cambiar de subcuenta ya no abre el aviso educativo de crédito." },
            { tipo: "arreglo", texto: "Se dejaron de guardar en tu perfil datos internos que no se usaban." }
        ]
    }
]
