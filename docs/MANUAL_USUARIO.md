# Manual de usuario de escinco

**Versión de la plataforma:** 1.0.0-beta (fase beta)  
**Idioma:** español  
**Monedas soportadas:** PEN (S/), USD ($), EUR (€), USDT (₮)

Este manual te guía por escinco paso a paso. Está escrito para alguien que nunca ha usado la plataforma y describe exactamente lo que puedes hacer en cada pantalla, sin suposiciones.

---

## 1. Introducción

### ¿Qué es escinco?

escinco es una aplicación web de finanzas personales para inversionistas en Perú. Te permite centralizar cuentas bancarias, billeteras, exchanges, tarjetas de crédito, inversiones y deudas en un solo panel, y ver tu patrimonio real sin fórmulas manuales.

Es una **PWA (progresiva)**: puedes instalarla en tu móvil o PC y funciona como una app nativa, incluso sin conexión (de forma parcial).

### Objetivo de la plataforma

Que sepas cuánto tienes realmente, cuánto debes y cuánto tienes invertido, todo actualizado automáticamente cada vez que registras un movimiento. escinco suma cuentas en distintas divisas y te muestra el patrimonio convertido a tu divisa principal.

### Requisitos de acceso

- Un navegador web moderno (Chrome, Edge, Safari, Firefox).
- Conexión a internet para registrarte, iniciar sesión y sincronizar tus datos con la nube. La interfaz funciona sin conexión, pero los cambios se guardan localmente y se sincronizan al volver.
- Una cuenta de escinco (correo electrónico y contraseña, o acceso con Google o Facebook).
- No se necesita tarjeta de crédito ni pago: escinco es gratuito en fase beta.

> **Importante:** escinco **no se conecta automáticamente a tu banco** todavía. Registras las cuentas y los movimientos a mano, y escinco los suma y los valora por ti.

---

## 2. Registro e inicio de sesión

### Crear una cuenta

1. Ve a la pantalla de registro (`/register`) o pulsa "Crear cuenta" en la página de inicio.
2. Rellena los campos obligatorios:
   - **Nombre**
   - **Correo electrónico**
   - **Contraseña** (mínimo 6 caracteres)
   - **Confirmar contraseña**
3. Pulsa el botón de crear cuenta.
4. También puedes registrarte con **Google** o **Facebook** pulsando sus botones respectivos.

Tras crear la cuenta, se te envía un enlace de verificación a tu correo. Revisa tu bandeja de entrada y pulsa "Ya verifiqué mi correo" (o "Reenviar enlace" si no te llega).

> Apple aparece como opción pero está deshabilitado ("próximamente").

### Iniciar y cerrar sesión

**Iniciar sesión:**
1. Ve a la pantalla de acceso (`/login`) o pulsa "Entrar".
2. Escribe tu correo y contraseña, o pulsa Google/Facebook.
3. Pulsa el botón de iniciar sesión.

**Cerrar sesión:**
- Desde cualquier pantalla de la aplicación, abre **Configuración** (icono de engranaje en la barra superior) y busca la opción de cerrar sesión. Se te pedirá confirmación antes de salir.
- La sesión se cierra automáticamente tras **15 minutos de inactividad** por seguridad.

### Recuperación de contraseña

Sí está implementada:

1. En la pantalla de inicio de sesión, pulsa **"¿Olvidaste tu contraseña?"**.
2. Escribe tu correo electrónico y pulsa "Enviar enlace de recuperación".
3. Revisa tu correo y sigue el enlace que te llega.
4. En la pantalla de restablecimiento, elige una contraseña nueva y confírmala.
5. Pulsa "Guardar contraseña nueva" y vuelve al inicio de sesión.

---

## 3. Dashboard

El dashboard es la pantalla principal. Resume tu situación financiera en tarjetas ("cards") que puedes ver, ocultar, redimensionar y reordenar.

### Interpretación del patrimonio

La card principal **Patrimonio total** muestra la suma de todo lo que tienes (en efectivo, cuentas e inversiones) restando lo que debes, todo convertido a tu divisa principal.

