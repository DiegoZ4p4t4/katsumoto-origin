-- ============================================================
-- Seguridad: RPCs SECURITY DEFINER expuestas a roles no autorizados
--
-- 1. Todas las RPC de escritura tenian EXECUTE otorgado a PUBLIC y a
--    'anon' (verificado en pg_proc.proacl). Como son SECURITY DEFINER,
--    un atacante sin login podia invocar create_invoice_with_items,
--    adjust_stock, transfer_stock, etc. Se revoca de PUBLIC/anon y se
--    deja solo a 'authenticated' (y service_role por defecto).
--
-- 2. create_invoice_with_items / create_credit_note / adjust_stock /
--    transfer_stock aceptaban p_created_by sin validar que el usuario
--    pertenezca a la organizacion. Se agrega la validacion para evitar
--    operaciones cross-tenant (SECURITY DEFINER bypasea RLS).
--
-- Nota: se preserva la logica original de cada funcion al 100%
-- (return type, checks, movement_type, reference_type). Solo se
-- agrega la validacion de p_created_by y, en las funciones que usaban
-- search_path='public', se endurece a '' cualificando con public.*
-- ============================================================

-- ------------------------------------------------------------
-- create_invoice_with_items: validar que el creador sea de la org
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_invoice_with_items(
    p_organization_id uuid,
    p_serie text,
    p_correlativo integer,
    p_invoice_type text,
    p_customer_id text,
    p_branch_id uuid,
    p_subtotal_cents bigint,
    p_gravada_cents bigint,
    p_exonerada_cents bigint,
    p_inafecta_cents bigint,
    p_exportacion_cents bigint,
    p_igv_rate numeric,
    p_igv_cents bigint,
    p_total_cents bigint,
    p_payment_method text,
    p_register_id uuid,
    p_notes text,
    p_created_by uuid,
    p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_invoice_id UUID;
    v_number TEXT;
    v_item JSONB;
    v_product_org_id UUID;
BEGIN
    IF p_created_by IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_created_by AND organization_id = p_organization_id
    ) THEN
        RAISE EXCEPTION 'Usuario no pertenece a la organizacion';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.branches
        WHERE id = p_branch_id AND organization_id = p_organization_id AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Sede no pertenece a la organizacion';
    END IF;

    v_number := p_serie || '-' || LPAD(p_correlativo::text, 6, '0');

    INSERT INTO public.invoices (
        organization_id, number, serie, correlativo, invoice_type,
        customer_id, branch_id, status,
        subtotal_cents, gravada_cents, exonerada_cents, inafecta_cents,
        exportacion_cents, igv_rate, igv_cents, total_cents,
        payment_method, register_id, notes, created_by
    ) VALUES (
        p_organization_id, v_number, p_serie, p_correlativo, p_invoice_type,
        p_customer_id::uuid, p_branch_id, 'issued',
        p_subtotal_cents, p_gravada_cents, p_exonerada_cents, p_inafecta_cents,
        p_exportacion_cents, p_igv_rate, p_igv_cents, p_total_cents,
        p_payment_method, p_register_id, p_notes, p_created_by
    ) RETURNING id INTO v_invoice_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.invoice_items (
            invoice_id, product_id, product_name, product_sku,
            quantity, unit_price_cents, discount_percent,
            discount_cents, line_total_cents, tax_affectation, igv_cents
        ) VALUES (
            v_invoice_id,
            (v_item->>'product_id')::UUID,
            v_item->>'product_name',
            v_item->>'product_sku',
            (v_item->>'quantity')::INTEGER,
            (v_item->>'unit_price_cents')::BIGINT,
            COALESCE((v_item->>'discount_percent')::NUMERIC, 0),
            COALESCE((v_item->>'discount_cents')::BIGINT, 0),
            (v_item->>'line_total_cents')::BIGINT,
            COALESCE(v_item->>'tax_affectation', 'gravado'),
            COALESCE((v_item->>'igv_cents')::BIGINT, 0)
        );

        IF (v_item->>'product_id') IS NOT NULL THEN
            SELECT organization_id INTO v_product_org_id
            FROM public.products
            WHERE id = (v_item->>'product_id')::UUID;

            IF v_product_org_id IS NULL THEN
                RAISE EXCEPTION 'Producto no encontrado: %', (v_item->>'product_name');
            END IF;

            IF v_product_org_id != p_organization_id THEN
                RAISE EXCEPTION 'Producto no pertenece a la organizacion: %', (v_item->>'product_name');
            END IF;

            UPDATE public.branch_stock
            SET stock = stock - (v_item->>'quantity')::INTEGER
            WHERE branch_id = p_branch_id
              AND product_id = (v_item->>'product_id')::UUID
              AND stock >= (v_item->>'quantity')::INTEGER;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Stock insuficiente para: %', (v_item->>'product_name');
            END IF;

            INSERT INTO public.stock_movements (
                organization_id, product_id, branch_id, movement_type,
                quantity, reference_type, reference_id, created_by
            ) VALUES (
                p_organization_id,
                (v_item->>'product_id')::UUID,
                p_branch_id,
                'out',
                (v_item->>'quantity')::INTEGER,
                'invoice',
                v_invoice_id,
                p_created_by
            );
        END IF;
    END LOOP;

    RETURN v_invoice_id;
