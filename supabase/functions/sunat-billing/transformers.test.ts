// Tests fiscales del transformer Deno: DB -> documento SUNAT
// Pinan el contrato: gravada = valor venta neto, igv extraido, total con IGV.
// Ejecutar: deno test --allow-none supabase/functions/sunat-billing/transformers.test.ts

import { assertEquals } from "jsr:@std/assert";
import {
  transformInvoiceToSunat,
  buildNoteDocument,
  buildSummaryDocument,
  centsToDecimal,
} from "./sunat/transformers.ts";
import type { DbRecord } from "./sunat/types.ts";

const SAMPLE_INVOICE: DbRecord = {
  id: "inv-1",
  invoice_type: "factura",
  serie: "F001",
  correlativo: 1,
  issue_date: "2026-08-05",
  gravada_cents: 10000,
  exonerada_cents: 0,
  inafecta_cents: 0,
  exportacion_cents: 0,
  igv_cents: 1800,
  total_cents: 11800,
  payment_method: "cash",
};

const SAMPLE_ITEM: DbRecord = {
  product_sku: "SKU-1",
  product_name: "REPUESTO AGRICOLA",
  quantity: 1,
  unit: "NIU",
  line_total_cents: 11800,
  igv_cents: 1800,
  tax_affectation: "gravado",
};

const SAMPLE_CUSTOMER: DbRecord = {
  document_type: "RUC",
  document_number: "20608183672",
  name: "CLIENTE PRUEBA S.A.C.",
};

Deno.test("transformInvoiceToSunat: contrato fiscal basico", () => {
  const result = transformInvoiceToSunat(SAMPLE_INVOICE, [SAMPLE_ITEM], SAMPLE_CUSTOMER);
  const doc = result.document as Record<string, unknown>;
  const detalles = doc.detalles as Array<Record<string, unknown>>;

  assertEquals(result.sunatTypeCode, "01");
  assertEquals(doc.moneda, "PEN");
  assertEquals(doc.forma_pago_tipo, "Contado");
  assertEquals(doc.forma_pago_codigo, "001");

  assertEquals(doc.mto_oper_gravadas, 100);
  assertEquals(doc.mto_igv, 18);
  assertEquals(doc.mto_imp_venta, 118);
  assertEquals(doc.valor_venta, 100);
  assertEquals(doc.sub_total, 100);

  const detalle = detalles[0];
  assertEquals(detalle.mto_valor_venta, 100);
  assertEquals(detalle.mto_base_igv, 100);
  assertEquals(detalle.igv, 18);
  assertEquals(detalle.tip_afe_igv, "10");
  assertEquals(detalle.unidad, "NIU");
  assertEquals(detalle.porcentaje_igv, 18.0);
});

Deno.test("transformInvoiceToSunat: pago a credito", () => {
  const invoice = { ...SAMPLE_INVOICE, payment_method: "credit" };
  const result = transformInvoiceToSunat(invoice, [SAMPLE_ITEM], SAMPLE_CUSTOMER);
  const doc = result.document as Record<string, unknown>;
  assertEquals(doc.forma_pago_tipo, "Credito");
  assertEquals(doc.forma_pago_codigo, "001");
});

Deno.test("transformInvoiceToSunat: item exonerado sin IGV", () => {
  const invoice = {
    ...SAMPLE_INVOICE,
    gravada_cents: 0,
    exonerada_cents: 10000,
    igv_cents: 0,
    total_cents: 10000,
  };
  const item = { ...SAMPLE_ITEM, line_total_cents: 10000, igv_cents: 0, tax_affectation: "exonerado" };
  const result = transformInvoiceToSunat(invoice, [item], SAMPLE_CUSTOMER);
  const doc = result.document as Record<string, unknown>;
  const detalles = doc.detalles as Array<Record<string, unknown>>;

  assertEquals(doc.mto_oper_gravadas, 0);
  assertEquals(doc.mto_oper_exoneradas, 100);
  assertEquals(doc.mto_igv, 0);
  const detalle = detalles[0];
  assertEquals(detalle.tip_afe_igv, "20");
  assertEquals(detalle.igv, 0);
  assertEquals(detalle.porcentaje_igv, 0.0);
});