Debajo, el dashboard muestra tarjetas como:
- **Ingresado / Gastado:** totales del último período.
- **Evolución patrimonial:** gráfico de cómo ha cambiado tu patrimonio con el tiempo (7D, 30D, 90D o Todo).
- **Distribución patrimonial:** cómo se reparte tu patrimonio entre liquidez, inversiones, inmovilizado y deudas.
- **Últimos movimientos:** listado de los movimientos más recientes.
- **Metas de ahorro:** progreso hacia tus objetivos de ahorro.
- **Alertas:** avisos del sistema (ej. uso elevado de tarjeta de crédito).

### Dinero disponible, invertido y deudas

Al abrir el detalle del patrimonio (card Patrimonio total) ves tres cifras:

| Cifra | Qué significa |
|-------|---------------|
| **Disponible** | Dinero en cuentas líquidas (efectivo, bancos, tarjetas de débito) que puedes usar. |
| **Inmovil / invertido** | Dinero en inversiones y activos que no están disponibles para gasto inmediato. |
| **Deudas** | Total de lo que debes (saldos de tarjetas de crédito y demás deudas registradas). |

El patrimonio total = disponible + invertido − deudas.

### Organización y personalización de tarjetas

Puedes editar el dashboard desde **Configuración › Panel de dashboard** (o el editor de cards):

- **Activar o desactivar cards:** elige qué tarjetas aparecen en el dashboard.
- **Tamaño de las cards:** ajusta cuántas columnas y filas ocupa cada card.
- **Cuentas y activos visibles:** elige qué cuentas y activos se muestran en las tarjetas que los usan.
- **Reordenar cards:** arrastra las tarjetas para poner primero las que más te importan.

### Selección de divisas

escinco trabaja con cuatro divisas: **PEN (soles), USD (dólares), EUR (euros) y USDT**. Cada cuenta y cada movimiento tiene su propia divisa, y escinco los convierte automáticamente a tu **divisa principal** para mostrar totales.

Puedes configurar:
- **Divisa principal:** la divisa en la que se resumen todos tus totales.
- **Formato de divisa:** se muestran los importes con símbolo (S/, $, €, ₮) o con código (PEN, USD, EUR, USDT).
- **Tipo de cambio:** puedes fijarlo manualmente o dejarlo en modo automático (según la configuración activa).

### Ocultamiento de importes

En la card de Patrimonio total hay un botón de "ojo" para **ocultar los importes** de la pantalla. Úsalo si estás en un lugar público y no quieres que se vean tus cifras. Los importes se vuelven a mostrar al pulsar de nuevo el mismo botón. Esta opción solo afecta a la sesión actual y no se guarda en tu perfil.

---

## 4. Gestión de cuentas

Una cuenta es donde guarda tu dinero: efectivo, banco, tarjeta de débito, tarjeta de crédito o exchange (cripto).

### Crear cuentas

1. Ve a la sección **Cuentas** desde la barra superior.
2. Pulsa el botón para crear una cuenta nueva.
3. Rellena:
   - **Nombre** de la cuenta (ej. "BBVA ahorro", "Efectivo", "Binance").
   - **Tipo:** efectivo, banco, tarjeta de débito, tarjeta de crédito o exchange.
   - **Divisa:** PEN, USD, USDT o EUR.
   - **Saldo inicial:** cuanto tiene la cuenta ahora.
   - Opcional: número de cuenta, CCI, día de corte, día de pago, límite (para tarjetas de crédito).
4. Guarda. La cuenta aparece en el listado y empieza a sumar en el patrimonio.

### Editar y eliminar cuentas

- **Editar:** abre la cuenta desde el listado y modifica sus datos. Puedes cambiar nombre, divisa, saldo, límites, etc.
- **Archivar:** si ya no usas una cuenta pero quieres conservar su historial, archívala. Deja de aparecer en el listado principal y deja de sumar en el patrimonio, pero sus movimientos se conservan. Puedes recuperar cuentas archivadas desde **Configuración › Datos**.
- **Eliminar:** si borras una cuenta con saldo distinto de cero, escinco te avisará. Los movimientos no se pierden: se conservan y se muestran como "Cuenta eliminada". Esta acción no se puede deshacer.

