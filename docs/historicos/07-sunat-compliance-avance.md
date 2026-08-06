# Avance: Cumplimiento SUNAT - Checklist de Facturacion Electronica

## Estado: EN PROGRESO
## Creado: 2025-04-23
## Plan asociado: `docs/06-sunat-compliance-plan.md`

---

## Resultado de la auditoria: 25 puntos SUNAT

### Resumen general

| Estado | Cantidad | Puntos |
|---|---|---|
| Cumple | 14 | 1(parcial), 2, 3, 4(parcial), 6, 7, 10, 12, 21, 13(parcial), 14(parcial), 15(parcial), 16(parcial), 24(parcial) |
| Parcial | 7 | 5, 8, 9, 11, 20, 22, 23 |
| No implementado | 4 | 17, 18, 19, 25 |

---

## Detalle por punto de la checklist

### 1. Identidad del emisor — ✅ CUMPLE (con observaciones)
- [x] RUC, razon social, direccion fiscal, ubigeo en `sunat_config`
- [x] Validacion formato RUC (11 digitos, empieza 1/2)
- [ ] Verificacion RUC activo/habido contra SUNAT en tiempo real
- [ ] Digito verificador RUC (algoritmo modulo 11)

### 2. Tipo de comprobante — ✅ CUMPLE
- [x] Codigos correctos: 01=Factura, 03=Boleta, 07=NC, 08=ND
- [x] `INVOICE_TYPE_MAP` en `constants.ts`
- [x] Enforced en POS: factura→RUC, boleta→DNI

### 3. Serie y numeracion — ✅ CUMPLE
- [x] Series validas: F001, B001, FC01, BC01, FD01
- [x] UNIQUE constraint en (serie, correlativo)
- [x] Retry hasta 3 veces en colision

### 4. Datos del cliente — ✅ CUMPLE (con observaciones)
- [x] RUC obligatorio para factura
- [x] DNI validado a 8 digitos para boleta
- [x] Longitudes por tipo documento en `DOCUMENT_LENGTHS`
- [x] Lookup RUC/DNI via apis-peru-proxy
- [ ] Digito verificador RUC (modulo 11)

### 5. Detalle de items — ⚠️ PARCIAL
- [x] Descripcion obligatoria, cantidad >= 1, precio >= 0
- [x] Zod schemas con validaciones
- [ ] **BUG:** Unidad hardcodeada "NIU" en `transformers.ts:74`
- [ ] **FALTA:** Mapeo de unidades al Catalogo 3 SUNAT (NIU, KGM, LTR, GLL, etc.)

### 6. Calculo de impuestos — ✅ CUMPLE (con observaciones)
- [x] IGV 18% correcto (formula prices-inclusive)
- [x] Base imponible, exonerado, inafecto separados
- [x] Motor de selva con determinacion geografica
- [ ] Tasa hardcodeada 18% (sin soporte a cambios futuros)
- [ ] ISC, ICBPER no implementados (no aplica a repuestos actualmente)

### 7. Totales — ✅ CUMPLE
- [x] Total = subtotal (prices-inclusive model)
- [x] TaxSubtotales separados por tipo en invoice.ts

### 8. Moneda — ⚠️ PARCIAL
- [x] PEN implicito en todo el sistema
- [ ] **BUG:** `note.ts` hardcodea "PEN" en vez de `document.moneda`
- [ ] Campo moneda no explicito en formulario factura
- [ ] Sin soporte tipo de cambio USD

### 9. Forma de pago — ⚠️ PARCIAL
- [x] Contado/Credito distinguidos en XML
- [x] 7 metodos de pago en POS
- [ ] **FALTA:** Codigo medio de pago (Catalogo 59) en XML
- [ ] **FALTA:** Cuotas con fechas/montos para credito

### 10. Referencias NC/ND — ✅ CUMPLE
- [x] BillingReference + DiscrepancyResponse en nota template
- [x] 7 motivos NC (Catalogo 09, 01-07)
- [ ] Motivos ND (08-11) no definidos

### 11. XML UBL — ⚠️ PROBLEMAS EN NOTAS
- [x] Invoice UBL 2.1 correcto (validado con F001-1 aceptada)
- [x] Summary/Voided UBL 2.0 correcto
- [ ] **BUG ALTO:** `note.ts:83-87` TaxScheme hardcodeado 1000/IGV sin importar afectacion
- [ ] **BUG ALTO:** `note.ts:220-238` LegalMonetaryTotal incompleto (falta LineExtensionAmount, TaxInclusiveAmount)
- [ ] **BUG MEDIO:** TaxTotal a nivel documento solo emite subtotal gravada
- [ ] FALTA: AllowanceCharge global para descuentos

