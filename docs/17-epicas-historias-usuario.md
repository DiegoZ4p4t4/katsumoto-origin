# Katsumoto — Épicas, Historias de Usuario y Backlog

**Fecha:** 2026-07-19
**Versión:** 2.0 (post-auditoría completa)
**Alcance:** Sistema integral de facturación electrónica, POS, inventario, tienda web

---

## Visión del Producto

Katsumoto es el sistema operativo de **SERVICIOS GENERALES UNITED E.I.R.L.** (RUC 20608183672), ubicado en Pichanaqui, Junín, Perú. Cubre el ciclo completo de venta de repuestos agrícolas: desde el catálogo y la venta en mostrador, hasta la facturación electrónica SUNAT y la gestión de inventario multi-sede.

---

## Épicas

### EP-01: Autenticación y Control de Acceso
**Objetivo:** Solo personal autorizado accede al sistema, con roles diferenciados.

| ID | Historia de Usuario | Rol | Criterios de Aceptación | Estado |
|----|-------------------|-----|------------------------|--------|
| HU-01.01 | Como admin, quiero iniciar sesión con email y contraseña | Todos | Login exitoso → Dashboard. Error → mensaje descriptivo. Reintentos de perfil antes de expulsar. | ✅ |
| HU-01.02 | Como admin, quiero invitar usuarios asignándoles un rol | Owner/Admin | Diálogo con nombre, email, rol. Contraseña temporal generada y mostrada. | ✅ |
| HU-01.03 | Como admin, quiero gestionar roles de usuarios existentes | Owner/Admin | Tabla CRUD con dropdown de roles. Cambio registrado en auditoría. | ✅ |
| HU-01.04 | Como admin, quiero activar/desactivar usuarios | Owner/Admin | Switch toggle. Usuario inactivo no puede hacer login. No puedo desactivarme a mí mismo. | ✅ |
| HU-01.05 | Como usuario, quiero que mi sesión se mantenga activa | Todos | JWT refrescado automáticamente. Al cerrar sesión, caché limpiado. | ✅ |

### EP-02: Dashboard de Negocio
**Objetivo:** Visión rápida del estado del negocio al iniciar sesión.

| ID | Historia de Usuario | Rol | Criterios de Aceptación | Estado |
|----|-------------------|-----|------------------------|--------|
| HU-02.01 | Como gerente, quiero ver las ventas del día y del mes | Admin/Owner | KPIs: Ventas Hoy, Ventas Mes con conteo de comprobantes. | ✅ |
| HU-02.02 | Como gerente, quiero ver la tendencia de ventas de la última semana | Admin/Owner | Gráfico de línea 7 días. Tooltips con monto en soles. | ✅ |
| HU-02.03 | Como encargado, quiero ver el estado del inventario | Admin/Inventory | Productos en stock, agotados, stock bajo con alertas visuales. | ✅ |
| HU-02.04 | Como admin, quiero ver el estado de facturación SUNAT | Admin/Owner | Widget compacto: aceptados, pendientes, rechazados. Badge de alertas. Link al panel completo. | ✅ |
| HU-02.05 | Como usuario, quiero acceder rápidamente a las acciones frecuentes | Todos | Botones: POS, Nuevo Comprobante, Inventario. | ✅ |

### EP-03: Punto de Venta (POS)
**Objetivo:** Vender productos rápidamente con cálculo automático de impuestos.

| ID | Historia de Usuario | Rol | Criterios de Aceptación | Estado |
|----|-------------------|-----|------------------------|--------|
| HU-03.01 | Como cajero, quiero buscar productos por nombre, SKU o categoría | Cashier | Grid con búsqueda, filtros IGV/stock/familia, paginación 24 items. | ✅ |
| HU-03.02 | Como cajero, quiero ver el stock disponible antes de vender | Cashier | Badge numérico en cada producto. "AGOT" en rojo si stock=0. | ✅ |
| HU-03.03 | Como cajero, quiero que los precios se ajusten por cantidad (price tiers) | Cashier | Etiqueta "×3+" visible cuando aplica tier. Ahorro calculado. | ✅ |
| HU-03.04 | Como cajero, quiero que el IGV se calcule automáticamente | Cashier | Gravado 18%, Exonerado 0% según ubicación y Ley Amazonía. | ✅ |
| HU-03.05 | Como cajero, quiero cobrar con múltiples métodos de pago | Cashier | 7 métodos: efectivo, débito, crédito, transferencia, Yape, Plin, crédito 30d. Cambio calculado. | ✅ |
| HU-03.06 | Como cajero, quiero emitir boleta o factura desde la misma pantalla | Cashier | Toggle Boleta/Factura. Factura bloquea sin RUC. Boleta usa Consumidor Final. | ✅ |
| HU-03.07 | Como cajero, quiero imprimir ticket térmico o PDF A4 al vender | Cashier | Pantalla de éxito con botones: Ticket Térmico, PDF A4, Nueva Venta. | ✅ |
| HU-03.08 | Como cajero, necesito tener una caja abierta para poder vender | Cashier | Sin caja → pantalla "Abrir Caja". Con caja → badge con número de caja. | ✅ |
| HU-03.09 | Como cajero con una sola sede, quiero que se seleccione automáticamente | Cashier | Si hay 1 sede activa no warehouse → auto-seleccionada. | ✅ |

