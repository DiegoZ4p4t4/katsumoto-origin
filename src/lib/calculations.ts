import type { Cents, TaxAffectation, InvoiceItemFormData } from "./types";
import { TAX_RATE_MAP } from "./constants";

export function calcDiscountCents(
  quantity: number,
  unitPriceCents: Cents,
  discountPercent: number
): Cents {
  return Math.round((quantity * unitPriceCents * discountPercent) / 100);
}

function getTaxRate(taxAffectation?: TaxAffectation): number {
  return TAX_RATE_MAP[taxAffectation || "gravado"] ?? 0.18;
}

function safeNum(value: number | undefined | null): number {
  return Number.isFinite(value as number) ? (value as number) : 0;
}

export function calcIgvCents(lineTotalCents: Cents, taxRate: number): Cents {
  if (taxRate === 0) return 0;
  return Math.round(lineTotalCents * taxRate / (1 + taxRate));
}

/** Base imponible neta (sin IGV) de un comprobante */
export function getNetBaseAmount(inv: {
  gravada_cents: Cents;
  exonerada_cents: Cents;
  inafecta_cents: Cents;
  exportacion_cents: Cents;
}): Cents {
  return (
    inv.gravada_cents +
    inv.exonerada_cents +
    inv.inafecta_cents +
    inv.exportacion_cents
  );
}

export interface InvoiceCalculation {  items: Array<
    InvoiceItemFormData & {
      discount_cents: Cents;
      line_total_cents: Cents;
      tax_affectation: TaxAffectation;
      igv_cents: Cents;
    }
  >;
  subtotal_cents: Cents;
  gravada_cents: Cents;
  exonerada_cents: Cents;
  inafecta_cents: Cents;
  exportacion_cents: Cents;
  igv_cents: Cents;
  total_cents: Cents;
}

export function calculateInvoice(
  items: InvoiceItemFormData[]
): InvoiceCalculation {
  const calculatedItems = items.map((item) => {
    const taxAffectation = item.tax_affectation || "gravado";
    const quantity = safeNum(item.quantity);
    const unitPriceCents = safeNum(item.unit_price_cents);
    const discountPercent = safeNum(item.discount_percent);
    const discount_cents = calcDiscountCents(
      quantity,
      unitPriceCents as Cents,
      discountPercent
    );
    const line_total_cents =
      quantity * unitPriceCents - discount_cents;
    const taxRate = getTaxRate(taxAffectation);
    const igv_cents = calcIgvCents(line_total_cents, taxRate);

    return {
      ...item,
      quantity,
      unit_price_cents: unitPriceCents as Cents,
      discount_percent: discountPercent,
      tax_affectation: taxAffectation as TaxAffectation,
      discount_cents,
      line_total_cents,
      igv_cents,
    };
  });

  const subtotal_cents = calculatedItems.reduce(
    (sum, item) => sum + item.line_total_cents,
    0
  );

  const gravada_cents = calculatedItems
    .filter((i) => i.tax_affectation === "gravado")
    .reduce((sum, i) => sum + i.line_total_cents - i.igv_cents, 0);

  const exonerada_cents = calculatedItems
    .filter((i) => i.tax_affectation === "exonerado")
    .reduce((sum, i) => sum + i.line_total_cents, 0);

  const inafecta_cents = calculatedItems
    .filter((i) => i.tax_affectation === "inafecto")
    .reduce((sum, i) => sum + i.line_total_cents, 0);

  const exportacion_cents = calculatedItems
    .filter((i) => i.tax_affectation === "exportacion")
    .reduce((sum, i) => sum + i.line_total_cents, 0);

  const igv_cents = calculatedItems.reduce(
    (sum, item) => sum + item.igv_cents,
    0
  );

  const total_cents = subtotal_cents;

  return {
    items: calculatedItems,
    subtotal_cents,
    gravada_cents,
    exonerada_cents,
    inafecta_cents,
    exportacion_cents,
    igv_cents,
    total_cents,
  };
}