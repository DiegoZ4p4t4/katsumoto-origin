# Grupo D — Plan de Pruebas End-to-End

**Fecha:** 2026-07-19
**Requisito:** Credenciales reales de Supabase (admin user)
**Estado:** Pendiente de ejecución

---

## D1 — Flujo de Venta (POS)

### Precondiciones
- Usuario autenticado con rol cashier/admin
- Al menos 1 sucursal tipo POS activa
- Al menos 1 caja abierta en esa sucursal
- Productos con stock > 0
- Cliente "Consumidor Final" (DNI 00000000) creado

### Pasos
1. Navegar a `/admin/pos`
2. Verificar que la sucursal se auto-selecciona (si solo hay 1)
3. Buscar un producto en el grid
4. Verificar que los filtros (familia, IGV, stock) funcionan
5. Agregar producto al carrito (click)
6. Verificar que el stock badge se actualiza
7. Ajustar cantidad con +/-
8. Verificar price tier si aplica
9. Seleccionar tipo Boleta
10. Seleccionar cliente "Consumidor Final" del dropdown
11. Presionar "Cobrar"
12. Seleccionar método de pago (Efectivo)
13. Ingresar monto recibido > total
14. Verificar cálculo de cambio
15. Confirmar venta
16. Verificar toast "Boleta B001-XXXXXXX emitida"
17. Verificar pantalla de éxito con:
    - Número de comprobante
    - Cambio a devolver
    - Botones PDF A4 / Ticket Térmico / Nueva Venta
18. Presionar "Nueva Venta"
19. Verificar carrito vacío

### Criterios de aceptación
- [ ] 0 errores en consola
- [ ] Stock descontado en branch_stock
- [ ] Invoice creada con status "issued"
- [ ] Transacción registrada en register_transactions
- [ ] Stock movement creado (tipo "out")
- [ ] PDF generado correctamente
- [ ] Ticket térmico generado

### Casos edge
- [ ] Factura sin cliente RUC → botón Cobrar bloqueado
- [ ] Producto agotado (stock=0) → botón disabled, badge "AGOT"
- [ ] Exceder stock en carrito → toast "Stock insuficiente"
- [ ] Cambiar tipo Boleta↔Factura → cliente se resetea
- [ ] Sin caja abierta → pantalla "Abrir Caja para Vender"
- [ ] Sucursal warehouse → mensaje "Solo almacén"

---

## D2 — Factura Manual + SUNAT

### Precondiciones
- Usuario admin/owner
- Credenciales SUNAT configuradas
- Certificado digital válido en Storage
- Modo beta (modo_produccion = false)

### Pasos
1. Navegar a `/admin/invoices/new`
2. Seleccionar tipo "Factura"
3. Buscar cliente con RUC (lookup RUC)
4. Agregar ítems con cantidades
5. Verificar cálculo de IGV y totales
6. Presionar "Emitir Factura"
7. Verificar toast de éxito
8. Redirigido a `/admin/invoices`
9. Abrir detalle del comprobante
10. Verificar datos: cliente, items, impuestos, totales
11. Presionar "Enviar a SUNAT"
12. Verificar spinner durante envío
13. Verificar resultado:
    - Éxito: badge "Aceptado SUNAT", hash visible, XML/CDR paths
    - Error: badge rojo con código y mensaje de error
14. Presionar "PDF" para descargar

### Criterios de aceptación
- [ ] Invoice creada con correlativo correcto (RPC atómica)
- [ ] Envío SUNAT exitoso → status "accepted"
- [ ] XML guardado en Storage (`{orgId}/{YYYY-MM}/F001-N.xml`)
- [ ] CDR guardado en Storage
- [ ] Hash SHA-256 almacenado
- [ ] Auditoría registrada (`sunat.send`)
- [ ] 0 errores en consola

### Casos edge
- [ ] RUC inválido (módulo 11) → error en envío
- [ ] Certificado expirado → error 2074
- [ ] Factura con fecha > 7 días → STALE_DATE
- [ ] Factura ya enviada → INVALID_STATUS
- [ ] Sin credenciales SUNAT → NO_CONFIG

---

## D3 — Resumen Diario de Boletas

