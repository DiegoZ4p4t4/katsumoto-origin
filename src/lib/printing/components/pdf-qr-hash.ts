import QRCode from "qrcode";
import type { PdfContext } from "../types";
import { INVOICE_TYPE_SUNAT_CODE, DOCUMENT_TYPE_SUNAT_CODE } from "../../types/sunat";
import { INVOICE_TYPES } from "../../constants";

const QR_SIZE_MM = 22;

export async function drawQrHash(ctx: PdfContext, y: number): Promise<number> {
  const { doc, invoice, sellerInfo, pageWidth, margin } = ctx;
  const rightX = pageWidth - margin;

  const hasHash = !!invoice.sunat_hash;
  const typeCode = INVOICE_TYPE_SUNAT_CODE[invoice.invoice_type] || "01";
  const typeLabel = INVOICE_TYPES[invoice.invoice_type]?.label || invoice.invoice_type.toUpperCase();
  const docTypeCode = DOCUMENT_TYPE_SUNAT_CODE[invoice.customer?.document_type || "DNI"] || "1";
  const docNumber = invoice.customer?.document_number || "00000000";

  const qrData = [
    sellerInfo.ruc, typeCode,
    invoice.serie || invoice.number.split("-")[0] || "",
    String(invoice.correlativo || invoice.number.split("-")[1] || ""),
    (invoice.igv_cents / 100).toFixed(2), (invoice.total_cents / 100).toFixed(2),
    invoice.issue_date || new Date().toISOString().split("T")[0],
    docTypeCode, docNumber,
    invoice.sunat_hash || "",
  ].join("|");

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, rightX, y);
  y += 5;

  let qrBase64: string | null = null;
  try {
    qrBase64 = await QRCode.toDataURL(qrData, {
      width: 200, margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    });
  } catch { /* skip */ }

  const textStartY = y;
  const textW = rightX - margin - (qrBase64 ? QR_SIZE_MM + 4 : 0);

  doc.setFontSize(6.5);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "italic");
  doc.text("Representación Impresa de:", margin, y);
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(7);
  doc.text(`${typeLabel} ${invoice.number}`, margin, y);
  y += 4;

  if (hasHash) {
    doc.setFontSize(6.5);
    doc.setTextColor(90, 90, 90);
    doc.setFont("helvetica", "normal");
    doc.text(`Hash: ${invoice.sunat_hash}`, margin, y, { maxWidth: textW });
    y += 4;
  }

  if (!hasHash) {
    doc.setFontSize(6);
    doc.setTextColor(130, 130, 130);
    doc.setFont("helvetica", "italic");
    doc.text("Comprobante pendiente de envío a SUNAT", margin, y);
    y += 4;
  }

  if (qrBase64) {
    doc.addImage(qrBase64, "PNG", rightX - QR_SIZE_MM, textStartY, QR_SIZE_MM, QR_SIZE_MM);
  }

  return Math.max(y, textStartY + QR_SIZE_MM) + 2;
}