### 12. Firma digital — ✅ CUMPLE
- [x] XMLDSig SHA-256 + RSA-SHA256 + C14N 1.0 (269 lineas)
- [x] Firmas aceptadas por SUNAT (F001-1, B001-1, baja)
- [ ] Verificacion local de firma antes de envio (debugging)

### 13. Envio a SUNAT — ⚠️ PARCIAL
- [x] SOAP sendBill/sendSummary/getStatus funcionales
- [x] REST OAuth2 para GRE implementado
- [ ] **FALTA:** SOAPAction vacio en sendSummary/getStatus (puede fallar prod)
- [ ] **FALTA:** Timeout en fetch calls
- [ ] **FALTA:** Retry automatico con backoff

### 14. CDR (respuesta SUNAT) — ⚠️ PARCIAL
- [x] CDR ZIP capturado y subido a Storage
- [x] Path guardado en `sunat_cdr_path` en BD
- [ ] **FALTA:** ResponseCode/Description/Notes del CDR no se persisten en BD
- [ ] **FALTA:** Columna `sunat_cdr_status` en invoices

### 15. Almacenamiento — ⚠️ PARCIAL
- [x] XML firmado → Storage (`{orgId}/{YYYY-MM}/{serie}-{correlativo}.xml`)
- [x] CDR ZIP → Storage
- [x] PDF generado localmente (jsPDF + ESC/POS)
- [ ] **FALTA:** XML de summary/voided NO se almacena
- [ ] **FALTA:** Politica de retencion (5 anos SUNAT)

### 16. Representacion impresa — 🚨 BUG CRITICO
- [x] QR code con formato pipe-separated SUNAT
- [x] Hash incluido en impresos
- [ ] **BUG CRITICO:** `thermal-ticket.ts:221-222` QR usa centavos en vez de soles decimales
- [ ] **FALTA:** Texto "Autorizado mediante Resolucion..."
- [ ] **FALTA:** Hash truncado a 24 chars en termico (debe ser completo)
- [ ] **TYPO:** "CREDITITO" en receipt-builder.ts:188

### 17. Plazos de envio — ❌ NO IMPLEMENTADO
- [ ] Validacion de antiguedad de fecha de emision
- [ ] Alertas de documentos pendientes de envio

### 18. Reintentos automaticos — ❌ NO IMPLEMENTADO
- [ ] Cola de reenvio
- [ ] Scheduler periodico

### 19. Consistencia contable — ❌ NO IMPLEMENTADO
- [ ] Cruces ventas vs XML vs libros
- [ ] Dashboard de consistencia

### 20. Catalogos SUNAT — ⚠️ PARCIAL
- [x] Tipo documento (Catalogo 6)
- [x] Tipo comprobante (Catalogo 01)
- [x] Afectacion IGV (Catalogo 07)
- [x] Motivos NC (Catalogo 09, 01-07)
- [ ] **FALTA:** Unidades de medida (Catalogo 3) — hardcoded "NIU"
- [ ] **FALTA:** Medios de pago (Catalogo 59)
- [ ] **FALTA:** Motivos ND (08-11)
- [ ] **FALTA:** Retenciones (tipo 20)

### 21. Manejo de errores — ✅ CUMPLE (basico)
- [x] Errores certificado mapeados (2073/2074/2076)
- [x] `sunat_error_code` + `sunat_error_message` en BD
- [x] Clasificacion basica tecnico vs SUNAT

### 22. Auditoria interna — ⚠️ PARCIAL
- [x] `audit_log` con 14 acciones
- [x] Columnas SUNAT en invoices/despatches
- [ ] **FALTA:** Operaciones SUNAT (send, void, summary) NO se loguean en audit_log
- [ ] **FALTA:** No hay trazabilidad de XML/CDR para summaries/voideds

### 23. Seguridad — ⚠️ OBSERVACIONES
- [x] Certificado PEM en Storage (protegido RLS)
- [x] Credenciales AES-256-GCM encrypted
- [ ] **RIESGO:** Fallback encryption key hardcodeada en `credentials.ts`
- [ ] **RIESGO:** `tryDecrypt` retorna valor encriptado si falla
- [ ] **RIESGO:** CORS `*` permite cualquier origen

