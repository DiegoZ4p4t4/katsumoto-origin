# Especificación Funcional por Módulo — Katsumoto v2

**Fecha:** 2026-07-19 (actualizado tras revisión completa)
**Objetivo:** Definir comportamiento esperado, reglas de negocio, casos válidos/inválidos, bugs corregidos y gaps por módulo.

---

## Resumen de cambios vs v1 (jul 2025)

| Cambio | Detalle |
|--------|---------|
| Single-company | Register eliminado, `VITE_ORG_ID` hardcodeado, `getCurrentOrgId()` O(1) |
| Auth | `signIn` reintenta perfil 4× antes de signOut |
| Auth | Nueva página `/admin/users` con CRUD + invite |
| Dashboard | Refactor: ventas hoy/mes, tendencia 7d, SUNAT status card |
| POS | Auto-selección de sede única, UUID consumidor final → búsqueda real |
| Facturación | `saveClient` async correcto, feedback lookup tipo inválido |
| SUNAT EFs | `config.toml` verify_jwt, body validation, rate limit 30/min, IGV_RATE constante |
| AGENTS.md | 8 RPCs documentadas, deploys sin `--no-verify-jwt` |

---

## M01 — Autenticación

**Archivos:** `pages/auth/Login.tsx`, `lib/auth-context.tsx`

### Cambios realizados (jul 2026)
- ❌ `pages/auth/Register.tsx` eliminado — single-company, solo admin crea usuarios
- ❌ `signUp` removido de `auth-context.tsx`
- ✅ `signIn`: si `fetchProfile` falla, 4 reintentos con backoff 1.5s×N antes de signOut
- ✅ `VITE_ORG_ID` en `.env`, `getCurrentOrgId()` retorna constante sin DB lookup
- ✅ Nueva página `/admin/users` — tabla CRUD, cambiar rol, activar/desactivar, invitar con contraseña temporal

### Reglas de negocio
| Válido | Inválido |
|--------|----------|
| Email + contraseña correcta → login | Credenciales incorrectas → "Credenciales inválidas" |
| Perfil `is_active = true` → login | Perfil inactivo → 4 reintentos, luego signOut |
| `isSigningInRef` previene doble SIGNED_IN | — |
| Solo owner/admin acceden a `/admin/users` | Otros roles → redirect a `/admin` |

### Status: ✅ Operativo

---

## M02 — Dashboard

**Archivos:** `pages/Index.tsx`, `hooks/useDashboardSales.ts`

### Cambios realizados (jul 2026)
- ✅ Refactor completo: KPIs de negocio (ventas hoy, ventas mes, productos en stock, por cobrar)
- ✅ Gráfico de tendencia de ventas últimos 7 días (LineChart)
- ✅ Widget SUNAT reducido a status card (3 métricas + badge + link al panel completo)
- ✅ Nuevo hook `useDashboardSales` — calcula métricas de invoices ya cargados
- ✅ Fix: `totalProducts === activeProducts` → ahora "Con Stock" (conteo real)
- ✅ Fix: `invoice.items?.length` → `items[0]?.count`

### Reglas de negocio
| Métrica | Fuente |
|---------|--------|
| Ventas Hoy | `invoices` con `issue_date = today`, status ≠ draft/cancelled |
| Ventas del Mes | `invoices` con `issue_date >= primer día del mes` |
| Productos en Stock | `branchProducts.filter(p => p.stock > 0).length` |
| Por Cobrar | `invoices` status = issued/accepted, suma `total_cents` |

### Status: ✅ Operativo | El panel SUNAT completo en `/admin/sunat-documents`

---

## M03 — Punto de Venta (POS)

**Archivos:** `pages/POS.tsx`, `hooks/usePosCart.ts`, `hooks/usePosInvoice.ts`, `components/pos/`

### Cambios realizados (jul 2026)
- ✅ Auto-selección de sede: si 1 sola sede activa (no warehouse), se selecciona automáticamente
- ✅ B1 fix: UUID hardcodeado `33da71e7-...` → busca "Consumidor Final" (DNI 00000000) de `clients[]`
- ✅ B2 fix: `cart.find()` O(n²) → `new Map(cart.map(...))` lookup O(1) para SKU
- ✅ B3 fix: lookup tipo inválido → toast "Requiere RUC" / "Requiere DNI"