END;
$function$;

-- ------------------------------------------------------------
-- create_credit_note: validar que el creador sea de la org
-- (logica de IGV ya corregida en migracion
--  20260805200928_fix_credit_note_igv_double_count)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_credit_note(
    p_organization_id uuid,
    p_parent_invoice_id uuid,
    p_items jsonb,
    p_motivo_nota text,
    p_descripcion_motivo text,
    p_branch_id uuid,
    p_created_by uuid,
    p_notes text DEFAULT NULL::text
)
RETURNS TABLE(invoice_id uuid, serie text, correlativo integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_invoice_id UUID;
    v_parent RECORD;
    v_serie TEXT;
    v_correlativo INTEGER;
    v_number TEXT;
    v_item JSONB;
    v_subtotal_cents BIGINT := 0;
    v_gravada_cents BIGINT := 0;
    v_exonerada_cents BIGINT := 0;
    v_inafecta_cents BIGINT := 0;
    v_exportacion_cents BIGINT := 0;
    v_igv_cents BIGINT := 0;
    v_total_cents BIGINT := 0;
    v_item_line_total BIGINT;
    v_item_igv BIGINT;
    v_item_tax_aff TEXT;
BEGIN
    IF p_created_by IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_created_by AND organization_id = p_organization_id
    ) THEN
        RAISE EXCEPTION 'Usuario no pertenece a la organizacion';
    END IF;

    SELECT * INTO v_parent
    FROM public.invoices
    WHERE id = p_parent_invoice_id
      AND organization_id = p_organization_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Factura referenciada no encontrada';
    END IF;

    IF v_parent.status NOT IN ('accepted', 'paid') THEN
        RAISE EXCEPTION 'La factura debe estar aceptada o pagada para emitir una NC (estado actual: %)', v_parent.status;
    END IF;

    IF v_parent.invoice_type NOT IN ('factura', 'boleta') THEN
        RAISE EXCEPTION 'Solo se puede emitir NC de facturas o boletas (tipo actual: %)', v_parent.invoice_type;
    END IF;

    IF v_parent.invoice_type = 'factura' THEN
        v_serie := 'FC01';
    ELSE
        v_serie := 'BC01';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_line_total := COALESCE((v_item->>'line_total_cents')::BIGINT, 0);
        v_item_igv := COALESCE((v_item->>'igv_cents')::BIGINT, 0);
        v_item_tax_aff := COALESCE(v_item->>'tax_affectation', 'gravado');

        v_subtotal_cents := v_subtotal_cents + v_item_line_total;
        v_igv_cents := v_igv_cents + v_item_igv;

        IF v_item_tax_aff = 'gravado' THEN
            v_gravada_cents := v_gravada_cents + (v_item_line_total - v_item_igv);
        ELSIF v_item_tax_aff = 'exonerado' THEN
            v_exonerada_cents := v_exonerada_cents + v_item_line_total;
        ELSIF v_item_tax_aff = 'inafecto' THEN
            v_inafecta_cents := v_inafecta_cents + v_item_line_total;
        ELSIF v_item_tax_aff = 'exportacion' THEN
            v_exportacion_cents := v_exportacion_cents + v_item_line_total;
        END IF;
    END LOOP;

    v_total_cents := v_subtotal_cents;

    v_correlativo := public.get_next_correlativo(p_organization_id, v_serie);
    v_number := v_serie || '-' || LPAD(v_correlativo::TEXT, 6, '0');

    INSERT INTO public.invoices (
        organization_id, number, serie, correlativo, invoice_type,
        customer_id, branch_id, status,
        subtotal_cents, gravada_cents, exonerada_cents, inafecta_cents,
        exportacion_cents, igv_rate, igv_cents, total_cents,
        notes, created_by,
        reference_invoice_id, motivo_nota, descripcion_motivo
    ) VALUES (
        p_organization_id, v_number, v_serie, v_correlativo, 'nota_credito',
        v_parent.customer_id, p_branch_id, 'issued',
        v_subtotal_cents, v_gravada_cents, v_exonerada_cents, v_inafecta_cents,
        v_exportacion_cents, v_parent.igv_rate, v_igv_cents, v_total_cents,
        p_notes, p_created_by,
        p_parent_invoice_id, p_motivo_nota, p_descripcion_motivo
    ) RETURNING id INTO v_invoice_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.invoice_items (
            invoice_id, product_id, product_name, product_sku,
            quantity, unit_price_cents, discount_percent,
            discount_cents, line_total_cents, tax_affectation, igv_cents
        ) VALUES (
            v_invoice_id,
            COALESCE((v_item->>'product_id')::UUID, NULL),
            v_item->>'product_name',
            v_item->>'product_sku',
            (v_item->>'quantity')::INTEGER,
            (v_item->>'unit_price_cents')::BIGINT,
            COALESCE((v_item->>'discount_percent')::NUMERIC, 0),
            COALESCE((v_item->>'discount_cents')::BIGINT, 0),
            (v_item->>'line_total_cents')::BIGINT,
            COALESCE(v_item->>'tax_affectation', 'gravado'),
            COALESCE((v_item->>'igv_cents')::BIGINT, 0)
        );

        IF (v_item->>'product_id') IS NOT NULL THEN
            INSERT INTO public.branch_stock (branch_id, product_id, stock, min_stock)
            VALUES (p_branch_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INTEGER, 0)
            ON CONFLICT (branch_id, product_id)
            DO UPDATE SET stock = public.branch_stock.stock + (v_item->>'quantity')::INTEGER;

            INSERT INTO public.stock_movements (
                organization_id, product_id, branch_id, movement_type,
                quantity, reference_type, reference_id, notes, created_by
            ) VALUES (
                p_organization_id,
                (v_item->>'product_id')::UUID,
                p_branch_id,
                'return',
                (v_item->>'quantity')::INTEGER,
                'credit_note',
                v_invoice_id,
                'NC ' || v_number || ' - ' || p_descripcion_motivo,
                p_created_by
            );
        END IF;
    END LOOP;

    INSERT INTO public.audit_log (organization_id, user_id, action, entity, entity_id, new_value)
    VALUES (
        p_organization_id, p_created_by, 'credit_note.create', 'invoice', v_invoice_id::TEXT,
        jsonb_build_object(
            'serie', v_serie,
            'correlativo', v_correlativo,
            'parent_invoice', v_parent.number,
            'motivo', p_motivo_nota,
            'total_cents', v_total_cents
        )
    );

    RETURN QUERY SELECT v_invoice_id, v_serie, v_correlativo;
