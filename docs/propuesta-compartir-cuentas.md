# Propuesta: compartir cuentas entre usuarios

Fecha: 2026-10-11 · Estado: diseño, sin implementar.

## Roles

| Rol | Puede ver | Puede crear/editar movimientos | Puede editar la cuenta |
|---|---|---|---|
| `host` | sí | sí | sí + compartir/revocar |
| `editor_cuenta` | sí | sí | sí (no compartir) |
| `editor_movimientos` | sí | sí | no |
| `lector` | sí | no | no |

Un usuario es `host` de la cuenta: la cuenta vive en `usuarios/{hostUid}/cuentas/{id}` y el host decide quién entra y con qué rol. Solo el host comparte y revoca.

## Modelo propuesto (sin romper lo actual)

En el doc de cuenta:

- `hostUid: string` (igual al dueño hoy).
- `compartidaCon: { [uid]: "lector" | "editor_movimientos" | "editor_cuenta" }`.
- `versionCompartida: number` para invalidar cachés.

En movimientos de una cuenta compartida: `cuentaHostUid` para saber dónde vive la cuenta sin adivinar por el `uid` del lector.

Nada de esto existe todavía en `firestore.rules` ni en el código.

## Reglas (esbozo)

- `read` de cuenta: `esPropietario(hostUid) || request.auth.uid in compartidaCon`.
- `update` de cuenta: host siempre; `editor_cuenta` solo campos no estructurales (nombre, num, cci, vence, límites), nunca `compartidaCon`, `hostUid`, `estado`, `orden`, `padreId`, `esAbstracta`.
- `create/update/delete` de movimientos con `cuenta` compartida: `editor_movimientos` o superior; el `saldoInicial`/`deuda` de la cuenta solo lo recalcula el host (o Cloud Function) para evitar carreras.
- `snapshots`: solo el host los escribe; los lectores leen el agregado ya calculado.

## Invitaciones

1. Host escribe `usuarios/{host}/invitaciones/{id}` con `{email, cuentaId, rol}`.
2. El invitado acepta → transacción que añade su `uid` a `compartidaCon` y borra la invitación.
3. Revocar = borrar la clave de `compartidaCon`. Los movimientos ya creados se conservan; la cuenta desaparece de sus selectores.

## Qué falta para implementarlo

- Migrar `cuentas` a lectura por `collectionGroup` o réplica por lector (hoy todo cuelga de `usuarios/{uid}` y las reglas aíslan por `uid`).
- Resolver conflictos de `saldoInicial`/`deuda` con escrituras concurrentes (transacción o Function).
- UI: insignia "Compartida", pantalla de miembros por cuenta, selector de rol, y `cuentasOperables()` uniendo propias + compartidas.
- Auditoría: quién editó qué (campo `actualizadoPor` en cuenta y movimiento).

Se deja como PEND-010. No se implementa en este cambio para no abrir un hueco de lectura entre usuarios sin las reglas anteriores.
