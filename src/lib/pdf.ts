// Lazy-loaded PDF generation — evita cargar 437KB de jsPDF + html2canvas en el bundle inicial
export async function generateInvoicePDF(...args: Parameters<typeof import("./printing/generate").generateInvoice>) {
  const { generateInvoice } = await import("./printing/generate");
  return generateInvoice(...args);
}

export async function generateThermalTicket(...args: Parameters<typeof import("./printing/formats/thermal-ticket").generateThermalTicket>) {
  const { generateThermalTicket } = await import("./printing/formats/thermal-ticket");
  return generateThermalTicket(...args);
}

export type { SellerInfo } from "./printing/seller-info";
export type { PdfTaxConfig, PrintOptions, DocumentFormat, PrintAction } from "./printing/types";
