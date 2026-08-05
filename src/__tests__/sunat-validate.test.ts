import { describe, it, expect } from 'vitest';

const { validateRuc, validatePreSend } = await import(
  '../../supabase/functions/sunat-billing/sunat/validate.ts'
);

describe('validateRuc — módulo 11 SUNAT', () => {
  it('RUC válido 20100130204', () => {
    expect(validateRuc('20100130204')).toBe(true);
  });

  it('RUC válido 20608183672 (Katsumoto)', () => {
    expect(validateRuc('20608183672')).toBe(true);
  });

  it('RUC inválido (dígito incorrecto)', () => {
    expect(validateRuc('20100130205')).toBe(false);
  });

  it('RUC inválido (muy corto)', () => {
    expect(validateRuc('12345')).toBe(false);
  });

  it('RUC inválido (no empieza con 10/15/17/20)', () => {
    expect(validateRuc('11111111111')).toBe(false);
  });

  it('RUC con caracteres no numéricos', () => {
    expect(validateRuc('20ABC123456')).toBe(false);
  });

  it('RUC válido 20100066603', () => {
    expect(validateRuc('20100066603')).toBe(true);
  });
});

describe('validatePreSend', () => {
  it('factura con RUC válido pasa', () => {
    const result = validatePreSend({
      invoice_type: 'factura',
      customer_document_type: 'RUC',
      customer_document_number: '20100130204',
      issue_date: new Date().toISOString().split('T')[0],
    });
    expect(result.valid).toBe(true);
  });

  it('factura con RUC inválido falla', () => {
    const result = validatePreSend({
      invoice_type: 'factura',
      customer_document_type: 'RUC',
      customer_document_number: '11111111111',
      issue_date: new Date().toISOString().split('T')[0],
    });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('INVALID_RUC');
  });

  it('boleta no requiere RUC válido', () => {
    const result = validatePreSend({
      invoice_type: 'boleta',
      customer_document_type: 'DNI',
      customer_document_number: '00000000',
      issue_date: new Date().toISOString().split('T')[0],
    });
    expect(result.valid).toBe(true);
  });

  it('fecha > 7 días falla', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    const result = validatePreSend({
      invoice_type: 'factura',
      customer_document_type: 'RUC',
      customer_document_number: '20100130204',
      issue_date: oldDate.toISOString().split('T')[0],
    });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('STALE_DATE');
  });
});
