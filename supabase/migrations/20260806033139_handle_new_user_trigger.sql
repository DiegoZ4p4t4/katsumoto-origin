-- ============================================================
-- Trigger handle_new_user: crea el perfil al registrar un usuario
--
-- Bug (verificado): inviteUser hacía signUp del auth user pero el
-- perfil en profiles NO se creaba automaticamente (no existia trigger),
-- por lo que el usuario invitado nunca podia iniciar sesion
-- (fetchProfile -> null -> signOut).
--
-- El flujo de invitacion pasa organization_id y role en user_metadata,
-- por lo que el trigger los lee de raw_user_meta_data. Si no hay org,
-- el perfil se crea inactivo (no puede loguear hasta ser asignado).
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, organization_id, role, is_active)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', new.email),
        NULLIF(new.raw_user_meta_data->>'organization_id', '')::uuid,
        COALESCE(new.raw_user_meta_data->>'role', 'cashier'),
        (new.raw_user_meta_data->>'organization_id' IS NOT NULL)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
