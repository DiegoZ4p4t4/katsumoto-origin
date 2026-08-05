# Plan de Continuidad — Katsumoto SUNAT Billing

**Fecha:** 2026-06-10
**Estado actual:** 4/5 tipos de documento probados contra SUNAT beta (aceptados).
Falta GRE (OAuth2 vencido). POS parcialmente funcional (RPC fixeado).

---

## FASE 4 — POS End-to-End + Nota de Débito (HOY)

### 4.1 Verificar flujo POS completo
**Objetivo:** El usuario debe poder crear facturas y boletas desde la UI sin errores.
**Acciones:**
- Recargar POS en navegador, seleccionar sucursal Pichanaqui
- Crear boleta B001-4 con 2 productos, cobrar en efectivo
- Crear factura F001-2 con cliente RUC, cobrar con tarjeta
- Verificar que ambas aparecen en /invoices
- Enviar ambas a SUNAT beta desde /sunat-documents

### 4.2 Nota de débito FD01-1
**Objetivo:** Completar el último tipo de documento SOAP pendiente.
**Acciones:**
- Crear nota de débito referenciando F001-1
- Enviar a SUNAT beta
- Verificar aceptación

### 4.3 Fix UI bugs encontrados
- `PosProductGrid` ya fixeado (Input import)
- Verificar que no haya más componentes rotos al navegar

---

## FASE 5 — Robustez de la Edge Function (MAÑANA)

### 5.1 Retry con backoff exponencial
**Problema:** SUNAT a veces timeout. El sistema debe reintentar automáticamente.
**Implementación:**
- 3 intentos máximo
- Backoff: 5s → 15s → 45s
- Solo para errores de red/timeout (no para rechazos de negocio)
- Registrar cada intento en `sunat_log`

### 5.2 Validación pre-envío
**Problema:** Errores detectables offline (RUC inválido, fecha > 7 días, items vacíos)
           se envían igual a SUNAT, gastando un intento y recibiendo rechazo.
**Implementación:**
- Función `validateBeforeSend(invoice)` en la Edge Function
- Validar: RUC módulo 11, fecha ≤ 7 días, items > 0, serie válida
- Si falla, retornar error SIN llamar a SUNAT

### 5.3 Rate limiting
**Problema:** Envíos masivos pueden saturar SUNAT → baneo temporal.
**Implementación:**
- Máximo 1 envío cada 3 segundos por organización
- Cola interna en Edge Function (en memoria o `pgmq`)

---

## FASE 6 — Seguridad y Monitoreo (SEMANA)

### 6.1 Migrar secretos a Supabase Vault
**Objetivo:** `clave_sol`, `certificado_password`, `cert_pem`, `cert_key_pem`
              encriptados con Vault en vez de `sunat_config`.
**Acciones:**
- Migrar credenciales vía SQL a `vault.secrets`
- Actualizar Edge Function `getConfig` para leer de Vault
- Mantener compatibilidad con `sunat_config` (fallback)

### 6.2 Dashboard de salud SUNAT
**Objetivo:** El usuario ve en tiempo real el estado de sus comprobantes.
**Acciones:**
- Verificar que `/sunat-documents` carga datos reales
- Verificar métricas de `useSunatHealth` (13 indicadores)
- Verificar alertas de `useSunatAlerts` (cert próximo a expirar, rechazos, etc.)
- Activar Realtime en `invoices` para actualización instantánea

### 6.3 PDF de comprobante con datos SUNAT
**Objetivo:** El PDF incluye QR, hash SUNAT, fecha de aceptación, CDR.
**Acciones:**
- Verificar que el generador de PDF actual incluye QR
- Agregar hash SUNAT y fecha de aceptación si existe
- Agregar enlace de descarga de CDR en el detalle

---

## FASE 7 — Producción (CUANDO ESTÉ LISTO)

### 7.1 Cambio a modo producción
- `Endpoint.setDeploymentMode(true)` en la Edge Function
- Verificar que el certificado corresponde a producción (no beta)
- Variable de entorno `SUNAT_DEPLOYMENT=true`

### 7.2 Plan de rollback
- Mantener modo beta como fallback
- Procedimiento documentado para volver atrás

### 7.3 Monitoreo post-producción
- Alertas si `sunat_error_code` != null por más de 1h
- Dashboard con tasa de aceptación/rechazo
- Log de auditoría completo

---

## Resumen de prioridades

| Fase | Entregable | Impacto | Tiempo |
|------|-----------|---------|--------|
| 4.1 | POS end-to-end funcional | 🔴 Crítico | 30 min |
| 4.2 | Nota de débito | 🟡 Alto | 15 min |
| 5.1 | Retry + backoff | 🟡 Alto | 1 h |
| 5.2 | Validación pre-envío | 🟡 Alto | 45 min |
| 6.1 | Secrets a Vault | 🟢 Medio | 1 h |
| 6.2 | Dashboard salud | 🟢 Medio | 30 min |
| 6.3 | PDF con datos SUNAT | 🟢 Medio | 45 min |
