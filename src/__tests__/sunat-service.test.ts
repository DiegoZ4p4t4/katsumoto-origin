import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
const mockGetSession = vi.fn();
const mockCreateSignedUrl = vi.fn();
const mockList = vi.fn();
const mockRemove = vi.fn();
const mockUpload = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockRefreshSession = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return {
      auth: {
        getSession: mockGetSession,
        refreshSession: mockRefreshSession,
      },
      functions: { invoke: mockInvoke },
      storage: { from: mockFrom },
      from: mockFrom,
      rpc: mockRpc,
    };
  },
  getCurrentOrgId: vi.fn().mockResolvedValue('7e80b22f-b06a-4025-937a-5f9d62d78733'),
}));

import { sunatService } from '@/services/sunat.service';

describe('sunat.service — integración Edge Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockFrom.mockImplementation(() => ({ select: mockSelect, createSignedUrl: mockCreateSignedUrl, list: mockList, remove: mockRemove, upload: mockUpload, eq: vi.fn() }));
    mockGetSession.mockResolvedValue({ data: { session: { expires_at: Math.floor(Date.now() / 1000) + 3600 } } });
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder, limit: mockLimit, single: vi.fn() });
    mockEq.mockReturnValue({ order: mockOrder, single: vi.fn(), limit: mockLimit });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.url/test' }, error: null });
  });

  describe('getConfig', () => {
    it('invoca sunat-credentials con action=get', async () => {
      mockInvoke.mockResolvedValueOnce({ data: { ruc: '20608183672' }, error: null });
      const result = await sunatService.getConfig();
      expect(mockInvoke).toHaveBeenCalledWith('sunat-credentials', { body: { action: 'get' } });
      expect(result).toEqual({ ruc: '20608183672' });
    });
  });

  describe('saveConfig', () => {
    it('invoca sunat-credentials con action=save', async () => {
      mockInvoke.mockResolvedValueOnce({ data: { ruc: '20608183672', is_configured: true }, error: null });
      const fd = { ruc: '20608183672', razon_social: 'TEST', usuario_sol: 'U', clave_sol: 'P' };
      const result = await sunatService.saveConfig(fd as any);
      expect(mockInvoke).toHaveBeenCalledWith('sunat-credentials', { body: { action: 'save', formData: fd } });
      expect(result.ruc).toBe('20608183672');
    });
  });

  describe('testConnection', () => {
    it('invoca sunat-billing con action=test', async () => {
      mockInvoke.mockResolvedValueOnce({ data: { success: true }, error: null });
      const result = await sunatService.testConnection();
      expect(mockInvoke).toHaveBeenCalledWith('sunat-billing', { body: { action: 'test' } });
      expect(result.success).toBe(true);
    });
  });

  describe('sendInvoice', () => {
    it('envía factura y retorna hash', async () => {
      mockInvoke.mockResolvedValueOnce({ data: { success: true, hash: 'abc', cdr_path: 'x.zip' }, error: null });
      const r = await sunatService.sendInvoice('id');
      expect(r.success).toBe(true);
      expect(r.hash).toBe('abc');
    });

    it('retorna error_code en rechazo', async () => {
      mockInvoke.mockResolvedValueOnce({ data: { success: false, error_code: '2076' }, error: null });
      const r = await sunatService.sendInvoice('id');
      expect(r.success).toBe(false);
      expect(r.error_code).toBe('2076');
    });
  });

  describe('sendSummary', () => {
    it('envía resumen diario', async () => {
      mockInvoke.mockResolvedValueOnce({ data: { success: true, ticket: 'T1', boletas_count: 5 }, error: null });
      const r = await sunatService.sendSummary('2025-01-15');
      expect(mockInvoke).toHaveBeenCalledWith('sunat-billing', { body: { action: 'send-summary', fecha: '2025-01-15' } });
      expect(r.ticket).toBe('T1');
      expect(r.boletas_count).toBe(5);
    });
  });

  describe('sendVoided', () => {
    it('envía comunicación de baja', async () => {
      mockInvoke.mockResolvedValueOnce({ data: { success: true, ticket: 'V1' }, error: null });
      const r = await sunatService.sendVoided('inv-id', 'ERROR');
      expect(mockInvoke).toHaveBeenCalledWith('sunat-billing', { body: { action: 'send-voided', invoice_id: 'inv-id', motivo: 'ERROR' } });
      expect(r.success).toBe(true);
    });
  });

  describe('sendDespatch', () => {
    it('envía guía de remisión', async () => {
      mockInvoke.mockResolvedValueOnce({ data: { success: true, ticket: 'G1' }, error: null });
      const r = await sunatService.sendDespatch('dp-id');
      expect(mockInvoke).toHaveBeenCalledWith('sunat-billing', { body: { action: 'send-despatch', despatch_id: 'dp-id' } });
      expect(r.success).toBe(true);
    });
  });

  describe('getXmlUrl / getCdrUrl', () => {
    it('genera URL firmada', async () => {
      const url = await sunatService.getXmlUrl('path/file.xml');
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('path/file.xml', 3600);
      expect(url).toBe('https://signed.url/test');
    });
  });

  describe('refreshSession', () => {
    it('refresca sesión si expira en <60s', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: { expires_at: Math.floor(Date.now() / 1000) + 30 } } });
      mockInvoke.mockResolvedValueOnce({ data: { success: true }, error: null });
      await sunatService.testConnection();
      expect(mockRefreshSession).toHaveBeenCalled();
    });
  });

  describe('getSummaryLogs', () => {
    it('retorna logs de resumen diario', async () => {
      mockLimit.mockResolvedValueOnce({ data: [{ id: 'log1', tipo: 'resumen_diario' }], error: null });
      const logs = await sunatService.getSummaryLogs();
      expect(logs).toHaveLength(1);
    });
  });
});
