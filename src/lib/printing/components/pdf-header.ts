import type { PdfContext } from "../types";
import { INVOICE_TYPES } from "../../constants";

const LOGO_MAX_W = 28;
const LOGO_MAX_H = 14;

function formatDatePDF(dateStr: string): string {
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return new Date(dateStr).toLocaleDateString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function drawHeader(ctx: PdfContext, y: number): Promise<number> {
  const { doc, invoice, sellerInfo, options, pageWidth, margin } = ctx;
  const rightX = pageWidth - margin;
  let textX = margin;

  if (sellerInfo.logoUrl) {
    const imgData = await loadImageAsBase64(sellerInfo.logoUrl);
    if (imgData) {
      try {
        doc.addImage(imgData, "AUTO", margin, y, LOGO_MAX_W, LOGO_MAX_H);
        textX = margin + LOGO_MAX_W + 5;
      } catch {
        // ignore
      }
    }
  }

  const bizName = sellerInfo.nombreComercial || sellerInfo.razonSocial || "KATSUMOTO";
  const legalName = sellerInfo.nombreComercial && sellerInfo.razonSocial && sellerInfo.nombreComercial !== sellerInfo.razonSocial
    ? sellerInfo.razonSocial
    : null;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 77, 0);
  doc.text(bizName.toUpperCase(), textX, y + 7);

  let nextY = y + 14;
  if (legalName) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(legalName, textX, nextY);
    nextY += 6;
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`RUC: ${sellerInfo.ruc}`, textX, nextY);
  nextY += 5;

  const addrParts = [sellerInfo.direccion, sellerInfo.distrito, sellerInfo.provincia, sellerInfo.departamento].filter(Boolean);
  if (addrParts.length > 0) {
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(addrParts.join(", "), textX, nextY);
    nextY += 3.5;
  }

  if (sellerInfo.phone || sellerInfo.email) {
    const parts: string[] = [];
    if (sellerInfo.phone) parts.push(`Tel: ${sellerInfo.phone}`);
    if (sellerInfo.email) parts.push(sellerInfo.email);
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(parts.join(" · "), textX, nextY);
    nextY += 3.5;
  }

  const typeInfo = INVOICE_TYPES[invoice.invoice_type];
  const typeLabel = typeInfo?.label || invoice.invoice_type.toUpperCase();
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(typeLabel.toUpperCase(), rightX, y + 7, { align: "right" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`N° ${invoice.number}`, rightX, y + 14, { align: "right" });

  if (options.branchName) {
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(`Sede: ${options.branchName}`, rightX, y + 20, { align: "right" });
  }

  const headerBottom = Math.max(nextY, y + 24);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, headerBottom + 2, rightX, headerBottom + 2);

  const infoY = headerBottom + 6;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text("Fecha de Emisión:", margin, infoY);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text(formatDatePDF(invoice.issue_date), margin + 28, infoY);

  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text("Moneda:", margin + 85, infoY);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("PEN (Soles)", margin + 105, infoY);

  return infoY + 6;
}
