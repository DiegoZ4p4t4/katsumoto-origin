-- ============================================================
-- Fix: Nota de credito duplicaba el IGV
--
-- Bug (verificado en produccion):
--   v_gravada_cents += line_total   (bruto, debia ser line_total - igv)
--   v_total_cents  := subtotal + igv (subtotal ya incluye IGV)
--   => ítem de S/118 producia gravada=118, total=136 (debia ser 100/118)
--
-- Correccion:
--   v_gravada_cents += (line_total - igv)   => base imponible neta
--   v_total_cents   := subtotal             => subtotal (bruto) ya es el total
--
-- Nota: se mantiene el modelo price-inclusive (line_total = precio con IGV,
-- igv extraido con factor r/(1+r)), consistente con create_invoice_with_items
-- y con el transformer SUNAT (mto_valor_venta = line_total - igv).
-- ============================================================

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
SET search_path TO 'public'
AS $$
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
    SELECT * INTO v_parent
    FROM invoices
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

    v_correlativo := get_next_correlativo(p_organization_id, v_serie);
    v_number := v_serie || '-' || LPAD(v_correlativo::TEXT, 6, '0');

    INSERT INTO invoices (
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
        INSERT INTO invoice_items (
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
            INSERT INTO branch_stock (branch_id, product_id, stock, min_stock)
            VALUES (p_branch_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INTEGER, 0)
            ON CONFLICT (branch_id, product_id)
            DO UPDATE SET stock = branch_stock.stock + (v_item->>'quantity')::INTEGER;

            INSERT INTO stock_movements (
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

    INSERT INTO audit_log (organization_id, user_id, action, entity, entity_id, new_value)
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
$$;
