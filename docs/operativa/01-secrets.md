# 01 — Secrets y respaldos

> Inventario de secretos del proyecto, qué usa cada parte y qué hay que respaldar. Verificado con `supabase secrets list` (2026-08-06).

## Secrets del proyecto Supabase (`supabase secrets list`)

| Secret | Lo usa | Obligatorio | Nota |
|---|---|---|---|
| `SUNAT_CREDENTIALS_KEY` | `sunat-credentials`, `sunat-billing` | **SÍ** | Clave maestra de cifrado de la `clave_sol`. **Si falta, `sunat-credentials` da 500.** Ver respaldo abajo. |
| `APIS_PERU_TOKEN` | `apis-peru-proxy` | **SÍ** (si se consultan RUC/DNI) | Token de apisperu.com |
| `SUPABASE_URL` | Las 3 EFs | **SÍ** | URL del proyecto |
| `SUPABASE_ANON_KEY` | Las 3 EFs (validación JWT) | **SÍ** | Publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | Las 3 EFs (acceso DB bypass RLS) | **SÍ** | **Secreto fuerte** |
| `SUPABASE_DB_URL` | (sin uso en código hoy) | No | Documentado en AGENTS pero sin referencias |
| `SUNAT_DIRECT_ENABLED` | (sin uso en código hoy) | No | Histórico |
| `SUPABASE_JWKS`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS` | Runtime Supabase | — | Generados por la plataforma |

## 🔑 CRÍTICO — respaldo de `SUNAT_CREDENTIALS_KEY`

- **Regenerada el 2026-08-06** (la anterior se perdió y rompió `sunat-credentials`).
- El valor está en el **gestor de contraseñas del administrador** y, temporalmente, en `/tmp/katsumoto-enc-key.txt` de la máquina de desarrollo.
- **Si se pierde:** hay que regenerarla y **reingresar la `clave_sol`** en Configuración SUNAT (lo que estaba encriptado con la llave vieja no se puede leer).

## Credenciales del negocio (en `sunat_config`)

| Dato | Estado | Nota |
|---|---|---|
| `ruc` | `20608183672` | - |
| `razon_social` | SERVICIOS GENERALES UNITED E.I.R.L. | - |
| `usuario_sol` | `UNITED10` | Texto plano |
| `clave_sol` | **Encriptada** | No se puede leer; se reingresa si cambia la clave maestra |
| `certificado_password` | No se usa | El certificado es PEM, se lee sin contraseña |
| `gre_client_id` / `gre_client_secret` | Almacenados | Para GRE (OAuth2) — **pendiente regenerar en SUNAT** |
| Certificado (PEMs) | En Storage `sunat-documents/{orgId}/certificates/` | `private_key.pem` + `certificate.pem` |

## Variables de entorno del build (`.env`, no versionado)

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...   # publishable
VITE_ORG_ID=7e80b22f-b06a-4025-937a-5f9d62d78733
DATABASE_URL=prisma+postgres...   # local de Prisma, solo dev
```

`.env` está en `.gitignore`. `.env.example` documenta las variables públicas.

## GitHub Actions (secrets del repo, para releases Tauri — actualmente depriorizado)

`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — solo si se retoma el desktop app.

## Recomendaciones de respaldo

1. `SUNAT_CREDENTIALS_KEY` en un gestor de contraseñas (mínimo).
2. Backup de la BD Supabase (exportaciones o backups automáticos de la plataforma).
3. Las credenciales SOL/certificado en el gestor de contraseñas de la empresa.
4. Los PEMs del certificado digital (copia fuera de Storage).
