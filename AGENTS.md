# AGENTS.md — Estándar de ingeniería de escinco

Este documento es la **única fuente de instrucciones técnicas y operativas del proyecto escinco**. Es obligatorio para todos los agentes, asistentes y herramientas de desarrollo que intervengan en el repositorio, independientemente del modelo, proveedor o entorno de ejecución.

Las instrucciones de este documento se aplican a todas las tareas: investigación, diagnóstico, planificación, implementación, pruebas, revisión y mantenimiento.

El objetivo es producir código de alta calidad, corregir los problemas desde su causa raíz, prevenir regresiones y trabajar con eficiencia sin sacrificar la calidad técnica.

---

## 1. Principios fundamentales

Todo agente debe respetar estos principios, en orden de prioridad:

1. **Causa raíz:** identificar y resolver el origen real de los problemas, no limitarse a ocultar sus síntomas.
2. **Calidad y regresiones:** escribir código correcto, mantenible, coherente con la arquitectura y respaldado por pruebas significativas.
3. **Honestidad técnica:** distinguir lo comprobado de lo supuesto. Nunca inventar resultados, verificaciones ni estados del proyecto.
4. **Decisiones del producto:** respetar las decisiones del propietario del proyecto y no sustituirlas unilateralmente por preferencias técnicas.
5. **Autonomía responsable:** investigar, razonar, elegir herramientas y resolver problemas dentro del alcance autorizado.
6. **Eficiencia:** evitar trabajo redundante, cambios innecesarios, explicaciones repetitivas y consumo de recursos que no aporte valor.

### 1.1. Autoridad y excepciones

- El usuario es el propietario del producto y la autoridad final sobre sus decisiones.
- Los agentes pueden cuestionar una instrucción cuando detecten un riesgo, contradicción o problema técnico. Deben explicar el motivo y proponer alternativas.
- No pueden ignorar unilateralmente una decisión del usuario.
- El usuario puede autorizar excepciones a este documento. Una excepción debe tener un alcance claro y aplicarse únicamente a la tarea autorizada.
- Una autorización puntual no modifica automáticamente las reglas generales.
- Si una excepción puede comprometer la seguridad, integridad de datos o estabilidad del sistema, el agente debe explicar sus consecuencias antes de proceder.

### 1.2. Una única fuente de instrucciones

`AGENTS.md` sustituye las instrucciones generales anteriores de `AGENTS-AGENTES.md`.

- No mantener documentos paralelos con reglas generales que puedan contradecir este archivo.
- La documentación técnica específica del proyecto puede complementar estas reglas, pero no sustituirlas ni contradecirlas.
- Si dos instrucciones parecen incompatibles, identificar la contradicción y resolverla antes de realizar cambios que puedan verse afectados.

---

## 2. Protocolo obligatorio de trabajo

Toda tarea forma parte de un plan de trabajo por fases, incluso si el cambio inmediato parece pequeño.

No se debe confundir el tamaño de una modificación con la importancia de investigar su contexto.

### Fase 1. Investigación

Antes de modificar código:

1. Comprender el objetivo y el comportamiento esperado.
2. Examinar la implementación existente y la estructura relevante del proyecto.
3. Identificar los archivos involucrados, sus consumidores, dependencias e interfaces.
4. Buscar funcionalidades, componentes, servicios y utilidades reutilizables.
5. Consultar la documentación técnica y de diseño pertinente.
6. Identificar riesgos, posibles regresiones y efectos secundarios.
7. Revisar las pruebas existentes relacionadas con el comportamiento.

La investigación debe tener una profundidad proporcional a la complejidad y al riesgo, pero nunca omitirse.

No asumir que una función, archivo, dependencia o comportamiento existe sin comprobarlo en el repositorio.

### Fase 2. Diagnóstico

Antes de implementar, presentar un diagnóstico que incluya:

- Problema u objetivo identificado.
- Comportamiento actual y comportamiento esperado.
- Causa raíz, cuando se trate de un error.
- Evidencias encontradas en el código, las pruebas o la reproducción.
- Archivos afectados y sus relaciones.
- Riesgos y posibles efectos secundarios.
- Aspectos todavía desconocidos o hipótesis pendientes de comprobar.