### Consultar saldos y divisas

Desde la sección Cuentas ves cada cuenta con:
- Su nombre y tipo.
- Su saldo actual, en su divisa.
- Su estado (activa o archivada).
- Para tarjetas de crédito: el límite, el uso de la línea y el día de corte/pago, con un indicador de uso saludable, elevado o crítico.

Pulsando una cuenta ves su detalle (información y movimientos de esa cuenta).

---

## 5. Gestión de movimientos

Un movimiento es cada ingreso, gasto, transferencia o operación que afecta a tus cuentas. escinco tiene **11 tipos de movimiento**:

| Tipo | Qué registra |
|------|--------------|
| Ingreso | Dinero que entra a una cuenta. |
| Gasto | Dinero que sale de una cuenta. |
| Transferencia | Dinero que mueves entre dos de tus cuentas. |
| Cambio de divisa | Cambio de una divisa a otra (ej. soles a dólares). |
| Compra de activo | Compras una inversión (BTC, acciones, etc.). |
| Venta de activo | Vendes una inversión. |
| Compra P2P / Venta P2P | Compra o venta directa con otra persona. |
| Compra con tarjeta | Gasto hecho con tarjeta de crédito. |
| Pago de tarjeta | Pago que haces para reducir la deuda de tu tarjeta. |
| Error | Movimientos para corregir o anotar errores. |

### Registrar ingresos

1. Ve a **Movimientos** y pulsa el botón de nuevo movimiento.
2. Elige el tipo **Ingreso**.
3. Selecciona la cuenta donde entra el dinero, escribe el concepto, el monto, la divisa y la fecha.
4. Guarda. El ingreso suma al saldo de la cuenta y al patrimonio.

### Registrar gastos

1. Elige el tipo **Gasto**.
2. Selecciona la cuenta de la que sale el dinero, concepto, monto, divisa y fecha.
3. Opcional: añade **etiquetas** (ej. "comida", "transporte") para agrupar y filtrar gastos después.
4. Guarda. El gasto resta al saldo y se registra como negativo.

### Registrar transferencias

1. Elige el tipo **Transferencia**.
2. Selecciona la **cuenta origen** y la **cuenta destino**.
3. Si usan la misma divisa, escribe el monto. Si usan divisas distintas, el formulario pide monto origen, monto destino y tipo de cambio.
4. Guarda. Se resta de la origen y se suma a la destino.

### Registrar compra y venta de activos (inversiones)

Desde la sección **Inversiones** o desde Movimientos eligiendo "Compra de activo" o "Venta de activo":

1. Indica el **activo** (ej. BTC, AAPL) y la cuenta donde se ejecuta.
2. Escribe la **cantidad**, el **precio por unidad** y, opcional, la **comisión**.
3. Guarda. escinco actualiza tu posición (cantidad y precio promedio) y el historial de precios.

### Editar, eliminar y consultar movimientos

- **Consultar:** en la sección Movimientos ves el listado completo. Puedes filtrar por tipo (todos, ingresos, gastos, transferencias, cambio de divisa, inversiones, P2P, tarjetas, errores), buscar por concepto, filtrar por cuenta, etiquetas o rango de fechas.
- **Editar:** abre un movimiento y modifica sus datos. Al guardar, los saldos de las cuentas afectadas se recalculan.
- **Eliminar:** pulsa el botón de eliminar en un movimiento y confirma. El movimiento desaparece y los saldos se ajustan.
- **Deshacer:** tras eliminar, aparece una notificación con la opción de deshacer la acción durante un tiempo corto.
- **Favoritos:** si un movimiento es de tipo ingreso, gasto o compra con tarjeta, puedes guardarlo como plantilla (ver sección Favoritos).

---

## 6. Gestión de inversiones

escinco tiene una sección **Inversiones** (y, si la activas, **Trading**) para seguir tu cartera además de tus cuentas bancarias.

### Administrar inversiones

