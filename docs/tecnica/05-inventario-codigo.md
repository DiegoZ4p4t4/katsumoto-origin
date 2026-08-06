# 05 — Inventario de código

> Mapa completo de archivos y módulos del sistema. Verificado contra el repo (2026-08-06).

## Páginas (`src/pages/`)

| Página | Ruta | Descripción |
|---|---|---|
| `Index.tsx` | `/admin` | Dashboard (métricas, SUNAT, acciones) |
| `POS.tsx` | `/admin/pos` | Punto de Venta |
| `Invoices.tsx` | `/admin/invoices` | Lista de comprobantes + NC/ND |
| `CreateInvoice.tsx` | `/admin/invoices/new` | Comprobante manual |
| `Inventory.tsx` | `/admin/inventory` | Productos (CRUD, CSV, stock) |
| `MachineModels.tsx` | `/admin/machines` | Modelos de máquina |
| `Transfers.tsx` | `/admin/transfers` | Transferencias entre sedes |
| `StockMovements.tsx` | `/admin/stock` | Kardex/movimientos |
| `Clients.tsx` | `/admin/clients` | Clientes |
| `Orders.tsx` | `/admin/orders` | Pedidos de la tienda (fulfillment) |
| `CashRegisters.tsx` | `/admin/cash-registers` | Cajas |
| `Reports.tsx` | `/admin/reports` | Reportes contables |
| `Despatches.tsx` | `/admin/despatches` | Guías de remisión |
| `CreateDespatch.tsx` | `/admin/despatches/new` | Nueva guía |
| `SunatConfig.tsx` | `/admin/sunat-config` | Configuración SUNAT |
| `SunatDocuments.tsx` | `/admin/sunat-documents` | Documentos SUNAT + cola de envío |
| `TaxConfiguration.tsx` | `/admin/tax-configuration` | Config tributaria (Ley Amazonía) |
| `Branches.tsx` | `/admin/branches` | Sedes |
| `Users.tsx` | `/admin/users` | Usuarios/invitación |
| `PrinterSettings.tsx` | `/admin/printer-settings` | Config impresora |
| `System.tsx` | `/admin/system` | Sistema/versión/actualizaciones |
| `NotFound.tsx` | — | 404 (sin montar; el catch-all redirige) |
| `tienda/StoreIndex.tsx` | `/` | Catálogo tienda |
| `tienda/StoreCartPage.tsx` | `/carrito` | Carrito |
| `tienda/StoreCheckout.tsx` | `/checkout` | Checkout |
| `tienda/StoreLayout.tsx` | — | Layout tienda |
| `tienda/PrivacyPolicy.tsx` / `TermsOfUse.tsx` | `/privacidad` `/terminos` | Legal |
| `auth/Login.tsx` | `/login` | Login |

## Servicios (`src/services/`) — capa Supabase

| Servicio | Propósito |
|---|---|
| `invoice.service.ts` | Comprobantes: CRUD, `createWithItems` (RPC), `createCreditNote`, estados |
| `product.service.ts` | Productos CRUD |
| `customer.service.ts` | Clientes CRUD + conteos |
| `branch.service.ts` | Sedes CRUD |
| `stock.service.ts` | Ajustes y transferencias (RPCs `adjust_stock`/`transfer_stock`) |
| `despatch.service.ts` | Guías CRUD + correlativo |
| `order.service.ts` | Pedidos tienda (admin) + `fulfillStoreOrder` |
| `store-public.service.ts` | Tienda pública: catálogo, `createOrder` (RPC `create_store_order`) |
| `register.service.ts` | Cajas: open/close/transacciones |
| `machine.service.ts` | Modelos de máquina |
| `category.service.ts` | Categorías gestionadas |
| `report.service.ts` | Reportes contables |
| `sunat.service.ts` | EFs SUNAT + documentos + certificado |
| `tax-config.service.ts` | Config tributaria |
| `user.service.ts` | Usuarios/invitación |
| `audit.service.ts` | Auditoría (`insert_audit_entry`) |
| `apisPeru.ts` | Proxy RUC/DNI |
| `storage.service.ts` | Storage (XML/CDR) |

## Hooks (`src/hooks/`)

