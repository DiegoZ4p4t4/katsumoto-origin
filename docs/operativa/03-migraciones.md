# 03 — Workflow de migraciones

> Cómo hacer cambios de esquema de forma segura y versionada.

## Reglas

1. **Toda** migración va en `supabase/migrations/` con nombre `YYYYMMDDHHMMSS_descripcion.sql` (se genera con `supabase migration new <descripcion>`).
2. Antes de aplicar a la BD viva, **probar en una transacción con ROLLBACK** cuando sea posible (funciones que no escriben, consultas).
3. Aplicar con `supabase db query --linked --file <archivo>`.
4. Registrar la migración como aplicada en el historial:
   ```bash
   supabase migration repair --status applied <timestamp>
   ```
5. Si la migración es idempotente, se puede re-aplicar sin romper nada.

## Flujo recomendado

```bash
# 1. Crear
supabase migration new fix_algo

# 2. Escribir el SQL en supabase/migrations/<archivo>.sql

# 3. Probar (si aplica) en transacción
supabase db query --linked "
BEGIN;
<sql de la migracion o una prueba>
ROLLBACK;"

# 4. Aplicar
supabase db query --linked --file supabase/migrations/<archivo>.sql

# 5. Verificar
supabase db query --linked "<select de verificacion>"

# 6. Registrar en el historial
supabase migration repair --status applied <timestamp>

# 7. Commit
git add supabase/migrations/<archivo>.sql && git commit
```

## Cambios de RPC/funciones

- Se escriben como `CREATE OR REPLACE FUNCTION` en la migración.
- Las RPC de escritura deben mantener: `SECURITY DEFINER`, `SET search_path TO ''`, referencias `public.*`, validación de org del creador, y **no** otorgar EXECUTE a `anon`/PUBLIC (se revoca/otorga en la misma migración si hace falta).

## Cambios de RLS

- Agregar/eliminar políticas con `DROP POLICY IF EXISTS ...` / `CREATE POLICY ...`.
- Recordar: UPDATE requiere política SELECT; usar `TO authenticated` con predicado de pertenencia (nunca solo `TO authenticated` sin `USING`).
- Verificar con las consultas de sanidad de `despliegue/02-supabase.md`.

## Migraciones aplicadas en la sesión 2026-08-05/06

- `20260805200928_fix_credit_note_igv_double_count`
- `20260805201150_fix_get_next_register_number_for_update`
- `20260805201800_revoke_rpc_execute_anon_y_validar_org`
- `20260805202150_despatch_check_include_processing_rejected`
- `20260805221331_secure_store_order_rpc_y_rls`
- `20260805221633_fix_profiles_admin_policy`
- `20260805223405_add_ticket_footer`
- `20260806033139_handle_new_user_trigger`
- `20260806033301_fix_profiles_role_check`
- `20260806125053_protect_products_cost_cents`

Todas marcadas como aplicadas en el historial de la BD.