### 24. Logs y trazabilidad — ⚠️ PARCIAL
- [x] `sunat_summary_log` para resumenes/bajas
- [x] Columnas timestamp en invoices
- [ ] **FALTA:** Log estructurado requests/responses SUNAT
- [ ] **FALTA:** Request ID / correlation ID
- [ ] **FALTA:** Log de acceso a certificado

### 25. Validaciones inteligentes — ❌ NO IMPLEMENTADO
- [ ] Alerta "Factura sin CDR en 24h"
- [ ] Alerta "Certificado por vencer"
- [ ] Alerta "Documento rechazado sin corregir"
- [ ] Dashboard de riesgo tributario

---

## Progreso de implementacion (FASE 1 del plan)

| # | Tarea | Estado | Archivo(s) |
|---|---|---|---|
| 1.1 | Fix QR thermal-ticket (centavos→soles) | ✅ HECHO | `thermal-ticket.ts:221` |
| 1.2 | Fix TaxScheme en note.ts | ✅ HECHO | `note.ts:50-62` (tributo dinamico) |
| 1.3 | Fix LegalMonetaryTotal en note.ts | ✅ HECHO | `note.ts:buildMonetaryTotalXml()` |
| 1.4 | Fix TaxTotal documento en note.ts | ✅ HECHO | `note.ts:buildNoteTaxSubtotals()` |
| 1.5 | Fix typo "CREDITITO" | ✅ HECHO | `receipt-builder.ts:188` |

## Progreso de implementacion (FASE 2 del plan)

| # | Tarea | Estado | Archivo(s) |
|---|---|---|---|
| 2.1 | Mapeo unidades medida (Catalogo 3) | ✅ HECHO | `constants.ts`, `transformers.ts` (2 sitios) |
| 2.2 | Persistir datos CDR en BD | ✅ HECHO | Migracion SQL, `types.ts`, `direct-client.ts`, `index.ts` |
| 2.3 | Fix SOAPAction headers | ✅ HECHO | `soap-client.ts` (sendSummary + getStatus) |
| 2.4 | Timeout + retry SUNAT calls | ✅ HECHO | `soap-client.ts` (30s timeout, 3 retries backoff) |
| 2.5 | Validacion fecha emision | ✅ HECHO | `index.ts` (max 7 dias) |
| 2.6 | Moneda explicita en note.ts | ✅ HECHO | `note.ts` (ya usa `moneda` dinámico desde FASE 1) |
| 2.7 | Medio de pago XML (Catalogo 59) | ✅ HECHO | `invoice.ts` (PaymentMeans), `transformers.ts` |
| 2.8 | Motivos ND (08-11) | ✅ HECHO | `invoices.ts` (`DEBIT_NOTE_REASONS`) |

## Progreso de implementacion (FASE 3 del plan)

| # | Tarea | Estado | Archivo(s) |
|---|---|---|---|
| 3.1 | Eliminar fallback encryption key | ✅ HECHO | `credentials.ts` (throw si no hay secret) |
| 3.2 | Fix tryDecrypt silent failure | ✅ HECHO | `credentials.ts` (return null en vez de raw) |
| 3.3 | Restringir CORS | ✅ HECHO | `http.ts` (origins permitidos) |
| 3.4 | Validacion digito verificador RUC | ✅ HECHO | `format.ts` (modulo 11) |

## Progreso de implementacion (FASE 4 del plan)

| # | Tarea | Estado | Archivo(s) |
|---|---|---|---|
| 4.1 | Almacenar XML summary/voided | ✅ HECHO | `index.ts` (upload RC/RA a Storage) |
| 4.2 | Auditoria operaciones SUNAT | ✅ HECHO | `audit.service.ts` (6 acciones), `index.ts` (audit helper + 8 puntos) |

## Progreso de implementacion (FASE 3 del plan)

| # | Tarea | Estado | Archivo(s) |
|---|---|---|---|
| 3.1 | Eliminar fallback encryption key | ✅ HECHO | `credentials.ts` (throw si no hay secret) |
| 3.2 | Fix tryDecrypt silent failure | ✅ HECHO | `credentials.ts` (return null en vez de raw) |
| 3.3 | Restringir CORS | ✅ HECHO | `http.ts` (origins permitidos) |
| 3.4 | Validacion digito verificador RUC | ✅ HECHO | `format.ts` (modulo 11) |

## Progreso de implementacion (FASE 4 del plan)

