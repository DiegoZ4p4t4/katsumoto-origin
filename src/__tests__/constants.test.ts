import { describe, it, expect } from 'vitest';
import { INVOICE_TYPES, PAYMENT_METHODS } from '@/lib/constants/invoices';
import { DOCUMENT_TYPES, DOCUMENT_LENGTHS } from '@/lib/constants/documents';
import { IGV_RATE, TAX_RATE_MAP } from '@/lib/constants/tax';

describe('constants — invoices', () => {
  it('INVOICE_TYPES tiene factura, boleta, nc, nd', () => {
    expect(Object.keys(INVOICE_TYPES)).toContain('factura');
    expect(Object.keys(INVOICE_TYPES)).toContain('boleta');
    expect(Object.keys(INVOICE_TYPES)).toContain('nota_credito');
    expect(Object.keys(INVOICE_TYPES)).toContain('nota_debito');
  });

  it('INVOICE_TYPES cada tipo tiene label y serie_prefix', () => {
    for (const [key, type] of Object.entries(INVOICE_TYPES)) {
      expect(type.label).toBeTruthy();
      expect(type.serie_prefix).toBeTruthy();
    }
  });

  it('factura → serie_prefix F', () => {
    expect(INVOICE_TYPES.factura.serie_prefix).toBe('F');
  });

  it('boleta → serie_prefix B', () => {
    expect(INVOICE_TYPES.boleta.serie_prefix).toBe('B');
  });

  it('PAYMENT_METHODS incluye cash', () => {
    expect(Object.keys(PAYMENT_METHODS)).toContain('cash');
  });

  it('PAYMENT_METHODS cada método tiene label', () => {
    for (const [, method] of Object.entries(PAYMENT_METHODS)) {
      expect(method.label).toBeTruthy();
    }
  });
});

describe('constants — documents', () => {
  it('DOCUMENT_TYPES tiene RUC y DNI', () => {
    expect(DOCUMENT_TYPES).toContain('RUC');
    expect(DOCUMENT_TYPES).toContain('DNI');
  });

  it('DOCUMENT_TYPES tiene 5 tipos', () => {
    expect(DOCUMENT_TYPES).toHaveLength(5);
  });

  it('DOCUMENT_LENGTHS RUC min=11 max=11', () => {
    expect(DOCUMENT_LENGTHS.RUC.min).toBe(11);
    expect(DOCUMENT_LENGTHS.RUC.max).toBe(11);
  });

  it('DOCUMENT_LENGTHS DNI min=8 max=8', () => {
    expect(DOCUMENT_LENGTHS.DNI.min).toBe(8);
    expect(DOCUMENT_LENGTHS.DNI.max).toBe(8);
  });
});

describe('constants — tax', () => {
  it('IGV_RATE es 0.18', () => {
    expect(IGV_RATE).toBe(0.18);
  });

  it('TAX_RATE_MAP tiene las 4 afectaciones básicas', () => {
    expect(TAX_RATE_MAP.gravado).toBe(0.18);
    expect(TAX_RATE_MAP.exonerado).toBe(0);
    expect(TAX_RATE_MAP.inafecto).toBe(0);
    expect(TAX_RATE_MAP.exportacion).toBe(0);
  });
});
