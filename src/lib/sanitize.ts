const MAX_STRING_LENGTH = 5000;
const SCRIPT_PATTERN = /<script[^>]*>[\s\S]*?<\/script>/gi;
const HTML_PATTERN = /<[^>]*>/g;

export function sanitizeInput(input: string, maxLength: number = MAX_STRING_LENGTH): string {
  if (!input || typeof input !== "string") return "";
  return input
    .replace(SCRIPT_PATTERN, "")
    .replace(HTML_PATTERN, "")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeName(name: string): string {
  return sanitizeInput(name, 200);
}

export function sanitizeNotes(notes: string): string {
  return sanitizeInput(notes, 500);
}

export function sanitizeAddress(address: string): string {
  return sanitizeInput(address, 500);
}

export function sanitizePhone(phone: string): string {
  if (!phone) return "";
  return phone.replace(/[^\d+\-() ]/g, "").trim().slice(0, 20);
}

export function sanitizeEmail(email: string): string {
  if (!email) return "";
  return email.trim().toLowerCase().slice(0, 254);
}

export function sanitizeDocumentNumber(doc: string, docType: string): string {
  if (!doc) return "";
  const cleaned = doc.replace(/\D/g, "");
  const maxLen = docType === "RUC" ? 11 : docType === "DNI" ? 8 : 15;
  return cleaned.slice(0, maxLen);
}

export function sanitizeSearchQuery(query: string): string {
  if (!query) return "";
  return query.replace(/[%_\\]/g, "").trim().slice(0, 200);
}