### Flujo
```
Seleccionar sucursal (auto si 1 sola) → Buscar/agregar productos → Ajustar cantidades →
Seleccionar cliente (opcional, requerido para factura) → Elegir método de pago → Cobrar →
Crear invoice (RPC create_invoice_with_items) → Registrar transacción en caja → Imprimir/PDF
```

### Reglas de negocio
| Válido | Inválido |
|--------|----------|
| Producto con stock > 0 | Stock = 0 → toast "agotado" |
| Cantidad ≤ stock | Exceder → toast "Stock insuficiente. Solo hay X" |
| Boleta: DNI o sin cliente (Consumidor Final) | Factura: cliente con RUC obligatorio |
| 7 métodos de pago | — |
| Caja abierta requerida (`canSell`) | Sin caja → "Abrir Caja para Vender" |
| Cliente en selva + sucursal en selva → exonerado | Fuera de selva → gravado 18% |

### Status: ✅ Operativo

---

## M04 — Facturación

**Archivos:** `pages/Invoices.tsx`, `pages/CreateInvoice.tsx`, `services/invoice.service.ts`

### Cambios realizados (jul 2026)
- ✅ B1 fix: `handleLookupClient` → `await saveClient()` en vez de `generateId()` local + fire-and-forget
- ✅ B2 fix: lookup tipo inválido → toast error descriptivo

### Tipos de comprobante
| Tipo | Serie | SUNAT code |
|------|-------|------------|
| Factura | F001 | 01 |
| Boleta | B001 | 03 |
| Nota de crédito | FC01 / BC01 | 07 |
| Nota de débito | FD01 | 08 |

### Transiciones de estado
```
draft → issued → accepted → paid
  ↓        ↓         ↓
cancelled cancelled cancelled
```

### Reglas de negocio
| Válido | Inválido |
|--------|----------|
| Factura requiere cliente RUC | Factura con DNI → error |
| NC a factura → sendBill | NC a boleta → sendSummary |
| `createWithItems` con 3 retries en colisión correlativo | Stock insuficiente → error descriptivo |
| `nextCorrelativo` es informativo en UI, real determinado por RPC | — |

### Gaps
- [ ] Sin "duplicar comprobante"
- [ ] Sin "enviar lote a SUNAT"
- [ ] Sin filtro por rango de fechas

### Status: ✅ Operativo

---

## M05 — Integración SUNAT

**Archivos:** `supabase/functions/sunat-billing/` (30 archivos), `services/sunat.service.ts`

### Cambios realizados (jul 2026, rondas 1-2)
- ✅ `config.toml` con `verify_jwt = false` en las 3 EFs
- ✅ `IGV_RATE = 0.18` constante en `constants.ts`, usada en `transformers.ts`
- ✅ `sendVoided` con try/catch (consistente con `sendSummary`)
- ✅ `validateBody(action, body)` — campos requeridos por acción + límite 100KB
- ✅ `checkRateLimit(key)` — 30 req/min por userId+action en sunat-billing
- ✅ `usedGreVersion` dead code eliminado
- ✅ Validación `ruc`, `razon_social`, `usuario_sol` requeridos en sunat-credentials

### Actions
| Action | Transporte | Auth | Rate limit |
|--------|-----------|------|------------|
| `test` | Local | owner/admin/any | 30/min |
| `send` | SOAP sendBill | owner/admin | 30/min |
| `send-summary` | SOAP sendSummary | owner/admin | 30/min |
| `send-voided` | SOAP sendSummary | owner/admin | 30/min |
| `check-ticket` | SOAP getStatus | any | 30/min |
| `check-summary-ticket` | SOAP getStatus | any | 30/min |
| `send-despatch` | REST sendCpe | owner/admin | 30/min |
| `check-despatch-ticket` | REST checkStatus | any | 30/min |

### Status: ✅ SOAP operativo | ❌ GRE bloqueado (OAuth2)

---

## M06 — Inventario

