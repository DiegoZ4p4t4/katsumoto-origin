# Auditoría Completa del Sistema Katsumoto

## Fecha: 2025-07-07
## Alcance: Análisis integral de código, arquitectura, base de datos y cumplimiento SUNAT

---

## 1. RESUMEN EJECUTIVO

Katsumoto es un sistema POS/Inventario/ERP para **SERVICIOS GENERALES UNITED E.I.R.L.** (RUC 20608183672), ubicado en Pichanaqui, Junín, Perú. El sistema está construido sobre un stack moderno React 19 + TypeScript + Vite 6 + Supabase + Tauri 2.

**Estado general: Operativo en beta.** El core de facturación electrónica SUNAT funciona (facturas, boletas, notas, bajas vía SOAP). La GUI de Remisión Electrónica (GRE) vía REST está implementada pero **bloqueada por credenciales OAuth2 vencidas** (requiere regeneración desde SUNAT Menú SOL).

24/24 tareas del plan de cumplimiento SUNAT están completadas. Sin embargo, se identificaron **20 issues** adicionales (1 crítico, 7 altos, 8 medios, 4 bajos) que requieren atención.

---

## 2. ARQUITECTURA GENERAL

### 2.1 Stack Tecnológico

| Capa | Tecnología | Versión | Host |
|------|-----------|---------|------|
| Desktop app | Tauri 2 (Rust + WebView) | 2.10 | Local |
| Frontend | React + TypeScript + Vite | 19 / 5.5 / 6.3 | Bundled en Tauri |
| UI Kit | shadcn/ui + Tailwind CSS | latest / 3.4 | - |
| State | TanStack Query | 5.56 | - |
| Routing | react-router-dom | 6.26 | - |
| Backend DB | Supabase PostgreSQL | 15 | supabase.co |
| Auth | Supabase Auth | 2.102 | supabase.co |
| Edge Functions | Deno + TypeScript | - | supabase.co |
| Billing SUNAT | SOAP (sendBill/sendSummary) + REST (GRE) | - | SUNAT endpoints |
| Releases | GitHub Actions + Releases | - | github.com |
| Package Manager | pnpm | - | - |

### 2.2 Diagrama de Componentes

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Tauri 2 + Vite)                  │
│  ┌──────────┐ ┌───────┐ ┌─────────┐ ┌────────┐ ┌────────────┐  │
│  │ 18 Pages │ │25 Hooks│ │18 Svcs  │ │60+ Cmp │ │ Lib (types, │  │
│  │ (lazy)   │ │        │ │         │ │        │ │  constants, │  │
│  │          │ │        │ │         │ │        │ │  schemas,   │  │
│  │          │ │        │ │         │ │        │ │  printing)  │  │
│  └──────────┘ └───────┘ └─────────┘ └────────┘ └────────────┘  │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTPS (JWT)
┌──────────────────────────▼───────────────────────────────────────┐
│                      SUPABASE BACKEND                             │
│  ┌─────────────────┐ ┌──────────────────┐ ┌───────────────────┐  │
│  │ PostgreSQL 15   │ │ Auth (GoTrue)    │ │ Storage (S3)      │  │
│  │ 25 tables + RLS │ │ JWT + RLS        │ │ sunat-documents   │  │
│  └─────────────────┘ └──────────────────┘ └───────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ EDGE FUNCTIONS (Deno/TypeScript)                             │  │
│  │  ┌──────────────────┐ ┌────────────────┐ ┌───────────────┐  │  │
│  │  │ sunat-billing v70│ │sunat-creds v8  │ │apis-peru v4   │  │  │
│  │  │ SOAP + REST SUNAT│ │AES-256-GCM CRUD│ │RUC/DNI proxy  │  │  │
│  │  └──────────────────┘ └────────────────┘ └───────────────┘  │  │
│  └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         SUNAT SOAP   SUNAT REST   apisperu.com
         (e-factura)  (api-cpe)    (RUC/DNI)
