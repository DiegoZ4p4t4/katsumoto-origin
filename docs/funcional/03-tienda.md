# 03 — Tienda online

> Cómo funciona el flujo de compra público. Verificado contra `src/services/store-public.service.ts`, `src/pages/tienda/*`, `src/components/store/*` y el RPC `create_store_order`.

## Catálogo (público, sin login)

- `getProducts()`: lee `products` activos, **solo columnas públicas** (id, name, sku, description, price_cents, image_url, unit, category, category_group, product_family, tags, is_active, tax_affectation). `cost_cents` **no** es accesible a anon (GRANT a nivel de columna).
- `getBranches()`: lee sedes activas (la tienda usa la sede tipo `online`).
- `getBranchStock()`: stock por sede.

## Carrito

- `CartContext` mantiene el carrito y lo persiste en **localStorage** (`katsumoto_store_cart`).
- Al recargar, se guardan solo `{productId, quantity}`; un `syncProducts` rellena los productos completos desde el catálogo.
- Los precios mostrados **incluyen IGV**.

## Checkout (`/checkout`)

- Formulario de contacto (nombre, teléfono, correo, tipo/número de documento) y dirección de envío opcional (define la afectación por Ley Amazonía).
- El pedido se crea llamando al RPC **`create_store_order`** (SECURITY DEFINER), que:
  1. Valida que la sede sea `online` y activa.
  2. **Recalcula en el servidor** el `unit_price` desde `products.price_cents` (aplicando `price_tiers` por cantidad) y el IGV según la afectación del producto (con exoneración por selva si la sede es selva).
  3. Inserta `store_orders` (status `pending`) + `store_order_items` transaccionalmente.
  4. Devuelve el id del pedido.

> **Seguridad:** el cliente NO envía montos. Todo importe se deriva de la BD. Esto evita manipular precios a S/0.01.

## Ciclo del pedido

```
pending → confirmed → processing → completed
                              ↘ cancelled
```

- El admin gestiona pedidos en `/admin/orders` (avanzar estado).
- Al pasar a `completed`, el RPC **`fulfill_store_order`**:
  - Exige `status = 'processing'` y que el operador pertenezca a la org.
  - Crea/vincula el cliente por documento.
  - Crea la **factura** (si RUC) o **boleta** (si DNI) en la sede **almacén**, con `create_invoice_with_items` (descuenta stock, genera movimiento).
  - Marca el pedido `completed`. Todo en una transacción.

## RLS de la tienda (anon)

| Acceso | Permitido |
|---|---|
| Leer productos (columnas públicas) | ✅ (RLS `is_active=true` + GRANT de columnas) |
| Leer sedes / stock | ✅ (necesario para el catálogo) |
| Crear pedidos | ✅ solo vía RPC `create_store_order` |
| Leer `store_orders` / `store_order_items` / `organizations` | ❌ (políticas anon cerradas) |
| Leer `sunat_config` | ❌ |

## Notas

- El stock visible en la tienda y la validación de stock al crear el pedido no bloquean la compra: el stock real se valida en el **fulfillment** (sede almacén).
- No hay pago en línea: el pedido es una solicitud que el negocio confirma y procesa.
