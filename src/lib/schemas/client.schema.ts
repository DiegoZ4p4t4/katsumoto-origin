// ── Client Schemas (Zod) ──
// Validation schemas for client/customer forms

import { z } from "zod";
import { DOCUMENT_LENGTHS } from "@/lib/constants";

// ── Enums matching domain types ──
export const DocumentTypeEnum = z.enum(["RUC", "DNI", "Pasaporte", "CE", "Otros"]);

// ── Client Form ──
export const clientFormSchema = z.object({
  name: z.string().min(1, "Nombre/Razon social requerido").max(200, "Maximo 200 caracteres"),
  document_type: DocumentTypeEnum,
  document_number: z.string().min(1, "Numero de documento requerido"),
  phone: z.string().max(20, "Maximo 20 caracteres").default(""),
  email: z.string().email("Email invalido").or(z.literal("")).default(""),
  address: z.string().max(200, "Maximo 200 caracteres").default(""),
  city: z.string().max(100, "Maximo 100 caracteres").default(""),
  department_code: z.string().regex(/^\d{2}$|^$/, "Codigo dept. inválido").default(""),
  province_code: z.string().regex(/^\d{4}$|^$/, "Codigo prov. inválido").default(""),
  district_code: z.string().regex(/^\d{6}$|^$/, "Codigo dist. inválido").default(""),
}).superRefine((data, ctx) => {
  const digits = data.document_number.replace(/\D/g, "");
  const limits = DOCUMENT_LENGTHS[data.document_type];
  if (!limits) {
    if (digits.length < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Numero de documento requerido", path: ["document_number"] });
    }
    return;
  }
  if (digits.length < limits.min || digits.length > limits.max) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${data.document_type}: ${limits.min === limits.max ? `debe tener ${limits.min} dígitos` : `debe tener ${limits.min}-${limits.max} dígitos`}`,
      path: ["document_number"],
    });
  }
});
export type ClientFormValues = z.infer<typeof clientFormSchema>;
