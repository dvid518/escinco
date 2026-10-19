# Changelog de escinco

## [1.0.0-beta.29] - 2026-10-18

### Bloque 2 — UI polish y Favoritos feature completion

#### Última barra de favoritos
- Última barra de favoritos con botón eliminar dual

#### Favoritos
- Modelo, repositorio, servicio y UI base
- Abrir formulario precargado con valores (no valoresIniciales)
- Tocar sobre favorito selecciona/deseleciona (clic simple), doble clic ejecuta
- Eliminar seleccionados (dual con movimientos)
- Máximo 1 favorito para editar
- Editar plantilla de favorito: abrir modal precargado, guardar cambios en plantilla

#### Movimientos
- Restaurar init() para cargar cuentas y movimientos
- Declarar favoritosCache y timers de favorito en movimientos
- Quitar estrella de favorito de la lista de movimientos

#### Categorías del sistema
- Vivienda, alimentación, transporte, ahorro, ocio viven en el código, no en Firestore
- Siempre primero, no eliminables, color positive
- Quitar sembrado de 8 etiquetas principales (Comida, Transporte, Ocio, Vivienda, Salud, Educación, Inversiones, Otros)
- Limpieza puntual al arranque: borrar etiquetas con esPrincipal === true

#### Presupuestos
- Modelo, repositorio y servicio (mensual/anual, categoría o etiquetas, split igual entre tags, alertas 50/75/90% y superado)
- UI con botón en lastbar persistente, modal y card de dashboard
- Crear y editar con toggle categoría/etiquetas

#### UI polish
- Colores de selección al estándar de inversiones (border var(--positive), background var(--backgroundAlt))
- Botones de acción circulares (border-radius 50%) en vez de cápsula
- Card-item-main padding reducido (12px 24px) para menos espacio entre estrella y texto
- #lista-movimientos padding-bottom 40px (menos hueco vacío al final)
- #panel .filtros con padding, border y background para definir contenedor visual
- .filtro-limpiar height 40px (alineación con el resto de controles)
- #favoritos-movimientos min-height auto (no ocupar espacio cuando hay pocos favoritos)
- Agregar ícono receipt-text de Lucide, cambiar ícono de presupuestos

#### CSS
- Mover estilos inline a CSS (dashboard.html, demo.html, index.html)

#### Firebase
- firebase/firestore.rules: agregar colección presupuestos/{presupuestoId}

#### Pruebas
- 23 suites, TODO OK

## Versiones anteriores

### 1.0.0-beta.28
- Véase el historial de commits para detalles

### 1.0.0-beta.27
- Véase el historial de commits para detalles

### 1.0.0-beta.22 y anteriores
- Véase docs/reporte-bugs.md para detalles de bugs resueltos y pendientes