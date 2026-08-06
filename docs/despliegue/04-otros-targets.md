# 04 — Otros targets de despliegue (Docker, Vercel, nginx)

> Opciones alternativas a Cloudflare Pages. Verificado contra los archivos del repo (2026-08-06). El método **recomendado** sigue siendo Cloudflare Pages (`despliegue/01`).

## Docker + Nginx

El repo incluye un Dockerfile multi-stage y un compose para servir `dist/` con Nginx.

**`docker-compose.yml` (producción):**
```yaml
services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
        - VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
    container_name: katsumoto-frontend
    ports:
      - "8551:8551"
    restart: unless-stopped
```

**Uso:**
```bash
# las VITE_* deben estar en el entorno (se incrustan en el build)
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... docker compose up -d --build
# app en http://<host>:8551
```

**Detalles del Dockerfile:**
- Build: `node:20-alpine` + `pnpm install --frozen-lockfile` + `pnpm build`.
- Runtime: `nginx:alpine`, usuario **no-root** (`appuser`, UID 1001), copia `dist/` + `nginx.conf`.
- Expone puerto 8551.

**`nginx.conf`:** SPA fallback (`try_files ... /index.html`), headers de seguridad (CSP estricta, `X-Frame-Options: SAMEORIGIN`, HSTS), caché 1 año de assets hasheados.

> Nota: `docker-compose.dev.yml` + `Dockerfile.dev` son para desarrollo (volúmenes, HMR).

## Vercel

El repo incluye `vercel.json`:
- Rewrite SPA: `/(.*) → /index.html`.
- Headers de seguridad (misma CSP estricta que nginx/Cloudflare).

**Uso:** deploy estándar de Vercel (build `pnpm build`, output `dist/`).

> Nota: el rewrite de `vercel.json` captura `/api/*` — la función `api/updates/` (Tauri) no es alcanzable en Vercel. Está deprioritizada igualmente.

## Comparativa

| Aspecto | Cloudflare Pages (recomendado) | Docker/nginx | Vercel |
|---|---|---|---|
| Build | manual (`pnpm build`) | en imagen | en CI de Vercel |
| Headers | `_headers` + `_redirects` | `nginx.conf` | `vercel.json` |
| CSP | estricta | estricta | estricta |
| Costo | gratuito | servidor propio | plan Vercel |
| Nota | **el método que usas hoy** | para servidores VPS | alternativa |
