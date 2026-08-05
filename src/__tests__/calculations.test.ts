import { describe, it, expect } from 'vitest';
import {
  calcDiscountCents,
  calcIgvCents,
  calculateInvoice,
} from '@/lib/calculations';
import type { InvoiceItemFormData } from '@/lib/types';
import type { Cents } from '@/lib/types';

describe('calculations — IGV engine', () => {
  describe('calcDiscountCents', () => {
    it('calcula descuento 0% → 0', () => {
      expect(calcDiscountCents(2, 10000 as Cents, 0)).toBe(0);
    });

    it('calcula descuento 10% sobre S/100 x 2 unidades', () => {
      expect(calcDiscountCents(2, 10000 as Cents, 10)).toBe(2000);
    });

    it('calcula descuento con redondeo', () => {
      const result = calcDiscountCents(3, 3333 as Cents, 10);
      expect(result).toBe(1000);
    });
  });

  describe('calcIgvCents', () => {
    it('IGV 18% sobre S/100 (10000 cents)', () => {
      const igv = calcIgvCents(10000 as Cents, 0.18);
      // 10000 * 0.18 / 1.18 = 1525.42... → redondeado 1525
      expect(igv).toBe(1525);
    });

    it('IGV 18% sobre S/200 (20000 cents)', () => {
      const igv = calcIgvCents(20000 as Cents, 0.18);
      // 20000 * 0.18 / 1.18 = 3050.84... → redondeado 3051
      expect(igv).toBe(3051);
    });

    it('tasa 0% retorna 0', () => {
      expect(calcIgvCents(10000 as Cents, 0)).toBe(0);
    });

    it('tasa 0% para exonerado', () => {
      expect(calcIgvCents(10000 as Cents, 0)).toBe(0);
    });
  });

  describe('calculateInvoice', () => {
    it('factura con 1 item gravado IGV 18%', () => {
      const items: InvoiceItemFormData[] = [{
        product_name: 'Aceite 2T',
        quantity: 2,
        unit_price_cents: 2500 as Cents,
        discount_percent: 0,
        tax_affectation: 'gravado',
      }];

      const result = calculateInvoice(items);
      expect(result.gravada_cents).toBe(4237);
      expect(result.igv_cents).toBe(763);
      expect(result.total_cents).toBe(5000);
      expect(result.exonerada_cents).toBe(0);
      expect(result.inafecta_cents).toBe(0);
    });

    it('factura con 1 item gravado + 1 item exonerado', () => {
      const items: InvoiceItemFormData[] = [
        {
          product_name: 'Aceite (gravado)',
          quantity: 1,
          unit_price_cents: 11800 as Cents,
          discount_percent: 0,
          tax_affectation: 'gravado',
        },
        {
          product_name: 'Flete (exonerado)',
          quantity: 1,
          unit_price_cents: 5000 as Cents,
          discount_percent: 0,
          tax_affectation: 'exonerado',
        },
      ];

      const result = calculateInvoice(items);
      expect(result.gravada_cents).toBeGreaterThan(0);
      expect(result.exonerada_cents).toBe(5000);
      expect(result.igv_cents).toBeGreaterThan(0);
      expect(result.total_cents).toBe(16800);
    });

    it('factura con descuento por item', () => {
      const items: InvoiceItemFormData[] = [{
        product_name: 'Cadena',
        quantity: 1,
        unit_price_cents: 12000 as Cents,
        discount_percent: 10,
        tax_affectation: 'gravado',
      }];

      const result = calculateInvoice(items);
      // discount = 12000 * 1 * 10 / 100 = 1200
      // line_total = 12000 - 1200 = 10800
      expect(result.total_cents).toBe(10800);
      expect(result.items[0].discount_cents).toBe(1200);
      expect(result.items[0].line_total_cents).toBe(10800);
    });

    it('suma correcta de igv_cents total', () => {
      const items: InvoiceItemFormData[] = [
        { product_name: 'A', quantity: 1, unit_price_cents: 11800 as Cents, discount_percent: 0, tax_affectation: 'gravado' },
        { product_name: 'B', quantity: 1, unit_price_cents: 23600 as Cents, discount_percent: 0, tax_affectation: 'gravado' },
      ];

      const result = calculateInvoice(items);
      const sumLineIgv = result.items[0].igv_cents + result.items[1].igv_cents;
      expect(result.igv_cents).toBe(sumLineIgv);
    });

    it('item inafecto no genera IGV', () => {
      const items: InvoiceItemFormData[] = [{
        product_name: 'Servicio inafecto',
        quantity: 1,
        unit_price_cents: 5000 as Cents,
        discount_percent: 0,
        tax_affectation: 'inafecto',
      }];

      const result = calculateInvoice(items);
      expect(result.igv_cents).toBe(0);
      expect(result.inafecta_cents).toBe(5000);
      expect(result.gravada_cents).toBe(0);
    });

    it('item exportación no genera IGV', () => {
      const items: InvoiceItemFormData[] = [{
        product_name: 'Exportación',
        quantity: 1,
        unit_price_cents: 100000 as Cents,
        discount_percent: 0,
        tax_affectation: 'exportacion',
      }];

      const result = calculateInvoice(items);
      expect(result.igv_cents).toBe(0);
      expect(result.exportacion_cents).toBe(100000);
    });

    it('múltiples items de diferentes afectaciones suman correctamente', () => {
      const items: InvoiceItemFormData[] = [
        { product_name: 'A', quantity: 1, unit_price_cents: 11800 as Cents, discount_percent: 0, tax_affectation: 'gravado' },
        { product_name: 'B', quantity: 1, unit_price_cents: 5000 as Cents, discount_percent: 0, tax_affectation: 'exonerado' },
        { product_name: 'C', quantity: 1, unit_price_cents: 3000 as Cents, discount_percent: 0, tax_affectation: 'inafecto' },
        { product_name: 'D', quantity: 1, unit_price_cents: 20000 as Cents, discount_percent: 0, tax_affectation: 'exportacion' },
      ];

      const result = calculateInvoice(items);
      expect(result.gravada_cents).toBeGreaterThan(0);
      expect(result.exonerada_cents).toBe(5000);
      expect(result.inafecta_cents).toBe(3000);
      expect(result.exportacion_cents).toBe(20000);
      expect(result.igv_cents).toBeGreaterThan(0);
      expect(result.total_cents).toBe(39800);
    });

    it('default a gravado si no se especifica tax_affectation', () => {
      const items: InvoiceItemFormData[] = [{
        product_name: 'Sin tipo',
        quantity: 1,
        unit_price_cents: 11800 as Cents,
        discount_percent: 0,
      }];

      const result = calculateInvoice(items);
      expect(result.igv_cents).toBeGreaterThan(0);
      expect(result.gravada_cents).toBeGreaterThan(0);
    });

    it('cantidad 0 no genera error', () => {
      const items: InvoiceItemFormData[] = [{
        product_name: 'Vacío',
        quantity: 0,
        unit_price_cents: 1000 as Cents,
        discount_percent: 0,
        tax_affectation: 'gravado',
      }];

      const result = calculateInvoice(items);
      expect(result.total_cents).toBe(0);
    });

    it('precio mínimo (1 cent) con IGV', () => {
      const items: InvoiceItemFormData[] = [{
        product_name: 'Mínimo',
        quantity: 1,
        unit_price_cents: 1 as Cents,
        discount_percent: 0,
        tax_affectation: 'gravado',
      }];
      const result = calculateInvoice(items);
      expect(result.total_cents).toBe(1);
      expect(result.gravada_cents).toBeGreaterThanOrEqual(0);
    });

    it('descuento 100% → line_total y gravada 0', () => {
      const items: InvoiceItemFormData[] = [{
        product_name: 'Gratis',
        quantity: 10,
        unit_price_cents: 5000 as Cents,
        discount_percent: 100,
        tax_affectation: 'gravado',
      }];
      const result = calculateInvoice(items);
      expect(result.total_cents).toBe(0);
      expect(result.igv_cents).toBe(0);
      expect(result.gravada_cents).toBe(0);
    });

    it('cantidad grande no causa overflow', () => {
      const items: InvoiceItemFormData[] = [{
        product_name: 'Muchos',
        quantity: 999999,
        unit_price_cents: 999999 as Cents,
        discount_percent: 0,
        tax_affectation: 'gravado',
      }];
      const result = calculateInvoice(items);
      expect(result.total_cents).toBeGreaterThan(0);
      expect(Number.isSafeInteger(result.total_cents)).toBe(true);
      expect(Number.isSafeInteger(result.igv_cents)).toBe(true);
    });
  });
});
