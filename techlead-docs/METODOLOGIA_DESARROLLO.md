# METODOLOGÍA DE DESARROLLO DE ESCINCO

## 10.1 Principios Fundamentales

### 10.1.1 Protocolo Obligatorio de Trabajo

Toda tarea forma parte de un plan de trabajo por fases, incluso si el cambio inmediato parece pequeño. El agente debe seguir las 5 fases establecidas:

#### Fase 1. Investigación
- Comprender el objetivo y comportamiento esperado
- Examinar la implementación existente y estructura relevante
- Identificar archivos involucrados, consumidores, dependencias e interfaces
- Buscar funcionalidades, componentes, servicios y utilidades reutilizables
- Consultar documentación técnica y de diseño pertinente
- Identificar riesgos, posibles regresiones y efectos secundarios
- Revisar pruebas existentes relacionadas con el comportamiento

#### Fase 2. Diagnóstico
- Presentar diagnóstico con problema/u objetivo, comportamiento actual/esperado
- Identificar causa raíz (cuando sea error)
- Evidencias encontradas en código, pruebas o reproducción
- Archivos afectados y sus relaciones
- Riesgos y posibles efectos secundarios
- Aspectos desconocidos o hipótesis pendientes de comprobar
- **Distinguir expresamente**: Confirmado, Hipótesis, Pendiente

#### Fase 3. Plan de Implementación
- Presentar plan ordenado por fases antes de editar
- Especificar: qué se hará, por qué, qué archivos se modificarán/crearán/eliminarán
- Qué comportamiento se espera obtener
- Qué pruebas y verificaciones se ejecutarán
- Qué riesgos o dependencias deben tenerse en cuenta

#### Fase 4. Implementación
- Seguir el plan aprobado
- Mantener cambios enfocados en el objetivo
- No introducir refactorizaciones, mejoras o funcionalidades ajenas al alcance
- Comprobar que cada modificación respeta los contratos existentes
- Ejecutar verificaciones durante el trabajo, no únicamente al terminar

#### Fase 5. Verificación y Cierre
- Ejecutar pruebas pertinentes
- Ejecutar suite completa cuando corresponda
- Ejecutar lint para archivos de código modificados
- Realizar verificación visual en navegador cuando haya cambios de interfaz
- Revisar resultado final y posibles efectos secundarios
- Presentar informe honesto de lo realizado y lo que quedó pendiente

No declarar una tarea terminada si quedan errores conocidos que afectan a su objetivo.

### 10.1.2 Una Última Fuente de Instrucciones

`AGENTS.md` es la **única fuente de instrucciones técnicas y operativas** del proyecto escinco. Sus reglas se aplican a todas las tareas: investigación, diagnóstico, planificación, implementación, pruebas, revisión y mantenimiento.

- No mantener documentos paralelos con reglas generales que puedan contradecir este archivo.
- La documentación técnica específica del proyecto puede complementar estas reglas, pero no sustituirlas ni contradecirlas.
- Si dos instrucciones parecen incompatibles, identificar la contradicción y resolverla antes de realizar cambios que puedan verse afectados.

## 10.2 Convenciones de Código

### 10.2.1 JavaScript

- Utilizar JavaScript con ES Modules (`"type": "module"` en package.json)
- **No introducir un bundler ni un proceso de compilación** - el proyecto corre nativo en navegador
- Preferir `const`; utilizar `let` únicamente cuando sea necesario reasignar
- Utilizar nombres descriptivos en español para las funciones, variables y elementos propios del proyecto
- Mantener un estilo coherente con los archivos existentes
- Evitar abstracciones innecesarias y código excesivamente complejo
- **No añadir comentarios que simplemente repitan lo que hace el código**
- Los comentarios deben explicar decisiones, restricciones o comportamientos que no sean evidentes
- **Los comentarios del proyecto deben estar en español**
- **No dejar código muerto, imports sin uso ni implementaciones duplicadas**

### 10.2.2 CSS

- Clases e IDs propios del proyecto en español
- **IDs en `kebab-case`** (ej. `#distribucion-lista`, `#lista-movimientos`)
- Tokens globales en `css/style.css`
- Componentes reutilizables en `css/componentes.css`
- Estilos específicos de página en `css/[pagina].css`
- **Consultar `DISENO.md` antes de crear una clase o componente visual**
- Reutilizar clases y variables existentes siempre que sea adecuado
- **No utilizar `!important`**
- **No introducir estilos inline mediante atributos `style` ni asignaciones como `element.style.propiedad`**