END;
$function$;

-- ------------------------------------------------------------
-- adjust_stock: validar creador de la org (logica original intacta)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_stock(
    p_organization_id uuid,
    p_product_id uuid,
    p_branch_id uuid,
    p_movement_type text,
    p_quantity integer,
    p_notes text,
    p_created_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_movement_id UUID;
BEGIN
    IF p_created_by IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_created_by AND organization_id = p_organization_id
    ) THEN
        RAISE EXCEPTION 'Usuario no pertenece a la organizacion';
    END IF;

    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'La cantidad debe ser mayor a 0';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.branches
        WHERE id = p_branch_id AND organization_id = p_organization_id
    ) THEN
        RAISE EXCEPTION 'Sede no pertenece a la organizacion';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.products
        WHERE id = p_product_id AND organization_id = p_organization_id AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Producto no pertenece a la organizacion';
    END IF;

    IF p_movement_type IN ('in', 'return') THEN
        INSERT INTO public.branch_stock (branch_id, product_id, stock, min_stock)
        VALUES (p_branch_id, p_product_id, p_quantity, 0)
        ON CONFLICT (branch_id, product_id)
        DO UPDATE SET stock = public.branch_stock.stock + p_quantity;
    ELSIF p_movement_type = 'out' THEN
        UPDATE public.branch_stock
        SET stock = stock - p_quantity
        WHERE branch_id = p_branch_id AND product_id = p_product_id AND stock >= p_quantity;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Stock insuficiente';
        END IF;
    ELSIF p_movement_type = 'adjustment' THEN
        INSERT INTO public.branch_stock (branch_id, product_id, stock, min_stock)
        VALUES (p_branch_id, p_product_id, p_quantity, 0)
        ON CONFLICT (branch_id, product_id)
        DO UPDATE SET stock = public.branch_stock.stock + p_quantity;
    END IF;

    INSERT INTO public.stock_movements (
        organization_id, product_id, branch_id, movement_type,
        quantity, reference_type, notes, created_by
    ) VALUES (
        p_organization_id, p_product_id, p_branch_id, p_movement_type,
        ABS(p_quantity), 'manual', p_notes, p_created_by
    ) RETURNING id INTO v_movement_id;

    RETURN v_movement_id;