Distinguir expresamente entre:

- **Confirmado:** respaldado por evidencia.
- **Hipótesis:** explicación posible que aún debe verificarse.
- **Pendiente:** información o comprobación que no se ha podido obtener.

No presentar una hipótesis como si fuera una causa raíz confirmada.

### Fase 3. Plan de implementación

Presentar un plan ordenado por fases antes de editar.

El plan debe especificar:

1. Qué se hará.
2. Por qué se hará.
3. Qué archivos se modificarán, crearán o eliminarán.
4. Qué comportamiento se espera obtener.
5. Qué pruebas y verificaciones se ejecutarán.
6. Qué riesgos o dependencias deben tenerse en cuenta.

La extensión del plan debe ser proporcional a la tarea. Una modificación pequeña puede tener un plan breve, pero no queda exenta de investigación, diagnóstico ni planificación.

### Fase 4. Implementación

- Seguir el plan aprobado.
- Mantener los cambios enfocados en el objetivo.
- No introducir refactorizaciones, mejoras o funcionalidades ajenas al alcance.
- Comprobar que cada modificación respeta los contratos existentes.
- Ejecutar verificaciones durante el trabajo, no únicamente al terminar.

### Fase 5. Verificación y cierre

Antes de dar por terminada la tarea:

- Ejecutar las pruebas pertinentes.
- Ejecutar la suite completa cuando corresponda.
- Ejecutar lint para los archivos de código modificados.
- Realizar la verificación visual en navegador cuando haya cambios de interfaz.
- Revisar el resultado final y los posibles efectos secundarios.
- Presentar un informe honesto de lo realizado y lo que quedó pendiente.

No declarar una tarea terminada si quedan errores conocidos que afectan a su objetivo.

---

## 3. Control del alcance y de los archivos

### 3.1. Archivos previstos

Antes de implementar, enumerar los archivos que se prevé modificar, crear o eliminar.

La lista inicial establece el alcance de trabajo, pero puede cambiar si la investigación descubre una dependencia necesaria.

### 3.2. Archivos adicionales

Si durante la implementación se descubre que es necesario modificar un archivo que no estaba contemplado:

1. Detener los cambios relacionados con ese archivo.
2. Explicar qué función cumple y por qué es necesario modificarlo.
3. Mostrar qué problema resolvería el cambio.
4. Incorporarlo al plan y solicitar autorización.

No modificar archivos adicionales unilateralmente.

La autorización puede darse como parte de la aprobación del plan actualizado.

### 3.3. Mejoras fuera del alcance

Está prohibido introducir mejoras no solicitadas ni aprobadas, aunque parezcan convenientes.

Si el agente detecta una oportunidad de mejora:

- Explicar su utilidad.
- Identificar los archivos que afectaría.
- Indicar sus riesgos y beneficios.
- Proponerla como una fase o tarea adicional.

No implementarla hasta recibir aprobación.

### 3.4. Protección de cambios existentes

- Revisar el estado de Git antes de modificar archivos.
- Identificar cambios previos del usuario u otros agentes.
- No sobrescribir, revertir, eliminar ni atribuirse cambios preexistentes.
- No utilizar comandos destructivos sin comprender exactamente sus efectos.
- No asumir que todo cambio visible en el repositorio pertenece a la tarea actual.

---

## 4. Arquitectura del proyecto

Respetar la separación de responsabilidades existente.

La organización arquitectónica de referencia es:

`js/pages/` → `js/ui/` → `js/services/` → `js/repositories/` → `js/models/` → `firebase/`

Las capas deben utilizarse cuando sean necesarias, sin introducir abstracciones artificiales.

### 4.1. Responsabilidades

- **pages:** coordinación de las páginas y sus flujos.
- **ui:** componentes, interacción y presentación.
- **services:** lógica de negocio y coordinación de operaciones.
- **repositories:** acceso y persistencia de datos.
- **models:** representación, validación y transformación de datos.
- **firebase:** configuración e integración con los servicios Firebase.

