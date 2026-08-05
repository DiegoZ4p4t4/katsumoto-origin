import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { Invoice } from "../../types";
import type { SellerInfo } from "../seller-info";
import type { PrintOptions } from "../types";
import { INVOICE_TYPES, IGV_RATE, PAYMENT_METHODS } from "../../constants";
import { formatCents } from "../../format";
import { getLegalBasisText, determineTax } from "../../tax-engine";
import { INVOICE_TYPE_SUNAT_CODE, DOCUMENT_TYPE_SUNAT_CODE } from "../../types/sunat";

const W = 58;
const M = 2;
const CW = W - M * 2;
const FONT = "courier";

// ─── Number to words (ES, PEN) ───

const UNITS = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
const TEENS = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
const TENS_ = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const HUNDREDS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function numberToWords(n: number): string {
  if (n === 0) return "CERO";
  if (n === 100) return "CIEN";
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 30) return n === 20 ? "VEINTE" : "VEINTI" + UNITS[n - 20];
  if (n < 100) {
    const tens = TENS_[Math.floor(n / 10)];
    const unit = n % 10;
    return unit ? `${tens} Y ${UNITS[unit]}` : tens;
  }
  if (n < 1000) {
    const hundred = HUNDREDS[Math.floor(n / 100)];
    const rest = n % 100;
    return rest ? `${hundred} ${numberToWords(rest)}` : hundred;
  }
  if (n < 1_000_000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    const thousandsWord = thousands === 1 ? "MIL" : `${numberToWords(thousands)} MIL`;
    return rest ? `${thousandsWord} ${numberToWords(rest)}` : thousandsWord;
  }
  if (n < 1_000_000_000) {
    const millions = Math.floor(n / 1_000_000);
    const rest = n % 1_000_000;
    const millionsWord = millions === 1 ? "UN MILLON" : `${numberToWords(millions)} MILLONES`;
    return rest ? `${millionsWord} ${numberToWords(rest)}` : millionsWord;
  }
  return String(n);
}

function centsToText(cents: number): string {
  const soles = Math.floor(Math.abs(cents) / 100);
  const centimos = Math.abs(cents) % 100;
  const solesText = numberToWords(soles);
  const centimosText = centimos > 0 ? `CON ${numberToWords(centimos)}/100` : "CON 00/100";
  return `${solesText} SOLES ${centimosText}`;
}

// ─── Height estimation ───

function estimateHeight(invoice: Invoice, sellerInfo: SellerInfo, options?: PrintOptions): number {
  let h = 10;
  h += 6; // biz name
  if (sellerInfo.nombreComercial && sellerInfo.razonSocial && sellerInfo.nombreComercial !== sellerInfo.razonSocial) h += 4;
  h += sellerInfo.ruc ? 4 : 0;
  const addrParts = [sellerInfo.direccion, sellerInfo.distrito, sellerInfo.provincia, sellerInfo.departamento].filter(Boolean);
  if (addrParts.length > 0) h += Math.ceil(addrParts.join(", ").length / 28) * 3;
  h += sellerInfo.phone ? 3 : 0;
  h += sellerInfo.email ? 3 : 0;
  h += 9; // separator + doc type + number
  h += options?.branchName ? 3 : 0;
  h += 10; // date+time + separator
  h += 14; // customer + separator
  const items = invoice.items || [];
  for (const item of items) {
    const name = item.product_name || "Producto";
    const sku = item.product_sku ? 1 : 0;
    const lines = Math.ceil(name.length / 24);
    h += lines * 3 + 4 + sku * 3;
  }
  h += 9; // separator + tax title
  if (invoice.gravada_cents > 0) h += 3.5;
  if (invoice.exonerada_cents > 0) h += 3.5;
  if (invoice.inafecta_cents > 0) h += 3.5;
  h += 12; // IGV + line + total
  h += 4;  // moneda
  h += 10; // SON line
  h += invoice.payment_method ? 4 : 0;
  if (invoice.payment_method === "cash" && options?.cashReceivedCents !== undefined) h += 8;
  h += invoice.notes ? 4 : 0;
  if (options?.taxConfig && invoice.exonerada_cents > 0) h += 12;
  if (invoice.sunat_hash) h += 38;
  if (sellerInfo.ticketFooter) h += 8;
  h += 12; // footer + margin
  return Math.max(h, 80);
}

// ─── Main generator ───

