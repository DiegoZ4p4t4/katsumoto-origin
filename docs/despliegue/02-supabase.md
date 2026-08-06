# 02 — Supabase: migraciones, Edge Functions y secrets

> Cómo gestionar el backend de Supabase. Verificado contra la CLI y el proyecto (2026-08-06).

## Proyecto

- **Project ref:** `kdsjojrrspzmufdumywd`
- **Región:** East US (North Virginia)
- **Acceso:** `supabase` CLI autenticado (el access token vive en la sesión del CLI).

```bash
supabase projects list                       # ver proyectos
supabase link --project-ref kdsjojrrspzmufdumywd
```

## Migraciones

Las migraciones viven en `supabase/migrations/` (formato `YYYYMMDDHHMMSS_nombre.sql`).

**Crear una migración nueva:**
```bash
supabase migration new <nombre_descripcion>
```

**Aplicarla a la BD viva:**
```bash
supabase db query --linked --file supabase/migrations/<archivo>.sql
# o en una transacción de prueba:
supabase db query --linked "BEGIN; ...; ROLLBACK;"
```

> ⚠️ Aplicar con `db query --file` **no** registra la migración en el historial. Para marcarla como aplicada:
> ```bash
> supabase migration repair --status applied <timestamp>
> ```

**Ver estado:**
```bash
supabase migration list --linked
```

## Deploy de Edge Functions

```bash
npx supabase functions deploy sunat-billing --project-ref kdsjojrrspzmufdumywd
npx supabase functions deploy sunat-credentials --project-ref kdsjojrrspzmufdumywd
npx supabase functions deploy apis-peru-proxy --project-ref kdsjojrrspzmufdumywd
```

- Cada función tiene `config.toml` con `verify_jwt = false` (la validación JWT es interna).
- Verificar que el deploy quedó bien:
  ```bash
  npx supabase functions list --project-ref kdsjojrrspzmufdumywd
  curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS "https://kdsjojrrspzmufdumywd.supabase.co/functions/v1/sunat-credentials" -H "Origin: http://localhost:8551"
  # 200 = OK. 500 = la función falla al cargar (p. ej. secret faltante).
  ```

## Secrets

```bash
npx supabase secrets list --project-ref kdsjojrrspzmufdumywd
npx supabase secrets set NOMBRE="valor" --project-ref kdsjojrrspzmufdumywd
```

Ver inventario completo en `operativa/01-secrets.md`.

**Regla crítica:** si una EF hace `throw` a nivel de módulo por un secret faltante (como `sunat-credentials` con `SUNAT_CREDENTIALS_KEY`), **toda request devuelve 500**, incluido el preflight CORS. Ante un 500 de una EF, revisa primero los secrets.

## Sanidad rápida de la BD

```bash
# RLS y tablas
supabase db query --linked "SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY relname;"
# Políticas anon peligrosas (USING true)
supabase db query --linked "SELECT polrelid::regclass, polname FROM pg_policy WHERE pg_get_expr(polqual, polrelid) = 'true';"
# Permisos de las RPC
supabase db query --linked "SELECT proname, proacl FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosecdef;"
```
