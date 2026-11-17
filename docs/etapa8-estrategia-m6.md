# Etapa 8 — Estrategia de migración M6

**Fase 0 — Preparación y Contratos Técnicos.**
Documenta el estado de la migración M6 (padre → varias cuentas finales) y las preguntas abiertas para el PO. Solo describe el comportamiento; no modifica código de producción.

## 1. ¿M6 está aplicada en producción?

**No se puede verificar desde el repositorio.**

Evidencia del repositorio:
- El script `scripts/migraciones/m6-preferencias-padre.mjs` existe en `HEAD` (rama `main`) y está **eliminado en el working tree** (cambio preexistente, no relacionado con Etapa 8, no staged).
- El script genera el archivo de propuesta `./propuesta-m6.json` y **no escribe en Firestore** ("el SDK web no se puede cargar desde Node").
- Las propuestas `propuesta-m4.json` … `propuesta-m8.json` también están eliminadas en el working tree.

Conclusión: no hay forma de confirmar desde este entorno si M6 fue ejecutada contra Firestore de producción. **Estado: verificar.** Requiere acceso al entorno de producción / consola de Firestore o al historial de despliegues.

## 2. Qué hace M6 (según el script en HEAD)

- Lee cuentas y preferencias del usuario (desde backup o Firestore).
- Expande las "cards agregadas de familia" en **una card por cuenta final** (`cuenta:<id>`).
- Ajusta dimensiones (`dimensión ajustada`) y elimina dimensiones de cuentas ya no presentes (`dimensión eliminada`).
- Produce `propuesta-m6.json` con: `migracion: "M6"`, `uid`, `fecha`, `fuente`, `resumen`, `cambios`, `dashboard_propuesto`, `estado_general` y `instrucciones`.
- Instrucciones del propio script: revisar los cambios, editar el JSON si algún caso no debe migrarse, aplicar cuando la UI de F7.7 lea cada cuenta como instancia individual. **No se escribe Firestore desde Node; la aplicación real requiere un escritor de preferencias.**

## 3. Traslado de preferencia de padre a varias cuentas finales — PROTEGIDO

El PO ha protegido esta decisión: **no inventar**. Cuando una preferencia de un padre (tarjeta de familia agregada) debe trasladarse a varias cuentas finales, hay ambigüedades que deben resolverse con el PO antes de implementar:

1. ¿Cada cuenta final hereda exactamente la misma dimensión/orden del padre, o se calculan individualmente?
2. ¿Qué ocurre con la posición global del orden (`orden`) al expandir una card de familia en varias cuentas consecutivas? ¿Se conservan las posiciones relativas del resto de cards?
3. ¿Cómo se evitan duplicaciones si una cuenta ya tiene su propia card individual además de la heredada del padre?
4. ¿El usuario puede elegir qué cuentas finales reciben la migración, o se aplica a todas las cuentas del padre automáticamente?

**Acción:** documentar estas preguntas para el PO. No se implementará lógica de migración M6 en esta fase sin confirmación.

## 4. Requisitos de Fase 0 para cuando se implemente M6

- Conservar la **posición global** de las cards en el orden del dashboard.
- Evitar **duplicaciones** de cards para una misma cuenta final.
- No escribir en Firestore desde un script de Node (según el propio script M6); usar el escritor de preferencias de la aplicación.
- Generar una propuesta revisable (`propuesta-m6.json`) antes de aplicar.

## 5. Archivos relacionados

- `scripts/migraciones/m6-preferencias-padre.mjs` (en HEAD; eliminado en working tree).
- `scripts/migraciones/preferencias.mjs` (`migrarPreferenciasM6`, `resumenCambios`, `argumentosMigracion`).
- `scripts/migraciones/lector-datos.mjs` (`leerCuentas`, `leerPreferencias`).
- `propuesta-m6.json` (generada por M6; eliminada en working tree).