**Archivos:** `pages/Inventory.tsx`, `services/product.service.ts`, `components/inventory/` (13 componentes)

### Cambios realizados (jul 2026)
- ✅ B1 fix: `productFormDefaults` NaN → 0 para campos numéricos
- ✅ (Ronda 1) Barcode en `batchCreate` CSV — `generateBarcode(prodSeq++)`

### Reglas de negocio
| Válido | Inválido |
|--------|----------|
| SKU único por organización | Duplicado → error con nombre |
| Soft delete (`is_active = false`) | Delete físico |
| Barcode EAN-13 automático (prefijo 775) | — |
| CSV con columnas mapeadas, lotes de 50 | Columna desconocida → error |
| `branches.length === 0` → botones disabled + warning | — |

### Tabs
1. **Productos** — tabla con 7 filtros, sort, paginación, stats
2. **Categorías** — gestión 3 niveles (familia → grupo → categoría)
3. **Alertas** — reposición sugerida con navegación a transfers
4. **Stock por Sede** — reporte consolidado

### Status: ✅ Operativo

---

## M07 — Stock / Movimientos / Transferencias

**Archivos:** `pages/StockMovements.tsx`, `pages/Transfers.tsx`, `services/stock.service.ts`

### Tipos de movimiento
| Tipo | Descripción |
|------|-------------|
| `in` | Entrada |
| `out` | Salida |
| `transfer_out` | Salida por transferencia |
| `transfer_in` | Entrada por transferencia |
| `return` | Devolución |

### Reglas de negocio
| Válido | Inválido |
|--------|----------|
| `adjust_stock` / `transfer_stock` vía RPC atómica | — |
| Stock no negativo (validado en RPC) | `out` > stock → error |
| Transferencia genera 2 movimientos (out + in) | Origen = destino |
| Filtros: search, type, product, date range | — |
| Sugerencias automáticas warehouse → POS | — |
| Prefill desde ReplenishmentAlerts vía `location.state` | — |

### Status: ✅ Operativo

---

## M08 — Clientes

**Archivos:** `pages/Clients.tsx`, `services/customer.service.ts`

### Reglas de negocio
| Válido | Inválido |
|--------|----------|
| RUC 11 dígitos (módulo 11) | RUC inválido |
| DNI 8 dígitos | — |
| `upsertFromLookup`: busca existente → crea si no | — |
| `is_selva_zone` calculado al crear/actualizar ubicación | — |
| Search con sanitización SQL (`replace(/[%_,]/g, "")`) | — |
| Soft delete (`is_active = false`) | — |

### Status: ✅ Operativo

---

## M09 — Sedes / Almacenes

**Archivos:** `pages/Branches.tsx`, `services/branch.service.ts`

### Tipos
| Tipo | Icono | Puede vender |
|------|-------|-------------|
| `warehouse` | Warehouse | No |
| `pos` | Store | Sí (con caja abierta) |
| `online` | Globe | Sí (tienda virtual) |

### Status: ✅ Operativo

---

## M10 — Cajas Registradoras

**Archivos:** `pages/CashRegisters.tsx`, `services/register.service.ts`

### Estados
| Estado | Significado |
|--------|-------------|
| `open` | Aceptando transacciones |
| `closed` | Cerrada, difference_cents calculado |

### Reglas de negocio
| Válido | Inválido |
|--------|----------|
| Abrir con monto inicial ≥ 0 | Abrir en warehouse → error |
| Una caja abierta por sucursal | Duplicada → error |
| `get_next_register_number` RPC | — |
| Cierre con diferencia (real - esperado) | — |

### Status: ⚠️ Código sólido, 0 filas en DB (no probado en producción)

---

## M11 — Reportes

**Archivos:** `pages/Reports.tsx`, `components/reports/`

### Tabs
- **Reporte General Contable** — libro de ventas con filtros fecha/sucursal
- **Reporte de Ventas** — agrupado por tipo, método de pago, export CSV

### Status: ✅ Funcionalidad básica operativa

---

## M12 — Tienda Web Pública

**Archivos:** `pages/tienda/`, `components/store/`, `services/store-public.service.ts`

