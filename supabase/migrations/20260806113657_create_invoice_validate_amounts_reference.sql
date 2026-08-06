-- ============================================================
-- Integridad fiscal: create_invoice_with_items valida montos
-- y soporta reference_invoice_id (notas de debito).
--
-- Motivo: el RPC confiaba ciegamente en los montos del cliente
-- (p_subtotal_cents, p_igv_cents, etc.). Un bug del frontend
-- podia persistir comprobantes con totales arbitrarios
-- (ej: Nota de Debito que emitia la linea completa + incremento).
-- Ahora el servidor verifica la aritmetica item por item.
-- ============================================================

-- La firma vieja (sin reference_invoice_id) queda obsoleta: se elimina
-- para que toda llamada pase por la validacion de montos.
DROP FUNCTION IF EXISTS public.create_invoice_with_items(
    uuid, text, integer, text, text, uuid,
    bigint, bigint, bigint, bigint, bigint, numeric,
    bigint, bigint, text, uuid, text, uuid, jsonb
);

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
    p_reference_invoice_id uuid,
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
    v_calc_subtotal BIGINT := 0;
    v_calc_igv BIGINT := 0;
    v_calc_gravada BIGINT := 0;
    v_calc_exonerada BIGINT := 0;
    v_calc_inafecta BIGINT := 0;
    v_calc_exportacion BIGINT := 0;
    v_aff TEXT;
    v_line BIGINT;
    v_igv BIGINT;
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

    IF p_reference_invoice_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.invoices
        WHERE id = p_reference_invoice_id AND organization_id = p_organization_id
    ) THEN
        RAISE EXCEPTION 'Comprobante referenciado no pertenece a la organizacion';
    END IF;

    -- Validacion de montos: la aritmetica la decide el servidor
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_line := (v_item->>'line_total_cents')::BIGINT;
        v_igv := COALESCE((v_item->>'igv_cents')::BIGINT, 0);
        v_aff := COALESCE(v_item->>'tax_affectation', 'gravado');
        v_calc_subtotal := v_calc_subtotal + v_line;
        v_calc_igv := v_calc_igv + v_igv;
        IF v_aff = 'gravado' THEN
            v_calc_gravada := v_calc_gravada + (v_line - v_igv);
        ELSIF v_aff = 'exonerado' THEN
            v_calc_exonerada := v_calc_exonerada + v_line;
        ELSIF v_aff = 'exportacion' THEN
            v_calc_exportacion := v_calc_exportacion + v_line;
        ELSE
            v_calc_inafecta := v_calc_inafecta + v_line;
        END IF;
    END LOOP;

    IF v_calc_subtotal <> p_subtotal_cents
       OR v_calc_igv <> p_igv_cents
       OR v_calc_gravada <> p_gravada_cents
       OR v_calc_exonerada <> p_exonerada_cents
       OR v_calc_inafecta <> p_inafecta_cents
       OR v_calc_exportacion <> p_exportacion_cents
       OR p_total_cents <> p_subtotal_cents
    THEN
        RAISE EXCEPTION 'Montos del comprobante inconsistentes con los items';
    END IF;

    v_number := p_serie || '-' || LPAD(p_correlativo::text, 6, '0');

    INSERT INTO public.invoices (
        organization_id, number, serie, correlativo, invoice_type,
        customer_id, branch_id, status,
        subtotal_cents, gravada_cents, exonerada_cents, inafecta_cents,
        exportacion_cents, igv_rate, igv_cents, total_cents,
        payment_method, register_id, notes, created_by, reference_invoice_id
    ) VALUES (
        p_organization_id, v_number, p_serie, p_correlativo, p_invoice_type,
        p_customer_id::uuid, p_branch_id, 'issued',
        p_subtotal_cents, p_gravada_cents, p_exonerada_cents, p_inafecta_cents,
        p_exportacion_cents, p_igv_rate, p_igv_cents, p_total_cents,
        p_payment_method, p_register_id, p_notes, p_created_by, p_reference_invoice_id
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
