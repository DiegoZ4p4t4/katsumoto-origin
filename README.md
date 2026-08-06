# Katsumoto — Sistema de Facturación Agroindustrial

Sistema integral (facturación electrónica SUNAT, ERP, POS, inventario y tienda web) para **SERVICIOS GENERALES UNITED E.I.R.L.** (RUC 20608183672) — Pichanaqui, Junín, Perú.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + TypeScript + Vite 6 (SWC) + shadcn/ui + Tailwind CSS |
| Estado | TanStack Query v5 |
| Backend | Supabase (PostgreSQL 15 + Auth + Edge Functions/Deno) |
| Despliegue | Web (Cloudflare Pages) · Desktop Tauri deprioritizado |
| Build | pnpm |

## Arranque rápido

```bash
pnpm install
pnpm dev          # Admin en http://localhost:8551
pnpm build        # tsc (gate) + vite build → dist/
pnpm build:store  # Build tienda → dist-store/ (no usado en el deploy web)
```

## Variables de entorno (`.env`)

```env
VITE_SUPABASE_URL=https://kdsjojrrspzmufdumywd.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key-publica>
VITE_ORG_ID=7e80b22f-b06a-4025-937a-5f9d62d78733
```

## Despliegue

**Web (Cloudflare Pages):** `pnpm build` → subir `dist/` a Cloudflare Pages. Ver [docs/despliegue/01-cloudflare-pages.md](docs/despliegue/01-cloudflare-pages.md).

**Edge Functions:** `npx supabase functions deploy <nombre> --project-ref kdsjojrrspzmufdumywd`. Ver [docs/despliegue/02-supabase.md](docs/despliegue/02-supabase.md).

## Documentación

Ver [docs/README.md](docs/README.md) — índice completo: funcional, técnica, despliegue y operativa.

## Comandos

```bash
pnpm dev              # Dev server admin (8551)
pnpm build            # tsc --noEmit + vite build
pnpm build:store      # Build tienda pública
pnpm typecheck        # tsc --noEmit
pnpm lint             # ESLint (0 errores)
pnpm test             # vitest (141 tests)
pnpm sunat:test       # Tests Deno fiscales (13 tests)
pnpm sunat:smoke      # SUNAT smoke test
```

## Pipeline de calidad

```
tsc 0 errores · lint 0 errores · vitest 141/141 · deno 13/13 · build admin + store
```

## Licencia

Privado — SERVICIOS GENERALES UNITED E.I.R.L.
