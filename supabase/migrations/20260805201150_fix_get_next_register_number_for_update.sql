-- ============================================================
-- Fix: get_next_register_number lanzaba error en PostgreSQL 15
--
-- Bug (verificado en produccion):
--   SELECT COALESCE(MAX(number),0)+1 ... FOR UPDATE
--   => "FOR UPDATE is not allowed with aggregate functions"
--   => abrir una caja registradora fallaba siempre en la UI.
--
-- Correccion:
--   1. Lock a nivel de fila (SELECT ... ORDER BY number DESC LIMIT 1
--      FOR UPDATE) para serializar la apertura concurrente.
--   2. Calcular MAX() sin FOR UPDATE sobre el agregado.
--   3. UNIQUE (organization_id, branch_id, number) como defensa: si dos
--      aperturas simultaneas obtienen el mismo numero, la segunda falla
--      con duplicate key en vez de crear dos cajas con el mismo numero.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_next_register_number(p_branch_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    next_num INTEGER;
    lock_id UUID;
BEGIN
    SELECT id INTO lock_id
    FROM public.cash_registers
    WHERE branch_id = p_branch_id
    ORDER BY number DESC
    LIMIT 1
    FOR UPDATE;

    SELECT COALESCE(MAX(number), 0) + 1 INTO next_num
    FROM public.cash_registers
    WHERE branch_id = p_branch_id;

    RETURN next_num;
END;
$$;

ALTER TABLE public.cash_registers
    ADD CONSTRAINT cash_registers_org_branch_number_key UNIQUE (organization_id, branch_id, number);
