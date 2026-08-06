-- ============================================================
-- Fix: CHECK de profiles solo permitia owner/admin/user
--
-- La aplicacion usa 6 roles (src/lib/types/common.ts UserRole):
--   owner, admin, cashier, vendedor, inventory, reader
-- El CHECK original solo aceptaba owner/admin/user, por lo que
-- asignar roles de cajero/vendedor/inventario/lector fallaba con
-- CHECK violation (fallo silencioso en la UI de Usuarios).
-- ============================================================

ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'cashier'::text, 'vendedor'::text, 'inventory'::text, 'reader'::text]));
