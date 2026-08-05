# Plan: Cumplimiento SUNAT - Checklist de Facturacion Electronica

## Estado: PLANIFICADO
## Prioridad: ALTA
## Creado: 2025-04-23
## Basado en: Auditoria completa de 25 puntos SUNAT

## Contexto

Auditoria interna del sistema Katsumoto contra checklist de cumplimiento SUNAT.
El sistema ya fue validado contra SUNAT beta: F001-1 (aceptada), B001-1 (aceptada via resumen), baja F001-1 (aceptada).
Se identificaron bugs criticos, gaps funcionales y mejoras necesarias.

---

## FASE 1: Bugs Criticos (prioridad inmediata)

### 1.1 Fix QR en ticket termico — CRITICO

**Problema:** `thermal-ticket.ts:221-222` usa `cents.toFixed(0)` en vez de `(cents/100).toFixed(2)` para IGV y total en datos QR. SUNAT espera soles decimales, no centavos enteros.

**Archivo:** `src/lib/printing/formats/thermal-ticket.ts`
**Lineas:** 221-222
**Fix:**
```typescript
// ANTES (incorrecto)
igv_cents.toFixed(0)
total_cents.toFixed(0)

// DESPUES (correcto)
(invoice.igv_cents / 100).toFixed(2)
(invoice.total_cents / 100).toFixed(2)
```

**Impacto:** Toda boleta/factura impresa en termico tiene QR invalido.

---

### 1.2 Fix TaxScheme en notas (note.ts) — ALTO

**Problema:** Linea 83-87 de `note.ts` hardcodea `TaxScheme ID=1000/IGV/VAT` sin importar el `tip_afe_igv` real del item. Notas con items exonerados/inafectos tendran esquema de impuesto incorrecto y seran RECHAZADAS por SUNAT.

**Archivo:** `supabase/functions/sunat-billing/sunat/xml/templates/note.ts`
**Lineas:** 83-87
**Fix:** Usar el mismo mapeo que `invoice.ts` (lineas 101-105) que mapea por tipo de afectacion:
- gravado → 1000/IGV/VAT
- exonerado → 9997/EXO/VAT
- inafecto → 9998/FRE/FRE
- exportacion → 9995/EXP/FRE

---

### 1.3 Fix LegalMonetaryTotal en notas — ALTO

**Problema:** `note.ts` solo emite `PayableAmount` en `LegalMonetaryTotal`. SUNAT UBL 2.1 requiere `LineExtensionAmount` + `TaxInclusiveAmount` + `PayableAmount`.

**Archivo:** `supabase/functions/sunat-billing/sunat/xml/templates/note.ts`
**Lineas:** 220-238
**Fix:** Agregar los campos faltantes, consistente con `invoice.ts`.

---

### 1.4 Fix TaxTotal a nivel documento en notas — ALTO

**Problema:** `note.ts` solo emite un `TaxSubtotal` para gravadas (1000). Si la nota tiene items exonerados/inafectos, sus subtotales no se representan a nivel documento.

**Archivo:** `supabase/functions/sunat-billing/sunat/xml/templates/note.ts`
**Lineas:** 220-238
**Fix:** Usar la misma logica de `buildTaxSubtotals()` de `invoice.ts` que genera subtotales separados para gravada/exonerada/inafecta.

---

### 1.5 Fix typo "CREDITITO" — BAJO

**Problema:** `receipt-builder.ts:188` dice "NOTA DE CREDITITO ELECTRONICA" en vez de "NOTA DE CREDITO ELECTRONICA".

**Archivo:** `src/lib/printing/thermal/receipt-builder.ts`
**Linea:** 188

---

## FASE 2: Cumplimiento SUNAT (gaps funcionales)

### 2.1 Mapeo unidades de medida (Catalogo 3)

**Problema:** `transformers.ts:74` hardcodea unidad "NIU" para todos los items, ignorando la unidad real del producto.

**Alcance:**
- Crear mapa `UNIDAD_SUNAT_MAP` en `constants.ts`: `{ "Unidad": "NIU", "Kilogramo": "KGM", "Litro": "LTR", "Galon": "GLL", "Metro": "MTR", ... }`
- Modificar `transformers.ts` para usar `UNIDAD_SUNAT_MAP[item.unidad] || "NIU"`
- Agregar campo `sunat_unit_code` a tabla `products` (opcional, para override manual)

