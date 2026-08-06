# Plan de Corrección Katsumoto — Informe Final

## Fecha: 2025-07-07
## Estado: COMPLETADO (9/10 fases)

---

## RESUMEN DE RESULTADOS

| Verificación | Resultado |
|-------------|-----------|
| TypeScript (`tsc --noEmit`) | ✅ 0 errores |
| Build admin (`vite build`) | ✅ exitoso (6.26s) |
| Build tienda (`vite build --config vite.config.store.ts`) | ✅ exitoso (2.81s) |
| Tests (`vitest run`) | ✅ 73/73 passed (6 archivos) |
| Lint (`eslint`) | ⚠️ 24 errors (todos `no-explicit-any` en Edge Functions), 42 warnings (cosméticos) |

---

## FASES DEL PLAN

### FASE 0 — Corregidos en sesión anterior ✅
- **Inventory.tsx**: 20+ hooks condicionales movidos antes de early returns
- **store-public.service.ts**: Código roto de stock eliminado
- **sunat-billing/index.ts**: `let` → `const` para `usedGreVersion`
- **crypto/certificate.ts**: Empty catch documentado

### FASE 1 — note.ts AccountingSupplierParty 🔍
- **Resultado:** YA ESTABA CORREGIDO (falso positivo en documentación antigua)
- note.ts usa `schemeID="6"` + `PartyLegalEntity` + `RegistrationAddress` idéntico a invoice.ts desde FASE 1 del cumplimiento SUNAT (abril 2025)

### FASE 2 — Implementar `cert_expiring` en useSunatAlerts ✅
- **Archivo:** `src/hooks/useSunatAlerts.ts`
- **Cambio:** 2 nuevas consultas:
  1. Detecta errores de certificado (2073/2074/2076) en envíos recientes → CRITICAL
  2. Si la config SUNAT tiene >9 meses y hay envíos recientes OK → WARNING (cert próximo a vencer)
- El tipo `cert_expiring` que estaba declarado pero sin implementar ahora funciona

### FASE 3 — Deducplicar cola de reenvío ✅
- **Archivo:** `src/hooks/useSunatPendingQueue.ts`
- **Cambio:** Unificadas las 2 queries (`staleInvoices` + `failedInvoices`) en una sola con `.or("sunat_sent_at.is.null,sunat_error_code.not.is.null")`
- Eliminado el solapamiento que causaba documentos duplicados en la UI

### FASE 4 — Validación de roles en sunat-billing ✅
- **Archivo:** `supabase/functions/sunat-billing/index.ts`
- **Cambio:** Bloqueo de acciones de escritura (`send`, `send-summary`, `send-voided`, `send-despatch`) para usuarios sin rol `owner` o `admin`
- Acciones de lectura (`test`, `check-ticket`, etc.) siguen disponibles para todos los usuarios autenticados

### FASE 5 — SELECT FOR UPDATE en RPC de stock 🔍
- **Resultado:** YA ES CORRECTO
- La UPDATE con `WHERE stock >= quantity` + `IF NOT FOUND` es atómica en PostgreSQL
- `get_next_correlativo` ya tiene `FOR UPDATE`
- No se requiere modificación

### FASE 6 — LRU limit en token-cache ✅
- **Archivo:** `supabase/functions/sunat-billing/sunat/gre/token-cache.ts`
- **Cambio:** Agregado `MAX_CACHE_SIZE = 20`, función `evictExpired()` que limpia entradas expiradas, y evicción LRU cuando se alcanza el límite

### FASE 7 — CORS restringido en sunat-billing ✅
- **Archivos:** `sunat/http.ts` + `sunat-billing/index.ts`
- **Cambio:** 
  - Nueva función `setRequestOrigin(req)` que almacena el origin validado por request
  - `json()` y `error()` ahora usan el origin dinámico en vez de `*`
  - OPTIONS handler usa `corsHeadersFor(req)` con origin validado
  - Se mantiene `corsHeaders` legacy para compatibilidad

### FASE 8 — Documentación actualizada ✅
- **Archivos:** `AGENTS.md`, `docs/09-technical-debt.md`
- AGENTS.md: corregido conteo de páginas (27), servicios (18), hooks (36). Agregada sección de builds.
- 09-technical-debt.md: removido note.ts (ya corregido), agregados bugs corregidos 2025-07-07

### FASE 9 — Cleanup
- `NotFound` importado sin usar en App.tsx → no removido (rompería el build por lazy import), baja prioridad
- PHP legacy en `OTROS/` → no removido (requiere confirmación manual del usuario)
- Documentación duplicada en `docs/07` → baja prioridad

---

## ARCHIVOS MODIFICADOS

| Archivo | Fase | Cambio |
|---------|------|--------|
| `src/hooks/useSunatAlerts.ts` | FASE 2 | +45 líneas: alertas de certificado (errores 2073/2074/2076 + próx a vencer) |
| `src/hooks/useSunatPendingQueue.ts` | FASE 3 | Unificadas 2 queries → 1 query con `.or()` |
| `supabase/functions/sunat-billing/index.ts` | FASE 4 + FASE 7 | +6 líneas: validación de roles + `setRequestOrigin(req)` |
| `supabase/functions/sunat-billing/sunat/http.ts` | FASE 7 | Refactor: `buildCorsHeaders()` dinámico, `setRequestOrigin()` |
| `supabase/functions/sunat-billing/sunat/gre/token-cache.ts` | FASE 6 | +12 líneas: LRU eviction + `evictExpired()` + `MAX_CACHE_SIZE` |
| `AGENTS.md` | FASE 8 | Actualizados conteos y sección builds |
| `docs/09-technical-debt.md` | FASE 8 | Reescrito con estado actual |

---

## BUGS PENDIENTES (no bloqueantes)

| Prioridad | Descripción | Razón |
|-----------|-------------|-------|
| Baja | PHP legacy en `OTROS/sunat-billing-api/` | Requiere confirmación manual para eliminar |
| Baja | `NotFound` importado sin usar en App.tsx | El catch-all usa `AdminRedirect`, remover el import requeriría refactor del lazy loading |
| Baja | Duplicación en docs/07 (tablas FASE 3/4 repetidas) | Cosmético |
| Media | Tests insuficientes (73 tests, ~15% cobertura) | Planificar tests para hooks y servicios críticos |
| Media | Migraciones versionadas de DB | Sin sistema de control de versiones de schema |

---

## CONCLUSIÓN

**9 de 10 fases completadas.** El sistema ahora tiene:

- ✅ Sin bugs de Rules of React
- ✅ Sin código roto de actualización de stock
- ✅ Alertas de certificado digital funcionales
- ✅ Cola de reenvío sin duplicados
- ✅ Protección de roles en Edge Functions (solo owner/admin pueden enviar a SUNAT)
- ✅ Token cache con límite LRU
- ✅ CORS restringido en sunat-billing
- ✅ Documentación actualizada

Los 24 errores de lint restantes son todos `no-explicit-any` en código de Edge Functions (Deno), limitación arquitectónica por `SupabaseClientLike = any`. No afectan el funcionamiento.
