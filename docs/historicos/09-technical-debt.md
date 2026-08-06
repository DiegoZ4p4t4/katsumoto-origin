# Deuda Técnica

## Fecha: 2025-07-07 (actualizado)

---

## GRE - Guía de Remisión Electrónica

### Estado: Funcionalidad no soportada por el momento

La GRE (Guía de Remisión Electrónica) vía REST está implementada pero requiere credenciales OAuth2 actualizadas desde SUNAT Menú SOL. Se posterga su habilitación.

---

## Completado

### Fix note.ts AccountingSupplierParty
- **Estado:** ✅ CORREGIDO (FASE 1 cumplimiento SUNAT, abril 2025)
- note.ts ya usa `cac:Party/cac:PartyIdentification/cbc:ID schemeID="6"` + `PartyLegalEntity` + `RegistrationAddress` (idéntico a invoice.ts)

### Bugs corregidos 2025-07-07

| Archivo | Issue | Estado |
|---------|-------|--------|
| `src/pages/Inventory.tsx` | 20+ hooks llamados condicionalmente (violación Rules of React) | ✅ CORREGIDO |
| `src/services/store-public.service.ts` | Código de actualización de stock roto (`supabase.rpc ? undefined : undefined`) | ✅ CORREGIDO |
| `src/hooks/useSunatAlerts.ts` | Alerta `cert_expiring` declarada pero nunca implementada | ✅ CORREGIDO |
| `src/hooks/useSunatPendingQueue.ts` | Documentos duplicados en cola de reenvío | ✅ CORREGIDO |
| `supabase/functions/sunat-billing/index.ts` | Sin validación de roles en acciones de escritura | ✅ CORREGIDO |
| `supabase/functions/sunat-billing/sunat/http.ts` | `json()` y `error()` usaban CORS `*` en vez del origin del request | ✅ CORREGIDO |
| `supabase/functions/sunat-billing/sunat/gre/token-cache.ts` | Memory leak: Map sin límite | ✅ CORREGIDO (LRU + evicción) |

---

## Pendientes (no bloqueantes)

### Retención (tipo 20)
- **Problema:** No implementado. Solo necesario si compran a sujetos no domiciliados.
- **Prioridad:** Baja (no requerido actualmente)

### PHP legacy sin eliminar
- **Carpeta:** `OTROS/sunat-billing-api/`
- **Problema:** API PHP legacy (Greenter) marcada para eliminar pero aún presente
- **Prioridad:** Baja (no afecta funcionamiento)

### Tests insuficientes
- Solo 6 archivos de test (73 tests), cobertura baja (~15%).
- **Prioridad:** Media
- Recomendación: Agregar tests para hooks críticos (usePosCart, useInvoices) y servicios (invoice.service.ts).

### Migraciones versionadas de DB
- Los cambios de schema son manuales. No hay sistema de migraciones.
- **Prioridad:** Media

### `NotFound` importado sin usar en App.tsx
- **Prioridad:** Baja