### EP-04: Facturación y SUNAT
**Objetivo:** Emitir comprobantes electrónicos válidos ante SUNAT.

| ID | Historia de Usuario | Rol | Criterios de Aceptación | Estado |
|----|-------------------|-----|------------------------|--------|
| HU-04.01 | Como admin, quiero crear facturas y boletas manualmente | Admin | Formulario con tipo, cliente, items, cálculo automático IGV. Zod validación. | ✅ |
| HU-04.02 | Como admin, quiero ver todos los comprobantes con filtros | Admin | Tabla paginada. Filtros: status, tipo. Detalle completo en diálogo. | ✅ |
| HU-04.03 | Como admin, quiero enviar una factura a SUNAT | Admin | Botón "Enviar a SUNAT" desde detalle. Spinner durante envío. Resultado: aceptado/rechazado con código. | ✅ |
| HU-04.04 | Como admin, quiero enviar el resumen diario de boletas a SUNAT | Admin | Panel con fecha. Envío async → ticket. Consultar ticket → CDR. | ✅ |
| HU-04.05 | Como admin, quiero anular una factura (comunicación de baja) | Admin | Botón "Anular" con motivo. Envío async → ticket. Status cambia a cancelled. | ✅ |
| HU-04.06 | Como admin, quiero emitir notas de crédito y débito | Admin | Vincular a factura padre. Elegir motivo del catálogo 09. Items a acreditar. | ✅ |
| HU-04.07 | Como admin, quiero ver alertas de problemas con SUNAT | Admin | Widget con alertas: sin CDR, rechazados, vencidos >3d, certificado próximo a expirar. | ✅ |
| HU-04.08 | Como admin, quiero reenviar comprobantes pendientes o fallidos | Admin | Cola de reenvío unificada (sin duplicados). Botón retry por documento. | ✅ |

### EP-05: Inventario y Stock
**Objetivo:** Control completo del catálogo de productos y existencias.

| ID | Historia de Usuario | Rol | Criterios de Aceptación | Estado |
|----|-------------------|-----|------------------------|--------|
| HU-05.01 | Como encargado, quiero crear productos con SKU, precio, costo, categoría | Admin/Inventory | Formulario Zod. Barcode EAN-13 automático. SKU validado sin duplicados. | ✅ |
| HU-05.02 | Como encargado, quiero importar productos masivamente desde CSV | Admin | Diálogo CSV. Lotes de 50. Detección de duplicados. Barcode asignado. | ✅ |
| HU-05.03 | Como encargado, quiero configurar precios por cantidad (mayoreo) | Admin | Editor de price tiers por producto. Min quantity + precio + etiqueta. | ✅ |
| HU-05.04 | Como encargado, quiero ajustar stock manualmente | Admin/Inventory | Diálogo: tipo (entrada/salida), cantidad, notas. Movimiento registrado. | ✅ |
| HU-05.05 | Como encargado, quiero transferir stock entre sucursales | Admin/Inventory | Formulario: origen, destino, producto, cantidad. Sugerencias automáticas. 2 movimientos generados. | ✅ |
| HU-05.06 | Como encargado, quiero ver el kardex de movimientos de un producto | Admin/Inventory | Historial completo. Filtros: tipo, fecha, sucursal. Export CSV. | ✅ |
| HU-05.07 | Como encargado, quiero recibir alertas de stock bajo | Admin/Inventory | Tab "Alertas" con badge de conteo. Sugerencias de transferencia. Navegación directa a transferencias. | ✅ |

