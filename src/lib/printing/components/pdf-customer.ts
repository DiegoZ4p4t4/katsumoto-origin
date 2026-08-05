import type { PdfContext } from "../types";

export function drawCustomer(ctx: PdfContext, y: number): number {
  const { doc, invoice, margin, contentWidth } = ctx;

  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(248, 249, 250);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 22, 3, 3, "FD");
  y += 4;

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text("CLIENTE", margin + 4, y);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(invoice.customer?.name || "—", margin + 4, y);
  y += 5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  const docLabel = invoice.customer?.document_type || "DOC";
  doc.text(`${docLabel}: ${invoice.customer?.document_number || "—"}`, margin + 4, y);
  y += 8;

  return y;
}
