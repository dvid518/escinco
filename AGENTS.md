# Reglas de renderizado y mantenimiento — escinco

Este archivo rige cualquier modificación de la capa de UI del proyecto. Su objetivo es evitar regresiones a `innerHTML`, estilos inline y mezcla de lógica de negocio con renderizado.

## 1. Renderizado seguro (obligatorio)

- **Nunca** usar `element.innerHTML = \`...\`` con datos de usuario o dinámicos.
- **Nunca** usar `element.insertAdjacentHTML(...)` con datos dinámicos.
- Usar siempre `document.importNode(template.content, true)` o los helpers `contenidoDesdeTemplate(id, opciones)` / `contenidoDesdeFilas(id, filas, mapear)` de `js/ui/modal.js`.
- Rellenar datos con `.textContent = dato` (o `.value` para inputs). Nunca inyectar HTML del usuario.
- Si debe ir HTML dinámico (icono SVG del catálogo), usar la clave `html:` de `contenidoDesdeTemplate` o clonar el nodo correspondiente.

## 2. Templates

- Todo componente reutilizable o con datos dinámicos va en un `<template id="tpl-nombre-componente">` en `dashboard.html` (y replicarse idéntico en `demo.html`, verificado por `tests/plantillas.test.mjs`).
- Los IDs de templates, clases y funciones deben ir **en español**.
- Los huecos se declaran con `data-tpl="nombre"` (sin `@` dentro; los atributos van en `data-tpl-attr`).
- Un template no debe quedar sin uso (verificado por `plantillas.test.mjs`).

## 3. Estilos y DOM

- No usar estilos inline (`style="..."` o `element.style.x = ...`) salvo excepciones documentadas (CSS variables `--modal-x`/`--modal-y` para drag de modales persistentes).
- No usar `!important`.
- No introducir dependencias ni pasos de build (ES Modules vanilla, sin bundler).

## 4. Lógica de negocio

- No modificar lógica de negocio, solo la capa de renderizado.
- Mantener el mismo comportamiento exacto que antes (mismos IDs de DOM, mismos listeners, mismos nombres de clase CSS, mismas interacciones: click, doble click, clic sostenido, swipe).

## 5. Commits

- Uno por componente o página migrada: `refactor(ui): migrar [componente/página] a <template>`
- Si algo falla o el diagnóstico revela un problema mayor, parar y reportar antes de continuar.

## 6. Verificación

- Ejecutar `npm test` tras cada cambio (debe quedar TODO OK).
- No modificar tests existentes salvo que sea estrictamente necesario para cubrir un componente migrado.
- Antes de tocar una página, verificar que exista el `<template>` correspondiente en `dashboard.html` y `demo.html`.