No trasladar lógica de negocio a la capa visual por comodidad.

No introducir lógica de acceso a datos directamente en componentes cuando exista una capa adecuada para ello.

### 4.2. Dependencias e interfaces

Antes de modificar un archivo:

- Identificar quién lo importa o consume.
- Revisar las funciones públicas y sus firmas.
- Comprobar la estructura de los objetos que recibe y devuelve.
- Identificar eventos, listeners, selectores y contratos DOM.
- Revisar dependencias directas e indirectas.

No cambiar una interfaz pública sin identificar y adaptar todos sus consumidores afectados.

### 4.3. Reutilización

Antes de crear una nueva implementación, buscar alternativas existentes en:

- `js/core/`
- `js/services/`
- `js/repositories/`
- `js/ui/`
- `js/models/`
- `css/componentes.css`

No duplicar funciones o componentes que ya resuelvan el mismo problema.

Si la implementación existente no es adecuada, explicar por qué antes de crear una alternativa.

---

## 5. Convenciones de código

### 5.1. JavaScript

- Utilizar JavaScript con ES Modules.
- No introducir un bundler ni un proceso de compilación.
- Preferir `const`; utilizar `let` únicamente cuando sea necesario reasignar.
- Utilizar nombres descriptivos en español para las funciones, variables y elementos propios del proyecto.
- Mantener un estilo coherente con los archivos existentes.
- Evitar abstracciones innecesarias y código excesivamente complejo.
- No añadir comentarios que simplemente repitan lo que hace el código.
- Los comentarios deben explicar decisiones, restricciones o comportamientos que no sean evidentes.
- Los comentarios del proyecto deben estar en español.
- No dejar código muerto, imports sin uso ni implementaciones duplicadas.

### 5.2. CSS

- Clases e IDs propios del proyecto en español.
- IDs en `kebab-case`.
- Tokens globales en `css/style.css`.
- Componentes reutilizables en `css/componentes.css`.
- Estilos específicos de página en `css/[pagina].css`.
- Consultar `DISENO.md` antes de crear una clase o componente visual.
- Reutilizar clases y variables existentes siempre que sea adecuado.
- No utilizar `!important`.
- No introducir estilos inline mediante atributos `style` ni asignaciones como `element.style.propiedad`.

Excepción permitida: las variables CSS `--modal-x` y `--modal-y` utilizadas para el desplazamiento de modales persistentes.

### 5.3. Convenciones Firestore

- Campos en `camelCase`.
- Tipos en minúsculas.
- Divisas en mayúsculas: `PEN`, `USD`.
- Fechas almacenadas como `Timestamp`, según los contratos del proyecto.
- IDs personalizados en minúsculas y con guiones bajos cuando corresponda.
- Los datos personales deben permanecer bajo la estructura de usuario correspondiente, como `usuarios/{uid}`.

No alterar esquemas, rutas ni contratos de datos sin analizar las consecuencias sobre los datos existentes y sus consumidores.

---

## 6. Renderizado, DOM y seguridad visual

Estas reglas son obligatorias para cualquier modificación de la interfaz.

### 6.1. Renderizado seguro

Nunca asignar datos de usuario o contenido dinámico no confiable mediante:

- `element.innerHTML`
- `insertAdjacentHTML()`

Utilizar preferentemente:

- `document.importNode(template.content, true)`.
- `contenidoDesdeTemplate(id, opciones)`.
- `contenidoDesdeFilas(id, filas, mapear)`.

Los datos deben asignarse mediante `.textContent`, `.value` o mecanismos equivalentes seguros.

No insertar HTML construido a partir de datos de usuario.

### 6.2. Excepción controlada para SVG

El HTML dinámico de SVG del catálogo puede utilizarse únicamente mediante la clave `html:` de `contenidoDesdeTemplate` o mediante clonación de nodos previamente definidos.

Esta excepción no permite insertar contenido arbitrario ni datos de usuario como HTML.

### 6.3. Templates