### Precondiciones
- Boletas emitidas hoy (status "issued", sunat_sent_at = null)

### Pasos
1. Navegar a `/admin/sunat-documents`
2. Verificar fecha por defecto = hoy
3. Presionar "Enviar Resumen"
4. Verificar ticket generado
5. Presionar "Consultar Ticket"
6. Verificar resultado:
   - Aceptado: CDR descargable
   - Procesando: badge "Procesando"
   - Rechazado: error code/message

### Criterios de aceptación
- [ ] Boletas marcadas con sunat_ticket
- [ ] sunat_summary_log creado
- [ ] XML resumen guardado en Storage
- [ ] CDR guardado al consultar ticket

---

## D4 — Ciclo Completo de Inventario

### Pasos
1. **Crear producto**
   - Navegar a `/admin/inventory`
   - Presionar "Nuevo"
   - Completar formulario (nombre, SKU, precio, costo, stock inicial)
   - Guardar
   - Verificar toast éxito
   - Verificar producto en tabla

2. **Ajustar stock**
   - Seleccionar producto → "Ajustar Stock"
   - Tipo "Entrada", cantidad 10
   - Guardar
   - Verificar stock actualizado en tabla

3. **Transferir entre sedes**
   - Navegar a `/admin/transfers`
   - Verificar sugerencias automáticas
   - Crear transferencia: warehouse → POS
   - Guardar
   - Verificar 2 movimientos creados (transfer_out + transfer_in)

4. **Verificar kardex**
   - En inventario, click en producto → pestaña "Movimientos"
   - Ver historial completo
   - Verificar entradas, salidas, transferencias

### Criterios de aceptación
- [ ] Producto creado con barcode EAN-13 automático
- [ ] Stock inicial registrado como movimiento "in"
- [ ] Transferencia genera movimiento en origen y destino
- [ ] Kardex muestra todos los movimientos con fechas

---

## D5 — Tienda Web → Pedido → Fulfill

### Pasos
1. Navegar a `/` (tienda pública)
2. Verificar catálogo carga productos de Supabase
3. Filtrar por categoría
4. Agregar producto al carrito
5. Verificar carrito persiste al recargar (localStorage)
6. Ir a checkout
7. Completar formulario (nombre, teléfono, email, DNI, dirección)
8. Confirmar pedido
9. Verificar pantalla de confirmación con número de pedido

10. **Admin: gestionar pedido**
    - Login como admin
    - Navegar a `/admin/orders`
    - Ver pedido en lista (status "pending")
    - Cambiar a "confirmed" → "processing"
    - Presionar "Fulfill" (convertir a invoice)
    - Verificar invoice creada
    - Verificar stock descontado

### Criterios de aceptación
- [ ] store_order creado
- [ ] store_order_items creados
- [ ] Stock ajustado (movement "out")
- [ ] Fulfill crea invoice correctamente
- [ ] 0 errores en consola en tienda pública

---

## D6 — Gestión de Usuarios

### Pasos
1. Navegar a `/admin/users` (requiere owner/admin)
2. Ver lista de usuarios
3. Presionar "Invitar usuario"
4. Completar nombre, email, rol
5. Verificar contraseña temporal generada
6. Cambiar rol de un usuario (dropdown en tabla)
7. Desactivar/activar usuario (switch)
8. Verificar que no se puede desactivar a sí mismo

### Criterios de aceptación
- [ ] Usuario creado en Supabase Auth
- [ ] Perfil creado con rol correcto
- [ ] Contraseña temporal funcional
- [ ] Cambio de rol registrado en auditoría
- [ ] Usuario inactivo no puede hacer login

---

## Resumen de Ejecución

| Flujo | Fecha | Resultado | Issues |
|-------|-------|-----------|--------|
| D1 POS | — | Pendiente | — |
| D2 Factura+SUNAT | — | Pendiente | — |
| D3 Resumen diario | — | Pendiente | — |
| D4 Inventario | — | Pendiente | — |
| D5 Tienda→Pedido | — | Pendiente | — |
| D6 Usuarios | — | Pendiente | — |

---

*Ejecutar con credenciales de admin en Supabase. Registrar resultados en esta misma tabla.*
