import jsPDF from "jspdf";
import { encodeEAN13, isValidEAN13 } from "@/lib/barcode";
import { formatCents } from "@/lib/format";
import type { Product } from "@/lib/types";
import type { SellerInfo } from "../seller-info";

const MM_TO_PT = 2.83464567;

const LABEL_W_MM = 63;
const LABEL_H_MM = 33.9;
const MARGIN_X_MM = 8.5;
const MARGIN_Y_MM = 14;
const COLS = 3;
const ROWS = 8;
const LABELS_PER_PAGE = COLS * ROWS;

const LABEL_W_PT = LABEL_W_MM * MM_TO_PT;
const LABEL_H_PT = LABEL_H_MM * MM_TO_PT;
const MARGIN_X_PT = MARGIN_X_MM * MM_TO_PT;
const MARGIN_Y_PT = MARGIN_Y_MM * MM_TO_PT;

// A4
const PAGE_W = 210 * MM_TO_PT;
const PAGE_H = 297 * MM_TO_PT;

export interface LabelOptions {
  sellerInfo: SellerInfo;
  products: Product[];
  copies?: number;
}

function drawEan13Barcode(
  doc: jsPDF,
  x: number,
  y: number,
  code: string,
  width: number,
  height: number
) {
  if (!code || code.length !== 13 || !isValidEAN13(code)) return;

  const binary = encodeEAN13(code);
  const modW = width / 95;

  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === "0") continue;
    const isGuard = i < 3 || (i >= 45 && i < 50) || i >= 92;
    const barH = isGuard ? height : height - 3;
    doc.setFillColor(0, 0, 0);
    doc.rect(x + i * modW, y, modW, barH, "F");
  }

  doc.setFontSize(5.5);
  doc.setFont("courier", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text(code[0], x, y + height + 3, { baseline: "top" });
  doc.text(code.slice(1, 7), x + modW * 4, y + height + 3, {
    baseline: "top",
    charSpace: "auto",
  } as Parameters<typeof doc.text>[3]);
  doc.text(code.slice(7, 13), x + modW * 50, y + height + 3, {
    baseline: "top",
    charSpace: "auto",
  } as Parameters<typeof doc.text>[3]);
}

function drawSingleLabel(
  doc: jsPDF,
  product: Product,
  x: number,
  y: number,
  seller: SellerInfo
) {
  const PADDING = 2 * MM_TO_PT;
  const bx = x + PADDING;
  const by = y + PADDING;
  const bw = LABEL_W_PT - 2 * PADDING;
  const bh = LABEL_H_PT - 2 * PADDING;

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.1);
  doc.rect(x, y, LABEL_W_PT, LABEL_H_PT);

  const businessName = seller.nombreComercial || seller.razonSocial || "";
  const barcodeY = by + 4;
  const barcodeH = 10 * MM_TO_PT;

  doc.setFontSize(5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(businessName.toUpperCase(), bx, by, { baseline: "top" });

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  const name = product.name.length > 28 ? product.name.slice(0, 27) + "\u2026" : product.name;
  doc.text(name, bx, barcodeY - 1.5, { baseline: "bottom" });

  drawEan13Barcode(doc, bx, barcodeY, product.barcode, bw, barcodeH);

  const infoY = barcodeY + barcodeH + 6;
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`SKU: ${product.sku}`, bx, infoY, { baseline: "top" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(230, 80, 0);
  const price = formatCents(product.price_cents);
  doc.text(price, bx + bw, infoY, { baseline: "top", align: "right" });

  doc.setFontSize(5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(product.unit, bx + bw, infoY + 4, { baseline: "top", align: "right" });
}

export function generateProductLabels(options: LabelOptions): jsPDF {
  const { sellerInfo, products, copies = 1 } = options;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const totalPages = Math.ceil((products.length * copies) / LABELS_PER_PAGE);

  let labelIdx = 0;
  let pageCount = 0;
  let printed = 0;

  while (printed < products.length * copies) {
    if (pageCount > 0) doc.addPage();
    pageCount++;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const copyIdx = Math.floor(labelIdx / products.length);
        const prodIdx = labelIdx % products.length;
        const product = products[prodIdx];

        const lx = MARGIN_X_PT + col * LABEL_W_PT;
        const ly = MARGIN_Y_PT + row * LABEL_H_PT;

        drawSingleLabel(doc, product, lx, ly, sellerInfo);
        labelIdx++;
        printed++;

        if (printed >= products.length * copies) break;
      }
      if (printed >= products.length * copies) break;
    }
  }

  return doc;
}

export function downloadLabels(options: LabelOptions): void {
  const doc = generateProductLabels(options);
  const firstProduct = options.products[0];
  const name = options.products.length === 1
    ? `etiqueta-${firstProduct.sku}`
    : `etiquetas-${options.products.length}-productos`;
  doc.save(`${name}.pdf`);
}

export function printLabels(options: LabelOptions): void {
  const doc = generateProductLabels(options);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");
  if (printWindow) {
    printWindow.onload = () => setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else {
    window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