```

### 2.3 IDs y Referencias Importantes

| Recurso | ID |
|---------|-----|
| Supabase Project Ref | `kdsjojrrspzmufdumywd` |
| Organization ID | `7e80b22f-b06a-4025-937a-5f9d62d78733` |
| Admin User ID | `7a900ed7-3939-46aa-bdb2-2e8e3be5621a` |
| Storage Bucket | `sunat-documents` |
| GitHub Repo | `github.com/DiegoZ4p4t4/katsumoto` |

---

## 3. ANÁLISIS DEL FRONTEND

### 3.1 Páginas (18, no 20 como documentado)

| Página | Ruta | Componente | Estado |
|--------|------|------------|--------|
| Dashboard | `/admin` | `Index.tsx` | Operativo |
| POS | `/admin/pos` | `POS.tsx` | Operativo |
| Productos | `/admin/inventory` | `Inventory.tsx` | Operativo |
| Máquinas | `/admin/machines` | `MachineModels.tsx` | Operativo |
| Transferencias | `/admin/transfers` | `Transfers.tsx` | Operativo |
| Movimientos | `/admin/stock` | `StockMovements.tsx` | Operativo |
| Facturación | `/admin/invoices` | `Invoices.tsx` | Operativo |
| Nueva Factura | `/admin/invoices/new` | `CreateInvoice.tsx` | Operativo |
| Clientes | `/admin/clients` | `Clients.tsx` | Operativo |
| Guías Remisión | `/admin/despatches` | `Despatches.tsx` | Operativo |
| Nueva Guía | `/admin/despatches/new` | `CreateDespatch.tsx` | Operativo |
| Config SUNAT | `/admin/sunat-config` | `SunatConfig.tsx` (role-guarded) | Operativo |
| Docs SUNAT | `/admin/sunat-documents` | `SunatDocuments.tsx` | Operativo |
| Config Tributaria | `/admin/tax-configuration` | `TaxConfiguration.tsx` (role-guarded) | Operativo |
| Cajas | `/admin/cash-registers` | `CashRegisters.tsx` | Operativo |
| Reportes | `/admin/reports` | `Reports.tsx` | Operativo |
| Pedidos Online | `/admin/orders` | `Orders.tsx` | Operativo |
| Sedes | `/admin/branches` | `Branches.tsx` (role-guarded) | Operativo |
| Impresora | `/admin/printer-settings` | `PrinterSettings.tsx` | Operativo |
| Sistema | `/admin/system` | `System.tsx` (role-guarded) | Operativo |
| **Tienda pública:** | | | |
| Landing | `/` | `StoreIndex.tsx` | Operativo |
| Carrito | `/carrito` | `StoreCartPage.tsx` | Operativo |
| Checkout | `/checkout` | `StoreCheckout.tsx` | Operativo |

### 3.2 Hooks (25 archivos)

| Categoría | Hooks | Propósito |
|-----------|-------|-----------|
| **Datos** | `useProducts`, `useInvoices`, `useClients`, `useBranches`, `useMachines`, `useRegisters`, `useStockMovements`, `useOrders`, `useDespatches` | Consultas CRUD con TanStack Query |
| **Mutations** | `useProductMutations`, `useInvoiceMutations`, `useClientMutations`, `useBranchMutations`, `useMachineMutations`, `useRegisterMutations`, `useDespatchMutations`, `useCrudMutations` | Operaciones de escritura |
| **POS** | `usePosCart`, `usePosInvoice` | Lógica del punto de venta |
| **SUNAT** | `useSunatHealth` (13 métricas), `useSunatAlerts` (4 tipos), `useSunatPendingQueue` (cola + retry), `useSunatConfig` | Monitoreo y cumplimiento |
| **Utilidades** | `useDebounce`, `useTableSort`, `usePagination`, `useAutoUpdate`, `useSystemInfo`, `useRealtime`, `useOrgId` | Infraestructura |
| **Tienda** | `useStorePublic` | Consultas de tienda pública |

### 3.3 Servicios (18 archivos)

| Servicio | Tablas principales | Funciones |
|----------|-------------------|-----------|
| `invoice.service.ts` | invoices, invoice_items | CRUD, `createWithItems` (RPC, 3 retries), `createCreditNote`, status transitions |
| `product.service.ts` | products, price_tiers | CRUD productos, precios por cantidad |
| `customer.service.ts` | customers | CRUD clientes |
| `stock.service.ts` | stock_movements | Movimientos, transferencias, ajustes |
| `branch.service.ts` | branches, branch_stock | CRUD sedes, stock por sucursal |
| `sunat.service.ts` | sunat_config, sunat_summary_log | Invocación de las 3 Edge Functions SUNAT |
| `despatch.service.ts` | despatches, despatch_items | CRUD guías de remisión |
| `machine.service.ts` | machine_models, product_machines | CRUD modelos de máquina |
| `register.service.ts` | cash_registers, register_transactions | CRUD cajas registradoras |
| `order.service.ts` | store_orders | Pedidos de tienda online |
| `audit.service.ts` | audit_log | 20 acciones de auditoría |
| `report.service.ts` | - | Reportes contables y de ventas |
| `tax-config.service.ts` | tax_configurations | Configuración de impuestos |
| `apisPeru.ts` | - | Proxy para consultas RUC/DNI vía apis-peru-proxy |
| `storage.service.ts` | - | Operaciones de Storage |
| `category.service.ts` | managed_category_* | Gestión de categorías |
| `user.service.ts` | profiles | Gestión de usuarios |
| `store-public.service.ts` | products (público) | Consultas para tienda pública |

### 3.4 Componentes (60+ archivos)

Organizados por dominio:
- `ui/` — 50+ componentes shadcn/ui (button, card, dialog, table, etc.)
- `pos/` — `PosCart`, `PosProductGrid`, `PosPaymentDialog`
- `inventory/` — 13 componentes (tablas, diálogos, filtros, kardex, stock, CSV)
- `invoices/` — 8 componentes (tabla, filtros, editor items, NC, preview)
- `machines/` — 3 componentes
- `reports/` — 4 componentes (sales, accounting, filtros, export)
- `store/` — 4 componentes (header, cart context, product card, floating buttons)
- `data-table/` — PaginationControls, SortableHeader
- `shared/` — UpdateNotification

### 3.5 Librerías Core (src/lib/)

| Módulo | Archivos | Propósito |
|--------|----------|-----------|
| `types/` | 12 archivos (index + 11 dominios) | Tipos TypeScript para cada dominio |
| `constants/` | 6 archivos | Constantes de negocio (productos, facturas, impuestos, documentos, sedes, geo) |
| `schemas/` | 5 archivos | Validación Zod (producto, factura, cliente, máquina, sede) |
| `printing/` | 12 archivos | Generación de PDFs (jsPDF), tickets térmicos (ESC/POS), QR, formatos |
| `sunat-integration/` | 3 archivos | Integración con librería `fractuyo` para cálculos SUNAT |
| `platform/` | 5 archivos | Adaptadores de impresión (Tauri vs Web) |
| `tax-engine.ts` | 524 líneas | Motor de determinación de impuestos (Ley Selva/Amazonía 27037) |
| `calculations.ts` | 101 líneas | Cálculo de IGV, descuentos, totales (prices-inclusive) |
| `format.ts` | - | Formateo de moneda, validación RUC módulo 11 |
| `geo-peru.ts` | - | Datos geográficos de Perú (departamentos, provincias) |
| `geo-districts.ts` | - | Datos de distritos con indicador `isSelva` |
| `pricing.ts` | - | Lógica de price tiers por cantidad |
| `barcode.ts` | - | Generación de códigos de barras |
| `supabase.ts` | 38 líneas | Cliente Supabase + caché de org_id |

### 3.6 Observaciones Frontend

1. **Lazy loading bien implementado** — Todas las páginas usan `React.lazy()` con Suspense fallback.
2. **Provider hell moderado** — 8 providers anidados en `App.tsx` (AuthProvider, RealtimeProvider, QueryClientProvider, TooltipProvider, ThemeProvider, PlatformProvider, BranchSelectionProvider, CategoryImagesProvider, TaxConfigProvider).
3. **Use of `as any` limitado pero presente** — Solo 7 ocurrencias en frontend (principalmente en `SunatConfig.tsx` para acceder a `result.certificate_subject`).
4. **Caché de `organization_id` con TTL de 5 minutos** — Puede causar inconsistencia si un admin cambia la org de un usuario durante una sesión activa.
5. **Dos builds separadas** — `vite.config.ts` (admin) y `vite.config.store.ts` (tienda pública), con entries `main.tsx` y `main-store.tsx` respectivamente.

---

## 4. ANÁLISIS DEL BACKEND (EDGE FUNCTIONS)

### 4.1 sunat-billing v70 (888 líneas en index.ts)

#### Arquitectura de Módulos

```
sunat-billing/
├── index.ts (888 líneas)          # Router principal + handlers
├── sunat/
│   ├── auth.ts                    # JWT decode + profile lookup
│   ├── client.ts                  # Factory: createSunatClient()
│   ├── constants.ts               # Maps (tipos doc, afectación, errores, acciones, unidades)
│   ├── direct-client.ts (333 ln)  # Orquestador: SOAP para CPE, REST para GRE
│   ├── http.ts                    # CORS, JSON, error helpers
│   ├── storage.ts                 # Verificar archivos en Storage
│   ├── transformers.ts (330 ln)   # DB records → documentos SUNAT
│   ├── types.ts                   # Interfaces (SunatCredentials, SunatResult, etc.)
│   ├── validate.ts               # Validación RUC módulo 11
│   ├── crypto/
│   │   ├── certificate.ts         # Carga PEMs de Storage
│   │   ├── credentials.ts (33 ln) # AES-256-GCM decrypt
│   │   ├── c14n.ts               # Canonicalización XML simplificada
│   │   └── xml-signer.ts (149 ln) # XMLDSig (SHA-256 + RSA + C14N)
│   ├── gre/
│   │   ├── gre-rest-client.ts (273 ln) # OAuth2 + sendCpe + checkStatus
│   │   └── token-cache.ts (33 ln) # Cache token in-memory (10 min buffer)
│   ├── soap/
│   │   ├── soap-client.ts (170 ln) # SOAP HTTP (sendBill, sendSummary, getStatus)
│   │   ├── soap-envelope.ts       # SOAP envelope builders
│   │   └── soap-parser.ts         # SOAP response parsers
│   ├── xml/
│   │   ├── helpers.ts (17 ln)     # escapeXml, formatAmount, ensureArray
│   │   ├── namespaces.ts          # UBL namespaces
│   │   └── templates/
│   │       ├── invoice.ts (261 ln) # UBL 2.1 Factura/Boleta
│   │       ├── note.ts             # UBL 2.1 Nota Crédito/Débito
│   │       ├── summary.ts          # UBL 2.0 Resumen Diario
│   │       ├── voided.ts           # UBL 2.0 Comunicación de Baja
│   │       └── despatch.ts         # UBL 2.1 Guía de Remisión (version-aware)
│   └── utils/
│       ├── endpoints.ts           # SOAP endpoints (beta/prod)
│       ├── zip.ts                 # zipXml, unzipFirstFile (fflate)
│       └── number-to-words.ts     # Número a letras en español
```

#### Acciones y Transportes

| Action | Transporte | Auth | Endpoint SUNAT | Respuesta |
|--------|-----------|------|----------------|-----------|
| `test` | - (local) | - | - | Firma XML + datos certificado |
| `send` | SOAP sendBill | WS-Security | e-factura.sunat.gob.pe | CDR inmediato |
| `send-summary` | SOAP sendSummary | WS-Security | e-factura.sunat.gob.pe | Ticket (async) |
| `send-voided` | SOAP sendSummary | WS-Security | e-factura.sunat.gob.pe | Ticket (async) |
| `check-ticket` | SOAP getStatus | WS-Security | e-factura.sunat.gob.pe | Status + CDR |
| `check-summary-ticket` | SOAP getStatus | WS-Security | e-factura.sunat.gob.pe | Status + CDR |
| `send-despatch` | **REST** sendCpe | OAuth2 Bearer | api-cpe.sunat.gob.pe | Ticket (async) |
| `check-despatch-ticket` | **REST** checkStatus | OAuth2 Bearer | api-cpe.sunat.gob.pe | Status (0/98/99) + CDR |

#### Flujo de Envío de Factura (`action: "send"`)

1. **Validación pre-envío** (`handleSend`, línea 383):
   - Invoice existe y status = "issued"
   - Fecha de emisión ≤ 7 días de antigüedad (STALE_DATE)
   - Tiene items
   - Cliente existe
   - Factura requiere RUC válido (módulo 11)

2. **Resolución de tipo** (línea 460):
   - Si es nota_crédito/debito → busca factura padre, valida que NC a boleta vaya por resumen
   - Si es factura/boleta → transforma vía `transformInvoiceToSunat()`

3. **Envío SOAP** (`DirectSunatClient.sendInvoice`):
   - Carga PEM desde Storage
   - Construye XML UBL 2.1 con template
   - Firma XML (XMLDSig SHA-256 + RSA)
   - ZIPea XML firmado
   - Envía vía SOAP sendBill con timeout 30s + 3 retries

4. **Post-envío** (línea 536):
   - Si éxito: guarda XML en Storage, CDR en Storage, actualiza invoice a "accepted"
   - Si falla: guarda error_code y error_message
   - Auditoría `sunat.send` en audit_log

#### Flujo de Resumen Diario (`action: "send-summary"`)

1. Busca boletas + NC a boletas pendientes para la fecha
2. Enriquece NC con datos del padre (tipo documento, número)
3. Construye documento resumen con `buildSummaryDocument()`
4. Envía vía SOAP sendSummary
5. Almacena XML en Storage (path: `RC-{fecha}-{correlativo}.xml`)
6. Marca todas las boletas como "issued" con `sunat_ticket`
7. Crea entrada en `sunat_summary_log`

#### Flujo GRE/REST (`action: "send-despatch"`)

1. Obtiene token OAuth2 (cached con buffer de 10 min)
2. Construye XML UBL 2.1 GRE (version-aware 1.0/2.0)
3. Firma y ZIPea XML
4. Envía vía POST JSON a REST API (archivo base64 + hash SHA-256)
5. Retorna ticket para polling

### 4.2 sunat-credentials v8 (237 líneas)

- CRUD de `sunat_config`
- Encripta `clave_sol` y `certificado_password` con AES-256-GCM
- IV aleatorio de 12 bytes concatenado al ciphertext
- No expone datos sensibles en GET (retorna `has_clave_sol`, `has_certificado_password`)
- CORS restringido a 4 orígenes
- Verifica existencia de certificado en Storage antes de guardar

### 4.3 apis-peru-proxy v4 (167 líneas)

- Proxy seguro para apisperu.com
- Rate limiting in-memory: 30 req/min por IP+userId
- Validación de formato RUC (11 dígitos) y DNI (8 dígitos)
- CORS restringido
- Mapeo de errores amigables (RUC no encontrado, DNI no encontrado)

### 4.4 Observaciones Backend

1. **`SupabaseClientLike = any`** — Elimina toda la seguridad de tipos. Las operaciones de BD usan `(supabase.from(...) as any)` en 25+ ubicaciones. Esto impide que TypeScript detecte errores de schema en tiempo de compilación.

2. **Sin validación de roles en EFs** — `sunat-billing` solo verifica que el JWT sea válido, no que el usuario tenga rol `owner` o `admin`. Cualquier empleado autenticado puede llamar a `send`, `send-summary`, etc.

3. **Inconsistencia de estado en handleSummary** — Si el envío SOAP falla pero ya se marcaron algunos invoices, no hay rollback. Las marcas `sunat_ticket` y `issued` se aplican secuencialmente sin transacción.

4. **Memory leak en token-cache.ts** — El `Map` crece indefinidamente si hay múltiples organizaciones. Debería tener un TTL global o un límite de entradas.

5. **No hay circuit breaker** — Si SUNAT está caído, las llamadas fallan 3 veces con backoff pero no hay un mecanismo para pausar intentos.

6. **Falta X-Request-ID / Correlation-ID** — No se genera ni propaga un ID de tracing para debugging cross-component.

---

## 5. ANÁLISIS DE BASE DE DATOS

### 5.1 Tablas (25, todas con RLS)

| # | Tabla | Filas | Índices FK | Realtime |
|---|-------|-------|-----------|----------|
| 1 | organizations | 2 | - | No |
| 2 | profiles | 2 | fk user_id | No |
| 3 | branches | 3 | fk org | No |
| 4 | products | 143 | fk org, category | Sí |
| 5 | customers | 2 | fk org | Sí |
| 6 | invoices | 2 | fk org, customer, branch | Sí |
| 7 | invoice_items | - | fk invoice, product | No |
| 8 | sunat_config | 1 | fk org | No |
| 9 | sunat_summary_log | 7 | fk org | No |
| 10 | despatches | 1 | fk org | Sí |
| 11 | despatch_items | 4 | fk despatch, product | No |
| 12 | tax_configurations | 1 | fk org | No |
| 13 | machine_models | 48 | fk org | No |
| 14 | product_machines | 115 | fk product, machine | No |
| 15 | branch_stock | 1 | fk org, branch, product | Sí |
| 16 | price_tiers | 40 | fk product | No |
| 17 | cash_registers | 0 | fk org, branch | Sí |
| 18 | register_transactions | 0 | fk register | No |
| 19 | stock_movements | 2 | fk org, branch, product | Sí |
| 20 | audit_log | 8 | fk org | No |
| 21 | store_orders | 0 | fk org, customer | No |
| 22 | store_order_items | 0 | fk order, product | No |
| 23-25 | managed_category_* | 17/17/19 | - | No |

### 5.2 Columnas SUNAT en `invoices`

| Columna | Tipo | Propósito |
|---------|------|-----------|
| `sunat_hash` | TEXT | Digest SHA-256 del XML firmado |
| `sunat_xml_path` | TEXT | Path del XML en Storage |
| `sunat_cdr_path` | TEXT | Path del CDR ZIP en Storage |
| `sunat_cdr_code` | TEXT | Código de respuesta CDR |
| `sunat_cdr_description` | TEXT | Descripción del CDR |
| `sunat_ticket` | TEXT | Ticket de resumen/baja |
| `sunat_error_code` | TEXT | Código de error SUNAT |
| `sunat_error_message` | TEXT | Mensaje de error |
| `sunat_sent_at` | TIMESTAMPTZ | Fecha/hora de envío |
| `sunat_accepted_at` | TIMESTAMPTZ | Fecha/hora de aceptación |
| `reference_invoice_id` | UUID | FK a factura padre (NC/ND) |
| `motivo_nota` | TEXT | Código motivo NC/ND (Catálogo 09) |
| `descripcion_motivo` | TEXT | Descripción del motivo |

### 5.3 Funciones RPC

- `get_next_correlativo(org_id, serie)` — Retorna siguiente correlativo atómicamente
- `create_invoice_with_items(...)` — Crea invoice + items + descuenta stock en una transacción
- `create_credit_note(...)` — Crea nota de crédito vinculada
- `insert_audit_entry(...)` — Inserta entrada de auditoría con user_id automático

### 5.4 Observaciones DB

1. **Sin migraciones versionadas** — Los cambios de schema se aplican manualmente. No hay sistema de migraciones (Flyway, Alembic, etc.).

2. **Sin backups automatizados** — El doc de disaster recovery menciona `pg_dump` manual pero no hay cron/scheduler.

3. **`sunat_summary_log` sin FK a invoices** — No hay relación explícita entre el log de resumen y las boletas que contiene. El `ticket` es el único vínculo.

4. **Validación de stock en RPC no cubre race conditions** — Aunque `create_invoice_with_items` está en una transacción, el nivel de aislamiento por defecto en PostgreSQL (READ COMMITTED) puede permitir phantom reads si dos cajeros venden el mismo producto simultáneamente.

---

## 6. CUMPLIMIENTO SUNAT (25 PUNTOS)

### Resumen de Auditoría

| Estado | Cantidad | Puntos |
|--------|----------|--------|
| Cumple | 14 | 1(parcial), 2, 3, 4(parcial), 6, 7, 10, 12, 21, 13(parcial), 14(parcial), 15(parcial), 16(parcial), 24(parcial) |
| Parcial | 7 | 5, 8, 9, 11, 20, 22, 23 |
| No implementado | 4 | 17, 18, 19, 25 |

### 24 Tareas Completadas (Fases 1-5)

| Fase | Tareas | Estado |
|------|--------|--------|
| FASE 1: Bugs Críticos | 5/5 | Completado |
| FASE 2: Cumplimiento SUNAT | 8/8 | Completado |
| FASE 3: Seguridad | 4/4 | Completado |
| FASE 4: Trazabilidad | 4/4 | Completado |
| FASE 5: Validaciones Inteligentes | 3/3 | Completado |

### Puntos débiles restantes

- **Punto 1 (Identidad emisor):** Falta verificación RUC activo/habido en tiempo real
- **Punto 5 (Unidades):** Mapeo parcial al Catálogo 3 (17 unidades mapeadas, pero sin soporte para override por producto)
- **Punto 17 (Plazos):** Sin validación de antigüedad en frontend (solo backend)
- **Punto 18 (Reintentos):** La cola de reenvío es manual (botón en UI), no automática con scheduler
- **Punto 19 (Consistencia contable):** Sin cruce automático ventas vs XML
- **Punto 23 (Seguridad):** CORS restrictivo pero no validación de roles en EFs

---

## 7. BUGS E ISSUES IDENTIFICADOS

### 7.1 Críticos (1)

| # | Issue | Ubicación | Descripción |
|---|-------|-----------|-------------|
| **C1** | **GRE OAuth2 bloqueado** | `gre-rest-client.ts`, `sunat_config` | Credenciales OAuth2 viejas rechazadas por SUNAT. `client_id: 7df91084-...` ya no es válido en el endpoint unificado `api-seguridad.sunat.gob.pe`. Las guías de remisión no se pueden enviar. **Bloqueante para producción.** |

### 7.2 Altos (7)

| # | Issue | Ubicación | Descripción |
|---|-------|-----------|-------------|
| **H1** | **note.ts formato AccountingSupplierParty** | `templates/note.ts` | Usa `cbc:CustomerAssignedAccountID` + `cbc:AdditionalAccountID` en vez de `cac:PartyIdentification/schemeID="6"` (formato UBL 2.1). Las notas crédito/débito pueden ser rechazadas en producción. |
| **H2** | **Sin validación de roles en EFs** | `sunat-billing/index.ts` | Cualquier usuario autenticado puede enviar facturas/resúmenes. Las acciones de escritura en `sunat-credentials` requieren rol. |
| **H3** | **Inconsistencia de estado sin transacción** | `index.ts:handleSummary` | Si el envío SOAP es exitoso pero falla al marcar algunos invoices, quedan estados inconsistentes sin rollback. |
| **H4** | **Deduplicación en cola de reenvío** | `useSunatPendingQueue.ts` | `staleInvoices` y `failedInvoices` pueden solaparse. Un invoice sin `sent_at` y con `error_code` aparece 2 veces en la cola. |
| **H5** | **No hay circuit breaker para SUNAT** | `soap-client.ts` | Si SUNAT está caído, se reintenta 3 veces con backoff pero no hay mecanismo para pausar nuevos intentos. Podría generar avalancha de errores. |
| **H6** | **Riesgo de race condition en stock** | RPC `create_invoice_with_items` | Aislamiento READ COMMITTED puede permitir sobreventa si dos cajeros venden el mismo producto simultáneamente. Debería usar `SELECT ... FOR UPDATE`. |
| **H7** | **`cert_expiring` no implementado** | `useSunatAlerts.ts` | El tipo de alerta está declarado pero nunca se genera. No hay monitoreo de fecha de vencimiento del certificado digital. |

### 7.3 Medios (8)

| # | Issue | Ubicación | Descripción |
|---|-------|-----------|-------------|
| **M1** | **`SupabaseClientLike = any`** | 25+ ubicaciones | Elimina type safety en todas las operaciones de BD. Errores de schema solo se detectan en runtime. |
| **M2** | **Memory leak en token-cache** | `token-cache.ts` | El `Map` crece sin límite. Cada org genera una entrada que nunca se limpia si no se usa. |
| **M3** | **Caché de org_id con TTL fijo** | `supabase.ts:getCurrentOrgId` | 5 minutos. Si un admin reasigna la organización de un usuario, ve datos de la org anterior hasta que expire. |
| **M4** | **Documentación desactualizada** | `docs/04-architecture.md` | Dice "sunat-billing v62", "20 páginas" (son 18+3 tienda). Los diagramas/flujos no reflejan v70. |
| **M5** | **Duplicación en docs/07** | `docs/07-sunat-compliance-avance.md` | Las tablas de FASE 3 y FASE 4 aparecen duplicadas (líneas 199-231). |
| **M6** | **Falta X-Request-ID** | Todas las EFs | Sin tracing cross-component para debugging de pipelines de facturación. |
| **M7** | **No hay health check de Storage** | `storage.ts` | Solo verifica existencia de archivo, no integridad ni permisos. |
| **M8** | **Tests insuficientes** | `__tests__/` | Solo 5 archivos de test. Sin tests para hooks, componentes, o servicios críticos. |

### 7.4 Bajos (4)

| # | Issue | Ubicación | Descripción |
|---|-------|-----------|-------------|
| **L1** | **Cleanup de Realtime al cambiar org** | `useRealtime.ts` | El efecto se recrea cuando cambia `organizationId`, pero el canal anterior podría no cerrarse limpiamente. |
| **L2** | **Hardcoded IGV rate en múltiples lugares** | `transformers.ts:86`, `invoice.ts:39` | Aunque existe `TAX_RATE_MAP`, el 18% aparece hardcodeado en expresiones como `1 + (tipAfeIgv === "10" ? 0.18 : 0)`. |
| **L3** | **PHP legacy sin eliminar** | `OTROS/sunat-billing-api/` | Marcado para eliminar pero aún presente (~3-5MB). |
| **L4** | **`build:store` no documentado** | `package.json` | El script `build:store` compila la tienda por separado pero el flujo no está en los docs. |

---

## 8. DEUDA TÉCNICA

### 8.1 Pendiente inmediato

| Item | Prioridad | Esfuerzo | Bloqueante |
|------|-----------|----------|------------|
| Regenerar credenciales GRE OAuth2 | **Crítica** | 1h (depende de SUNAT) | Sí |
| Fix note.ts AccountingSupplierParty | Alta | 2h | No (beta OK) |
| Implementar `cert_expiring` en useSunatAlerts | Alta | 1h | No |
| Agregar validación de roles en sunat-billing | Alta | 3h | No |
| Deducplicar cola de reenvío | Media | 30min | No |
| Agregar `SELECT FOR UPDATE` en RPC stock | Alta | 1h | No |

### 8.2 Pendiente futuro

| Item | Prioridad |
|------|-----------|
| Retención (tipo 20) | Baja (no requerido actualmente) |
| ISC, ICBPER | Baja (no aplica a repuestos) |
| Scheduler automático de reenvío | Media |
| Dashboard de consistencia contable | Media |
| Migraciones versionadas de DB | Media |
| Tests unitarios para hooks y servicios | Media |
| Eliminar PHP legacy (OTROS/) | Baja |
| Circuit breaker para llamadas SUNAT | Media |

---

## 9. ANÁLISIS DE SEGURIDAD

### 9.1 Fortalezas

- **AES-256-GCM** para claves sensibles (clave_sol, certificado_password)
- **Sin fallback encryption key** (corregido en FASE 3)
- **tryDecrypt retorna null** en vez del valor encriptado (corregido en FASE 3)
- **CORS restringido** a 4 orígenes conocidos
- **RLS en todas las tablas** (63 políticas)
- **Certificados PEM en Storage** protegidos por RLS (no en código)
- **Rate limiting** en apis-peru-proxy (30 req/min por IP+userId)
- **JWT propio** en las 3 EFs (decode + profile lookup)

### 9.2 Debilidades

- **Sin validación de roles en sunat-billing** — Un empleado con JWT válido puede enviar facturas
- **SupabaseClientLike = any** — Sin type safety, propenso a errores de schema
- **Service role key en EFs** — Necesario para bypass RLS pero es un riesgo si se filtra
- **Sin sanitización de entrada** en body de requests — Confía en la validación del frontend
- **Sin rate limiting en sunat-billing** — Un actor malicioso podría saturar llamadas a SUNAT
- **Token cache en memoria sin límite** — Posible DoS si se crean muchas organizaciones

### 9.3 Recomendaciones de Seguridad

1. Agregar `RoleGuard` en handlers de sunat-billing (owner/admin)
2. Agregar rate limiting por IP en sunat-billing
3. Rotar `SUNAT_CREDENTIALS_KEY` periódicamente
4. Agregar límite de entradas en token-cache (LRU con max 100)
5. Implementar sanitización de entrada con Zod en EFs
6. Monitorear intentos fallidos de auth en EFs

---

## 10. ANÁLISIS DE RENDIMIENTO

### 10.1 Puntos fuertes

- **Lazy loading** de páginas reduce el bundle inicial
- **TanStack Query** con staleTime configurado por dominio
- **Realtime via Supabase channels** evita polling
- **Promise.all en useSunatHealth** — 13 queries paralelas
- **Caché de token OAuth2** con 10 min buffer
- **Índices FK en 22 columnas** (documentado en AGENTS.md)

### 10.2 Puntos débiles

- **13 queries secuenciales en cada carga del Dashboard** (productos, facturas, stocks, health, alerts, etc.)
- **Sin paginación en algunas listas** (products: 143 items full scan en branchProducts)
- **Cálculo en cliente de métricas** (useMemo en Index.tsx filtra/mapea arrays enteros)
- **SOAP 30s timeout puede ser excesivo** — SUNAT beta suele responder en 2-5s
- **Sin compresión en respuestas de EFs** — XMLs grandes sin gzip

---

## 11. RECOMENDACIONES PRIORIZADAS

### Inmediatas (semana 1)

1. **Regenerar credenciales GRE OAuth2** — Bloqueante para guías de remisión
2. **Fix note.ts AccountingSupplierParty** — Antes de usar notas en producción
3. **Implementar `cert_expiring` en alertas** — Monitorear vencimiento del certificado
4. **Agregar `SELECT FOR UPDATE` en RPC de stock** — Evitar sobreventa

### Corto plazo (semanas 2-4)

5. **Agregar validación de roles en sunat-billing**
6. **Deducplicar cola de reenvío**
7. **Límite LRU en token-cache**
8. **Agregar X-Request-ID en todas las EFs**
9. **Actualizar documentación (v70, páginas reales)**
10. **Eliminar PHP legacy (OTROS/)**

### Mediano plazo (1-3 meses)

11. **Migraciones versionadas de DB**
12. **Backups automatizados de PostgreSQL**
13. **Tests unitarios y de integración**
14. **Circuit breaker para SUNAT**
15. **Scheduler automático de reenvío**
16. **Dashboard de consistencia contable**

### Largo plazo (3-6 meses)

17. **Retención tipo 20** (si es requerido)
18. **Soporte multi-moneda (USD)**
19. **ISC e ICBPER** (si aplican)
20. **Type-safe Supabase client en EFs** (usar tipos generados)

---

## 12. CONCLUSIÓN

Katsumoto es un sistema **sólido y bien diseñado** para su escala actual. El core de facturación electrónica SUNAT funciona correctamente vía SOAP (facturas, boletas, notas, bajas), con 24/24 tareas de cumplimiento completadas. La arquitectura de Edge Functions es limpia y bien modularizada.

El **bloqueo principal es el GRE OAuth2**, que impide el envío de guías de remisión electrónicas. Las notas de crédito/débito tienen un formato XML que debe actualizarse antes de producción. La seguridad de las EFs necesita refuerzo con validación de roles.

La deuda técnica es manejable: ~20 issues identificados, la mayoría de prioridad media o baja. El sistema está listo para producción en beta, con las salvedades documentadas arriba.

---

## APÉNDICE A: Archivos de Documentación

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `docs/01-signing-keys.md` | Actualizado | Claves de firma ed25519 para auto-update |
| `docs/02-release.md` | Actualizado | Flujo de versiones v2.1.6 |
| `docs/03-deployment.md` | Actualizado | Deploy de EFs, secrets, Docker |
| `docs/04-architecture.md` | **Desactualizado** | Dice v62, 20 páginas |
| `docs/05-white-screen-fix.md` | OK | Fix pantalla blanca Tauri |
| `docs/06-sunat-compliance-plan.md` | Actualizado | Plan de 24 tareas, 5 fases |
| `docs/07-sunat-compliance-avance.md` | **Contenido duplicado** | Tablas FASE 3/4 repetidas |
| `docs/08-sunat-session-context.md` | Actualizado | Handoff de sesión |
| `docs/09-technical-debt.md` | Parcial | Solo cubre GRE, nota, retención, PHP |
| `docs/10-auditoria-completa-sistema.md` | **NUEVO** | Este documento |

## APÉNDICE B: Estructura de Archivos

```
21_PRUEBA_LIB_SUNAT/
├── src/                          # Frontend React + TypeScript
│   ├── App.tsx                   # Router principal (18 rutas admin + 3 tienda)
│   ├── main.tsx                  # Entry point admin
│   ├── main-store.tsx            # Entry point tienda pública
│   ├── pages/                    # 21 componentes de página (lazy loaded)
│   ├── components/               # 60+ componentes (ui/, pos/, inventory/, invoices/, etc.)
│   ├── hooks/                    # 25 custom hooks
│   ├── services/                 # 18 servicios (capa de datos)
│   └── lib/                      # Tipos, constantes, schemas, printing, tax-engine, etc.
├── supabase/functions/           # Edge Functions (Deno/TypeScript)
│   ├── sunat-billing/            # v70 - Motor SUNAT (32 archivos, ~2500 líneas)
│   ├── sunat-credentials/        # v8  - CRUD encriptado (237 líneas)
│   └── apis-peru-proxy/          # v4  - Proxy RUC/DNI (167 líneas)
├── docs/                         # Documentación (10 archivos)
├── migration-sql/                # Migraciones SQL manuales
├── OTROS/                        # Código legacy para eliminar
├── src-tauri/                    # Config Tauri 2 (Rust)
├── scripts/                      # Scripts utilitarios
├── public/                       # Assets estáticos
├── dist/                         # Build output admin
├── dist-store/                   # Build output tienda
├── docker-compose.yml            # Docker producción
├── docker-compose.dev.yml        # Docker desarrollo
└── package.json                  # Dependencias (82 deps, 28 devDeps)
```

---

*Documento generado el 2025-07-07 mediante análisis exhaustivo de código y documentación.*
