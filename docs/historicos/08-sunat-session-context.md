# Contexto: Sesión de Cumplimiento SUNAT

## Estado: COMPLETADO (24/24 tareas + extras)
## Fecha: 2025-04-28
## EF deployada: sunat-billing v70 (verify_jwt=false)

---

## Qué se hizo

Auditoría completa del sistema Katsumoto contra una checklist de 25 puntos de cumplimiento SUNAT.
Se identificaron bugs, gaps funcionales y mejoras. Se implementaron las 24 tareas en 5 fases.
Documentación generada en `docs/06-sunat-compliance-plan.md` y `docs/07-sunat-compliance-avance.md`.

---

## FASE 1: Bugs Críticos (5/5 HECHO)

### 1.1 Fix QR thermal-ticket
- **Archivo:** `src/lib/printing/formats/thermal-ticket.ts:221`
- **Cambio:** `cents.toFixed(0)` → `(cents / 100).toFixed(2)` para IGV y total en datos QR

### 1.2 Fix TaxScheme en note.ts
- **Archivo:** `supabase/functions/sunat-billing/sunat/xml/templates/note.ts`
- **Cambio:** TaxScheme ahora dinámico según `tip_afe_igv` (igual que invoice.ts):
  - gravado=1000/IGV/VAT, exonerado=9997/EXO/VAT, inafecto=9998/INA/FRE, exportacion=9995/EXP/FRE
- **Función:** `buildLineXml()` ahora recibe `moneda` como 3er parámetro

### 1.3 Fix LegalMonetaryTotal en note.ts
- **Archivo:** mismo `note.ts`
- **Cambio:** `buildMonetaryTotalXml()` ahora emite `LineExtensionAmount` + `TaxInclusiveAmount` + `PayableAmount`
- Recibe `moneda` como 3er parámetro

### 1.4 Fix TaxTotal documento en note.ts
- **Archivo:** mismo `note.ts`
- **Cambio:** Nueva función `buildNoteTaxSubtotals()` que genera subtotales separados para gravada(1000), exonerada(9997), inafecta(9998)
- Reemplazó el TaxSubtotal único hardcodeado a 1000/IGV

### 1.5 Fix typo CREDITITO
- **Archivo:** `src/lib/printing/thermal/receipt-builder.ts:188`
- **Cambio:** "NOTA DE CREDITITO ELECTRONICA" → "NOTA DE CREDITO ELECTRONICA"

---

## FASE 2: Cumplimiento SUNAT (8/8 HECHO)

### 2.1 Mapeo unidades medida (Catálogo 3)
- **Archivo:** `supabase/functions/sunat-billing/sunat/constants.ts`
- **Cambio:** Agregado `UNIT_MAP` con 17 mapeos: Unidad→NIU, Kilogramo→KGM, Litro→LTR, etc.
- **Archivo:** `supabase/functions/sunat-billing/sunat/transformers.ts`
- **Cambio:** 2 sitios donde `unidad: "NIU"` → `unidad: UNIT_MAP[String(item.unit || "")] || "NIU"`
- Import agregado: `UNIT_MAP` en transformers.ts

### 2.2 Persistir datos CDR en BD
- **Migración SQL:** `add_cdr_response_columns` — agrega `sunat_cdr_code TEXT` y `sunat_cdr_description TEXT` a `invoices` y `despatches`
- **Archivo:** `supabase/functions/sunat-billing/sunat/types.ts` — `SunatResult` agrega `cdr_code` y `cdr_description`
- **Archivo:** `supabase/functions/sunat-billing/sunat/direct-client.ts` — `sendInvoice` propaga `cdr_code` y `cdr_description`
- **Archivo:** `supabase/functions/sunat-billing/index.ts` — `handleSend` persiste `sunat_cdr_code` y `sunat_cdr_description`

### 2.3 Fix SOAPAction headers
- **Archivo:** `supabase/functions/sunat-billing/sunat/soap/soap-client.ts`
- **Cambio:** `sendSummary` usa `SOAPAction: "urn:sendSummary"`, `getStatus` usa `SOAPAction: "urn:getStatus"`

### 2.4 Timeout + retry en llamadas SUNAT
- **Archivo:** `supabase/functions/sunat-billing/sunat/soap/soap-client.ts`
- **Cambio:** Nueva función `fetchWithRetry()` con:
  - 30s timeout (AbortController)
  - 3 reintentos con backoff (1s, 2s, 4s)
  - Solo reintenta en TypeError o AbortError
- Todos los `fetch()` calls reemplazados por `fetchWithRetry()`

### 2.5 Validación fecha emisión
- **Archivo:** `supabase/functions/sunat-billing/index.ts` — `handleSend()`
- **Cambio:** Rechaza invoices con fecha de emisión >7 días de antigüedad (error STALE_DATE)