export async function generateThermalTicket(
  invoice: Invoice,
  sellerInfo: SellerInfo,
  options?: PrintOptions,
): Promise<jsPDF> {
  const totalH = estimateHeight(invoice, sellerInfo, options);
  const doc = new jsPDF({ unit: "mm", format: [W, totalH] });

  function ctext(text: string, y: number, size: number) {
    if (!text) return;
    doc.setFontSize(size);
    doc.text(text, W / 2, y, { align: "center" });
  }

  function ltext(text: string, y: number, size: number) {
    doc.setFontSize(size);
    doc.text(text, M, y);
  }

  function rtext(text: string, y: number, size: number) {
    doc.setFontSize(size);
    doc.text(text, W - M, y, { align: "right" });
  }

  function sep(y: number) {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.15);
    doc.line(M, y, W - M, y);
  }

  function lightSep(y: number) {
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.1);
    doc.line(M, y, W - M, y);
  }

  let y = 4;

  // ═══════════════════════════════════════════
  // HEADER
  // ═══════════════════════════════════════════

  const bizName = sellerInfo.nombreComercial || sellerInfo.razonSocial || "KATSUMOTO";
  const legalName = sellerInfo.nombreComercial && sellerInfo.razonSocial && sellerInfo.nombreComercial !== sellerInfo.razonSocial
    ? sellerInfo.razonSocial : null;

  doc.setFont(FONT, "bold");
  doc.setTextColor(0, 0, 0);
  ctext(bizName, y, 8);
  y += 7;

  if (legalName) {
    doc.setFont(FONT, "normal");
    doc.setTextColor(60, 60, 60);
    ctext(legalName, y, 6);
    y += 5;
  }

  if (sellerInfo.ruc) {
    doc.setFont(FONT, "normal");
    doc.setTextColor(60, 60, 60);
    ctext(`RUC: ${sellerInfo.ruc}`, y, 6);
    y += 5;
  }

  const addrParts = [sellerInfo.direccion, sellerInfo.distrito, sellerInfo.provincia, sellerInfo.departamento].filter(Boolean);
  if (addrParts.length > 0) {
    doc.setFont(FONT, "normal");
    doc.setTextColor(80, 80, 80);
    const addrText = addrParts.join(", ");
    const addrLines = doc.splitTextToSize(addrText, CW);
    doc.setFontSize(5);
    for (const line of addrLines) {
      doc.text(line, W / 2, y, { align: "center" });
      y += 3;
    }
  }

  if (sellerInfo.phone) {
    doc.setFont(FONT, "normal");
    doc.setTextColor(80, 80, 80);
    ctext(`Tel: ${sellerInfo.phone}`, y, 5);
    y += 4;
  }

  if (sellerInfo.email) {
    doc.setFont(FONT, "normal");
    doc.setTextColor(80, 80, 80);
    ctext(`Email: ${sellerInfo.email}`, y, 5);
    y += 4;
  }

  sep(y); y += 5;

  // ═══════════════════════════════════════════
  // DOCUMENTO
  // ═══════════════════════════════════════════

  const typeInfo = INVOICE_TYPES[invoice.invoice_type];
  const typeLabel = typeInfo?.label || invoice.invoice_type.toUpperCase();

  doc.setFont(FONT, "bold");
  doc.setTextColor(0, 0, 0);
  ctext(typeLabel.toUpperCase(), y, 8);
  y += 7;
  ctext(invoice.number || "—", y, 6);
  y += 5;

  if (options?.branchName) {
    doc.setFont(FONT, "normal");
    doc.setTextColor(80, 80, 80);
    ctext(`Sede: ${options.branchName}`, y, 5);
    y += 4;
  }

  sep(y); y += 4;

  // ═══════════════════════════════════════════
  // FECHA Y HORA
  // ═══════════════════════════════════════════

  doc.setFont(FONT, "normal");
  doc.setTextColor(60, 60, 60);
  const dateStr = invoice.issue_date
    ? new Date(invoice.issue_date).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" })
    : new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  ltext(`Fecha: ${dateStr}`, y, 5.5);
  rtext(`Hora: ${timeStr}`, y, 5.5);
  y += 4;

  sep(y); y += 4;

  // ═══════════════════════════════════════════
  // CLIENTE
  // ═══════════════════════════════════════════

  doc.setFont(FONT, "bold");
  doc.setTextColor(0, 0, 0);
  ltext("CLIENTE", y, 5.5);
  y += 4;

  doc.setFont(FONT, "normal");
  doc.setTextColor(0, 0, 0);
  ltext(invoice.customer?.name || "Consumidor Final", y, 6.5);
  y += 5;

  const docLabel = invoice.customer?.document_type || "DNI";
  const docNum = invoice.customer?.document_number || "00000000";
  doc.setTextColor(60, 60, 60);
  ltext(`${docLabel}: ${docNum}`, y, 5.5);
  y += 4;

  sep(y); y += 4;

  // ═══════════════════════════════════════════
  // ITEMS
  // ═══════════════════════════════════════════

  const items = invoice.items || [];
  if (items.length === 0) {
    doc.setFont(FONT, "normal");
    doc.setTextColor(100, 100, 100);
    ctext("(sin productos)", y, 5.5);
    y += 4;
  } else {
    // Column header
    doc.setFont(FONT, "bold");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(5);
    doc.text("#", M, y);
    doc.text("Cant", M + 4, y);
    doc.text("Descripcion", M + 12, y);
    doc.text("P.Unit", M + 37, y);
    doc.text("Total", W - M, y, { align: "right" });
    y += 3;

    lightSep(y); y += 3;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const name = item.product_name || "Producto";
      const sku = item.product_sku || "";
      const qty = item.quantity || 1;
      const unitPrice = formatCents(item.unit_price_cents || 0);
      const lineTotal = formatCents(item.line_total_cents || 0);

      doc.setFont(FONT, "normal");
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(5.5);

      // Item number
      doc.text(String(i + 1), M, y);
      // Quantity
      doc.text(String(qty), M + 4, y);
      // Product name (wrapped)
      const nameW = 24; // chars for description column
      const nameLines = doc.splitTextToSize(name, CW - 16);
      doc.text(nameLines[0], M + 12, y);
      // Right-aligned prices
      doc.text(unitPrice, M + 37, y);
      doc.text(lineTotal, W - M, y, { align: "right" });
      y += 3.5;

      // Extra name lines + SKU
      for (let j = 1; j < nameLines.length; j++) {
        doc.text(nameLines[j], M + 12, y);
        y += 3;
      }
      if (sku) {
        doc.setTextColor(80, 80, 80);
        doc.text(`SKU: ${sku}`, M + 12, y);
        y += 3;
      }

      // Light separator between items
      if (i < items.length - 1) {
        lightSep(y);
        y += 2;
      }
    }
  }

  sep(y); y += 4;

  // ═══════════════════════════════════════════
  // DESGLOSE TRIBUTARIO
  // ═══════════════════════════════════════════

  doc.setFont(FONT, "bold");
  doc.setTextColor(0, 0, 0);
  ltext("DESGLOSE TRIBUTARIO", y, 5.5);
  y += 4;

  doc.setFont(FONT, "normal");
  doc.setFontSize(5.5);

  if (invoice.gravada_cents > 0) {
    doc.setTextColor(60, 60, 60);
    ltext("Op. Gravadas (10)", y, 5.5);
    doc.setTextColor(0, 0, 0);
    rtext(formatCents(invoice.gravada_cents), y, 5.5);
    y += 3.5;
  }
  if (invoice.exonerada_cents > 0) {
    doc.setTextColor(60, 60, 60);
    ltext("Op. Exoneradas (20)", y, 5.5);
    doc.setTextColor(0, 0, 0);
    rtext(formatCents(invoice.exonerada_cents), y, 5.5);
    y += 3.5;
  }
  if (invoice.inafecta_cents > 0) {
    doc.setTextColor(60, 60, 60);
    ltext("Op. Inafectas (30)", y, 5.5);
    doc.setTextColor(0, 0, 0);
    rtext(formatCents(invoice.inafecta_cents), y, 5.5);
    y += 3.5;
  }

  doc.setTextColor(60, 60, 60);
  ltext(`IGV (${(IGV_RATE * 100).toFixed(0)}%)`, y, 5.5);
  doc.setTextColor(0, 0, 0);
  rtext(formatCents(invoice.igv_cents || 0), y, 5.5);
  y += 2;

  doc.setTextColor(60, 60, 60);
  ltext("Moneda: SOLES (PEN)", y, 5.5);
  y += 2;

  sep(y); y += 5;

  // ═══════════════════════════════════════════
  // TOTAL
  // ═══════════════════════════════════════════

  doc.setFont(FONT, "bold");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  ltext("TOTAL", y, 10);
  rtext(formatCents(invoice.total_cents || 0), y, 10);
  y += 8;

  // ─── SON: (monto en letras) ───
  const amountText = centsToText(invoice.total_cents || 0);
  doc.setFont(FONT, "normal");
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(5);
  const sonLines = doc.splitTextToSize(`SON: ${amountText}`, CW);
  for (const line of sonLines) {
    ltext(line, y, 5);
    y += 3;
  }

  sep(y); y += 4;

  // ═══════════════════════════════════════════
  // PAGO
  // ═══════════════════════════════════════════

  if (invoice.payment_method) {
    const methodLabel = PAYMENT_METHODS[invoice.payment_method]?.label || invoice.payment_method;
    doc.setFont(FONT, "normal");
    doc.setTextColor(60, 60, 60);
    ltext(`Pago: ${methodLabel}`, y, 5.5);
    y += 4;
  }

  if (invoice.payment_method === "cash" && options?.cashReceivedCents !== undefined) {
    doc.setFont(FONT, "normal");
    doc.setTextColor(0, 0, 0);
    ltext(`Recibido: ${formatCents(options.cashReceivedCents)}`, y, 5.5);
    y += 4;
    const change = options.cashReceivedCents - (invoice.total_cents || 0);
    if (change > 0) {
      doc.setTextColor(60, 60, 60);
      ltext(`Vuelto: ${formatCents(change)}`, y, 5.5);
      y += 4;
    }
  }

  if (invoice.notes) {
    doc.setFont(FONT, "normal");
    doc.setTextColor(80, 80, 80);
    ltext(`Obs: ${invoice.notes}`, y, 5.5);
    y += 4;
  }

  // ═══════════════════════════════════════════
  // SELVA
  // ═══════════════════════════════════════════

  if (options?.taxConfig && invoice.exonerada_cents > 0) {
    sep(y); y += 3;
    const determination = determineTax({
      sellerProvinceCode: options.taxConfig.sellerProvinceCode,
      sellerDistrictCode: options.taxConfig.sellerDistrictCode,
      productFamily: null,
      selvaLawEnabled: options.taxConfig.selvaLawEnabled,
    });
    const legalText = getLegalBasisText(determination, options.taxConfig.sellerProvinceCode, options.taxConfig.sellerDistrictCode);
    if (legalText) {
      doc.setFont(FONT, "normal");
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(legalText, CW);
      doc.setFontSize(4.5);
      doc.text(lines, M, y);
      y += lines.length * 2.5 + 2;
    }
  }

  // ═══════════════════════════════════════════
  // SUNAT
  // ═══════════════════════════════════════════

  if (invoice.sunat_hash) {
    sep(y); y += 4;

    doc.setFont(FONT, "normal");
    doc.setTextColor(80, 80, 80);
    ctext("Representacion Impresa de la", y, 5); y += 3;
    ctext(`${typeLabel} ${invoice.number}`, y, 5); y += 3;

    const typeCode = INVOICE_TYPE_SUNAT_CODE[invoice.invoice_type] || "01";
    const docTypeCode = DOCUMENT_TYPE_SUNAT_CODE[invoice.customer?.document_type || "DNI"] || "1";
    const docNumber = invoice.customer?.document_number || "00000000";

    const qrData = [
      sellerInfo.ruc, typeCode,
      invoice.serie || invoice.number.split("-")[0] || "",
      String(invoice.correlativo || invoice.number.split("-")[1] || ""),
      (invoice.igv_cents / 100).toFixed(2), (invoice.total_cents / 100).toFixed(2),
      invoice.issue_date || new Date().toISOString().split("T")[0],
      docTypeCode, docNumber, invoice.sunat_hash,
    ].join("|");

    try {
      const qrBase64 = await QRCode.toDataURL(qrData, { width: 100, margin: 1, color: { dark: "#000000", light: "#ffffff" } });
      const qrSize = 18;
      doc.addImage(qrBase64, "PNG", (W - qrSize) / 2, y, qrSize, qrSize);
      y += qrSize + 2;
    } catch { /* skip QR */ }

    doc.setFont(FONT, "normal");
    doc.setTextColor(80, 80, 80);
    ltext(`Hash: ${invoice.sunat_hash}`, y, 4.5); y += 3;
    ltext("Verifique en cpe.sunat.gob.pe", y, 4.5); y += 4;
  }

  // ═══════════════════════════════════════════
  // FOOTER CONFIGURABLE
  // ═══════════════════════════════════════════

  if (sellerInfo.ticketFooter) {
    sep(y); y += 3;
    doc.setFont(FONT, "normal");
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(4.5);
    const footerLines = doc.splitTextToSize(sellerInfo.ticketFooter, CW);
    doc.text(footerLines, M, y);
    y += footerLines.length * 2.5 + 2;
  }

  // ═══════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════

  sep(y); y += 3;

  doc.setFont(FONT, "normal");
  doc.setTextColor(100, 100, 100);
  ctext(`Katsumoto v2.1.7 — ${sellerInfo.nombreComercial || sellerInfo.razonSocial}`, y, 4.5);
  y += 3;
  ctext(new Date().toLocaleString("es-PE"), y, 4.5);

  // ─── Output ───
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const action = options?.action || "download";

  if (action === "download") {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${invoice.number}-ticket.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else {
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  return doc;
}
