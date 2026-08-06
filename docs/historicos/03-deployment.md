# Guía de Despliegue — Katsumoto v2.0

**Última actualización:** 2026-07-19

---

## 1. Requisitos

- Node.js 20+ y pnpm
- Cuenta Supabase con proyecto `kdsjojrrspzmufdumywd`
- Supabase CLI (`brew install supabase/tap/supabase`)

## 2. Clonar e instalar

```bash
git clone https://github.com/DiegoZ4p4t4/katsumoto.git
cd katsumoto
pnpm install
```

## 3. Variables de entorno

```bash
cp .env.example .env
```

Editar `.env`:
```env
VITE_SUPABASE_URL=https://kdsjojrrspzmufdumywd.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_H2VW9pyyaPL7KuXd2zh0mQ_UhFa2vig
VITE_ORG_ID=7e80b22f-b06a-4025-937a-5f9d62d78733
```

## 4. Base de Datos

La estructura (25 tablas, RLS, índices, 8 RPCs) ya está en Supabase.

```bash
# Inicializar datos mínimos (clientes, config, usuarios)
# La SR_KEY la obtienes de Supabase Dashboard → Settings → API → service_role
SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/init.mjs
```

Esto crea automáticamente:
- 3 clientes (Consumidor Final, RUC, DNI)
- SUNAT config base
- Tax config (Ley Selva Pichanaqui)
- 2 usuarios admin:
  - `yescobar@katsumoto.shop` / `1234abcd` (owner)
  - `juan.zapata@datacodev.com` / `mamaguevo` (admin)

Si la DB ya tiene datos, el script es idempotente (no duplica).

## 5. Desplegar Edge Functions

```bash
npx supabase functions deploy sunat-billing --project-ref kdsjojrrspzmufdumywd
npx supabase functions deploy sunat-credentials --project-ref kdsjojrrspzmufdumywd
npx supabase functions deploy apis-peru-proxy --project-ref kdsjojrrspzmufdumywd
```

Las EFs incluyen `config.toml` con `verify_jwt = false`. No requiere flags adicionales.

## 6. Verificar secretos en Supabase

```bash
supabase secrets list
```

| Secret | Obligatorio | Propósito |
|--------|-------------|-----------|
| `SUPABASE_URL` | ✅ | URL del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Bypass RLS para operaciones admin |
| `SUNAT_CREDENTIALS_KEY` | ✅ | Clave AES-256-GCM para credenciales SOL (32 bytes) |
| `APIS_PERU_TOKEN` | ⚠️ | Token apisperu.com (RUC/DNI lookup) |
| `SUPABASE_ANON_KEY` | ✅ | API key pública |

## 7. Configurar SUNAT

1. Login en `http://localhost:8551/login`
2. Ir a `/admin/sunat-config`
3. Completar: RUC `20608183672`, razón social, usuario SOL, clave SOL
4. Subir certificado digital `.p12` o `.pem`
5. Test conexión → debe mostrar datos del certificado
6. Mantener "Modo Producción" desactivado para pruebas (beta SUNAT)
7. Para GRE: obtener `client_id`/`client_secret` en SUNAT Menú SOL (pendiente)

## 8. Certificados en Storage

Desde `/admin/sunat-config` → Upload certificado, o manualmente:
```bash
# Bucket: sunat-documents
# Paths:
#   {orgId}/certificates/private_key.pem
#   {orgId}/certificates/certificate.pem
```

## 9. Build producción

```bash
pnpm build          # Admin → dist/
pnpm build:store    # Tienda → dist-store/
```

Verificar:
```bash
npx tsc --noEmit   # 0 errores
npx vitest run     # 73/73 tests
```

## 10. Deploy

### Frontend estático
Servir `dist/` (admin) y `dist-store/` (tienda) con nginx.

### Docker
```bash
docker compose up -d              # Producción (puerto 8551)
docker compose -f docker-compose.dev.yml up -d  # Desarrollo
```

### Tauri Desktop
```bash
# Build + GitHub Release vía Actions
# .github/workflows/release.yml
```

## 11. Checklist post-deploy

- [ ] `pnpm dev` arranca sin errores en `http://localhost:8551`
- [ ] Login funciona con `yescobar@katsumoto.shop` / `1234abcd`
- [ ] Dashboard carga KPIs, gráficos, SUNAT widget
- [ ] POS: productos visibles, navegables, filtrables
- [ ] POS: abrir caja con monto inicial
- [ ] Facturación: crear factura, enviar a SUNAT (beta)
- [ ] SUNAT test conexión: firma digital OK
- [ ] Tienda web (`/`): catálogo visible, carrito funcional
- [ ] 0 errores en consola del navegador

## Troubleshooting

| Error | Solución |
|-------|----------|
| Login falla "Credenciales inválidas" | Verificar email/contraseña. Ejecutar `scripts/init.mjs` con SR_KEY. |
| "Perfil no encontrado" | Insertar perfil manualmente en `profiles`. |
| Dashboard crashea "Rendered more hooks" | Reglas de React violadas. Revisar hooks antes de early returns. |
| SUNAT "NO_CONFIG" | Ir a `/admin/sunat-config` y completar datos. |
| SUNAT "CERT_MISSING_STORAGE" | Subir certificado en `/admin/sunat-config`. |
| POS "Sin caja abierta" | Abrir caja desde el mismo POS. |
| Productos no visibles en tienda | Verificar `is_active = true` y stock en `branch_stock`. |
| Edge Function 401 | Verificar `config.toml` con `verify_jwt = false`. Re-deploy. |
| "Invalid API key" en init.mjs | Usar la service_role key correcta del proyecto. |

## Credenciales por defecto

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| `yescobar@katsumoto.shop` | `1234abcd` | owner (superadmin) |
| `juan.zapata@datacodev.com` | `mamaguevo` | admin |

---

*Para cambiar credenciales: modificar `USERS` en `scripts/init.mjs` y re-ejecutar.*

## Despliegue en Cloudflare Pages

Katsumoto es una **SPA única** — tienda + admin comparten el mismo build `dist/`.
El build `dist-store/` es opcional (tienda ligera sin admin para otro dominio).

### Build

```bash
pnpm build          # dist/ contiene TODO: tienda + admin + login
pnpm build:store    # opcional — tienda sin admin para dominio separado
```

### Subir (1 solo proyecto)

1. Ir a Cloudflare Dashboard → Workers & Pages → Create
2. Arrastrar carpeta `dist/`
3. Deploy

O por CLI:
```bash
npx wrangler pages deploy dist/ --project-name=katsumoto
```

### Archivos incluidos

| Archivo | Propósito |
|---------|-----------|
| `public/_redirects` | `/* → /index.html 200` — SPA routing |
| `public/_headers` | CSP + security headers (Supabase, apisperu) |

### Rutas resultantes
- `/` → Tienda pública
- `/carrito`, `/checkout` → Tienda
- `/login` → Login
- `/admin`, `/admin/*` → Sistema interno (protegido)
