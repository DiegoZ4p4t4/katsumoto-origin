# 02 — Base de datos

> Esquema real de la BD de Supabase (PostgreSQL 15). Verificado contra la instancia viva (2026-08-06).

## Tablas (29)

Todas con **RLS habilitado**. Las marcadas como *otra app* no se usan en el frontend de Katsumoto.

| Tabla | Propósito |
|---|---|
| `organizations` | Multi-tenant (2 filas) |
| `profiles` | Perfiles de usuario: `organization_id`, `role`, `is_active` |
| `katsumoto_usuarios` | **Otra app** (roles admin/mecanico/asistente) — no usar |
| `branches` | Sedes: `warehouse` / `pos` / `online` |
| `products` | Repuestos agrícolas (~143) |
| `customers` | Clientes (20) |
| `invoices` | Comprobantes (35) + columnas SUNAT (`sunat_hash`, `sunat_ticket`, `sunat_cdr_*`, `sunat_error_*`) |
| `invoice_items` | Líneas de comprobante |
| `sunat_config` | Config SUNAT (1 fila): credenciales cifradas, `modo_produccion`, `ticket_footer` |
| `sunat_summary_log` | Log de resúmenes diarios y bajas (ticket, estado, CDR) |
| `despatches` / `despatch_items` | Guías de remisión electrónica (1 guía pendiente) |
| `tax_configurations` | Config tributaria: Ley Amazonía (`selva_law_enabled`) |
| `machine_models` / `product_machines` | Modelos de máquina y compatibilidad (48/115) |
| `branch_stock` | Stock por `(branch_id, product_id)` |
| `price_tiers` | Precios por cantidad (40) |
| `managed_category_families/groups/categories` | Categorías gestionadas (17/17/19) |
| `store_orders` / `store_order_items` | Pedidos de la tienda online (0) |
| `cash_registers` / `register_transactions` | Cajas (1) y transacciones |
| `stock_movements` | Kardex (movimientos `in/out/adjustment/transfer_*/return`) |
| `audit_log` | Auditoría |
| `servicios` / `piezas` / `actualizaciones` | **Otra app** (servicios técnicos) — no usar |

## RPCs (funciones SECURITY DEFINER)

Todas validan `organization_id` y **no exponen EXECUTE a `anon`/PUBLIC** (solo `authenticated`). Firmas y propósito:

| Función | Params (resumen) | Uso |
|---|---|---|
| `get_next_correlativo` | `p_organization_id, p_serie` | Siguiente correlativo por serie (lock) |
| `create_invoice_with_items` | `p_organization_id, p_serie, p_correlativo, p_invoice_type, p_customer_id, p_branch_id, montos..., p_created_by, p_items` | Crea comprobante + ítems + descuenta stock (transaccional). Valida que `p_created_by` pertenezca a la org |
| `create_credit_note` | `p_organization_id, p_parent_invoice_id, p_items, p_motivo, p_descripcion, p_branch_id, p_created_by` | Crea NC vinculada (serie FC01/BC01), devuelve stock. IGV calculado correctamente (`gravada = line_total − igv`) |
| `insert_audit_entry` | `p_action, p_entity, p_entity_id, p_old_value, p_new_value` | Auditoría (usa `auth.uid()`) |
| `adjust_stock` | `p_organization_id, p_product_id, p_branch_id, p_movement_type, p_quantity, p_notes, p_created_by` | Ajusta stock (in/out/adjustment) |
| `transfer_stock` | `p_organization_id, p_product_id, p_from_branch_id, p_to_branch_id, p_quantity, p_notes, p_created_by` | Transfiere entre sedes (2 movimientos) |
| `fulfill_store_order` | `p_order_id` | Convierte pedido → factura/boleta en sede almacén (valida org del operador) |
| `get_next_register_number` | `p_branch_id` | Siguiente número de caja (lock por fila) |
| `create_store_order` | `p_*` (datos pedido), `p_items jsonb` | Crea pedido de tienda **recalculando precios/IGV en servidor** (anon) |
| `is_owner_or_admin` | - | Helper RLS (lee `profiles.role`) |

## Seguridad de RPCs

- Todas son `SECURITY DEFINER` (bypass RLS) → deben validar la org manualmente (lo hacen).
- `SET search_path TO ''` + referencias `public.*` (excepto `create_credit_note` que quedó con `search_path=public` — ver nota abajo).
- `REVOKE EXECUTE FROM PUBLIC, anon` aplicado a las 8 RPC de escritura; solo `authenticated` + `service_role`.
- Validación de pertenencia: `p_created_by` debe ser un `profiles.id` de la org.

> **Nota pendiente (deuda):** `create_credit_note` usa `SET search_path TO 'public'` sin schema-qualify en sus referencias. No es un riesgo activo (no hay objetos maliciosos en `public`), pero se recomienda endurecer igual que el resto.

## RLS

- 63 políticas corregidas para usar `(select auth.uid())` y el helper `org_id()`.
- Tienda pública (anon): solo lectura de `products` (columnas públicas por GRANT) y llamada a `create_store_order`. `store_orders`, `store_order_items`, `organizations`, `sunat_config` **no** son legibles por anon.
- `products.cost_cents`: protegida de anon con GRANT a nivel de columna.

## Triggers

- `on_auth_user_created` → crea el perfil al crear un auth user (lee org/rol de `user_metadata`).
- `trg_seed_branch_stock_on_product*` / `..._on_branch*` → siembra `branch_stock` al crear/actualizar producto o sede.
- `*_updated` → mantiene `updated_at`.

## Constraints clave

- `invoices_organization_id_serie_correlativo_key` — UNIQUE (org, serie, correlativo).
- `cash_registers_org_branch_number_key` — UNIQUE (org, sede, número).
- `customers_organization_id_document_type_document_number_key` — UNIQUE cliente por documento.
- `stock_movements_movement_type_check` — incluye `transfer_out`, `transfer_in`, `return`.
- `profiles_role_check` — 6 roles (`owner, admin, cashier, vendedor, inventory, reader`).
- `despatches_status_check` — incluye `processing` y `rejected`.

## Migraciones

- `supabase/migrations/` — migraciones versionadas (formato `YYYYMMDDHHMMSS_nombre.sql`).
- El historial de migraciones en la BD está reconciliado (`supabase migration repair --status applied`).
- Las migraciones originales (2026-04) están en el historial de la BD pero **no** tienen archivos en el repo (gap pre-existente).

## Datos de referencia

- Organización: `7e80b22f-b06a-4025-937a-5f9d62d78733`.
- Admin: `juan.zapata@datacodev.com` (role `admin`); Owner: `yescobar@katsumoto.shop`.
- `sunat_config.modo_produccion = false` (beta).