Los componentes reutilizables o que representen datos dinámicos deben utilizar templates cuando corresponda.

- Declarar los templates mediante `<template id="tpl-nombre-componente">`.
- Mantener los templates compartidos de `dashboard.html` y `demo.html` idénticos.
- Verificar su correspondencia mediante `tests/plantillas.test.mjs`.
- Utilizar nombres en español para IDs, clases y funciones.
- Los huecos deben identificarse mediante `data-tpl="nombre"`, sin `@`.
- Utilizar `data-tpl-attr` para atributos dinámicos.
- No dejar templates sin uso.
- No duplicar estructuras HTML que deberían reutilizar un template existente.

### 6.4. Comportamiento e interacciones

Al modificar una interfaz, preservar el comportamiento existente salvo que el plan aprobado indique expresamente lo contrario.

Comprobar, cuando corresponda:

- IDs y selectores utilizados por JavaScript.
- Listeners y delegación de eventos.
- Clases utilizadas como estados o contratos.
- Click, doble click y clic sostenido.
- Swipe y gestos.
- Drag and drop.
- Estados de carga, error y vacío.
- Accesibilidad y navegación por teclado.

No asumir que un cambio visual es inocuo para la lógica de interacción.

---

## 7. Interfaz y diseño

### 7.1. Documentación de diseño

Antes de crear o modificar componentes visuales:

1. Consultar `DISENO.md`.
2. Buscar componentes y clases reutilizables.
3. Identificar los tokens y convenciones existentes.
4. Definir cómo se integra el nuevo elemento con el diseño actual.
5. Evitar introducir patrones visuales aislados.

Si no existe una clase reutilizable adecuada, seguir las convenciones de nombres y añadirla al archivo correspondiente, normalmente `css/componentes.css` para componentes compartidos.

### 7.2. Verificación visual obligatoria

Toda modificación de interfaz debe verificarse visualmente en un navegador.

La comprobación debe realizarse sobre la aplicación y el estado que corresponda a la tarea.

Cuando sea pertinente, comprobar:

- Apariencia y alineación.
- Dimensiones y espaciado.
- Responsive y distintos tamaños de pantalla.
- Estados interactivos.
- Transiciones y animaciones.
- Carga de datos.
- Estados vacíos y de error.
- Regresiones en otras partes de la interfaz.

No basta con comprobar que el código compila o que los tests pasan.

Si el navegador o la herramienta necesaria no está disponible:

- Declarar expresamente la limitación.
- No afirmar que la interfaz fue verificada visualmente.
- Completar las verificaciones alternativas posibles.
- Dejar la comprobación visual como pendiente.

---

## 8. Firebase, datos y caché

### 8.1. Acceso a Firestore

- Utilizar los wrappers existentes en `firebase/firestore.js`.
- No introducir acceso directo a Firestore mediante CDN.
- Respetar las rutas, validaciones y contratos existentes.
- No duplicar mecanismos de acceso a datos.

### 8.2. Caché

Utilizar `cacheCapa` de `js/core/cache.js` cuando corresponda.

Después de una escritura que afecte datos almacenados en caché, verificar si es necesario invalidar la entrada correspondiente.

No añadir invalidaciones indiscriminadas ni asumir que una escritura actualiza automáticamente todos los estados visuales.

Comprobar los flujos de lectura, escritura, actualización y eliminación afectados.

### 8.3. Integridad de datos

Antes de modificar operaciones de datos:

- Identificar el esquema actual.
- Comprobar compatibilidad con registros existentes.
- Revisar validaciones y reglas de seguridad.
- Considerar datos incompletos, nulos o con formatos anteriores.
- Evitar pérdidas, duplicaciones o inconsistencias.

No modificar datos de producción ni ejecutar operaciones destructivas como parte de una prueba sin autorización expresa y sin conocer sus consecuencias.

---

## 9. Seguridad y secretos

La seguridad es una condición de diseño, no una comprobación opcional al final.

### 9.1. API keys y secretos

Distinguir entre credenciales públicas y secretos privados.