### 2.6 Moneda explícita en notas
- Ya quedó resuelto en FASE 1: `const moneda = escapeXml(document.moneda || "PEN")` en `buildNoteXml()`
- Todas las funciones internas de note.ts usan `moneda` dinámico

### 2.7 Medio de pago XML (Catálogo 59)
- **Archivo:** `supabase/functions/sunat-billing/sunat/transformers.ts`
- **Cambio:** Mapa `PAYMENT_MEANS_MAP` y campo `forma_pago_codigo` en documento
- **Archivo:** `supabase/functions/sunat-billing/sunat/xml/templates/invoice.ts`
- **Cambio:** Agregado `<cac:PaymentMeans><cbc:PaymentMeansID>001</cbc:PaymentMeansID></cac:PaymentMeans>` antes de PaymentTerms

### 2.8 Motivos ND (08-11)
- **Archivo:** `src/lib/constants/invoices.ts`
- **Cambio:** Agregado `DEBIT_NOTE_REASONS` con códigos 08-11 (diferencia precio, diferencia cantidad, descuento posterior, interés mora)

---

## FASE 3: Seguridad (4/4 HECHO)

### 3.1 Eliminar fallback encryption key
- **Archivo:** `supabase/functions/sunat-billing/sunat/crypto/credentials.ts`
- **Cambio:** Removido fallback `"katsumoto-enc-key-2026"`. Ahora lanza error si `SUNAT_CREDENTIALS_KEY` no existe.

### 3.2 Fix tryDecrypt silent failure
- **Archivo:** mismo `credentials.ts`
- **Cambio:** Retorna `null` en vez del valor encriptado crudo cuando falla la desencriptación.

### 3.3 Restringir CORS
- **Archivo:** `supabase/functions/sunat-billing/sunat/http.ts`
- **Cambio:** `getAllowOrigin(req)` verifica origin contra lista permitida:
  - `tauri://localhost`, `https://tauri.localhost`, `http://localhost:8551`, `http://localhost:1420`
- `corsHeadersFor(req)` para responses con request context
- Se mantiene `corsHeaders` legacy para responses sin request

### 3.4 Validación dígito verificador RUC
- **Archivo:** `src/lib/format.ts`
- **Cambio:** `isValidRUC()` ahora incluye algoritmo módulo 11 con pesos [5,4,3,2,7,6,5,4,3,2]

---

## FASE 4: Trazabilidad (4/4 HECHO)

### 4.1 Almacenar XML summary/voided
- **Archivo:** `supabase/functions/sunat-billing/index.ts`
- **Cambio:** `handleSummary()` y `handleVoided()` suben XML firmado a Storage:
  - Resumen: `{orgId}/{YYYY-MM}/RC-{fecha}-{correlativo}.xml`
  - Baja: `{orgId}/{YYYY-MM}/RA-{fecha}-{correlativo}.xml`

### 4.2 Auditoría operaciones SUNAT
- **Archivo:** `src/services/audit.service.ts`
- **Cambio:** 6 acciones nuevas: `sunat.send`, `sunat.summary`, `sunat.voided`, `sunat.ticket_check`, `sunat.despatch.send`, `sunat.despatch.check`
- **Archivo:** `supabase/functions/sunat-billing/index.ts`
- **Cambio:** Nueva función `audit()` (fire-and-forget insert en audit_log)
- 8 puntos de auditoría: send success, send fail, summary, voided, ticket_check, despatch send success, despatch send fail, despatch check

### 4.3 CDR status en resumen diario
- **Migración SQL:** `add_cdr_path_to_summary_log` — agrega `cdr_path`, `cdr_code`, `cdr_description` a `sunat_summary_log`
- **Archivo:** `index.ts` — `updateSummaryLogStatus()` ahora:
  - Recibe `orgId` como 4to parámetro
  - Sube CDR a Storage cuando ticket resuelve
  - Persiste `cdr_code`, `cdr_description`

### 4.4 Texto representación impresa
- **Archivo:** `src/lib/printing/formats/thermal-ticket.ts`
- **Cambio:** Hash completo (antes truncado a 24 chars) + texto "Autorizado mediante Res. de Intendencia"

---

## FASE 5: Validaciones Inteligentes (3/3 HECHO)

### 5.1 Alertas automáticas
- **Nuevo archivo:** `src/hooks/useSunatAlerts.ts`
- Hook que detecta: sin CDR (>24h), rechazados sin corregir, stale (>3 días sin enviar), guías rechazadas
- Retorna array de `SunatAlert` ordenados por severidad (critical > warning > info)