Excepción permitida: las variables CSS `--modal-x` y `--modal-y` utilizadas para el desplazamiento de modales persistentes.

### 10.2.3 Convenciones Firestore

- **Campos en `camelCase`** en el código JavaScript (aunque en BD pueden ser strings)
- **Tipos en minúsculas**: `pen`, `usd`, `usdt`, `eur` (aunque en UI pueden mostrarse en mayúsculas)
- **Divisas en mayúsculas**: `PEN`, `USD` (solo para visualización en UI, no en el modelo de datos)
- Fechas almacenadas como `Timestamp` en Firestore, convertidas a string `YYYY-MM-DD` en el modelo JavaScript
- IDs personalizados en minúsculas y con guiones bajos cuando corresponda
- Los datos personales deben permanecer bajo la estructura de usuario correspondiente, como `usuarios/{uid}`

No alterar esquemas, rutas ni contratos de datos sin analizar las consecuencias sobre los datos existentes y sus consumidores.

## 10.3 Organización del Trabajo

### 10.3.1 Capas y Responsabilidades

La organización arquitectónica de referencia es:

`js/pages/` → `js/ui/` → `js/services/` → `js/repositories/` → `js/models/` → `firebase/`

**Responsabilidades por capa**:

| Capa | Puede Tener | Debe EVITAR |
|------|-------------|------------|
| **Core** | Funciones puras, utilidades matemáticas, formateo, fechas | Dependencias Firestore, DOM, window, localStorage |
| **Services** | Lógica de negocio, operaciones Firestore, llamadas API externas | Dependencias de presentación (DOM, CSS classes) |
| **Repositories** | CRUD Firestore, normalización de datos, queries | Lógica de negocio, decisiones de UI |
| **Pages** | Orquestación, coordinación llamadas, gestión estado temporal | Contener lógica de negocio pura |
| **UI** | Presentación, manejadores eventos básicos, renderizado | Lógica de negocio, cálculos de negocio, acceso a datos |

### 10.3.2 Direcciones de Dependencia

```
Capa superior                          Capa inferior
Pages  ←→  Services  ←→  Repositories  ←→  Firestore
   ↑               ↑               ↑               ↑
Core (lectura solo)  Utilidades       Constantes     Lint/Tests
```

**Reglas estrictas de importación**:

1. **Pages** pueden importar de: Services, Core (lectura), Constants
2. **Services** pueden importar de: Repositorios, Core (lectura), Constants
3. **Repositorios** pueden importar de: Core (solo funciones puras), Constants
4. **Core** NO puede importar de: Pages, Services, Repositorios
5. **UI** puede importar de: Core (solo funciones puras), Components itself

**Prohibido**: importar `firebase/firestore.js` directamente en páginas o core. Siempre través del punto único en `js/services/` o `js/repositories/`.

### 10.3.3 Convenciones de Importación y Exportación

- **Default exports**: Solo para módulos únicos por archivo (rare). Preferir named exports.
- **Named exports**: Grupos lógicos: `export { esMovimientoPositivo, montoDeMovimiento }` desde core
- **Index files**: `js/core/index.js` que re-exporta funciones comunes, `js/services/index.js` para consumers
- **Rutas absolutamente relativas**: Siempre `import {X} from './archivo.js'`, nunca paths absolutos ni `../` profundidad variable
- **Cartas de firestore**: Nunca importar firestore directamente en páginas/core; siempre a través de `firebase/firestore.js` punto único

### 10.3.4 Flujo de Implementación

1. **Entender el cambio solicitado** leyendo documentos y código relacionado
2. **Identificar archivos afectados** revisando imports y consumidores
3. **Verificar comportamiento actual** ejecutando `npm test` y `npm run lint` baseline
4. **Implementar el cambio** siguiendo convenciones existentes
5. **Ejecutar verificaciones**:
   - `npm test` tests focalizados
   - `npm run lint` en archivos modificados
   - Verificación visual en navegador (cambios UI)
6. **Revisar diff final** asegurándose de no haber introducido regresiones
7. **Informar resultados** honrados (éxitos, fallos, pendientes)

## 10.4 Proceso de Revisión

### 10.4.1 Checklist de Pull Request

Todo Pull Request debe passar el siguiente checklist:

- ✅ ¿El cambio respeta los límites de capa? (ninguna dependencia cruza en dirección prohibida)
- ✅ ¿La responsabilidad del módulo está clara en nombre y docs?
- ✅ ¿Tests cubren el nuevo módulo o módificado?
- ✅ ¿Lint pasa en todos los archivos nuevos/transformados?
- ✅ ¿No hay imports circulares nuevos detectados por Graphify?
- ✅ ¿El comportamiento H2 se preserva (para cambios dashboard/UI)?
- ✅ ¿No se eliminó funcionalidad sin reemplazo?
- ✅ ¿Documentación actualizada si es necesario?

### 10.4.2 Code Review

El agente responsable debe revisar críticamente los resultados recibidos de otros agentes o collaborators. No aceptar automáticamente código, diagnósticos o conclusiones de otro agente sin verificar.

La responsabilidad de la calidad final permanece en el agente que coordina la tarea.

## 10.5 Estrategia de Pruebas

### 10.5.1 Patrones de Tests Existentes

El repositorio usa el patrón en `tests/helpers.mjs`, incluyendo utilidades:

- `nuevoReporter`: reportero de tests personalizado
- `extraerFuncion`: utilidad para extraer funciones de código para testing

### 10.5.2 Cuándo Añadir Tests

Añadir o ampliar pruebas cuando se modifique lógica no trivial, especialmente:

- Ramas condicionales
- Bucles y procesamiento de colecciones
- Parsers y transformaciones
- Cálculos financieros (manejo de montos, divisas, redondeo)
- Operaciones con fechas y divisas
- Seguridad y permisos (validaciones Firestore)
- Persistencia y caché (cacheCapa operations)
- Estados de carga, error y vacío
- Interacciones y comportamiento de componentes

### 10.5.3 Ejecución Obligatoria

Para cambios de código:

1. ✅ Ejecutar pruebas focalizadas durante la implementación
2. ✅ Ejecutar `npm test` antes de cerrar la tarea
3. ✅ Ejecutar `npm run lint` para comprobar código modificado
4. ✅ Resolver errores introducidos por el cambio
5. ✅ Informar de cualquier fallo preexistente que afecte a la interpretación del resultado

Para cambios exclusivamente documentales, no es necesario ejecutar la suite completa si no existe una razón técnica para hacerlo.

## 10.6 Documentación

### 10.6.1 Convenciones de Documentación

- **Todos los comentarios del proyecto deben estar en español**
- Los templates deben utilizar `data-tpl="nombre"` para huecos (sin `@`)
- Utilizar `data-tpl-attr` para atributos dinámicos
- Los huecos deben identificarse mediante `data-tpl="nombre"`, sin `@`
- No dejar templates sin uso
- No duplicar estructuras HTML que deberían reutilizar un template existente
- Mantener los templates compartidos de `dashboard.html` y `demo.html` idénticos
- Verificar su correspondencia mediante `tests/plantillas.test.mjs`

### 10.6.2 Documentos Clave

Estos son los documentos que todo agente (incluyendo Kimi, el nuevo Tech Lead) debe consultar primero:

1. `AGENTS.md` - Reglas para agentes OpenCode (nunca modificar sin aprobación PO)
2. `DISENO.md` - Sistema diseño (tokens, convenciones, NO modificar sin PO)
3. `CONTEXTO_PRODUCTO.md` - Contexto general del producto (este paquete)
4. `ARQUITECTURA_ACTUAL.md` - Arquitectura técnica actual
5. `MAPA_DE_MODULOS.md` - Estructura por módulos y capas
6. `MODELO_DE_DATOS.md` - Esquemas y modelos de datos
7. `AUDITORIA_TECNICA.md` - Hallazgos y prioridades técnicas
8. `REGISTRO_DECISIONES_DISPONIBLES.md` - Decisiones aprobadas y pendientes
9. `ESTADO_PROYECTO.md` - Estado actual del proyecto
10. `ETAPA9_CONTEXTO.md` - Contexto específico de la Etapa 9 (prioridad actual)
11. `METODOLOGIA_DESARROLLO.md` - Esta guía de metodología
12. `VACIOS_Y_VERIFICACIONES_PENDIENTES.md` - Vacíos de información y verificaciones pendientes

## 10.7 Interacción entre Product Owner y Agentes de IA

### 10.7.1 Autoridad Final

El **usuario (Product Owner)** es la autoridad final sobre todas las decisiones del proyecto. Los agentes pueden:

- Cuestionar una instrucción cuando detecten un riesgo, contradicción o problema técnico
- Explicar el motivo y proponer alternativas
- **No pueden ignorar unilateralmente** una decisión del usuario
- El usuario puede autorizar excepciones a `AGENTS.md` con alcance claro

### 10.7.2 Proceso de Decisión

Cuando una decisión requiere aprobación del Product Owner:

1. El agente presenta las opciones con evidencia y consecuencias
2. El usuario toma la decisión final
3. El agente documenta la decisión en `REGISTRO_DECISIONES_DISPONIBLES.md`
4. El agente procede según la autorización otorgada

### 10.7.3 Limitaciones del Agente

Los agentes **no pueden**:

- Realizar commits ni push por iniciativa propia (solo cuando el usuario las solicite explícitamente)
- Introducir dependencias nuevas de producción sin autorización
- Introducir frameworks, bundlers o procesos de compilación que contradigan la arquitectura actual
- Alterar archivos existentes ni ejecutar operaciones destructivas sin autorización
- Inventar decisiones ni atribuir al Product Owner decisiones que no estén documentadas

## 10.8 Herramientas, Agentes y Delegación

### 10.8.1 Elección de Herramientas

Los agentes tienen libertad para elegir herramientas de investigación, análisis, edición y verificación, siempre que respeten `AGENTS.md` y el alcance autorizado.

### 10.8.2 Delegación

Se permite delegar tareas a otros agentes cuando:

- El objetivo es demasiado grande para una sola persona/agente
- Requieren conjuntos de habilidades diferentes
- La delegación tenga objetivo concreto, contexto suficiente y alcance definido

El agente responsable debe revisar críticamente los resultados recibidos. No aceptar automáticamente código, diagnósticos o conclusiones de otro agente.

### 10.8.3 Eficiencia

- Evitar lecturas repetidas de archivos sin necesidad
- No ejecutar suites completas innecesariamente durante cada pequeña iteración
- Utilizar pruebas focalizadas durante el desarrollo y la suite completa al cerrar
- No delegar tareas que sean más rápidas y seguras de resolver directamente
- No realizar cambios masivos sin una justificación técnica
- No continuar investigando aspectos que no afectan al objetivo ni a sus riesgos

## 10.9 Git y Control de Versiones

### 10.9.1 Reglas para Agentes

- ✅ Revisar `git status` antes de comenzar
- ✅ Identificar los cambios preexistentes
- ✅ Mantener aislados los cambios de la tarea actual
- ✅ Revisar el diff antes de dar por finalizada la implementación
- ✅ No descartar cambios del usuario ni de otros agentes

- ❌ **Los agentes no pueden realizar commits ni push por iniciativa propia**
- Solo podrán ejecutar estas operaciones cuando el usuario las solicite explícitamente
- No interpretar la aprobación de un plan de implementación como autorización para crear commits o hacer push

### 10.9.2 Trabajo en Worktrees

Cuando el agente necesita trabajar en aislamiento:

- Se pueden crear worktrees con `tools.opencode.worktree_create`
- El agente debe mantener cambios aislados
- Los worktrees se pueden remover con `tools.opencode.worktree_remove` cuando se completen

## 10.10 Criterios de Finalización

Al terminar una tarea, presentar un informe que incluya:

### 10.9.1 Resultado

- Objetivo de la tarea
- Problema identificado y causa raíz, si correspondía
- Solución implementada
- Comportamiento resultante

### 10.9.2 Archivos

Enumerar los archivos:
- Modificados
- Creados
- Eliminados

Explicar brevemente la función de los cambios relevantes.

### 10.9.3 Verificación

Informar de:
- Tests focalizados ejecutados
- Resultado de `npm test`
- Resultado de lint
- Verificación visual en navegador, si correspondía
- Otras comprobaciones relevantes

Distinguir entre comprobaciones exitosas, fallidas y no ejecutadas.

### 10.9.4 Pendientes y Riesgos

Indicar:
- Errores que no se pudieron resolver
- Fases que quedaron pendientes
- Limitaciones de herramientas o entorno
- Riesgos conocidos
- Decisiones que requieren aprobación del usuario

No presentar como finalizado un trabajo que todavía tenga fases pendientes.

---

**Filtro Final**: El agente no debe optimizar únicamente para terminar rápido o producir una solución que parezca funcionar. Debe optimizar para entregar **código de mayor calidad, corregir los errores de manera fiable, evitar regresiones y utilizar eficientemente el tiempo y las herramientas disponibles**.

Investigar antes de modificar. Diagnosticar antes de implementar. Planificar antes de ampliar el alcance. Verificar antes de declarar terminado.

Cuando no exista evidencia suficiente, decirlo. Cuando una decisión corresponda al usuario, consultarlo. Cuando un problema no pueda resolverse dentro de los límites establecidos, dejarlo documentado en lugar de introducir una solución especulativa.