Desde **Inversiones** puedes ver:
- **Posiciones:** cada activo que posees, con cantidad y precio promedio de compra.
- **Valor total:** suma de todas tus posiciones convertida a tu divisa principal.
- **Rendimiento:** ganancia o pérdida acumulada de tu cartera.
- **Estrategias:** reglas automáticas (tipo DCA) que puedes crear para comprar activos periódicamente.

### Consultar posiciones

Cada posición muestra:
- Activo y símbolo (ej. BTC, ETH, AAPL).
- Cantidad que posees.
- Precio promedio de compra.
- Último precio conocido y valor actual de la posición.
- Divisa del precio.

Puedes editar una posición (cantidad o precio promedio) o eliminarla.

### Registrar operaciones de compra y venta

- **Compra:** desde Inversiones, pulsa nueva operación y elige compra. Indica activo, cantidad, precio y fecha. La posición se crea o se actualiza (precio promedio ponderado).
- **Venta:** elige venta. Indica cantidad y precio de venta. Se reduce la posición y se registra la ganancia o pérdida.

Si usas **Trading**, también puedes abrir **trades** (largo o corto) con stop loss y take profit, y colocar **órdenes** (límite o stop) que se ejecutan solas al alcanzar el precio de disparo.

> Las órdenes no tienen ejecución automática completa en esta fase; comprueba el estado de cada orden desde la sección Trading.

### Consultar el rendimiento

En Inversiones ves el rendimiento total de la cartera y el valor actual de cada posición. Compara el precio promedio de compra con el último precio para saber si cada activo está ganando o perdiendo.

---

## 7. Favoritos

Los favoritos son **plantillas de movimiento recurrente**. Te ahorran escribir siempre los mismos datos (ej. "Sueldo", "Netflix", "Ahorro mensual").

### Guardar movimientos como favorito

Cuando ves un movimiento de tipo ingreso, gasto o compra con tarjeta, puedes guardarlo como favorito. Se crea una plantilla con el nombre, cuenta, monto, divisa, concepto y etiquetas de ese movimiento. El nombre del favorito tiene un máximo de 40 caracteres.

### Reutilizar plantillas

Desde el dashboard (card **Favoritos**) o desde Movimientos, elige un favorito y ejecútalo: escinco crea un nuevo movimiento con los datos de la plantilla y la fecha de hoy, vinculado al favorito original.

Puedes editar un favorito para cambiar su nombre, cuenta, monto, divisa, concepto o etiquetas. También puedes ejecutar una instancia vinculada con datos modificados sin cambiar la plantilla original.

### Administrar favoritos

- Ver el listado de todos tus favoritos.
- Editar el nombre o los datos de una plantilla.
- Eliminar un favorito: los movimientos que ya creaste con él se conservan, solo quedan desvinculados (dejan de estar asociados a la plantilla).

> Los favoritos solo admiten tipos de movimiento con una sola cuenta y un monto: ingreso, gasto y compra con tarjeta. Las transferencias y compras de activo no se pueden guardar como favorito en esta versión.

---

## 8. Configuración

Desde **Configuración** (icono de engranaje en la barra superior) ajustas el comportamiento de la aplicación.

### Preferencias de usuario

- **Tema:** oscuro, claro o seguir el sistema. Puedes cambiarlo en cualquier momento.
- **Fondo:** el fondo animado de la página de inicio se controla desde Apariencia.
- **Divisa principal:** la divisa en la que se resumen patrimonios y totales.
- **Formato de divisa:** símbolo (S/, $, €, ₮) o código (PEN, USD, EUR, USDT).
- **Lateralidad:** elegir si la información de las cuentas se muestra a la izquierda o a la derecha.

### Configuración de divisas

- Elige tu **divisa principal** para los resúmenes.
- Configura el **tipo de cambio** entre divisas (modo manual o automático, según lo disponible).
- Los importes se muestran en el formato elegido (símbolo o código) en todo el dashboard, cuentas y movimientos.

### Opciones disponibles

