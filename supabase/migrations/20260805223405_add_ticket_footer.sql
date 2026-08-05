-- ============================================================
-- Footer configurable del ticket termico
--
-- Texto libre (politica de garantia, redes sociales, mensajes)
-- que se imprime al pie del ticket si esta configurado.
-- Se almacena en sunat_config (tabla de configuracion del negocio).
-- ============================================================

ALTER TABLE public.sunat_config ADD COLUMN IF NOT EXISTS ticket_footer text;