Deno.test("transformInvoiceToSunat: numero a letras en leyenda", () => {
  const result = transformInvoiceToSunat(SAMPLE_INVOICE, [SAMPLE_ITEM], SAMPLE_CUSTOMER);
  const doc = result.document as Record<string, unknown>;
  const leyendas = doc.leyendas as Array<Record<string, unknown>>;
  const leyenda = leyendas[0];
  assertEquals(leyenda.code, "1000");
  assertEquals(typeof leyenda.value, "string");
  assertEquals((leyenda.value as string).length > 0, true);
});

Deno.test("buildNoteDocument: NC respeta el contrato fiscal", () => {
  const nota: DbRecord = {
    id: "nc-1",
    invoice_type: "nota_credito",
    serie: "FC01",
    correlativo: 1,
    issue_date: "2026-08-05",
    gravada_cents: 3390,
    exonerada_cents: 0,
    inafecta_cents: 0,
    exportacion_cents: 0,
    igv_cents: 610,
    total_cents: 4000,
    reference_invoice_id: "inv-1",
    motivo_nota: "01",
    descripcion_motivo: "ANULACION",
    payment_method: "cash",
    number: "FC01-000001",
  };
  const notaItem: DbRecord = {
    ...SAMPLE_ITEM,
    line_total_cents: 4000,
    igv_cents: 610,
    tax_affectation: "gravado",
  };
  const body: DbRecord = {
    tipo_doc_afectado: "01",
    num_doc_afectado: "F001-000001",
    cod_motivo: "01",
    des_motivo: "ANULACION DE LA OPERACION",
  };

  const result = buildNoteDocument(nota, [notaItem], SAMPLE_CUSTOMER, body);

  assertEquals(result.tipo_documento, "07");
  assertEquals(result.mto_oper_gravadas, 33.9);
  assertEquals(result.mto_igv, 6.1);
  assertEquals(result.mto_imp_venta, 40);
  assertEquals(result.moneda, "PEN");
  assertEquals(result.cod_motivo, "01");
});

Deno.test("centsToDecimal redondea a 2 decimales", () => {
  assertEquals(centsToDecimal(10000), 100);
  assertEquals(centsToDecimal(5), 0.05);
  assertEquals(centsToDecimal(3390), 33.9);
});

Deno.test("buildSummaryDocument: boleta en resumen diario", () => {
  const boleta: DbRecord = {
    invoice_type: "boleta",
    serie: "B001",
    correlativo: 1,
    total_cents: 3640,
    gravada_cents: 3085,
    exonerada_cents: 0,
    inafecta_cents: 0,
    igv_cents: 555,
    customer: { document_type: "DNI", document_number: "00000000" },
  };

  const result = buildSummaryDocument([boleta], "2026-08-05", 1) as Record<string, unknown>;
  const detalles = result.detalles as Array<Record<string, unknown>>;

  assertEquals(result.correlativo, "1");
  assertEquals(detalles.length, 1);
  const detalle = detalles[0];
  assertEquals(detalle.tipo_documento, "03");
  assertEquals(detalle.serie_numero, "B001-000001");
  assertEquals(detalle.estado, "1");
  assertEquals(detalle.cliente_tipo, "1");
  assertEquals(detalle.cliente_numero, "00000000");
  assertEquals(detalle.total, 36.4);
  assertEquals(detalle.mto_oper_gravadas, 30.85);
  assertEquals(detalle.mto_igv, 5.55);
});

Deno.test("transformInvoiceToSunat: precio unitario consistente con cantidad>1", () => {
  const invoice = { ...SAMPLE_INVOICE, gravada_cents: 847, igv_cents: 153, total_cents: 1000 };
  const item = { ...SAMPLE_ITEM, quantity: 3, line_total_cents: 1000, igv_cents: 153 };
  const result = transformInvoiceToSunat(invoice, [item], SAMPLE_CUSTOMER);
  const doc = result.document as Record<string, unknown>;
  const detalle = (doc.detalles as Array<Record<string, unknown>>)[0];

  const valorUnitario = detalle.mto_valor_unitario as number;
  const valorVenta = detalle.mto_valor_venta as number;

  assertEquals(detalle.cantidad, 3);
  assertEquals(valorVenta, 8.47);
  assertEquals(Math.abs(valorUnitario * 3 - valorVenta) < 0.01, true);
  assertEquals(detalle.mto_precio_unitario as number > 0, true);
});