END;
$$;

-- ------------------------------------------------------------
-- transfer_stock: validar creador de la org (logica original intacta)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_stock(
    p_organization_id uuid,
    p_product_id uuid,
    p_from_branch_id uuid,
    p_to_branch_id uuid,
    p_quantity integer,
    p_notes text,
    p_created_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_movement_id UUID;
BEGIN
    IF p_created_by IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_created_by AND organization_id = p_organization_id
    ) THEN
        RAISE EXCEPTION 'Usuario no pertenece a la organizacion';
    END IF;

    IF p_from_branch_id = p_to_branch_id THEN
        RAISE EXCEPTION 'Las sedes de origen y destino deben ser diferentes';
    END IF;

    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'La cantidad debe ser mayor a 0';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.branches
        WHERE id = p_from_branch_id AND organization_id = p_organization_id
    ) THEN
        RAISE EXCEPTION 'Sede de origen no pertenece a la organizacion';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.branches
        WHERE id = p_to_branch_id AND organization_id = p_organization_id
    ) THEN
        RAISE EXCEPTION 'Sede de destino no pertenece a la organizacion';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.products
        WHERE id = p_product_id AND organization_id = p_organization_id AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Producto no pertenece a la organizacion';
    END IF;

    UPDATE public.branch_stock
    SET stock = stock - p_quantity
    WHERE branch_id = p_from_branch_id
      AND product_id = p_product_id
      AND stock >= p_quantity;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock insuficiente en la sede de origen';
    END IF;

    INSERT INTO public.branch_stock (branch_id, product_id, stock, min_stock)
    VALUES (p_to_branch_id, p_product_id, p_quantity, 0)
    ON CONFLICT (branch_id, product_id)
    DO UPDATE SET stock = public.branch_stock.stock + p_quantity;

    INSERT INTO public.stock_movements (
        organization_id, product_id, branch_id, movement_type,
        quantity, reference_type, transfer_to_branch_id, notes, created_by
    ) VALUES (
        p_organization_id, p_product_id, p_from_branch_id, 'transfer_out',
        p_quantity, 'manual', p_to_branch_id, p_notes, p_created_by
    ) RETURNING id INTO v_movement_id;

    INSERT INTO public.stock_movements (
        organization_id, product_id, branch_id, movement_type,
        quantity, reference_type, transfer_to_branch_id, notes, created_by
    ) VALUES (
        p_organization_id, p_product_id, p_to_branch_id, 'transfer_in',
        p_quantity, 'manual', p_from_branch_id, p_notes, p_created_by
    );

    RETURN v_movement_id;
END;
$$;

-- ------------------------------------------------------------
-- Revocar EXECUTE a PUBLIC/anon y otorgar a authenticated
-- (se ejecuta al final para que aplique a las versiones finales)
-- ------------------------------------------------------------
DO $$
DECLARE
    f record;
BEGIN
    FOR f IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'create_invoice_with_items',
            'create_credit_note',
            'adjust_stock',
            'transfer_stock',
            'fulfill_store_order',
            'get_next_correlativo',
            'get_next_register_number',
            'insert_audit_entry'
          )
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
    END LOOP;
END $$;
