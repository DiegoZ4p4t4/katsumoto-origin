# 01 — Arquitectura

> Cómo está construido el sistema por dentro. Verificado contra el código (2026-08-06).

## Vista general

```
┌─────────────────────────────────────────────────────────────┐
│                    Web (Cloudflare Pages)                   │
│  /dist  →  React 19 + Vite 6 + shadcn/ui + TanStack Query   │
│  (un solo bundle: tienda pública en / + admin en /admin)    │
└──────────────┬───────────────────────────┬──────────────────┘
               │ supabase-js (anon + JWT)  │
               ▼                           ▼
┌────────────────────────────┐  ┌─────────────────────────────┐
│       Supabase REST/Auth   │  │  Edge Functions (Deno)      │
│  PostgreSQL 15 (29 tablas) │  │  sunat-billing  (SOAP+REST) │
│  RLS + RPC (SECURITY       │  │  sunat-credentials (cifrado)│
│  DEFINER) + Storage        │  │  apis-peru-proxy (RUC/DNI)  │
└────────────────────────────┘  └──────────────┬──────────────┘
                                               ▼
                                        SUNAT (beta/prod)
```

## Stack

| Capa | Tecnología | Detalle |
|---|---|---|
| Frontend | React 19 + TypeScript | Vite 6 (SWC), build rápido |
| UI | shadcn/ui + Tailwind CSS | componentes Radix |
| Estado | TanStack Query v5 | caché de datos Supabase |
| Formularios | react-hook-form + Zod | validación de schemas |
| Backend | Supabase (PostgreSQL 15) | Auth, REST, Realtime, Storage |
| Edge Functions | Deno | 3 funciones (ver `tecnica/03`) |
| Impresión | jspdf + ESC/POS | A4 y ticket térmico |
| Desktop | Tauri 2 (Rust) | **Deprioritizado**: el repo solo tiene `tauri.conf.json` placeholder; el despliegue real es web |

## Entradas y build

- `index.html` + `src/main.tsx` → app completa (tienda en `/`, admin en `/admin`).
- `vite.config.ts` — define `__APP_VERSION__` desde `src-tauri/tauri.conf.json`, puerto dev 8551.
- `vite.config.store.ts` — bundle separado de tienda (`dist-store/`, **no** usado en el deploy actual).
- `pnpm build` ejecuta `tsc --noEmit` (gate) + `vite build` → `dist/`.

## Estructura de `src/`

```
src/
  pages/          # rutas admin + tienda (lazy)
  components/     # ui/, pos/, invoices/, inventory/, store/, machines/, shared/
  hooks/          # hooks TanStack Query (usePosInvoice, useProducts, ...)
  services/       # capa Supabase (invoice.service, product.service, store-public.service, ...)
  lib/
    types/        # modelos de dominio
    schemas/      # Zod
    constants/    # series, métodos de pago, tasas
    tax-engine.ts # determinación tributaria (Ley Amazonía)
    calculations.ts # cálculo de IGV/totales
    printing/     # PDF A4 y ticket térmico (texto + ESC/POS)
    utils/        # stock, export CSV, format
```

## Capa de datos

- El frontend lee/escribe vía **supabase-js** (RLS protege cada tabla).
- Las operaciones atómicas (factura + stock, pedido + ítems, ajuste) se hacen con **RPC SECURITY DEFINER** en PostgreSQL (ver `tecnica/02`).
- Las operaciones con SUNAT se hacen vía **Edge Functions** (el cliente no tiene las credenciales SUNAT).

## Decisiones clave

1. **Multi-tenant por `organization_id`** en todas las tablas; RLS por org + validación en cada RPC.
2. **Precios con IGV incluido** en el modelo interno; se extrae el IGV (ver `funcional/02`).
3. **Tienda anon** pero con montos recalculados en servidor (RPC `create_store_order`).
4. **El proyecto Supabase es compartido** con otra app ("servicios técnicos"): las tablas `katsumoto_usuarios`, `servicios`, `piezas`, `actualizaciones` no se usan en Katsumoto.
5. **SUNAT en modo beta** actualmente (`sunat_config.modo_produccion = false`).
