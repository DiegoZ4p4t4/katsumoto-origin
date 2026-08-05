# Estado del Sistema — Katsumoto v3

**Fecha:** 2026-08-02
**Pipeline:** tsc 0 · vitest 141/141 · build 6.58s

---

## Lo que SÍ funciona (verificado en vivo)

| Módulo | Funcionalidad | Última prueba |
|--------|--------------|---------------|
| Auth | Login/logout con yescobar@katsumoto.shop | ✅ 0 errores |
| Dashboard | KPIs, gráficos, widgets pedidos/cajas/SUNAT | ✅ 0 errores |
| Tienda | Catálogo, carrito, checkout, privacidad, términos | ✅ 0 errores |
| POS | Filtros familia/grupo/stock, agregar al carrito | ✅ 0 errores |
| Facturación | Lista, detalle, NC/ND, envío SUNAT | ✅ 0 errores |
| Inventario | Productos, categorías, transferencias, movimientos | ✅ 0 errores |
| Clientes | CRUD, lookup RUC/DNI | ✅ 0 errores |
| Cajas | Apertura, cierre, resumen | ✅ 0 errores |
| Usuarios | CRUD, roles, invitación | ✅ 0 errores |
| SUNAT | Panel documentos, alertas, cola reenvío | ✅ 0 errores |
| Edge Functions | apis-peru-proxy, sunat-credentials, sunat-billing | ✅ Desplegadas |

## Fixes recientes (pendientes de deploy)

| Fix | Archivo | Qué corrige |
|-----|---------|-------------|
| PDF preview null guard | `InvoicePreviewDialog.tsx` | Crash al abrir vista previa con invoice null |
| X-Frame-Options SAMEORIGIN | `public/_headers` | "Este contenido está bloqueado" en preview |
| 58mm soporte | `thermal-ticket.ts`, `generate.ts`, `types.ts` | Formato dinámico para impresora 58mm |
| Printer default 58mm | `printer-config.ts` | paperWidth: 58 |
| SUNAT URL | `receipt-builder.ts` | cpe.sunat.gob.pe |
| pdf-items-table crash | `pdf-items-table.ts` | rows → tableData |
| Invoice sin items | `InvoiceDetail.tsx` | getById() para items completos |
| Texto corrupto | `CategoryManager.tsx`, `ProductTable.tsx` | 34 caracteres Unicode escapados |
| Familias dinámicas | `PosProductGrid.tsx` | managed_category_families, sin familias vacías |
| Store cart fixes | `StoreCartPage.tsx`, `CartContext.tsx` | Link checkout, stock total, syncProducts |
| Organization data | DB | RUC, nombre, dirección, teléfono |

## Historial de issues corregidos por módulo

### Impresión
- [x] PDF en blanco: `rows is not defined`
- [x] Vista previa bloqueada: X-Frame-Options DENY → SAMEORIGIN
- [x] Vista previa sin items: invoice de lista no tiene items
- [x] Ticket solo 80mm: soporte 58mm agregado
- [x] SUNAT URL incorrecta
- [x] Printer default 80mm → 58mm
- [x] InvoicePreviewDialog null crash
- [x] Logo silencioso: offset bug corregido
- [x] QR silencioso: indicador visual si falla
- [x] Impresión sin feedback: try/catch + showError

### Tienda
- [x] Link checkout roto: /tienda/checkout → /checkout
- [x] Stock del almacén: suma total de sucursales
- [x] syncProducts ausente en carrito
- [x] Toast "success" para error de stock
- [x] Prop warehouseStock → availableStock
- [x] createOrder doble descuento: stock solo en fulfill
- [x] Número pedido: PED-{fecha}-{random}
- [x] Dirección envío: campos address + city

### POS
- [x] Familias hardcodeadas → managed_category_families
- [x] Familias vacías visibles → solo con productos
- [x] IGV filter → Family filter
- [x] Sidebar Dashboard activo en todas las rutas

### Facturación
- [x] Nota de Débito: componente + botón creados
- [x] Cliente lookup ya existente → selección automática
- [x] saveClient async en CreateInvoice

### DB
- [x] Consumidor Final creado
- [x] Cliente RUC/DNI creados
- [x] SUNAT config base
- [x] Tax config Ley Selva
- [x] Organization actualizada (RUC, nombre, dirección)

### Seguridad
- [x] CSP correcto (Supabase + Cloudflare + apisperu)
- [x] Rate limiting en sunat-billing
- [x] Body validation en EFs
- [x] Edge Functions CORS (Cloudflare domains)
- [x] Sanitización global (8 funciones)

### QA
- [x] 141 tests (10 archivos)
- [x] ErrorBoundary global
- [x] OfflineBanner
- [x] Anti-doble-click en botones críticos
- [x] Loading/error states (MachineModels, CashRegisters, Dashboard, CreateInvoice)

### Roles
- [x] 6 roles implementados (owner, admin, vendedor, cashier, inventory, reader)
- [x] Sidebar filtrado por rol
- [x] RoleGuard en rutas de inventario

---

## Prompt para continuar la revisión

```
Sos un auditor de software con experiencia en sistemas ERP, facturación electrónica 
SUNAT, y aplicaciones React+Supabase. Estás revisando el sistema Katsumoto.

Contexto actual:
- Stack: React 19 + TypeScript + Vite + Supabase + shadcn/ui
- DB: PostgreSQL 15 con RLS, 25 tablas, 8 RPCs
- 6 roles: owner, admin, vendedor, cashier, inventory, reader
- Tests: 141 pasando de 141
- Build: limpio, 0 errores TypeScript

El sistema ya pasó por una auditoría exhaustiva de código (43+ bugs corregidos). 
Ahora necesito que revises desde la perspectiva del USUARIO FINAL:

1. Flujo completo de venta en POS: ¿El cajero puede vender sin fricción?
2. Impresión de comprobantes: ¿El ticket térmico 58mm se ve bien?
3. Vista previa de PDF: ¿Se abre sin errores?
4. Flujo tienda→pedido→admin: ¿El stock se descuenta correctamente?
5. Datos cruzados: ¿Los productos, clientes y facturas están correctamente vinculados?
6. Roles: ¿Un vendedor NO puede acceder a configuraciones?
7. Performance: ¿La app carga rápido en 4G?

NO revises código estático. Prueba en vivo. Navega, haz clic, intenta romper el sistema.
Prioriza lo ESENCIAL para el funcionamiento diario de la tienda.
Reporta SOLO bugs funcionales, no mejoras cosméticas.
```