**Archivos:**
- `supabase/functions/sunat-billing/sunat/constants.ts`
- `supabase/functions/sunat-billing/sunat/transformers.ts`
- `src/lib/constants/products.ts`

---

### 2.2 Persistir datos CDR en BD

**Problema:** ResponseCode, Description y Notes del CDR se extraen pero no se guardan en BD. Se pierden despues de la respuesta API.

**Alcance:**
- Agregar columnas a `invoices`: `sunat_cdr_code TEXT`, `sunat_cdr_description TEXT`, `sunat_cdr_notes JSONB`
- Migracion SQL con ALTER TABLE
- Modificar `index.ts` para persistir datos CDR despues de parsear

**Archivos:**
- Nueva migracion SQL
- `supabase/functions/sunat-billing/index.ts`
- `src/lib/types/invoice.ts`

---

### 2.3 Fix SOAPAction headers

**Problema:** `soap-client.ts` envia SOAPAction vacio para sendSummary y getStatus. Puede funcionar en beta pero fallar en produccion.

**Alcance:**
- `sendSummary`: SOAPAction = `urn:sendSummary`
- `getStatus`: SOAPAction = `urn:getStatus`

**Archivo:** `supabase/functions/sunat-billing/sunat/soap/soap-client.ts`

---

### 2.4 Timeout y retry en llamadas SUNAT

**Problema:** Fetch calls sin timeout explicito. Sin retry ante errores de red transitorios.

**Alcance:**
- Timeout: sendBill=30s, getStatus=15s, sendSummary=20s, REST=15s
- Retry: 3 intentos con backoff exponencial (1s, 2s, 4s)
- AbortController para timeout

**Archivos:**
- `supabase/functions/sunat-billing/sunat/soap/soap-client.ts`
- `supabase/functions/sunat-billing/sunat/gre/gre-rest-client.ts`

---

### 2.5 Validacion de fecha de emision (plazos SUNAT)

**Problema:** No se valida que la fecha de emision este dentro del plazo permitido por SUNAT.

**Alcance:**
- Facturas: envio inmediato (mismo dia)
- Boletas: dentro del plazo del resumen diario
- Alerta si hay documentos con fecha antigua sin enviar

**Archivos:**
- `supabase/functions/sunat-billing/index.ts` (validacion pre-envio)
- `src/pages/invoices/` (alerta en UI)

---

### 2.6 Moneda explicita

**Problema:** PEN es implicito. `note.ts` hardcodea "PEN". No hay soporte multi-moneda.

**Alcance:**
- Agregar campo `moneda` a `invoices` con default "PEN"
- Modificar templates para usar `document.moneda`
- Preparar para USD con tipo de cambio futuro

**Archivos:**
- `supabase/functions/sunat-billing/sunat/xml/templates/note.ts`
- `supabase/functions/sunat-billing/sunat/transformers.ts`
- `src/lib/types/invoice.ts`

---

### 2.7 Medio de pago en XML (Catalogo 59)

**Problema:** Solo se distingue Contado/Credito en XML. No se incluye codigo de medio de pago (Catalogo 59).

**Alcance:**
- Agregar `PaymentMeans` con codigo segun metodo: efectivo=001, tarjeta=004, transferencia=005, etc.
- Modificar `invoice.ts` template

**Archivos:**
- `supabase/functions/sunat-billing/sunat/xml/templates/invoice.ts`
- `supabase/functions/sunat-billing/sunat/transformers.ts`
- `src/lib/constants/invoices.ts`

---

### 2.8 Motivos de nota de debito (Catalogo 09, codigos 08-11)

**Problema:** Solo estan definidos motivos de NC (01-07). Faltan motivos de ND (08-11).

**Alcance:**
- Agregar a `CREDIT_NOTE_REASONS` o crear `DEBIT_NOTE_REASONS`
- 08=Diferencia de precio, 09=Diferencia en cantidad, 10=Descuento posterior, 11=Interes por mora

**Archivo:** `src/lib/constants/invoices.ts`

---

## FASE 3: Seguridad y Robustez

### 3.1 Eliminar fallback encryption key

**Problema:** `credentials.ts` tiene fallback `katsumoto-enc-key-2026` si `SUNAT_CREDENTIALS_KEY` no existe.

**Alcance:** Remover fallback. Lanzar error si el secret no esta configurado.

**Archivo:** `supabase/functions/sunat-billing/sunat/crypto/credentials.ts`

---

### 3.2 Fix tryDecrypt silent failure

**Problema:** Si la desencriptacion falla, `tryDecrypt` retorna el valor encriptado como si fuera plaintext.

