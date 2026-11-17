# CONTEXTO DEL PRODUCTO ESCINCO

## 1.1 Propósito y Visión

**escinco** es una aplicación web financiera personal que ayuda a los usuarios a gestionar sus finanzas personales. El sistema permite:

- Control de cuentas y saldos en múltiples divisas (PEN, USD, USDT, EUR)
- Registro y categorización de movimientos (ingresos, gastos, transferencias, cambios de divisa)
- Gestión de inversiones (activos, posiciones, órdenes de trading)
- Seguimiento de metas de ahorro
- Presupuestos periódicos
- Visualización de patrimonio y evolución patrimonial

**Vision**: Convertir escinco en la herramienta integral para que personas tengan claras sus finanzas en múltiples divisas, con acompañamiento de IA (drov) para análisis y recomendaciones.

## 1.2 Usuarios y Necesidades

| Usuario | Necesidades Principales |
|---------|------------------------|
| Usuario individual | Control de cuentas en divisas, registro de movimientos, seguimiento de metas, visión patrimonial |
| Usuario beta | Acceso a nuevas funcionalidades IA, pruebas de flujos, retroalimentación de usabilidad |
| Agente drov (IA) | Acceso a datos estructurados, capacitación para proporcionar recomendaciones financieras |

## 1.3 Modelo de Negocio

- **Plan "plana"**: Plan gratuito con funcionalidades básicas
- **Plan "flash"**: Plan de pago con funcionalidades avanzadas (IA avanzada, comprobantes, etc.)
- La nomenclatura vigente usa `plana`/`flash`/`drov` en lugar de términos tradicionales como `basic`/`premium`

## 1.4 Módulos y Capacidad Actual

El proyecto tiene los siguientes módulos principales implementados:

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| Cuentas | ✅ Implementado | Gestión de cuentas de usuario con múltiples divisas y subcuentas |
| Movimientos | ✅ Implementado | Registro de ingresos, gastos, transferencias, cambios de divisa |
| Inversiones | ✅ Parcial | Trading de activos, órdenes limitadas/stop, posiciones |
| Metas | ✅ Implementado | Metas de ahorro con seguimiento de progreso |
| Patrimonio | ✅ Implementado | Evolución patrimonial con snapshots diarios |
| Trading | ✅ Parcial | Ejecución de órdenes, gráficos de activos |
| Configuración | ✅ Implementado | Preferencias de tema, formato divisa, notificaciones |
| IA (drov) | ✅ Parcial | Integración con Gemini, asistente, registro de contexto |

## 1.5 Decisiones Arquitectónicas Notables

1. **Sin bundler/compiler**: El proyecto usa ES Modules directamente sin build step ni bundler
2. **Cache en dos niveles**: `cacheCapa` en `js/core/cache.js` combina memoria (Map) + localStorage con TTL de 5 minutos
3. **Service Worker con estrategias por tipo de recurso**: `sw.js` aplica diferentes estrategias de cacheo según JS, CSS, fuentes, imágenes, etc.
4. **Modo persistencia OFFLINE en Firestore**: `firebase/firestore.js` deshabilita persistence offline por consideraciones de consistencia
5. **Reglas Firestore unificadas**: `validarCamposMovimiento`/`validarCamposCuenta` usadas tanto por create como update (DEUDA-012 resuelta)

## 1.6 Dependencias Externas

- **Firebase**: Auth, Firestore, Hosting
- **Chart.js**: `js/lib/chart.umd.min.js` (local, no CDN)
- **Google Gemini API**: `GEMINI_API_KEY` en Secret Manager / `.env.local`

## 1.7 Convenios Importantes

- **Sin `!important` en CSS** (excepción: `--modal-x`, `--modal-y`)
- **Comentarios en español** en todo el código
- **Nombres en español** para variables, funciones, clases
- **camelCase** para funciones/variables, **kebab-case** para IDs HTML/CSS
- **Tipos en minúsculas** en Firestore, **divisas en mayúsculas** (PEN, USD)
- **Fechas como Timestamp** en Firestore
- **Sin secretos en el cliente**: `GEMINI_API_KEY` nunca expuesto en código del cliente