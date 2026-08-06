# 03 — Troubleshooting

> Problemas comunes y cómo diagnosticarlos. Verificado con casos reales resueltos en la revisión de 2026-08-06.

## 1. Edge Function responde 500 (WORKER_ERROR)

**Síntoma:** una EF devuelve `500` en toda request (incluso el preflight OPTIONS da 500).

**Causa más común:** un secret faltante que la función valida a nivel de módulo. Ej.: `sunat-credentials` hace `if (!SUNAT_CREDENTIALS_KEY) throw` → si el secret no está, TODO falla.

**Diagnóstico:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS "https://kdsjojrrspzmufdumywd.supabase.co/functions/v1/<nombre>" -H "Origin: http://localhost:8551"
npx supabase secrets list --project-ref kdsjojrrspzmufdumywd
```

**Fix:** configurar el secret y redesplegar (no hace falta redeploy, los secrets se propagan solos).

## 2. Error CORS en el navegador ("blocked by CORS policy")

**Síntoma:** la app web no puede llamar a una EF (el preflight falla).

**Causas:**
- La EF devuelve 500 (caso anterior) — el preflight "no pasa el access control check".
- El origen no está en `ALLOWED_ORIGINS` de la EF (local y dominio permitidos: `http://localhost:8551`, `https://katsumoto.shop`, `https://katsumoto-fact.pages.dev`, etc.).

**Fix:** si es 500 → resolver el secret. Si es origen → agregarlo a `ALLOWED_ORIGINS` de la EF y redesplegar.

## 3. Supabase REST devuelve 400 en un `select`

**Síntoma:** una consulta REST falla con 400 (por ejemplo, la tienda no carga productos).

**Causa:** el `select` incluye una **columna que no existe**. Ej. real: `select=...,stock` en `products` (la columna `stock` no existe; es un campo computado del hook).

**Fix:** quitar la columna inexistente del select. Verificar columnas reales:
```bash
supabase db query --linked "SELECT column_name FROM information_schema.columns WHERE table_name='products';"
```

## 4. Página que crashea en runtime (blanco / ErrorBoundary)

**Causas comunes:**
- Hooks llamados después de un early return (`CashRegisters`, `MachineModels`). El lint con `react-hooks/rules-of-hooks` lo detecta.
- Componente que lee un campo `undefined` (ej. `ProductImage` con `name` undefined por un producto mínimo `{id}` del carrito en localStorage).

**Diagnóstico:** consola del navegador (el ErrorBoundary loguea `componentStack`). Verificar con `pnpm lint` (rules-of-hooks) y `pnpm typecheck`.

## 5. `pnpm build` falla

- El build ejecuta `tsc --noEmit` como gate: si hay errores de tipos, no compila.
- `pnpm lint` debe quedar en **0 errores** (los warnings de variables sin usar no bloquean).

## 6. La página Configuración SUNAT no carga / no guarda

- Verificar que `sunat-credentials` responda 200 (OPTIONS).
- Verificar que `SUNAT_CREDENTIALS_KEY` esté en los secrets.
- Verificar que `sunat_config` tenga `is_configured = true` y que la `clave_sol` esté encriptada (no vacía).

## 7. Envío a SUNAT falla

- Modo: `sunat_config.modo_produccion` (false = beta). Verificar que el endpoint sea el correcto.
- Factura: cliente con RUC válido, fecha ≤ 7 días, estado `issued`.
- Boleta: va por **resumen diario**, no por `send` (si se intenta `send` → `USE_SEND_SUMMARY`).
- Credenciales: `clave_sol` debe desencriptarse (revisar la clave SUNAT).

## 8. No se ven los datos de la tienda

- Verificar RLS anon en `products` y el GRANT de columnas (anon debe poder leer las columnas públicas).
- Verificar que la tienda use la sede `online` activa.

## 9. Cambios en la BD no se reflejan

- Las migraciones se aplican con `supabase db query --linked --file ...`; si no se registran, marcarlas con `migration repair --status applied` para mantener el historial consistente.
