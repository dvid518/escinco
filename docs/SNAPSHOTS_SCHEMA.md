# SNAPSHOTS_SCHEMA — Esquema de `usuarios/{uid}/snapshots/{fecha}`

## Versión actual

- **schemaVersion: 1** — primera versión con versionado explícito.
- Los snapshots escritos antes de esta versión no tienen el campo `schemaVersion` y se consideran **v0**.

## Campos

| Campo | Tipo | Obligatorio | Versión | Descripción |
|-------|------|-------------|---------|-------------|
| patrimonioPEN | número | Sí | v0+ | Patrimonio total en PEN |
| patrimonioUSD | número | Sí | v0+ | Patrimonio total en USD |
| patrimonioUSDT | número | No | v0+ | Legacy, idéntico a patrimonioUSD (deprecado) |
| liquidezPEN | número | No | v0+ | Liquidez en PEN |
| liquidezUSD | número | No | v0+ | Liquidez en USD |
| inversionesPEN | número | No | v0+ | Inversiones en PEN |
| inversionesUSD | número | No | v0+ | Inversiones en USD |
| inmovilPEN | número | No | v0+ | Inmovilizado en PEN |
| inmovilUSD | número | No | v0+ | Inmovilizado en USD |
| deudasPEN | número | No | v0+ | Deudas en PEN |
| deudasUSD | número | No | v0+ | Deudas en USD |
| cerrado | booleano | No | v0+ | Indica si el snapshot del día está cerrado |
| actualizacion | timestamp | No | v0+ | Última actualización del documento |
| schemaVersion | número | Sí | v1+ | Versión del esquema. Siempre `1` en escrituras nuevas |

## Lectura de snapshots antiguos (sin schemaVersion)

Los snapshots creados antes de la v1 no incluyen el campo `schemaVersion`. Al leerlos, el código debe tratar la ausencia del campo como **v0**:

```js
const version = snapshot.schemaVersion ?? 0 // v0 si no existe
```

No es necesario migrar snapshots históricos. El campo `schemaVersion` solo se escribe en nuevas escrituras (`guardarSnapshotDelDia`).

## Reglas de Firestore

- El campo `schemaVersion` está incluido en la lista `hasOnly` del `create` de `snapshots/{fecha}`.
- No hay validación de tipo obligatoria para `schemaVersion` en `update` (los documentos legacy pueden no tenerlo).
- Los `fieldOverrides` en `firestore.indexes.json` excluyen de indexación automática todos los campos numéricos de snapshots (incluyendo `patrimonioUSDT` legacy).

## Historial de versiones

| Versión | Cambios | Fecha |
|---------|---------|-------|
| v0 | Esquema original sin `schemaVersion` | Antes de 2026-10-22 |
| v1 | Añade `schemaVersion: 1` en escrituras nuevas | 2026-10-22 |