- `firebaseConfig.apiKey` es pública por diseño y no debe tratarse como una contraseña.
- La protección debe apoyarse en las reglas de Firestore y las restricciones de API correspondientes.
- `GEMINI_API_KEY` es un secreto privado y nunca debe exponerse en el cliente.

La clave privada de Gemini debe mantenerse en Secret Manager y utilizarse desde una Cloud Function como `drovProxy`, cuando corresponda.

En desarrollo local, utilizar `.env.local`, mantenerlo fuera de Git y respetar el mecanismo local existente.

Nunca introducir secretos en:

- `js/`
- `firebase/`
- Archivos `*.html`
- `tools/`
- Repositorios públicos
- Logs o mensajes de error visibles para usuarios

Si se detecta una credencial expuesta, informar del riesgo y recomendar su rotación.

### 9.2. Validación de seguridad

Al modificar autenticación, datos financieros, permisos, persistencia o comunicaciones con servicios externos, revisar los riesgos correspondientes.

No afirmar que una medida de seguridad está configurada si no se ha comprobado.

La evaluación de controles de infraestructura adicionales se abordará en su fase específica. No introducirlos como requisitos de implementación de tareas ordinarias ni afirmar que ya están configurados.

---

## 10. Dependencias y tecnologías

- No añadir dependencias por comodidad.
- Antes de incorporar una dependencia, explicar qué problema resuelve, qué alternativa existente se evaluó y qué coste de mantenimiento introduce.
- No añadir dependencias de producción sin autorización.
- No introducir frameworks, bundlers o procesos de compilación que contradigan la arquitectura actual.
- Utilizar las herramientas ya disponibles siempre que sean suficientes.

**SortableJS está aprobado para el proyecto**, incluido su uso en las funcionalidades de Dashboard H2. No debe tratarse como una dependencia prohibida ni solicitarse una nueva autorización para su uso ya aprobado.

La aprobación de una tecnología no implica que cualquier implementación que la utilice sea correcta. Deben respetarse sus contratos, accesibilidad, rendimiento y comportamiento esperado.

---

## 11. Diagnóstico y resolución de errores

### 11.1. Reproducción obligatoria

Antes de corregir un bug, intentar reproducirlo.

El agente debe:

1. Identificar las condiciones necesarias para que ocurra.
2. Ejecutar el flujo correspondiente.
3. Observar el comportamiento real.
4. Compararlo con el esperado.
5. Identificar qué evidencia respalda el diagnóstico.

En errores de interfaz, utilizar el navegador cuando esté disponible.

Si no puede reproducirse, no inventar una reproducción. Continuar investigando mediante código, logs y pruebas, indicando qué parte del diagnóstico sigue sin confirmarse.

### 11.2. Causa raíz

No implementar una solución únicamente porque parezca razonable.

Analizar las rutas de ejecución, estados, dependencias y contratos implicados.

Cuando existan varias causas posibles, diseñar comprobaciones que permitan diferenciarlas.

Evitar:

- Soluciones basadas en temporizadores arbitrarios.
- Condiciones añadidas para ocultar errores.
- Estados duplicados sin necesidad.
- Reintentos indiscriminados.
- Cambios de comportamiento no solicitados.
- Silenciar excepciones para hacer pasar las pruebas.

### 11.3. Reintentos limitados

Los agentes pueden intentar resolver un problema hasta **tres veces**.

Cada intento debe aportar una hipótesis o modificación técnicamente distinta y estar respaldado por nueva evidencia.

No repetir mecánicamente el mismo cambio o procedimiento.

Si después de tres intentos el problema no se resuelve:

- Detener los intentos sobre ese problema.
- No continuar realizando cambios especulativos.
- Registrar el error y los intentos realizados.
- Determinar si existen tareas independientes que puedan continuar de forma segura.

El agente tiene dos alternativas:

**A. Consultar al usuario inmediatamente**, cuando el problema bloquea el resto del trabajo, requiere una decisión o existe riesgo de continuar.

**B. Dejar el problema pendiente**, cuando puede aislarse y el resto de las fases puede continuar sin comprometer la corrección del resultado.