### Cambios realizados (jul 2026)
- ✅ (Ronda 1) `createOrder`: `adjust_stock` con try/catch por item, acumula errores sin romper el pedido

### Reglas de negocio
| Válido | Inválido |
|--------|----------|
| Producto con stock > 0 → agregar | Agotado → botón disabled |
| Stock validado antes de crear pedido | Insuficiente → error con detalle |
| Carrito persiste en localStorage | — |
| `syncProducts` actualiza datos al cargar producto real | — |
| `getOrgIdFromBranch` determina la org | Sin org → error |

### Status: ✅ Operativo

---

## M13 — Gestión de Pedidos (Admin)

**Archivos:** `pages/Orders.tsx`, `services/order.service.ts`

### Transiciones de estado
```
pending → confirmed → processing → completed
   ↓          ↓           ↓
cancelled  cancelled   cancelled
```

### Reglas
| Válido | Inválido |
|--------|----------|
| `fulfill_store_order` RPC → invoice + ajusta stock | Fulfill sin items → error |
| Solo transiciones permitidas | Saltar estados → error |

### Status: ✅ Operativo

---

## M14 — Modelos de Máquina

**Archivos:** `pages/MachineModels.tsx`, `services/machine.service.ts`

### Status: ✅ Operativo

---

## M15-M20 — Resto de módulos

| Módulo | Archivo | Estado |
|--------|---------|--------|
| M15 Config SUNAT | `pages/SunatConfig.tsx` (605 líneas) | ✅ |
| M16 Docs SUNAT | `pages/SunatDocuments.tsx` (307 líneas) | ✅ |
| M17 Config Tributaria | `pages/TaxConfiguration.tsx` (821 líneas) | ✅ |
| M18 Sistema | `pages/System.tsx` | ✅ |
| M19 Impresión | `pages/PrinterSettings.tsx` + `lib/printing/` | ⚠️ No verificado |
| M20 Categorías | `components/inventory/CategoryManager.tsx` | ✅ |

---

## Gaps pendientes (no bugs)

### Funcionalidad faltante
- [ ] Devolución en POS (requiere ir a CreateCreditNote)
- [ ] Descuento manual por item en POS
- [ ] Envío a SUNAT en lote (multi-select)
- [ ] Duplicar comprobante
- [ ] Filtro por rango de fechas en tabla de comprobantes
- [ ] `units` persistir en `invoice_items` (schema change)

### Seguridad / Robustez
- [ ] Circuit breaker para llamadas SUNAT
- [ ] X-Request-ID en todas las EFs
- [ ] Backups automatizados PostgreSQL
- [ ] Migraciones versionadas de DB

### UX / Features
- [ ] Carrito persistente en tienda web (ya existe localStorage pero se pierden datos de producto tras recarga)
- [ ] Seguimiento de pedido para cliente web
- [ ] Pago en línea (solo datos de contacto actualmente)
- [ ] Arqueo de caja físico vs sistema
- [ ] POS bloqueado si no hay caja abierta (ya implementado)
- [ ] Formato PLE para exportación SUNAT
- [ ] Conteo físico / inventario cíclico
- [ ] Notificación al cliente por cambio de estado de pedido

---

## RPC Functions (8 documentadas)

| Function | Params | Uso |
|----------|--------|-----|
| `get_next_correlativo` | `p_organization_id, p_serie` | Correlativo atómico por serie |
| `create_invoice_with_items` | `p_organization_id, p_serie, ...` | Invoice + items + stock en transacción |
| `create_credit_note` | `p_organization_id, p_parent_invoice_id, ...` | NC vinculada |
| `insert_audit_entry` | `p_organization_id, p_action, ...` | Auditoría |
| `adjust_stock` | `p_organization_id, p_product_id, ...` | Ajuste stock |
| `transfer_stock` | `p_organization_id, p_product_id, ...` | Transferencia entre sedes |
| `fulfill_store_order` | `p_order_id` | Pedido → invoice |
| `get_next_register_number` | `p_branch_id` | Número de caja |

---

*Documento actualizado tras revisión completa de 20 módulos, 2026-07-19.*
