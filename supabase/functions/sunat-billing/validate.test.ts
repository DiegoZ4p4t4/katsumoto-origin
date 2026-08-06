// Tests de validacion RUC (mod-11 SUNAT)
// Ejecutar: deno test supabase/functions/sunat-billing/validate.test.ts

import { assertEquals } from "jsr:@std/assert";
import { validateRuc } from "./sunat/validate.ts";

Deno.test("validateRuc: RUC de la org es valido", () => {
  assertEquals(validateRuc("20608183672"), true);
});

Deno.test("validateRuc: acepta prefijos antes rechazados por la whitelist", () => {
  // prefijo 16 (antes la whitelist solo permitia 10/15/17/20)
  assertEquals(validateRuc("16000000004"), true);
  // prefijo 12
  assertEquals(validateRuc("12000000009"), true);
});

Deno.test("validateRuc: rechaza RUC con digito verificador incorrecto", () => {
  assertEquals(validateRuc("20608183671"), false);
  assertEquals(validateRuc("12345678901"), false);
});

Deno.test("validateRuc: rechaza longitud invalida o primer digito no 1/2", () => {
  assertEquals(validateRuc("1234567890"), false);
  assertEquals(validateRuc("30608183672"), false);
  assertEquals(validateRuc("abcdefghijk"), false);
});

Deno.test("validateRuc: digito verificador 0 (rem<2) es valido", () => {
  // 20000000000 -> sum=10, rem=10 -> no es el caso; buscamos rem 0/1.
  // 10000000000 -> 1*5=5, resto 0 -> sum=5, rem=5, check=6 => 10000000006
  assertEquals(validateRuc("10000000006"), true);
});
