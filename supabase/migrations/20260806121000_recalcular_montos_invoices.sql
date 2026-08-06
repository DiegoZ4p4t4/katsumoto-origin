-- ============================================================
-- Backfill fiscal: recalcular montos de todos los comprobantes
-- desde sus items (modelo vigente: line_total BRUTO, total = subtotal).
--
-- 1) Filas modelo VIEJO (total <> subtotal, pre-fix IGV): la linea se
--    almaceno NETA (line_total + igv = bruto). Se convierten las lineas
--    a bruto (unit_price = line_total + igv) sin tocar el IGV.
-- 2) Cabecera recalculada desde items para toda factura con items cuyo
--    almacenado difiera del calculo.
-- 3) Facturas sin items (resumenes diarios B001-1..3, aceptadas por
--    SUNAT) se dejan intactas: no hay datos para recalcular.
-- ============================================================

UPDATE public.invoice_items it
SET unit_price_cents = it.line_total_cents + it.igv_cents,
    line_total_cents = it.line_total_cents + it.igv_cents
FROM public.invoices i
WHERE i.id = it.invoice_id
  AND i.total_cents <> i.subtotal_cents
  AND it.igv_cents > 0;

WITH recalc AS (
    SELECT i.id,
           COALESCE(SUM(it.line_total_cents), 0) AS c_sub,
           COALESCE(SUM(it.igv_cents), 0) AS c_igv,
           COALESCE(SUM(CASE WHEN it.tax_affectation = 'gravado' THEN it.line_total_cents - it.igv_cents ELSE 0 END), 0) AS c_grav,
           COALESCE(SUM(CASE WHEN it.tax_affectation = 'exonerado' THEN it.line_total_cents ELSE 0 END), 0) AS c_exo,
           COALESCE(SUM(CASE WHEN it.tax_affectation = 'inafecto' THEN it.line_total_cents ELSE 0 END), 0) AS c_ina,
           COALESCE(SUM(CASE WHEN it.tax_affectation = 'exportacion' THEN it.line_total_cents ELSE 0 END), 0) AS c_exp
    FROM public.invoices i
    JOIN public.invoice_items it ON it.invoice_id = i.id
    GROUP BY i.id
)
UPDATE public.invoices i
SET subtotal_cents = r.c_sub,
    igv_cents = r.c_igv,
    gravada_cents = r.c_grav,
    exonerada_cents = r.c_exo,
    inafecta_cents = r.c_ina,
    exportacion_cents = r.c_exp,
    total_cents = r.c_sub
FROM recalc r
WHERE r.id = i.id
  AND (i.subtotal_cents <> r.c_sub OR i.igv_cents <> r.c_igv
       OR i.gravada_cents <> r.c_grav OR i.exonerada_cents <> r.c_exo
       OR i.inafecta_cents <> r.c_ina OR i.exportacion_cents <> r.c_exp
       OR i.total_cents <> r.c_sub);
