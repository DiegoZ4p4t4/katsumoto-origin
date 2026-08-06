-- ============================================================
-- Seguridad: restringir columnas de products que ve anon
--
-- La tienda publica (anon) necesita productos pero NO el costo de
-- compra. RLS es a nivel de fila (is_active=true), por lo que anon
-- podia leer cost_cents via la API directa. Se revoca SELECT de
-- anon sobre products y se re-otorga solo a las columnas publicas
-- que usa la tienda.
-- ============================================================

REVOKE SELECT ON public.products FROM anon;

GRANT SELECT (
    id,
    name,
    sku,
    description,
    price_cents,
    image_url,
    unit,
    category,
    category_group,
    product_family,
    tags,
    is_active,
    tax_affectation
) ON public.products TO anon;