### EP-06: Clientes
**Objetivo:** Gestionar la base de clientes con datos fiscales.

| ID | Historia de Usuario | Rol | Criterios de Aceptación | Estado |
|----|-------------------|-----|------------------------|--------|
| HU-06.01 | Como admin, quiero registrar clientes con RUC o DNI | Admin | Formulario Zod. Documento validado. Ubicación geográfica para Ley Selva. | ✅ |
| HU-06.02 | Como admin, quiero buscar clientes por nombre o documento | Admin | Búsqueda con debounce. Filtros: tipo documento, ciudad. | ✅ |
| HU-06.03 | Como cajero, quiero consultar RUC/DNI en SUNAT/RENIEC desde el POS | Cashier | Lookup automático vía apisperu.com. Cliente creado automáticamente si no existe. | ✅ |

### EP-07: Tienda Web Pública
**Objetivo:** Permitir que clientes realicen pedidos en línea.

| ID | Historia de Usuario | Rol | Criterios de Aceptación | Estado |
|----|-------------------|-----|------------------------|--------|
| HU-07.01 | Como cliente, quiero navegar el catálogo de productos | Cliente web | Landing con categorías, búsqueda, productos destacados. | ✅ |
| HU-07.02 | Como cliente, quiero agregar productos al carrito | Cliente web | Carrito persiste en localStorage. Cantidad ajustable. Sincronización con datos reales. | ✅ |
| HU-07.03 | Como cliente, quiero completar un pedido con mis datos | Cliente web | Formulario: nombre, teléfono, email, documento, dirección de envío. Validación de stock. | ✅ |
| HU-07.04 | Como admin, quiero gestionar los pedidos recibidos | Admin | Lista de pedidos. Cambio de estado (pending→confirmed→processing→completed). Fulfill → invoice. | ✅ |

### EP-08: Cajas Registradoras
**Objetivo:** Control de ingresos y egresos por sucursal.

| ID | Historia de Usuario | Rol | Criterios de Aceptación | Estado |
|----|-------------------|-----|------------------------|--------|
| HU-08.01 | Como cajero, quiero abrir una caja con monto inicial | Cashier | Diálogo con monto inicial. Botones rápidos S/1000/2000/5000. Número automático por sucursal. | ✅ |
| HU-08.02 | Como cajero, quiero cerrar una caja con el cuadre | Cashier | Monto final vs esperado. Diferencia calculada. Resumen por método de pago. | ✅ |
| HU-08.03 | Como admin, quiero ver el historial de cajas | Admin | Lista con aperturas/cierres. Detalle de transacciones por caja. | ✅ |

### EP-09: Reportes
**Objetivo:** Información contable y comercial para toma de decisiones.

| ID | Historia de Usuario | Rol | Criterios de Aceptación | Estado |
|----|-------------------|-----|------------------------|--------|
| HU-09.01 | Como contador, quiero ver el reporte contable (libro de ventas) | Admin | Tabla con comprobantes, totales gravado/exonerado/inafecto/IGV. Filtro fecha y sucursal. Export. | ✅ |
| HU-09.02 | Como gerente, quiero ver el reporte de ventas | Admin | Ventas agrupadas por tipo/método. Totales. Export CSV. | ✅ |

### EP-10: Configuración y Administración
**Objetivo:** Mantener el sistema operativo y actualizado.

| ID | Historia de Usuario | Rol | Criterios de Aceptación | Estado |
|----|-------------------|-----|------------------------|--------|
| HU-10.01 | Como admin, quiero configurar los datos de la empresa para SUNAT | Owner/Admin | Formulario: RUC, razón social, dirección, credenciales SOL. Test de conexión. | ✅ |
| HU-10.02 | Como admin, quiero subir el certificado digital | Owner/Admin | Upload .p12/.pem. Validación de formato y tamaño. Reemplazo automático del anterior. | ✅ |
| HU-10.03 | Como admin, quiero activar la exoneración de Amazonía (Ley 27037) | Owner/Admin | Toggle + configuración de ubicación. Reglas fiscales visibles. | ✅ |
| HU-10.04 | Como admin, quiero gestionar las sucursales | Owner/Admin | CRUD con tipo (almacén/POS/online), ubicación, serie de facturación. | ✅ |
| HU-10.05 | Como admin, quiero verificar e instalar actualizaciones del sistema | Owner/Admin | Panel con versión actual. Check updates (Tauri). Descarga e instalación. | ✅ |
| HU-10.06 | Como admin, quiero configurar la impresora | Admin | Configuración de impresora térmica. Detección de puertos. Test de impresión. | ✅ |

