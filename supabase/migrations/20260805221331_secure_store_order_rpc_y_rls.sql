-- ============================================================
-- Seguridad tienda publica: recalcular montos en servidor
--
-- Problema (verificado): storePublicService.createOrder insertaba los
-- montos calculados por el cliente (unitPrice/lineTotal/igv) sin
-- validacion server-side, y fulfill_store_order usa esos montos al
-- crear la factura. Un visitante podia pedir a S/0.01 y obtener una
-- factura valida por ese monto.
--
-- Solucion:
--   1. RPC SECURITY DEFINER create_store_order que recalcula unit_price
--      desde products.price_cents (con price_tiers por cantidad) y el
--      IGV en el servidor. La afectacion del item se deriva del producto
--      (con exoneracion por Ley Amazonia solo si la sede es selva).
--   2. Se revoca el INSERT/INSERT anon directo sobre store_orders y
--      store_order_items: la unica via de creacion es el RPC.
--   3. Se eliminan las lecturas anon USING(true) que filtraban datos
--      de pedidos/items de TODAS las organizaciones.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_store_order(
    p_order_number text,
    p_customer_name text,
    p_customer_phone text,
    p_customer_email text,
    p_customer_document_type text,
    p_customer_document_number text,
    p_branch_id uuid,
    p_shipping_address text,
    p_shipping_department_code text,
    p_shipping_province_code text,
    p_shipping_district_code text,
    p_notes text,
    p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_org_id uuid;
    v_branch_selva boolean;
    v_selva_law boolean := false;
    v_item jsonb;
    v_unit_price bigint;
    v_tier_price bigint;
    v_qty integer;
    v_line_total bigint;
    v_igv bigint;
    v_aff text;
    v_effective_aff text;
    v_subtotal bigint := 0;
    v_gravada bigint := 0;
    v_exonerada bigint := 0;
    v_inafecta bigint := 0;
    v_igv_total bigint := 0;
    v_order_id uuid;
BEGIN
    SELECT organization_id, is_selva_zone INTO v_org_id, v_branch_selva
    FROM public.branches
    WHERE id = p_branch_id AND is_active = true AND type = 'online';

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Sucursal online no encontrada';
    END IF;

    SELECT selva_law_enabled INTO v_selva_law
    FROM public.tax_configurations
    WHERE organization_id = v_org_id;

    INSERT INTO public.store_orders (
        organization_id, order_number, customer_name, customer_phone, customer_email,
        customer_document_type, customer_document_number, branch_id,
        shipping_address, shipping_department_code, shipping_province_code, shipping_district_code,
        status, notes
    ) VALUES (
        v_org_id, p_order_number, p_customer_name, p_customer_phone, p_customer_email,
        p_customer_document_type, p_customer_document_number, p_branch_id,
        p_shipping_address, p_shipping_department_code, p_shipping_province_code, p_shipping_district_code,
        'pending', p_notes
    ) RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := (v_item->>'quantity')::integer;
        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'Cantidad invalida para %', v_item->>'product_name';
        END IF;

        SELECT price_cents, tax_affectation INTO v_unit_price, v_aff
        FROM public.products
        WHERE id = (v_item->>'product_id')::uuid
          AND is_active = true
          AND organization_id = v_org_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Producto no disponible: %', v_item->>'product_name';
        END IF;

        IF v_unit_price IS NULL THEN
            RAISE EXCEPTION 'El producto % no tiene precio configurado', v_item->>'product_name';
        END IF;

        SELECT price_cents INTO v_tier_price
        FROM public.price_tiers
        WHERE product_id = (v_item->>'product_id')::uuid
          AND min_quantity <= v_qty
        ORDER BY min_quantity DESC
        LIMIT 1;

        IF FOUND THEN
            v_unit_price := v_tier_price;
        END IF;

        v_line_total := v_qty * v_unit_price;

        v_effective_aff := v_aff;
        IF v_effective_aff = 'gravado' AND v_selva_law AND v_branch_selva
           AND (v_item->>'tax_affectation') = 'exonerado' THEN
            v_effective_aff := 'exonerado';
        END IF;

        IF v_effective_aff = 'gravado' THEN
            v_igv := round(v_line_total * 0.18 / 1.18);
            v_gravada := v_gravada + (v_line_total - v_igv);
            v_igv_total := v_igv_total + v_igv;
        ELSIF v_effective_aff = 'exonerado' THEN
            v_igv := 0;
            v_exonerada := v_exonerada + v_line_total;
        ELSE
            v_igv := 0;
            v_inafecta := v_inafecta + v_line_total;
        END IF;

        v_subtotal := v_subtotal + v_line_total;

        INSERT INTO public.store_order_items (
            order_id, product_id, product_name, product_sku,
            quantity, unit_price_cents, line_total_cents, tax_affectation, igv_cents
        ) VALUES (
            v_order_id,
            (v_item->>'product_id')::uuid,
            v_item->>'product_name',
            v_item->>'product_sku',
            v_qty, v_unit_price, v_line_total, v_effective_aff, v_igv
        );
    END LOOP;

    IF v_subtotal = 0 THEN
        RAISE EXCEPTION 'El pedido no tiene items validos';
    END IF;

    UPDATE public.store_orders SET
        subtotal_cents = v_subtotal,
        gravada_cents = v_gravada,
        exonerada_cents = v_exonerada,
        inafecta_cents = v_inafecta,
        igv_cents = v_igv_total,
        total_cents = v_subtotal
    WHERE id = v_order_id;

    RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_store_order(
    text, text, text, text, text, text, uuid, text, text, text, text, text, jsonb
) TO anon, authenticated;

-- ------------------------------------------------------------
-- RLS: cerrar lecturas/escrituras anon directas sobre pedidos
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Public store read own order" ON public.store_orders;
DROP POLICY IF EXISTS "Public store insert orders" ON public.store_orders;

DROP POLICY IF EXISTS "Public store read order items" ON public.store_order_items;
DROP POLICY IF EXISTS "Public store insert order items" ON public.store_order_items;

DROP POLICY IF EXISTS "Public store read organizations" ON public.organizations;