- **Datos (TanStack Query):** `useProducts`, `useClients`, `useInvoices`, `useBranches`, `useRegisters`, `useMachines`, `useDespatches`, `useOrders`, `useStockMovements`, `useSunatConfig`, `useSunatHealth`, `useSunatAlerts`, `useSunatPendingQueue`, `useDashboardSales`, `useReports`, `useUsers`, `useSystemInfo`, `useStorePublic`, `useOrgId`.
- **Mutations:** `useProductMutations`, `useClientMutations`, `useBranchMutations`, `useMachineMutations`, `useInvoiceMutations`, `useRegisterMutations`, `useDespatchMutations`, `useCrudMutations` (base), `useTableSort`, `usePagination`, `useDebounce`.
- **Flujos:** `usePosInvoice` (venta), `usePosCart` (carrito POS), `usePrinter` (impresión), `useAutoUpdate` (Tauri), `useRealtime` (canal `org-{orgId}`).
- **UI:** `use-mobile`, `use-toast`.

## `src/lib/` — módulos clave

| Módulo | Propósito |
|---|---|
| `calculations.ts` | Cálculo de IGV/totales (precio incl. IGV) |
| `tax-engine.ts` | Determinación tributaria (Ley Amazonía, afectaciones) |
| `pricing.ts` | Precios por cantidad (price tiers) |
| `pdf.ts` | PDF A4 de comprobantes |
| `printing/` | Ticket térmico (texto + ESC/POS) y PDF 58/80mm; labels |
| `barcode.ts` | Códigos de barra (labels) |
| `export.ts` / `import.ts` / `report-export.ts` | CSV/Excel |
| `sanitize.ts` | Sanitización de inputs de la tienda |
| `geo-peru.ts` / `geo-districts.ts` | Ubigeos Perú + distritos selva |
| `supabase.ts` | Cliente + `getCurrentOrgId()` (VITE_ORG_ID) |
| `query-client.ts` / `query-keys.ts` | TanStack Query |
| `auth-context.tsx` | Sesión/login |
| `realtime-context.tsx` | Estado Realtime |
| `platform/` | Adaptadores impresora (web/tauri) |
| `constants/` | Series, métodos de pago, tasas, catálogos |
| `schemas/` | Zod |
| `types/` | Modelos de dominio |

## Backend de apoyo

| Archivo | Propósito |
|---|---|
| `api/updates/[target]/[arch]/[current_version].ts` | Función Vercel para updates de Tauri — **huérfana** (el desktop está deprioritizado y el rewrite de `vercel.json` la bloquea) |
| `scripts/init.mjs` | Seed/inicialización de la BD (usuarios, org, datos) — contiene credenciales de prueba |
| `scripts/sunat_direct_smoke.ts` | Smoke test SUNAT — **roto** (usa `SUPABASE_ACCESS_TOKEN` como JWT de usuario, no funciona) |
| `scripts/generate-districts.mjs` | Genera `geo-districts.ts` |

## Configuración y CI

| Archivo | Propósito |
|---|---|
| `vite.config.ts` / `vite.config.store.ts` | Build admin / tienda |
| `Dockerfile` + `docker-compose.yml` | Deploy con Nginx (ver `despliegue/04`) |
| `nginx.conf` | Headers de seguridad + SPA (ver `despliegue/04`) |
| `vercel.json` | Deploy en Vercel (rewrite SPA + headers) |
| `.github/workflows/ci.yml` | CI web: typecheck + lint + test + build |
| `.github/workflows/release.yml` | Release Tauri (4 plataformas + firma) — **deprioritizado** |
| `supabase/functions/*/config.toml` | `verify_jwt = false` por función |

## Código que no se usa (dead code / deprioritizado)

- `src-tauri/` — placeholder (`tauri.conf.json` solo); las APIs Tauri invocadas (`plugin-shell`, `plugin-updater`, comandos Rust de impresora) no tienen implementación.
- `api/updates/` — función Vercel huérfana.
- `vite.config.store.ts` / `dist-store/` — build de tienda separado, no usado en el deploy web.
- `scripts/sunat_direct_smoke.ts` — roto (token equivocado).
- `NotFound.tsx` — sin montar.
- `docs/historicos/` — documentación antigua archivada.