En el segundo caso, completar las tareas independientes del plan y presentar al final el error, los intentos realizados y la consulta o decisión necesaria.

---

## 12. Testing y calidad

Las pruebas deben demostrar que el comportamiento es correcto, no limitarse a confirmar que el código se ejecuta.

### 12.1. Principios

- Los tests deben evaluar código real del proyecto.
- No crear copias simplificadas de la implementación para probarlas en lugar del código real.
- No añadir tests vacíos como `assert(true)`.
- No utilizar mocks que sustituyan precisamente el comportamiento que se necesita verificar.
- No comprobar únicamente que se llamó una función si el requisito es que se produzca un resultado observable.
- No eliminar, debilitar ni modificar aserciones para hacer pasar una suite.
- No ocultar fallos preexistentes ni atribuirlos a la tarea actual sin evidencia.

### 12.2. Reproducción mediante tests

Cuando se corrige un bug, los tests deben reproducir el fallo antes de la corrección cuando sea viable.

Después de implementar, deben comprobar que el comportamiento esperado se cumple y que el fallo ya no ocurre.

Si no es viable reproducirlo mediante un test automatizado, explicar la limitación y utilizar una verificación alternativa adecuada.

### 12.3. Cuándo añadir tests

Añadir o ampliar pruebas cuando se modifique lógica no trivial, especialmente:

- Ramas condicionales.
- Bucles y procesamiento de colecciones.
- Parsers y transformaciones.
- Cálculos financieros.
- Operaciones con fechas y divisas.
- Seguridad y permisos.
- Persistencia y caché.
- Estados de carga, error y vacío.
- Interacciones y comportamiento de componentes.

Utilizar el patrón de pruebas existente en `tests/helpers.mjs`, incluyendo las utilidades `nuevoReporter` y `extraerFuncion`, y respetar la estructura de los tests del repositorio.

### 12.4. Ejecución obligatoria

Para cambios de código:

1. Ejecutar las pruebas focalizadas durante la implementación.
2. Ejecutar `npm test` antes de cerrar la tarea.
3. Ejecutar `npm run lint` para comprobar el código modificado, siguiendo la configuración existente.
4. Resolver los errores introducidos por el cambio.
5. Informar de cualquier fallo preexistente que afecte a la interpretación del resultado.

Para cambios exclusivamente documentales, no es necesario ejecutar la suite completa si no existe una razón técnica para hacerlo.

### 12.5. Honestidad de resultados

Nunca afirmar que:

- `npm test` pasó si no se ejecutó.
- Lint está limpio si no se ejecutó.
- Un bug está corregido si no se verificó.
- La interfaz funciona si no se comprobó.
- Una operación fue exitosa si no existe evidencia.

Informar de los resultados reales, incluyendo el comando y su resultado relevante.

No inventar cantidades de suites, tests, archivos o errores.

---

## 13. Herramientas, agentes y delegación

Los agentes tienen libertad para elegir herramientas de investigación, análisis, edición y verificación, siempre que respeten este documento y el alcance autorizado.

- NUNCA des la tarea por terminada sin haber modificado los archivos en el disco.
- Si `apply_patch` falla o no está disponible, edita los archivos directamente ejecutando un script corto de Python (`python -c "..."`) o PowerShell en la terminal.
- Tras editar, lee el archivo modificado para verificar que el cambio quedó guardado.


### 13.1. Delegación

Se permite delegar tareas a otros agentes.

La delegación debe tener:

- Objetivo concreto.
- Contexto suficiente.
- Alcance definido.
- Archivos o áreas involucradas.
- Resultado esperado.
- Criterios para evaluar el trabajo.

El agente responsable debe revisar críticamente los resultados recibidos. No aceptar automáticamente código, diagnósticos o conclusiones de otro agente.

La responsabilidad de la calidad final permanece en el agente que coordina la tarea.

### 13.2. Herramientas no disponibles

Si una herramienta necesaria no está disponible:

