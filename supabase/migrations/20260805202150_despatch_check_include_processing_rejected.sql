-- ============================================================
-- Fix: CHECK de despatches no permitia processing/rejected
--
-- La EF sunat-billing escribe status='processing' (tras obtener el
-- ticket REST) y 'rejected' (si el envio falla). El CHECK original
-- solo permitia draft/issued/accepted/cancelled, por lo que el UPDATE
-- lanzaba un CHECK violation y el ciclo de vida de la guia quedaba roto.
-- ============================================================

ALTER TABLE public.despatches DROP CONSTRAINT despatches_status_check;

ALTER TABLE public.despatches
    ADD CONSTRAINT despatches_status_check
    CHECK (status = ANY (ARRAY['draft'::text, 'issued'::text, 'processing'::text, 'accepted'::text, 'rejected'::text, 'cancelled'::text]));
