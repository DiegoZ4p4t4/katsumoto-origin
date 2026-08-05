import { InvoiceCalculator } from 'fractuyo';
import type { Cents } from '../types';

const calc18 = new InvoiceCalculator({ porcentajeIgv: 18 });
const calc10 = new InvoiceCalculator({ porcentajeIgv: 10 });
const calc105 = new InvoiceCalculator({ porcentajeIgv: 10.5 });
const calc4 = new InvoiceCalculator({ porcentajeIgv: 4 });

const CALC_MAP: Record<number, InvoiceCalculator> = {
  18: calc18,
  10: calc10,
  10.5: calc105,
  4: calc4,
};

export interface FractuyoLineItem {
  valorUnitario: number;
  valorVenta: number;
  igv: number;
  precioVenta: number;
  gratuito: boolean;
}

export interface FractuyoTotals {
  totalGravada: number;
  totalExonerada: number;
  totalInafecta: number;
  totalExportacion: number;
  totalGratuita: number;
  totalIgv: number;
  total: number;
  retencionBaseImponible: number;
}

export function getCalculator(igvPercent: number = 18): InvoiceCalculator {
  return CALC_MAP[igvPercent] ?? calc18;
}

export function calculateLine(
  unitPriceCents: Cents,
  quantity: number,
  incluyeIgv: boolean,
  igvPercent: number,
  affectationCode: string
): FractuyoLineItem {
  const calc = getCalculator(igvPercent);
  const unitPriceDecimal = unitPriceCents / 100;

  return calc.calculateItem({
    precio_venta_unitario: unitPriceDecimal,
    cantidad: quantity,
    inc_igv: incluyeIgv,
    tipo_de_igv: affectationCode,
  });
}

export function calculateTotals(
  lines: Array<{
    tipoDeIgv: string;
    igv: number;
    valorVenta: number;
    precioVenta: number;
  }>,
  descuentoFactor?: number
): FractuyoTotals {
  const calc = getCalculator();

  const result = calc.calculateTotals(
    lines.map((l) => ({
      tipo_de_igv: l.tipoDeIgv,
      igv: l.igv,
      valor_venta: l.valorVenta,
      precio_venta: l.precioVenta,
    })),
    descuentoFactor ? { descuento_factor: descuentoFactor } : undefined
  );

  return {
    totalGravada: result.total_gravada,
    totalExonerada: result.total_exonerada,
    totalInafecta: result.total_inafecta,
    totalExportacion: result.total_exportacion,
    totalGratuita: result.total_gratuita,
    totalIgv: result.total_igv,
    total: result.total,
    retencionBaseImponible: result.retencion_base_imponible,
  };
}

export function calculateDetraction(total: number, percent: number): number {
  const calc = getCalculator();
  return calc.calculateDetraction(total, percent);
}

export function calculateRetention(base: number, tipo: '01' | '02'): number {
  const calc = getCalculator();
  return calc.calculateRetention(base, tipo);
}