- Indicar qué herramienta falta.
- Explicar qué comprobación no puede realizarse.
- Utilizar alternativas razonables cuando existan.
- Diferenciar los resultados comprobados de las verificaciones pendientes.

No simular ejecuciones ni inventar resultados.

### 13.3. Eficiencia

- Evitar lecturas repetidas de archivos sin necesidad.
- No ejecutar suites completas innecesariamente durante cada pequeña iteración.
- Utilizar pruebas focalizadas durante el desarrollo y la suite completa al cerrar.
- No delegar tareas que sean más rápidas y seguras de resolver directamente.
- No realizar cambios masivos sin una justificación técnica.
- No continuar investigando aspectos que no afectan al objetivo ni a sus riesgos.

---

## 14. Git y control de versiones

- Revisar `git status` antes de comenzar.
- Identificar los cambios preexistentes.
- Mantener aislados los cambios de la tarea actual.
- Revisar el diff antes de dar por finalizada la implementación.
- No descartar cambios del usuario ni de otros agentes.

**Los agentes no pueden realizar commits ni push por iniciativa propia.**

Solo podrán ejecutar estas operaciones cuando el usuario las solicite explícitamente.

No interpretar la aprobación de un plan de implementación como autorización para crear commits o hacer push.

---

## 15. Identidad y convenciones de drov

El asistente de escinco se denomina siempre `drov`, en minúsculas.

Esta convención se aplica a:

- Textos.
- Comentarios.
- Variables.
- Funciones.
- Clases.
- Selectores CSS.
- Identificadores y nombres internos.

No utilizar variantes de capitalización.

Los detalles de proveedores, modelos y enrutamiento de IA se documentarán cuando se aborde esa fase específica. No asumir que un modelo o proveedor concreto es permanente ni introducir cambios en esa configuración por iniciativa propia.

---

## 16. Graphify

`graphify-out/` es un artefacto generado y debe permanecer en `.gitignore`.

Cuando sea necesario regenerar el grafo:

```bash
graphify extract . --code-only
```

`GRAPH_REPORT.md` puede versionarse si aporta valor al proyecto.

Los hooks de Graphify se instalarán cuando su funcionamiento sea estable y exista una necesidad concreta.

No regenerar artefactos ni ejecutar herramientas de análisis globales sin una razón relacionada con la tarea.

---

## 17. Criterios de finalización e informe

Al terminar una tarea, presentar un informe que permita entender exactamente qué ocurrió.

Debe incluir:

### 17.1. Resultado

- Objetivo de la tarea.
- Problema identificado y causa raíz, si correspondía.
- Solución implementada.
- Comportamiento resultante.

### 17.2. Archivos

Enumerar los archivos:

- Modificados.
- Creados.
- Eliminados.

Explicar brevemente la función de los cambios relevantes.

### 17.3. Verificación

Informar de:

- Tests focalizados ejecutados.
- Resultado de `npm test`.
- Resultado de lint.
- Verificación visual en navegador, si correspondía.
- Otras comprobaciones relevantes.

Distinguir entre comprobaciones exitosas, fallidas y no ejecutadas.

### 17.4. Pendientes y riesgos

Indicar:

- Errores que no se pudieron resolver.
- Fases que quedaron pendientes.
- Limitaciones de herramientas o entorno.
- Riesgos conocidos.
- Decisiones que requieren aprobación del usuario.

No presentar como finalizado un trabajo que todavía tenga fases pendientes.

---

## 18. Regla final

El agente no debe optimizar únicamente para terminar rápido o producir una solución que parezca funcionar.

Debe optimizar para entregar **código de mayor calidad, corregir los errores de manera fiable, evitar regresiones y utilizar eficientemente el tiempo y las herramientas disponibles**.

Investigar antes de modificar. Diagnosticar antes de implementar. Planificar antes de ampliar el alcance. Verificar antes de declarar terminado.

Cuando no exista evidencia suficiente, decirlo. Cuando una decisión corresponda al usuario, consultarlo. Cuando un problema no pueda resolverse dentro de los límites establecidos, dejarlo documentado en lugar de introducir una solución especulativa.