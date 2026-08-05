-- ============================================================
-- Fix: politica admin de profiles dependia de otra aplicacion
--
-- La politica "Admin full access profiles" usaba current_user_role(),
-- que lee el rol de la tabla katsumoto_usuarios (perteneciente a otra
-- aplicacion que comparte el proyecto). Los administradores reales de
-- Katsumoto (yescobar@katsumoto.shop owner, juan.zapata@datacodev.com
-- admin) estan en profiles pero NO en katsumoto_usuarios, por lo que
-- current_user_role() devolvia NULL y la gestion de usuarios desde la
-- UI quedaba vacia.
--
-- Solucion: funcion SECURITY DEFINER is_owner_or_admin() que lee el rol
-- de profiles (consistente con el resto de politicas del sistema) y se
-- reemplaza la politica. No se tocan las tablas de la otra aplicacion.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_owner_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = (select auth.uid())
          AND role IN ('owner', 'admin')
    );
$$;

DROP POLICY IF EXISTS "Admin full access profiles" ON public.profiles;

CREATE POLICY "Admin full access profiles" ON public.profiles
    FOR ALL
    TO authenticated
    USING (public.is_owner_or_admin())
    WITH CHECK (public.is_owner_or_admin());
