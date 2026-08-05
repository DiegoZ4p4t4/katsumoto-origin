import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
const mockFromSelect = vi.fn();
const mockFromInsert = vi.fn();
const mockEq = vi.fn();
const mockDoubleEq = vi.fn();
const mockSingle = vi.fn();
const mockGetUser = vi.fn();

const mockFromUpdate = vi.fn();

vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return {
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
      from: () => ({
        select: mockFromSelect,
        insert: mockFromInsert,
        update: mockFromUpdate,
      }),
    };
  },
  getCurrentOrgId: vi.fn().mockResolvedValue('7e80b22f-b06a-4025-937a-5f9d62d78733'),
}));

vi.mock('@/services/audit.service', () => ({
  auditService: { log: vi.fn() },
}));

import { invoiceService } from '@/services/invoice.service';

describe('invoice.service — creación de factura', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: '7a900ed7-3939-46aa-bdb2-2e8e3be5621a' } },
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    mockDoubleEq.mockReturnValue({ single: mockSingle });
    mockEq.mockReturnValue({ eq: mockDoubleEq, single: mockSingle });
    mockFromSelect.mockReturnValue({ eq: mockEq });
    mockFromUpdate.mockReturnValue({ eq: mockEq });
  });

  describe('createWithItems', () => {
    it('crea factura con items y llama a create_invoice_with_items RPC', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { invoice_serie_prefix: 'F001' },
        error: null,
      });
      mockRpc
        .mockResolvedValueOnce({ data: 1, error: null })
        .mockResolvedValueOnce({ data: 'new-invoice-uuid', error: null });

      const result = await invoiceService.createWithItems(
        {
          invoice_type: 'factura',
          customer_id: 'customer-uuid',
          items: [{
            product_name: 'Aceite 2T',
            quantity: 2,
            unit_price_cents: 2500,
            discount_percent: 0,
          }],
        },
        'branch-uuid',
        'cash',
        'register-uuid'
      );

      expect(result).toEqual({
        id: 'new-invoice-uuid',
        serie: 'F001',
        correlativo: 1,
      });

      const rpcCall = mockRpc.mock.calls[1][1];
      expect(rpcCall.p_serie).toBe('F001');
      expect(rpcCall.p_invoice_type).toBe('factura');
      expect(rpcCall.p_items).toHaveLength(1);
    });

    it('usa B001 para boleta si no hay prefijo en sucursal', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { invoice_serie_prefix: '' },
        error: null,
      });
      mockRpc
        .mockResolvedValueOnce({ data: 1, error: null })
        .mockResolvedValueOnce({ data: 'bol-uuid', error: null });

      const result = await invoiceService.createWithItems(
        {
          invoice_type: 'boleta',
          customer_id: 'cf-uuid',
          items: [{ product_name: 'Producto', quantity: 1, unit_price_cents: 1000, discount_percent: 0 }],
        },
        'branch-uuid',
        'cash',
        'register-uuid'
      );

      expect(result.serie).toBe('B001');
    });

    it('lanza error si usuario no autenticado', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      await expect(invoiceService.createWithItems(
        { invoice_type: 'factura', customer_id: 'x', items: [{ product_name: 'X', quantity: 1, unit_price_cents: 100, discount_percent: 0 }] },
        'branch-uuid', 'cash', 'register-uuid'
      )).rejects.toThrow('No autenticado');
    });

    it('lanza error si stock insuficiente', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { invoice_serie_prefix: 'F001' },
        error: null,
      });
      mockRpc
        .mockResolvedValueOnce({ data: 1, error: null })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Stock insuficiente para: Aceite', code: 'P0001' },
        });

      await expect(invoiceService.createWithItems(
        { invoice_type: 'factura', customer_id: 'x', items: [{ product_name: 'Aceite', quantity: 999, unit_price_cents: 100, discount_percent: 0 }] },
        'branch-uuid', 'cash', 'register-uuid'
      )).rejects.toThrow('Stock insuficiente');
    });
  });

  describe('updateStatus', () => {
    it('valida transiciones permitidas', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { status: 'issued' },
        error: null,
      });
      mockRpc.mockResolvedValue({ data: null, error: null });

      await expect(invoiceService.updateStatus('inv-id', 'accepted')).resolves.toBeUndefined();
    });

    it('rechaza transición inválida', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { status: 'accepted' },
        error: null,
      });

      await expect(invoiceService.updateStatus('inv-id', 'issued')).rejects.toThrow('Transición no permitida');
    });
  });
});
