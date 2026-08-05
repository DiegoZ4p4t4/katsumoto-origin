# Katsumoto + Fractuyo — Plan de Integración SUNAT

**Fecha:** 2026-06-10
**Estado:** ANÁLISIS COMPLETO, INTEGRACIÓN INICIADA

---

## Resumen Ejecutivo

El proyecto Katsumoto (POS/Inventario/ERP para repuestos agrícolas) ya tiene un sistema de facturación electrónica SUNAT completo y probado en beta. La librería **fractuyo** se integra como **capa complementaria**, no como reemplazo, trayendo:
- Cálculos de IGV estandarizados
- Validación offline de comprobantes
- XSD validation local (xmllint-wasm)
- QR data y montos a letras automáticos

## Estado Actual del Sistema

### Lo que funciona (listo para producción)
| Componente | Archivo | Estado |
|-----------|---------|--------|
| Engine SUNAT | `supabase/functions/sunat-billing/index.ts` | ✅ Probado contra SUNAT beta |
| XML UBL 2.1 (templates) | `sunat/xml/templates/*.ts` | ✅ Factura, boleta, NC, ND, guía, resumen, baja |
| Firma digital XAdES | `sunat/crypto/xml-signer.ts` | ✅ RSA-SHA256 + C14N |
| SOAP client | `sunat/soap/soap-client.ts` | ✅ sendBill, sendSummary, getStatus |
| REST client (GRE) | `sunat/gre/gre-rest-client.ts` | ✅ OAuth2 + sendCpe + checkStatus |
| Credenciales encriptadas | `sunat/crypto/credentials.ts` | ✅ AES-256-GCM |
| Frontend POS | `src/pages/POS.tsx` | ✅ Funcional |
| Frontend facturas | `src/pages/CreateInvoice.tsx` | ✅ Funcional |
| Servicio SUNAT frontend | `src/services/sunat.service.ts` | ✅ Invocación EFs |
| Health dashboard | `src/hooks/useSunatHealth.ts` | ✅ 13 métricas |
| Alertas pendientes | `src/hooks/useSunatAlerts.ts` | ✅ 4 tipos alerta |
| Cola de reenvío | `src/hooks/useSunatPendingQueue.ts` | ✅ Retry por documento |

### Lo que añade fractuyo
| Componente | Archivo | Beneficio |
|-----------|---------|-----------|
| Calculator estandarizado | `src/lib/sunat-integration/calculator.ts` | Reemplaza `calculations.ts` con fórmulas probadas |
| QR data | `src/lib/sunat-integration/xml-utils.ts` | QR estándar SUNAT |
| Montos a letras | `src/lib/sunat-integration/xml-utils.ts` | Reemplaza `number-to-words.ts` custom |
| Endpoints configurables | `src/lib/sunat-integration/xml-utils.ts` | Control de URLs SUNAT |

### Limitación clave: Deno vs Node.js
La Edge Function `sunat-billing` corre en **Deno** (Supabase Edge Functions).
Fractuyo es **Node.js ESM** y no puede correr en Deno.

**Estrategia:** Fractuyo se usa en la capa **cliente/Vite/Node.js** (cálculos, validación, QR).
La Edge Function Deno se mantiene intacta para la comunicación SOAP/REST con SUNAT.

## Arquitectura Final

```
CLIENTE (React/Vite/Node.js)          SUPABASE EDGE (Deno)
══════════════════════════════          ═════════════════════
                                      sunat-billing/index.ts
┌─ POS.tsx ─────────────────┐         ├── handleSend() → SOAP/REST → SUNAT
│  usePosInvoice()          │         ├── handleSummary() → sendSummary
│   ↓                       │         ├── handleVoided() → sendVoided
│  cálculos de IGV ─┬───────│─────────├── handleSendDespatch() → GRE REST
│  QR data ─┬───────┤       │         ├── handleTicketCheck()
│  preview XML ─┬─────┤     │         └── getConfig() → cert + creds
│               │     │     │
│  ┌────────────▼─────▼──┐  │
│  │ sunat-integration/  │  │
│  │ calculator.ts       │  │         sunat-credentials/index.ts
│  │ xml-utils.ts        │  │         ├── CRUD sunat_config
│  └─────────────────────┘  │         └── AES-256-GCM
│                           │
│  ┌────────────────────────▼──┐
│  │ sunat.service.ts          │  ← invokeEF()
│  │ sendInvoice(id)           │
│  │ sendSummary(fecha)        │
│  │ sendVoided(id)            │
│  │ sendDespatch(id)          │
│  └───────────────────────────┘
│                           │
│  ┌────────────────────────▼──┐
│  │ Supabase DB               │
│  │ invoices, customers,      │
│  │ products, sunat_config,   │
│  │ sunat_summary_log         │
│  └───────────────────────────┘
└───────────────────────────────┘
```

## Archivos Creados

```
src/lib/sunat-integration/
├── index.ts           # Barrel exports
├── calculator.ts      # Wrapper fractuyo InvoiceCalculator
│   ├── calculateLine()       Detalle por línea
│   ├── calculateTotals()     Totales del comprobante
│   ├── calculateDetraction() Cálculo detracción
│   └── calculateRetention()  Cálculo retención
└── xml-utils.ts       # Utilidades fractuyo
    ├── formatDate()           Fecha SUNAT
    ├── amountToWords()        Monto a letras 🇵🇪
    ├── generateQrData()       QR SUNAT (pipe-delimited)
    └── Endpoint               Control URLs
```

## Próximos Pasos (Orden de Prioridad)

### FASE 1 — Reemplazar cálculos existentes con fractuyo
- [ ] Migrar `src/lib/calculations.ts` → usar `src/lib/sunat-integration/calculator.ts`
- [ ] Verificar que `CreateInvoice.tsx` use el nuevo cálculo
- [ ] Test: crear factura de prueba desde el UI, verificar totales

### FASE 2 — Añadir validación offline antes de enviar
- [ ] Crear `src/lib/sunat-integration/validator.ts` con reglas de negocio SUNAT
- [ ] Integrar en `useInvoiceMutations.ts` antes de `sunatService.sendInvoice()`

### FASE 3 — Reemplazar montos a letras
- [ ] Migrar `number-to-words.ts` en Edge Function → usar `amountToWords()` de fractuyo
- [ ] Solo en el frontend (la EF usa su propia implementación)

### FASE 4 — XSD Validation local
- [ ] Configurar `validateXmlWithXsd()` con XSD de SUNAT/OASIS
- [ ] Añadir paso de validación en `CreateInvoice.tsx` antes de enviar

### FASE 5 — Pruebas contra SUNAT beta
- [ ] Crear empresa de prueba en Supabase
- [ ] Subir certificado de prueba
- [ ] Emitir factura F001-3 y verificar aceptación

### FASE 6 — Docker para producción
- [ ] Arreglar Dockerfile.dev para incluir fracayo
- [ ] Crear Dockerfile.prod con build optimizado + nginx
- [ ] Probar `docker compose up` completo

## Comandos Rápidos

```bash
# Desarrollo local (Vite)
pnpm dev                    # http://localhost:8551

# Docker (cuando funcione)
docker compose -f docker-compose.dev.yml up -d

# Lint
pnpm lint

# SUNAT smoke test (Deno)
pnpm sunat:smoke

# Deploy Edge Functions (requiere supabase CLI)
npx supabase functions deploy sunat-billing --project-ref kdsjojrrspzmufdumywd --no-verify-jwt
```
