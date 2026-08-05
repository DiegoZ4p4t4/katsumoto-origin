import { describe, it, expect } from 'vitest';
import { invoiceFormSchema, invoiceItemFormSchema } from '@/lib/schemas/invoice.schema';

describe('invoice.schema — Zod validations', () => {
  describe('invoiceItemFormSchema', () => {
    it('valida item con datos mínimos', () => {
      const result = invoiceItemFormSchema.safeParse({
        product_name: 'Aceite 2T',
        quantity: 2,
        unit_price_cents: 2500,
      });
      expect(result.success).toBe(true);
    });

    it('rechaza item sin product_name', () => {
      const result = invoiceItemFormSchema.safeParse({
        quantity: 2,
        unit_price_cents: 2500,
      });
      expect(result.success).toBe(false);
    });

    it('rechaza cantidad 0', () => {
      const result = invoiceItemFormSchema.safeParse({
        product_name: 'Aceite',
        quantity: 0,
        unit_price_cents: 2500,
      });
      expect(result.success).toBe(false);
    });

    it('rechaza cantidad negativa', () => {
      const result = invoiceItemFormSchema.safeParse({
        product_name: 'Aceite',
        quantity: -1,
        unit_price_cents: 2500,
      });
      expect(result.success).toBe(false);
    });

    it('rechaza precio negativo', () => {
      const result = invoiceItemFormSchema.safeParse({
        product_name: 'Aceite',
        quantity: 1,
        unit_price_cents: -100,
      });
      expect(result.success).toBe(false);
    });

    it('rechaza descuento > 100%', () => {
      const result = invoiceItemFormSchema.safeParse({
        product_name: 'Aceite',
        quantity: 1,
        unit_price_cents: 2500,
        discount_percent: 101,
      });
      expect(result.success).toBe(false);
    });

    it('acepta descuento 100%', () => {
      const result = invoiceItemFormSchema.safeParse({
        product_name: 'Aceite',
        quantity: 1,
        unit_price_cents: 2500,
        discount_percent: 100,
      });
      expect(result.success).toBe(true);
    });

    it('opcionales tienen defaults', () => {
      const result = invoiceItemFormSchema.safeParse({
        product_name: 'Aceite',
        quantity: 1,
        unit_price_cents: 1000,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.discount_percent).toBe(0);
      }
    });

    it('acepta tax_affectation válido', () => {
      const result = invoiceItemFormSchema.safeParse({
        product_name: 'Aceite',
        quantity: 1,
        unit_price_cents: 2500,
        tax_affectation: 'gravado',
      });
      expect(result.success).toBe(true);
    });

    it('acepta sin tax_affectation (opcional)', () => {
      const result = invoiceItemFormSchema.safeParse({
        product_name: 'Aceite',
        quantity: 1,
        unit_price_cents: 2500,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('invoiceFormSchema', () => {
    it('valida formulario completo', () => {
      const result = invoiceFormSchema.safeParse({
        customer_id: 'some-uuid',
        invoice_type: 'factura',
        issue_date: '2025-01-15',
        items: [{
          product_name: 'Aceite',
          quantity: 1,
          unit_price_cents: 2500,
        }],
      });
      expect(result.success).toBe(true);
    });

    it('rechaza sin customer_id', () => {
      const result = invoiceFormSchema.safeParse({
        invoice_type: 'factura',
        issue_date: '2025-01-15',
        items: [{
          product_name: 'Aceite',
          quantity: 1,
          unit_price_cents: 2500,
        }],
      });
      expect(result.success).toBe(false);
    });

    it('rechaza sin items', () => {
      const result = invoiceFormSchema.safeParse({
        customer_id: 'some-uuid',
        invoice_type: 'factura',
        issue_date: '2025-01-15',
        items: [],
      });
      expect(result.success).toBe(false);
    });

    it('valida invoice_type enum', () => {
      const valid = ['factura', 'boleta', 'nota_credito', 'nota_debito'];
      for (const type of valid) {
        const result = invoiceFormSchema.safeParse({
          customer_id: 'x',
          invoice_type: type,
          issue_date: '2025-01-15',
          items: [{ product_name: 'X', quantity: 1, unit_price_cents: 100 }],
        });
        expect(result.success).toBe(true);
      }
    });

    it('rechaza invoice_type inválido', () => {
      const result = invoiceFormSchema.safeParse({
        customer_id: 'x',
        invoice_type: 'guia_remision',
        issue_date: '2025-01-15',
        items: [{ product_name: 'X', quantity: 1, unit_price_cents: 100 }],
      });
      expect(result.success).toBe(false);
    });

    it('rechaza notes > 500 caracteres', () => {
      const result = invoiceFormSchema.safeParse({
        customer_id: 'x',
        invoice_type: 'factura',
        issue_date: '2025-01-15',
        notes: 'x'.repeat(501),
        items: [{ product_name: 'X', quantity: 1, unit_price_cents: 100 }],
      });
      expect(result.success).toBe(false);
    });

    it('due_date es opcional', () => {
      const result = invoiceFormSchema.safeParse({
        customer_id: 'x',
        invoice_type: 'factura',
        issue_date: '2025-01-15',
        items: [{ product_name: 'X', quantity: 1, unit_price_cents: 100 }],
      });
      expect(result.success).toBe(true);
    });
  });
});
