import { Receipt, Endpoint } from 'fractuyo';

export { Endpoint };

export function formatDate(date: Date): string {
  return Receipt.displayDate(date);
}

export function formatTime(date: Date): string {
  return Receipt.displayTime(date);
}

export function amountToWords(
  amount: number,
  junctor: string = 'CON',
  tail: string = 'SOLES'
): string {
  return Receipt.amountToWords(amount, junctor, tail);
}

export function generateQrData(
  ruc: string,
  docTypeCode: string,
  serie: string,
  numero: number,
  totalConIgv: number,
  totalIgv: number,
  fechaEmision: string,
  clienteDocType: string,
  clienteDocNumber: string,
  hash?: string
): string {
  const igv = totalIgv.toFixed(2);
  const total = totalConIgv.toFixed(2);
  const igvRate = totalIgv > 0 ? '18.00' : '0.00';

  return `${ruc}|${docTypeCode}|${serie}|${numero}|${igvRate}|${total}|${fechaEmision}|${clienteDocType}|${clienteDocNumber}${hash ? `|${hash}` : ''}`;
}

export function toDecimal(cents: number): number {
  return Math.round(cents) / 100;
}

export function toCents(decimal: number): number {
  return Math.round(decimal * 100);
}
