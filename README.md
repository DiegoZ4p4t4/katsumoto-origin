# Katsumoto — Sistema de Facturación Agroindustrial

Sistema integral para **SERVICIOS GENERALES UNITED E.I.R.L.** (RUC 20608183672) — Pichanaqui, Junín, Perú.

## Stack

| Capa | Tecnología |
|------|-----------|
| Desktop | Tauri 2 (Rust + WebView) |
| Frontend | React 19 + TypeScript + Vite 6 + shadcn/ui + Tailwind CSS |
| Estado | TanStack Query v5 |
| Backend | Supabase (PostgreSQL 15 + Auth + Edge Functions/Deno) |
| Build | pnpm |

## Arranque rápido

```bash
pnpm install
pnpm dev          # Admin en http://localhost:8551
pnpm build        # Build admin → dist/
pnpm build:store  # Build tienda → dist-store/
```

## Variables de entorno (.env)

```env
VITE_SUPABASE_URL=https://kdsjojrrspzmufdumywd.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
VITE_ORG_ID=7e80b22f-b06a-4025-937a-5f9d62d78733
```

## Estructura

```
src/
  pages/         # 26 páginas (lazy loaded)
  components/    # 97+ componentes (ui/, pos/, invoices/, inventory/, ...)
  hooks/         # 35 custom hooks (TanStack Query)
  services/      # 18 servicios (capa Supabase)
  lib/           # Tipos, constantes, Zod schemas, tax-engine, printing
supabase/functions/
  sunat-billing/      # v70 — Motor SUNAT SOAP + REST
  sunat-credentials/  # v8  — CRUD cifrado AES-256-GCM
  apis-peru-proxy/    # v4  — Proxy RUC/DNI
```

## Documentación

| Doc | Contenido |
|-----|-----------|
| `docs/17-epicas-historias-usuario.md` | 11 épicas, 58 historias de usuario |
| `docs/14-especificacion-funcional-por-modulo.md` | 20 módulos con reglas de negocio |
| `docs/16-plan-pruebas-e2e.md` | 6 flujos end-to-end |
| `docs/13-auditoria-arquitectura-v3.md` | Auditoría de arquitectura (22 issues) |
| `docs/04-architecture.md` | Arquitectura y disaster recovery |
| `docs/03-deployment.md` | Guía de despliegue |
| `AGENTS.md` | Referencia técnica para desarrollo |

## Comandos

```bash
pnpm dev              # Dev server admin (8551)
pnpm build            # Build admin
pnpm build:store      # Build tienda pública
pnpm lint             # ESLint
pnpm sunat:smoke      # SUNAT smoke test

# Deploy Edge Functions
npx supabase functions deploy sunat-billing --project-ref kdsjojrrspzmufdumywd
npx supabase functions deploy sunat-credentials --project-ref kdsjojrrspzmufdumywd
npx supabase functions deploy apis-peru-proxy --project-ref kdsjojrrspzmufdumywd

# Inicializar DB (solo primera vez)
node scripts/seed.mjs
```

## Pipeline

```
tsc 0 · vitest 73/73 · build admin · build store
```

## Licencia

Privado — SERVICIOS GENERALES UNITED E.I.R.L.
