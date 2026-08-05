-- ============================================================
-- CLEANUP + SEED — Katsumoto v2 (Schema-verified)
-- ============================================================

BEGIN;

-- Orden respeta FKs: hijos antes que padres
DELETE FROM public.register_transactions;
DELETE FROM public.sunat_summary_log;
DELETE FROM public.audit_log;
DELETE FROM public.store_order_items;
DELETE FROM public.store_orders;
DELETE FROM public.stock_movements;
DELETE FROM public.invoice_items;
DELETE FROM public.invoices;
DELETE FROM public.cash_registers;
DELETE FROM public.branch_stock;
DELETE FROM public.price_tiers;
DELETE FROM public.despatch_items;
DELETE FROM public.despatches;
DELETE FROM public.product_machines;
DELETE FROM public.customers;
DELETE FROM public.products;

-- ============================================================
-- SEED
-- ============================================================

DO $$
DECLARE
    v_org_id UUID := '7e80b22f-b06a-4025-937a-5f9d62d78733';
    v_user_id UUID := '7a900ed7-3939-46aa-bdb2-2e8e3be5621a';
    v_branch_store UUID;
    v_cust_ruc UUID;
    v_cust_cf UUID;
    v_prod1 UUID;
    v_prod2 UUID;
    v_prod3 UUID;
    v_prod4 UUID;
    v_prod5 UUID;
    v_register_id UUID;
BEGIN

    -- ── Sucursal para POS (usar la que ya existe) ──
    SELECT id INTO v_branch_store FROM public.branches
    WHERE organization_id = v_org_id AND type != 'warehouse' AND is_active = true
    LIMIT 1;

    IF v_branch_store IS NULL THEN
        INSERT INTO public.branches (organization_id, name, code, type, department_code, province_code, is_active, is_default, invoice_serie_prefix)
        VALUES (v_org_id, 'Pichanaqui', 'PICH-01', 'store', '12', '1206', true, true, 'F001')
        RETURNING id INTO v_branch_store;
    END IF;

    -- ── Cliente con RUC ──
    INSERT INTO public.customers (organization_id, name, document_type, document_number, address, phone)
    VALUES (v_org_id, 'TRANSPORTES ANDINOS S.A.C.', 'RUC', '20552123456', 'Av. Los Olivos 456', '064-123456')
    ON CONFLICT (organization_id, document_type, document_number) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_cust_ruc;

    -- ── Consumidor Final (para boletas, necesita UUID real) ──
    INSERT INTO public.customers (organization_id, name, document_type, document_number, address)
    VALUES (v_org_id, 'Consumidor Final', 'DNI', '00000000', '-')
    ON CONFLICT (organization_id, document_type, document_number) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_cust_cf;

    -- ── 5 productos ──
    INSERT INTO public.products (organization_id, name, sku, product_family, category_group, category, unit, price_cents, cost_cents, tax_affectation, min_stock, max_stock)
    VALUES (v_org_id, 'Aceite 2T Castrol 500ml', 'ACEI-001', 'productos', 'repuestos', 'Cadena', 'Unidad', 2500, 1800, 'gravado', 5, 200)
    RETURNING id INTO v_prod1;

    INSERT INTO public.products (organization_id, name, sku, product_family, category_group, category, unit, price_cents, cost_cents, tax_affectation, min_stock, max_stock)
    VALUES (v_org_id, 'Filtro de aire Stihl FS-250', 'FILT-001', 'productos', 'repuestos', 'Filtro de Aire', 'Unidad', 3500, 2500, 'gravado', 5, 200)
    RETURNING id INTO v_prod2;

    INSERT INTO public.products (organization_id, name, sku, product_family, category_group, category, unit, price_cents, cost_cents, tax_affectation, min_stock, max_stock)
    VALUES (v_org_id, 'Bujia NGK BPMR7A', 'BUJI-001', 'productos', 'repuestos', 'Bujía', 'Unidad', 1500, 1000, 'gravado', 5, 200)
    RETURNING id INTO v_prod3;

    INSERT INTO public.products (organization_id, name, sku, product_family, category_group, category, unit, price_cents, cost_cents, tax_affectation, min_stock, max_stock)
    VALUES (v_org_id, 'Cadena 3/8 72 eslabones Oregon', 'CADE-001', 'productos', 'repuestos', 'Cadena', 'Unidad', 12000, 8500, 'gravado', 2, 100)
    RETURNING id INTO v_prod4;

    INSERT INTO public.products (organization_id, name, sku, product_family, category_group, category, unit, price_cents, cost_cents, tax_affectation, min_stock, max_stock)
    VALUES (v_org_id, 'Servicio de Mantenimiento', 'SERV-001', 'servicios', 'maintenance', 'Bujía', 'Unidad', 8000, 0, 'gravado', 0, 999)
    RETURNING id INTO v_prod5;

    -- ── Stock ──
    INSERT INTO public.branch_stock (branch_id, product_id, stock, min_stock)
    VALUES 
        (v_branch_store, v_prod1, 50, 5),
        (v_branch_store, v_prod2, 50, 5),
        (v_branch_store, v_prod3, 50, 5),
        (v_branch_store, v_prod4, 50, 2),
        (v_branch_store, v_prod5, 999, 0)
    ON CONFLICT (branch_id, product_id) DO UPDATE SET stock = EXCLUDED.stock, min_stock = EXCLUDED.min_stock;

    -- ── Caja abierta ──
    INSERT INTO public.cash_registers (organization_id, branch_id, number, status, opened_by, opening_amount_cents)
    VALUES (v_org_id, v_branch_store, 1, 'open', v_user_id, 50000)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_register_id;

    RAISE NOTICE '✅ OK — sucursal: %, RUC: %, CF: %, productos:5, stock:OK, caja:abierta', v_branch_store, v_cust_ruc, v_cust_cf;
END;
$$;

COMMIT;