**Alcance:** Lanzar error o retornar null en vez del valor crudo.

**Archivo:** `supabase/functions/sunat-billing/sunat/crypto/credentials.ts`

---

### 3.3 Restringir CORS

**Problema:** `Access-Control-Allow-Origin: *` permite cualquier origen.

**Alcance:** Restringir a orígenes conocidos (localhost, dominio app, tauri://localhost).

**Archivo:** `supabase/functions/sunat-billing/sunat/http.ts`

---

### 3.4 Validacion dígito verificador RUC

**Problema:** Solo se valida formato (11 digitos, empieza con 1/2). Falta algoritmo modulo 11.

**Alcance:**
- Implementar `validateRucCheckDigit(ruc: string): boolean`
- Integrar en `src/lib/format.ts` y Zod schema

**Archivo:** `src/lib/format.ts`, `src/lib/schemas/client.schema.ts`

---

## FASE 4: Almacenamiento y Trazabilidad

### 4.1 Almacenar XML de summary/voided

**Problema:** Solo invoices y despatches guardan XML firmado en Storage. Resumenes y bajas no se persisten.

**Alcance:** Subir XML a Storage para summary y voided documents.

**Archivo:** `supabase/functions/sunat-billing/index.ts`

---

### 4.2 Auditoria de operaciones SUNAT

**Problema:** No se loguean operaciones SUNAT (send, void, summary) en `audit_log`.

**Alcance:**
- Agregar acciones: `sunat.send`, `sunat.summary`, `sunat.voided`, `sunat.ticket_check`, `sunat.despatch.send`, `sunat.despatch.check`
- Insertar en `audit_log` desde `index.ts` para cada operacion

**Archivos:**
- `src/services/audit.service.ts`
- `supabase/functions/sunat-billing/index.ts`

---

### 4.3 CDR status en resumen diario

**Problema:** `sunat_summary_log` no almacena path del CDR cuando el ticket se resuelve.

**Alcance:** Agregar columna `cdr_path` y guardar CDR del resumen cuando check-ticket retorna aceptado.

**Archivos:**
- Migracion SQL
- `supabase/functions/sunat-billing/index.ts`

---

### 4.4 Texto "Representacion Impresa" completo

**Problema:** Falta texto "Autorizado mediante Resolucion de Intendencia..." en impresos. Hash truncado en termico.

**Alcance:**
- Agregar texto de autorizacion
- Mostrar hash completo en termico
- Incluir estado CDR y fecha aceptacion

**Archivos:**
- `src/lib/printing/formats/thermal-ticket.ts`
- `src/lib/printing/thermal/receipt-builder.ts`
- `src/lib/printing/components/pdf-qr-hash.ts`

---

## FASE 5: Validaciones Inteligentes (nivel avanzado)

### 5.1 Alertas automaticas

- "Factura sin CDR en 24h" → query + notificacion
- "Certificado por vencer" → check expiry date del PEM
- "Documento rechazado sin corregir" → query por status=issued + sunat_error_code IS NOT NULL

### 5.2 Dashboard de riesgo tributario

- Cruce ventas vs XML emitidos
- XML vs libros electronicos
- Total declarado vs total emitido

### 5.3 Cola de reenvio automatico

- Documents en estado `issued` con `sunat_sent_at IS NULL` → reenvio automatico
- Scheduler que corre cada N minutos

---

## Resumen de tareas

| Fase | Tareas | Prioridad |
|---|---|---|
| FASE 1: Bugs criticos | 5 | INMEDIATA |
| FASE 2: Cumplimiento | 8 | ALTA |
| FASE 3: Seguridad | 4 | MEDIA |
| FASE 4: Almacenamiento | 4 | MEDIA |
| FASE 5: Inteligente | 3 | BAJA |
| **TOTAL** | **24** | |

## Dependencias

- FASE 1 no tiene dependencias (fixes independientes)
- FASE 2.1 (unidades) puede hacerse en paralelo con FASE 1
- FASE 2.2 (CDR BD) requiere migracion SQL
- FASE 4.2 (auditoria) requiere FASE 2.2 (columnas CDR)
- FASE 5 depende de FASE 2 y 4 completadas

## Notas

- Cada cambio en Edge Function requiere re-deploy + parchear verify_jwt=false
- Cambios en templates XML deben probarse en SUNAT beta antes de produccion
- Mantener compatibilidad con los 2 comprobantes ya emitidos y aceptados