### 5.2 Dashboard riesgo tributario
- **Nuevo archivo:** `src/hooks/useSunatHealth.ts`
- Hook con 13 métricas: totales por status, sin XML, sin CDR, stale, despatches, timestamps
- Query paralela optimizada con `Promise.all`

### 5.3 Cola de reenvío
- **Nuevo archivo:** `src/hooks/useSunatPendingQueue.ts`
- Hook que lista documentos pendientes (issued sin enviar + issued con error)
- Mutation `retry` para reenviar un documento individual
- Invalida queries de alerts, health y pending tras reenvío

---

## Tokens y Deploy

### Supabase Access Token
```
Usar variable de entorno $SUPABASE_ACCESS_TOKEN
```

### Deploy EF
```bash
npx supabase functions deploy sunat-billing --project-ref kdsjojrrspzmufdumywd
curl -X PATCH "https://api.supabase.com/v1/projects/kdsjojrrspzmufdumywd/functions/sunat-billing" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" -d '{"verify_jwt": false}'
```

---

## Pendiente para siguiente sesión

### NADA — Sistema listo para producción en beta

Todas las tareas de cumplimiento SUNAT completadas, UI integrada, e2e test pasado.

### Bug fix adicional (sesión 2025-04-24)
- **PaymentMeansCode:** `invoice.ts:246` — `<cbc:PaymentMeansID>` → `<cbc:PaymentMeansCode>` (no válido en UBL 2.1)
- Encontrado durante e2e test, corregido en v69

### Integración UI de FASE 5 (sesión 2025-04-24) — COMPLETADO
- ✅ `src/hooks/useOrgId.ts` — Hook reactivo para organization_id
- ✅ Widget "Salud SUNAT" en Dashboard (`Index.tsx`) — métricas + alertas
- ✅ Panel de Alertas + Cola de Reenvío en `/sunat-documents` (`SunatDocuments.tsx`)

### Limpieza (sesión 2025-04-24) — COMPLETADO
- ✅ `handleDebugDespatch` ya no existe en index.ts (limpio)
- ✅ `debug-despatch` action ya no está en routing (limpio)
- ✅ `sunat-billing-consolidated/` no existe en supabase/functions/ (limpio)
- ✅ `SUNAT_CREDENTIALS_KEY` verificado — funciona correctamente (credenciales se desencriptan OK)
- ✅ Credenciales GRE OAuth2 guardadas en `sunat_config` (client_id + client_secret)

### E2E Test SUNAT beta (sesión 2025-04-24) — APROBADO
- Factura F001-00000002 creada y enviada via sendBill → **ACEPTADA**
- XML firmado en Storage: `F001-2.xml`
- CDR en Storage: `F001-2-cdr.zip`
- Auditoría en audit_log: `sunat.send` con hash + success
- EF v69 deployada y verify_jwt parcheado

### Pendiente futuro (no bloqueante)
- **GRE test real** — SUNAT elimino `api-test-seguridad.sunat.gob.pe` (NXDOMAIN). Auth URL actualizado a `api-seguridad.sunat.gob.pe` en v70. Credenciales OAuth2 viejas son rechazadas (access_denied). Necesita regenerar client_id/client_secret desde SUNAT Menú SOL.
- **Retención (tipo 20)** — Solo si compran a sujetos no domiciliados
- **Fix note.ts AccountingSupplierParty** — Usar formato schemeID="6" igual que invoice.ts

---

## Sesión 2025-04-28: Deploy v70 + GRE Auth Fix

### Hecho
- Deploy sunat-billing **v70** exitoso (1.186MB)
- verify_jwt parcheado a false via Management API
- GRE auth URL fix confirmado: `getAuthUrl()` retorna `api-seguridad.sunat.gob.pe`
- DNS verificado: `api-test-seguridad.sunat.gob.pe` = NXDOMAIN, `api-seguridad.sunat.gob.pe` = 161.132.21.21
- Test SOAP (action `test`) → OK (firma + certificado correctos)
- Test GRE (action `send-despatch` despatch T001-1) → **access_denied** (HTTP 400)

### Hallazgo
SUNAT unifico endpoints de autenticación. El dominio `api-test-seguridad.sunat.gob.pe` ya no existe (NXDOMAIN). El endpoint unificado es `api-seguridad.sunat.gob.pe` tanto para beta como producción.

Las credenciales OAuth2 (`client_id`: `7df91084-...`) fueron generadas en el sistema viejo y SUNAT las rechaza en el endpoint unificado con `access_denied`. Se necesitan credenciales nuevas obtenidas desde SUNAT Menú SOL.

### Próximo paso
1. Acceder a SUNAT Menú SOL → Configuración → OAuth2
2. Generar nuevas credenciales (client_id + client_secret)
3. Actualizar `sunat_config` con las nuevas credenciales
4. Reintentar `send-despatch` para guía T001-1
