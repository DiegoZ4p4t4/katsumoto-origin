export interface ValidationResult {
  valid: boolean;
  code?: string;
  message?: string;
}

const RUC_FACTORS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export function validateRuc(ruc: string): boolean {
  if (!/^\d{11}$/.test(ruc)) return false;
  if (!["10", "15", "17", "20"].includes(ruc.substring(0, 2))) return false;

  const digits = ruc.split("").map(Number);
  const sum = RUC_FACTORS.reduce((acc, factor, i) => acc + digits[i] * factor, 0);
  const remainder = sum % 11;
  const checkDigit = remainder < 2 ? 0 : 11 - remainder;

  return checkDigit === digits[10];
}

const REQUIRED_FIELDS: Record<string, string[]> = {
  test: [],
  send: ["invoice_id"],
  "send-summary": ["fecha"],
  "send-voided": ["invoice_id"],
  "check-ticket": ["ticket"],
  "check-summary-ticket": ["ticket"],
  "send-despatch": ["despatch_id"],
  "check-despatch-ticket": ["despatch_id", "ticket"],
};

export function validateBody(action: string, body: Record<string, unknown>): ValidationResult {
  const required = REQUIRED_FIELDS[action];
  if (!required) {
    return { valid: false, code: "UNKNOWN_ACTION", message: `Acción desconocida: ${action}` };
  }
  for (const field of required) {
    const value = body[field];
    if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
      return { valid: false, code: "MISSING_FIELD", message: `Campo requerido: ${field}` };
    }
  }
  if (action === "send" || action === "send-summary" || action === "send-voided" || action === "send-despatch") {
    const bodySize = JSON.stringify(body).length;
    if (bodySize > 100_000) {
      return { valid: false, code: "PAYLOAD_TOO_LARGE", message: "Body excede 100KB" };
    }
  }
  return { valid: true };
}

export function validatePreSend(invoice: Record<string, unknown>): ValidationResult {
  const invoiceType = String(invoice.invoice_type ?? "");

  if (invoiceType === "factura") {
    const customerDoc = invoice.customer_document_number as string;
    const customerDocType = invoice.customer_document_type as string;

    if (customerDocType === "RUC") {
      if (!validateRuc(customerDoc)) {
        return {
          valid: false,
          code: "INVALID_RUC",
          message: `El RUC ${customerDoc} no es válido (módulo 11)`,
        };
      }
    } else if (customerDocType !== "DNI" && customerDocType !== "CE") {
      return {
        valid: false,
        code: "FACTURA_REQUIRES_RUC_DNI",
        message: "Factura requiere cliente con RUC o DNI válido",
      };
    }
  }

  const issueDate = String(invoice.issue_date ?? "");
  if (issueDate) {
    const daysDiff = Math.floor(
      (Date.now() - new Date(issueDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff > 7) {
      return {
        valid: false,
        code: "STALE_DATE",
        message: `Fecha de emisión (${issueDate}) excede los 7 días permitidos por SUNAT`,
      };
    }
  }

  return { valid: true };
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

export function checkRateLimit(key: string): ValidationResult {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { valid: true };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      valid: false,
      code: "RATE_LIMITED",
      message: `Demasiadas solicitudes. Reintente en ${retryAfter}s`,
    };
  }
  entry.count++;
  return { valid: true };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 60_000);