| Opción | Qué hace |
|--------|----------|
| **Panel de dashboard** | Activa/desactiva cards, ajusta tamaños y elige cuentas y activos visibles. |
| **Datos** | Exportar respaldo `.dvid`, importar respaldo, restaurar cuentas archivadas, eliminar toda la cuenta y sus datos. |
| **Cerrar sesión** | Sale de tu cuenta tras confirmar. |

### Exportar e importar datos (respaldo `.dvid`)

- **Exportar:** descarga un archivo `.dvid` con todo: cuentas, movimientos, activos, trades, órdenes y metas. Guárdalo en un lugar seguro. Puedes exportarlo en cualquier momento.
- **Importar:** sube un archivo `.dvid` generado por escinco. Los datos se **agregan** a los que ya tienes; no se elimina nada. Antes de importar, ves una vista previa con cuántas cuentas, movimientos, activos, etc. contiene el archivo.

### Eliminar tu cuenta

Desde Configuración › Datos puedes eliminar tu cuenta y todos tus datos de escinco permanentemente:
- Antes de borrar, se descarga automáticamente un respaldo `.dvid`.
- La acción **no se puede deshacer**.
- Se requiere confirmación (escribir "ELIMINAR" y, por seguridad, volver a confirmar tu contraseña o iniciar sesión con Google).

---

## 9. Preguntas frecuentes y solución de problemas

### ¿escinco es gratis?

Sí. escinco está en fase beta y es completamente gratis. No hay planes de pago ocultos ni se pide tarjeta.

### ¿Mis datos están seguros?

Sí. Tus datos están aislados por usuario y solo tú puedes acceder a ellos. Usamos Firebase Authentication y Firestore, con reglas que solo te dejan leer lo tuyo. Puedes exportar un respaldo `.dvid` y eliminar todo cuando quieras.

### ¿Se conecta con mi banco?

No hay conexión automática con bancos todavía. Registras las cuentas y los movimientos a mano, y escinco los suma y los valora por ti.

### ¿Qué monedas admite?

Soles (S/), dólares ($), euros (€) y USDT (₮). El tipo de cambio es configurable, manual o automático.

### ¿Necesito saber de finanzas para usarla?

No. escinco está diseñada para que cualquiera pueda usarla, sin conocimientos técnicos.

### ¿Funciona en móvil?

Sí. Es una PWA. Puedes instalarla en tu móvil o PC y funciona como una app nativa.

### ¿Funciona sin internet?

Sí, parcialmente. La interfaz funciona offline. Los datos se sincronizan cuando vuelve la conexión.

### ¿Puedo exportar mis datos?

Sí. Puedes exportar un respaldo en formato `.dvid` en cualquier momento.

### ¿Qué pasa si borro una cuenta?

Sus movimientos no se pierden: se conservan y se muestran como "Cuenta eliminada". Si solo la quieres dejar de ver, archívala y la recuperas cuando quieras desde Configuración › Datos.

### ¿Qué pasa si elimino mi cuenta?

Se borran permanentemente cuentas, movimientos, inversiones, pendientes, snapshots y trades. Antes se descarga un respaldo `.dvid`. No se puede deshacer.

### ¿Dónde obtengo ayuda?

Escríbenos a **ey@escinco.com**. También puedes consultar la página de Privacidad y Términos desde el pie de la aplicación.

---

### Soporte rápido

| Problema | Qué hacer |
|----------|-----------|
| No recuerdo mi contraseña | Pulsa "¿Olvidaste tu contraseña?" en el login y sigue el enlace de recuperación. |
| No me llega el correo de verificación | Pulsa "Reenviar enlace" en la pantalla de verificación. |
| Una cuenta no suma en el patrimonio | Comprueba que no esté archivada y que tenga la opción "es patrimonio" activada. |
| Los importes aparecen ocultos | Pulsa el botón del ojo en la card Patrimonio para volver a mostrarlos. |
| Quiero cambiar la divisa de los totales | Ve a Configuración y elige otra divisa principal. |
| Quiero mover mis datos a otro dispositivo | Exporta un respaldo `.dvid` y órtelo en el otro dispositivo. |

---