### EP-11: Cumplimiento y Seguridad
**Objetivo:** Proteger datos sensibles y cumplir normativa SUNAT.

| ID | Historia de Usuario | Rol | Criterios de Aceptación | Estado |
|----|-------------------|-----|------------------------|--------|
| HU-11.01 | Como sistema, las credenciales SOL deben estar cifradas | Sistema | AES-256-GCM con IV aleatorio. Nunca expuestas en GET. | ✅ |
| HU-11.02 | Como sistema, los certificados digitales deben almacenarse seguros | Sistema | Storage bucket protegido por RLS. No en código ni variables de entorno. | ✅ |
| HU-11.03 | Como sistema, los XML y CDR deben archivarse | Sistema | Storage bucket con path: {orgId}/{YYYY-MM}/{serie}-{correlativo}.xml | ✅ |
| HU-11.04 | Como sistema, las operaciones críticas deben auditarse | Sistema | audit_log: invoice.create, sunat.send, register.open, role.change, user.invite. | ✅ |
| HU-11.05 | Como sistema, el acceso a SUNAT debe tener rate limiting | Sistema | 30 req/min por userId+action en Edge Functions. | ✅ |
| HU-11.06 | Como sistema, solo owner/admin pueden enviar a SUNAT | Sistema | Validación de rol en Edge Functions para acciones de escritura. | ✅ |

---

## Backlog (Pendiente)

### Alta Prioridad
| ID | Historia | Épica | Bloqueante |
|----|----------|-------|------------|
| HU-12.01 | Emitir guía de remisión electrónica (GRE) vía REST | EP-04 | Requiere OAuth2 de SUNAT |
| HU-12.02 | Circuit breaker para llamadas SUNAT | EP-11 | — |
| HU-12.03 | X-Request-ID para tracing de requests | EP-11 | — |

### Media Prioridad
| ID | Historia | Épica |
|----|----------|-------|
| HU-12.04 | Devolución directa en POS | EP-03 |
| HU-12.05 | Descuento manual por item en POS | EP-03 |
| HU-12.06 | Envío de comprobantes en lote a SUNAT | EP-04 |
| HU-12.07 | Duplicar comprobante | EP-04 |
| HU-12.08 | Notificar cliente por cambio de estado de pedido | EP-07 |
| HU-12.09 | Arqueo de caja (conteo físico vs sistema) | EP-08 |
| HU-12.10 | Migraciones versionadas de DB | EP-11 |
| HU-12.11 | Backups automatizados PostgreSQL | EP-11 |

### Baja Prioridad
| ID | Historia | Épica |
|----|----------|-------|
| HU-12.12 | Venta rápida sin producto en catálogo | EP-03 |
| HU-12.13 | Formato PLE para exportación SUNAT | EP-09 |
| HU-12.14 | Conteo físico / inventario cíclico | EP-05 |
| HU-12.15 | Historial de cambios de producto | EP-05 |
| HU-12.16 | Historial de compras del cliente | EP-06 |
| HU-12.17 | Stock consolidado multi-sede en dashboard | EP-02 |
| HU-12.18 | Pago en línea (pasarela) | EP-07 |

---

## Resumen por Épica

| Épica | Historias | Completadas | Pendientes |
|-------|-----------|-------------|------------|
| EP-01 Auth | 5 | 5 | 0 |
| EP-02 Dashboard | 5 | 5 | 0 |
| EP-03 POS | 9 | 9 | 0 |
| EP-04 Facturación SUNAT | 8 | 8 | 0 |
| EP-05 Inventario | 7 | 7 | 0 |
| EP-06 Clientes | 3 | 3 | 0 |
| EP-07 Tienda Web | 4 | 4 | 0 |
| EP-08 Cajas | 3 | 3 | 0 |
| EP-09 Reportes | 2 | 2 | 0 |
| EP-10 Configuración | 6 | 6 | 0 |
| EP-11 Cumplimiento | 6 | 6 | 0 |
| Backlog | — | — | 18 |
| **Total** | **58** | **58 completadas** | **18 pendientes** |

---

*Documento de requisitos funcionales. Las historias marcadas ✅ han sido verificadas contra el código.*