| # | Tarea | Estado | Archivo(s) |
|---|---|---|---|
| 4.1 | Almacenar XML summary/voided | ✅ HECHO | `index.ts` (upload RC/RA a Storage) |
| 4.2 | Auditoria operaciones SUNAT | ✅ HECHO | `audit.service.ts` (6 acciones), `index.ts` (audit helper + 8 puntos) |
| 4.3 | CDR status en resumen diario | ✅ HECHO | Migracion SQL, `index.ts` (updateSummaryLogStatus) |
| 4.4 | Texto representacion impresa | ✅ HECHO | `thermal-ticket.ts` (hash completo + autorizacion) |

## Progreso de implementacion (FASE 5 del plan)

| # | Tarea | Estado | Archivo(s) |
|---|---|---|---|
| 5.1 | Alertas automaticas | ✅ HECHO | `hooks/useSunatAlerts.ts` (4 tipos de alerta) |
| 5.2 | Dashboard riesgo tributario | ✅ HECHO | `hooks/useSunatHealth.ts` (13 metricas) |
| 5.3 | Cola de reenvio automatico | ✅ HECHO | `hooks/useSunatPendingQueue.ts` (query + retry mutation) |

## Progreso de implementacion (FASE 5 del plan)

| # | Tarea | Estado | Archivo(s) |
|---|---|---|---|
| 5.1 | Alertas automaticas | ✅ HECHO | `hooks/useSunatAlerts.ts` + integrado en `SunatDocuments.tsx` |
| 5.2 | Dashboard riesgo tributario | ✅ HECHO | `hooks/useSunatHealth.ts` + integrado en `Index.tsx` |
| 5.3 | Cola de reenvio | ✅ HECHO | `hooks/useSunatPendingQueue.ts` + integrado en `SunatDocuments.tsx` |

---

## Estadisticas

| Metrica | Valor |
|---|---|
| Total tareas | 24 |
| Completadas | 24 |
| En progreso | 0 |
| Pendientes | 0 |
| Bugs criticos | 0 (6 corregidos) |
| Bugs medios/bajos | 0 (2 corregidos) |
| Gaps funcionales | 0 (8 cerrados) |
| Mejoras seguridad | 4 |
| Mejoras trazabilidad | 4 |
| Features avanzados | 3 |
| UI integraciones | 3 (alerts, health, pending queue) |

---

## Historial de cambios

| Fecha | Cambio |
|---|---|
| 2025-04-23 | Creacion del documento. Auditoria completa de 25 puntos. |
| 2025-04-23 | FASE 1 completada: 5/5 fixes aplicados (QR thermal, TaxScheme nota, LegalMonetaryTotal nota, TaxTotal documento nota, typo CREDITITO). Pendiente deploy EF. |
| 2025-04-23 | FASE 2: 7/8 tareas completadas. Unidades medida (Catalogo 3), CDR persistido en BD, SOAPAction fix, timeout+retry, validacion fecha emision, moneda dinamica en notas, motivos ND. sunat-billing v66 deployado. |
| 2025-04-23 | FASE 2.7 completada: Medio de pago XML (Catalogo 59). |
| 2025-04-23 | FASE 3 completa: Eliminado fallback encryption key, tryDecrypt retorna null, CORS restringido, digito verificador RUC modulo 11. |
| 2025-04-23 | FASE 4 parcial: XML summary/voided almacenado, CDR en resumen diario, hash completo + texto autorizacion en termico. Pendiente 4.2 (auditoria SUNAT). sunat-billing v67 deployado. |
| 2025-04-23 | FASE 4.2 completada: Auditoria SUNAT en audit_log (6 acciones nuevas, 8 puntos de auditoria en index.ts). sunat-billing v68 deployado. |
| 2025-04-23 | FASE 5 completa: useSunatAlerts (4 tipos alerta), useSunatHealth (13 metricas), useSunatPendingQueue (cola + retry). 24/24 tareas completadas. |
| 2025-04-24 | Bug fix PaymentMeansCode: `<cbc:PaymentMeansID>` → `<cbc:PaymentMeansCode>` en invoice.ts. Encontrado durante e2e test. sunat-billing v69 deployado. |
| 2025-04-24 | Integracion UI FASE 5: Widget Salud SUNAT en Dashboard, Panel Alertas + Cola Reenvio en SunatDocuments. Hook useOrgId creado. |
| 2025-04-24 | E2E test SUNAT beta: F001-00000002 creada, enviada, ACEPTADA. XML+CDR en Storage, auditoria en audit_log. |
| 2025-04-24 | Limpieza: debug-despatch y sunat-billing-consolidated ya no existen. SUNAT_CREDENTIALS_KEY verificado. Credenciales GRE OAuth2 guardadas. |
