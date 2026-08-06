# 02 — Modelo fiscal SUNAT

> Cómo se calculan los impuestos y cómo se representan los documentos ante SUNAT. Verificado contra `src/lib/calculations.ts`, `src/lib/tax-engine.ts` y el transformer `sunat-billing/sunat/transformers.ts`.

## Modelo de precio con IGV incluido

El sistema trabaja con **precios que ya incluyen IGV** (el usuario ingresa el precio final de mostrador). El IGV se **extrae** de cada línea:

```
line_total_cents  = qty × unit_price_cents − discount_cents        (bruto, CON IGV)
igv_cents (ítem)  = round(line_total_cents × 0.18 / 1.18)          (solo gravado; 0 si tasa 0)
```

### Campos de la factura (cabecera)

| Campo | Contenido real |
|---|---|
| `line_total_cents` (ítem) | Importe bruto **con IGV** |
| `igv_cents` (ítem) | IGV extraído = `line_total × 0.18/1.18` |
| `gravada_cents` | **Base neta** (sin IGV) de líneas gravadas = `Σ(line_total − igv)` |
| `exonerada_cents` / `inafecta_cents` / `exportacion_cents` | Importe de líneas con tasa 0 (neto = bruto) |
| `subtotal_cents` | `Σ line_total` (bruto, con IGV) — **no es la base imponible** |
| `igv_cents` | `Σ igv` de ítems |
| `total_cents` | `= subtotal_cents` (total con IGV) |

> Nota de diseño: `subtotal_cents` guarda el total bruto (igual a `total_cents`), no la base neta. El XML de SUNAT usa `gravada_cents` (neta), por lo que el documento emitido es correcto; solo el etiquetado de "Subtotal/Base" en algunas vistas puede confundir.

### Afectaciones tributarias

| Afectación | Código SUNAT (TaxType) | Tasa |
|---|---|---|
| Gravado | 10 (IGV) | 18% |
| Exonerado | 20 (EXO) | 0% |
| Inafecto | 30 (INA) | 0% |
| Exportación | 40 (EXP) | 0% |

### Cómo se mapea al XML (UBL 2.1)

El transformer `transformInvoiceToSunat` produce:

```
mto_valor_venta  (por ítem) = (line_total_cents − igv_cents)/100   → base neta por línea
mto_base_igv     (por ítem) = mto_valor_venta
mto_valor_unitario          = (line_total/1.18/qty) con 6 decimales (consistente con qty>1)
mto_precio_unitario         = (valor_venta + igv)/qty con 6 decimales (precio con IGV)
mto_oper_gravadas           = gravada_cents/100
mto_oper_exoneradas/inafectas = exonerada/inafecta/100
mto_igv                     = igv_cents/100
mto_imp_venta               = total_cents/100
moneda                      = PEN
```

El precio unitario se mantiene con **6 decimales** para que `precio_unitario × cantidad ≈ valor_venta` (evita la observación 2017 de SUNAT).

## Ley de Amazonía (Ley 27037)

Una operación se emite **exonerada de IGV** si se cumplen todas:
1. `tax_configurations.selva_law_enabled = true`.
2. El **vendedor** está en zona de selva (`branches.is_selva_zone` o ubigeo de la sede).
3. El **destino** (envío/comprador) está en zona de selva.

En POS (presencial) el destino es la propia sede. En tienda web el destino es el ubigeo de envío. La exoneración tiene vigencia hasta **31/12/2028** (D.S. 059-2023-EF). El texto legal se imprime en el documento.

## Series y correlativos

| Serie | Documento | Asignación |
|---|---|---|
| `F001` | Factura | Prefijo de sede o default |
| `B001` | Boleta | Prefijo de sede o default |
| `FC01` / `BC01` | NC a factura / NC a boleta | RPC `create_credit_note` (según tipo del padre) |
| `FD01` | Nota de Débito | default |
| `T001` | Guía de Remisión | Formulario de despacho |
| `RC` / `RA` | Resumen diario / Comunicación de baja | correlativo por fecha (count+1 en la EF) |

El correlativo lo asigna la RPC `get_next_correlativo` (con lock). UNIQUE `(organization_id, serie, correlativo)`.

## Validaciones previas al envío (Edge Function `sunat-billing`)

- Estado debe ser `issued`.
- Fecha de emisión ≤ **7 días** (error `STALE_DATE`).
- Factura exige cliente **RUC** con módulo 11 válido (`INVALID_RUC_MOD11`).
- Boleta no se envía por `sendBill` (`USE_SEND_SUMMARY`).
- Body ≤ 100 KB. Rate limit 30 req/min por usuario+acción.

## Estados del documento

```
draft → issued → accepted → paid → cancelled
                ↘ rejected (issued + sunat_error_code, reenviable)
```

- **Factura/nota** por `sendBill`: CDR inmediato → `accepted`.
- **Boleta** por resumen diario: al obtener ticket queda `issued`; al resolver el ticket (`check-summary-ticket`) → `accepted` (0) o reenviable (99).
- **Guía de remisión** (GRE): `processing` mientras el ticket no resuelve; `accepted` (0) / `rejected` (99).

## Cómo se verifica el código

- `src/lib/calculations.ts` — motor de cálculo frontend.
- `src/lib/tax-engine.ts` — determinación de afectación (selva).
- `supabase/functions/sunat-billing/sunat/transformers.ts` — mapeo DB → documento SUNAT.
- Tests: `src/__tests__/calculations.test.ts` y `supabase/functions/sunat-billing/transformers.test.ts` pinan este contrato.
