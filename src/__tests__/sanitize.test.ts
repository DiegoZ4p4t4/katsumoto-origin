import { describe, it, expect } from "vitest";
import {
  sanitizeInput,
  sanitizeName,
  sanitizePhone,
  sanitizeEmail,
  sanitizeDocumentNumber,
  sanitizeAddress,
  sanitizeNotes,
  sanitizeSearchQuery,
} from "@/lib/sanitize";

describe("sanitize", () => {
  describe("sanitizeInput", () => {
    it("remueve tags <script>", () => {
      expect(sanitizeInput('<script>alert("xss")</script>hello')).toBe("hello");
    });

    it("remueve tags HTML", () => {
      expect(sanitizeInput("<b>bold</b> text")).toBe("bold text");
    });

    it("trunca a maxLength", () => {
      expect(sanitizeInput("abc", 2)).toBe("ab");
    });

    it("maneja null/undefined", () => {
      expect(sanitizeInput("")).toBe("");
      expect(sanitizeInput(undefined as unknown as string)).toBe("");
    });

    it("preserva texto normal", () => {
      expect(sanitizeInput("Juan Pérez, Jr. Santo Toribio 620")).toBe("Juan Pérez, Jr. Santo Toribio 620");
    });
  });

  describe("sanitizeName", () => {
    it("remueve HTML y limita a 200 chars", () => {
      expect(sanitizeName("<script>xss</script>Juan")).toBe("Juan");
    });

    it("trunca nombres largos", () => {
      const long = "A".repeat(300);
      expect(sanitizeName(long).length).toBe(200);
    });
  });

  describe("sanitizePhone", () => {
    it("solo permite dígitos, +, -, (), espacio", () => {
      expect(sanitizePhone("+51 924-532-277")).toBe("+51 924-532-277");
    });

    it("remueve letras y caracteres especiales", () => {
      expect(sanitizePhone("abc924def532<script>277")).toBe("924532277");
    });

    it("trunca a 20 chars", () => {
      expect(sanitizePhone("12345678901234567890123").length).toBe(20);
    });
  });

  describe("sanitizeEmail", () => {
    it("lowercase y trim", () => {
      expect(sanitizeEmail("  JUAN@Katsumoto.SHOP  ")).toBe("juan@katsumoto.shop");
    });

    it("trunca a 254 chars", () => {
      const long = "a".repeat(300) + "@test.com";
      expect(sanitizeEmail(long).length).toBe(254);
    });
  });

  describe("sanitizeDocumentNumber", () => {
    it("RUC: solo dígitos, máx 11", () => {
      expect(sanitizeDocumentNumber("20-608183672-extra", "RUC")).toBe("20608183672");
    });

    it("DNI: solo dígitos, máx 8", () => {
      expect(sanitizeDocumentNumber("12345678-extra", "DNI")).toBe("12345678");
    });

    it("maneja string vacío", () => {
      expect(sanitizeDocumentNumber("", "DNI")).toBe("");
    });
  });

  describe("sanitizeAddress", () => {
    it("remueve HTML y limita a 500 chars", () => {
      expect(sanitizeAddress("<div>Jr. Santo Toribio 620</div>")).toBe("Jr. Santo Toribio 620");
    });
  });

  describe("sanitizeNotes", () => {
    it("remueve scripts de notas", () => {
      expect(sanitizeNotes("Entrega urgente<script>alert(1)</script>")).toBe("Entrega urgente");
    });
  });

  describe("sanitizeSearchQuery", () => {
    it("remueve % y _ para prevenir SQL injection via LIKE", () => {
      expect(sanitizeSearchQuery("test%_query\\")).toBe("testquery");
    });

    it("trunca a 200 chars", () => {
      const long = "x".repeat(300);
      expect(sanitizeSearchQuery(long).length).toBe(200);
    });
  });
});
