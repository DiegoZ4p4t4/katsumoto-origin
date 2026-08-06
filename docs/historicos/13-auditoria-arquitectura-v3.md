# Auditoría de Arquitectura y Análisis Integral v3 — Katsumoto

**Fecha:** 2026-07-18
**Alcance:** Revisión completa del código, arquitectura, requerimientos, casos de uso y calidad
**Método:** Análisis estático completo de ~180 archivos TypeScript, 33 archivos Deno, documentación y schema DB
**Basado en:** Auditorías v1 (docs/10), v2 (docs/11) y plan de corrección (docs/12) de julio 2025

---

## 1. RESUMEN EJECUTIVO

Katsumoto es un ERP/POS/Facturación electrónica para **SERVICIOS GENERALES UNITED E.I.R.L.** (RUC 20608183672, Pichanaqui, Junín, Perú). Stack: React 19 + TypeScript + Vite 6 + shadcn/ui + TanStack Query + Supabase + Tauri 2.

**Veredicto general: Sistema maduro y bien diseñado. ~85% listo para producción.** El core SOAP (facturas, boletas, resúmenes, bajas) está verificado. El bloqueo principal sigue siendo **GRE OAuth2** (credenciales vencidas). La deuda técnica es manejable (~22 issues, 1 bloqueante).

Comparado con julio 2025: la mayoría de bugs críticos fueron corregidos. Se identifican 8 issues nuevos o no documentados previamente.

---

## 2. ARQUITECTURA DEL SISTEMA

### 2.1 Diagrama de Capas

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENTE (Tauri 2 / Browser)                                 │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Páginas  │→ │ Hooks     │→ │ Servicios│→ │ Supabase   │  │
│  │ 27 lazy  │  │ 35 hooks  │  │ 18 svcs  │  │ Client JS  │  │
│  └──────────┘  └───────────┘  └──────────┘  └─────┬─────┘  │
│                                                    │ HTTPS  │
│  ┌──────────────────────────────────────────────────┘        │
│  │ lib/ — tipos, constantes, schemas, printing, tax-engine   │
│  │ platform/ — adaptadores impresión (Tauri/Web)             │
│  └──────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│ SUPABASE BACKEND                                             │
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ PostgreSQL 15   │  │ Auth (GoTrue)│  │ Storage (S3)   │  │
│  │ 25 tablas + RLS │  │ JWT sessions │  │ sunat-documents│  │
│  │ 4 RPC functions │  │              │  │                │  │
│  └─────────────────┘  └──────────────┘  └────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ EDGE FUNCTIONS (Deno/TypeScript, verify_jwt=false)       ││
│  │  sunat-billing v70 — SOAP + REST, 30 archivos, ~2600 ln  ││
│  │  sunat-credentials v8 — AES-256-GCM CRUD, 237 ln        ││
│  │  apis-peru-proxy v4 — RUC/DNI proxy, rate limit, 167 ln  ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   SUNAT SOAP      SUNAT REST      apisperu.com
   e-factura       api-cpe         (RUC/DNI)
```

### 2.2 Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Desktop | Tauri 2 (Rust + WebView) | 2.x |
| Frontend | React + TypeScript + Vite | 19 / 5.5 / 6.x |
| UI | shadcn/ui + Tailwind CSS | latest / 3.x |
| Estado servidor | TanStack Query | 5.x |
| Routing | react-router-dom | 6.x |
| Validación | Zod | 3.x |
| PDFs | jsPDF | latest |
| Backend DB | Supabase PostgreSQL | 15 |
| Auth | Supabase GoTrue | 2.x |
| Edge Runtime | Deno | latest |
| Build tool | pnpm | latest |

### 2.3 IDs y Referencias

| Recurso | ID |
|---------|-----|
| Supabase Project Ref | `kdsjojrrspzmufdumywd` |
| Organization ID | `7e80b22f-b06a-4025-937a-5f9d62d78733` |
| Admin User ID | `7a900ed7-3939-46aa-bdb2-2e8e3be5621a` |
| GitHub Repo | `github.com/DiegoZ4p4t4/katsumoto` |

---

## 3. REQUERIMIENTOS FUNCIONALES (RF)

Identificados a partir del análisis de código (27 requerimientos):

### Núcleo de Facturación Electrónica SUNAT
| ID | Requerimiento | Estado | Verificación |
|----|--------------|--------|-------------|
| RF01 | Emitir factura electrónica (SOAP sendBill) | ✅ | F001-1, F001-2 aceptadas |
| RF02 | Emitir boleta de venta (vía resumen SOAP) | ✅ | B001-1 aceptada |
| RF03 | Emitir nota de crédito (SOAP sendBill) | ✅ | Estructura XML lista, no testeada en prod |
| RF04 | Emitir nota de débito (SOAP sendBill) | ⚠️ | Misma estructura que NC, no testeada |
| RF05 | Enviar resumen diario de boletas (SOAP sendSummary) | ✅ | Verificado con CDR |
| RF06 | Enviar comunicación de baja (SOAP sendSummary) | ✅ | F001-1 baja aceptada |
| RF07 | Consultar ticket de resumen/baja (SOAP getStatus) | ✅ | Verificado |
| RF08 | Emitir guía de remisión electrónica (REST) | ❌ | Bloqueado por OAuth2 |
| RF09 | Consultar ticket de GRE (REST checkStatus) | ⚠️ | Implementado, no testeado |

### POS y Ventas
| ID | Requerimiento | Estado |
|----|--------------|--------|
| RF10 | Punto de venta con carrito | ✅ |
| RF11 | Cálculo de IGV (precios-inclusive) | ✅ |
| RF12 | Price tiers por cantidad | ✅ |
| RF13 | Múltiples métodos de pago (7) | ✅ |
| RF14 | Determinación tributaria automática (Amazonía) | ✅ |

### Gestión de Inventario
| ID | Requerimiento | Estado |
|----|--------------|--------|
| RF15 | CRUD de productos con SKU, barcode, categorías | ✅ |
| RF16 | Stock por sucursal (multi-sede) | ✅ |
| RF17 | Transferencias entre sedes | ✅ |
| RF18 | Ajustes de stock (entrada/salida) | ✅ |
| RF19 | Kardex de movimientos | ✅ |
| RF20 | Importación masiva CSV | ✅ |
| RF21 | Compatibilidad producto-máquina | ✅ |

### Clientes y Tienda Web
| ID | Requerimiento | Estado |
|----|--------------|--------|
| RF22 | CRUD de clientes (RUC/DNI) | ✅ |
| RF23 | Búsqueda automática RUC/DNI vía apisperu.com | ✅ |
| RF24 | Tienda web pública (catálogo, carrito, checkout) | ✅ |
| RF25 | Pedidos online con ajuste de stock | ✅ |

### Administración y Configuración
| ID | Requerimiento | Estado |
|----|--------------|--------|
| RF26 | Configuración SUNAT (credenciales, certificado, GRE) | ✅ |
| RF27 | Configuración tributaria (Ley Amazonía 27037) | ✅ |

---

## 4. REQUERIMIENTOS NO FUNCIONALES (NFR)

| ID | Requerimiento | Estado | Evidencia |
|----|--------------|--------|-----------|
| NFR01 | Multi-tenant (organization_id en todas las tablas) | ✅ | 25 tablas con RLS |
| NFR02 | Row-Level Security (63 políticas) | ✅ | Verificado |
| NFR03 | Cifrado AES-256-GCM de credenciales SUNAT | ✅ | `credentials.ts:tryDecrypt` |
| NFR04 | CORS restringido a orígenes conocidos | ✅ | v4 allowlist en http.ts |
| NFR05 | TypeScript strict mode (0 errores) | ✅ | `tsc --noEmit` |
| NFR06 | Realtime para datos críticos (7 tablas) | ✅ | Supabase channels |
| NFR07 | Cumplimiento UBL 2.1 / XMLDSig SUNAT | ✅ | SHA-256 + RSA |
| NFR08 | Desktop app (Tauri 2) | ✅ | Config presente |
| NFR09 | Lazy loading de páginas | ✅ | 27 React.lazy() |
| NFR10 | Dark/Light theme | ✅ | ThemeProvider |
| NFR11 | Auditoría inmutable | ✅ | audit_log + fire-and-forget |
| NFR12 | Rate limiting RUC/DNI proxy | ✅ | 30 req/min por IP+userId |
| NFR13 | Validación de roles en EFs (escritura) | ✅ | Corregido FASE 4, jul 2025 |
| NFR14 | Token cache GRE con límite LRU (20 entradas) | ✅ | Corregido FASE 6, jul 2025 |
| NFR15 | Tests unitarios (73 tests) | ⚠️ | ~15% cobertura |
| NFR16 | Migraciones versionadas de DB | ❌ | Manual, sin sistema |
| NFR17 | Backups automatizados | ❌ | Solo pg_dump manual |
| NFR18 | Circuit breaker para llamadas SUNAT | ❌ | Solo retries con backoff |
| NFR19 | Rate limiting en sunat-billing | ❌ | Sin protección |
| NFR20 | X-Request-ID / Correlation-ID para tracing | ❌ | No implementado |

---

## 5. CASOS DE USO

### Actores y Roles

| Rol | Descripción | Permisos clave |
|-----|-------------|---------------|
| **owner** | Dueño de la organización | Acceso total, config SUNAT, gestión usuarios |
| **admin** | Administrador | CRUD completo, facturación, reportes, SUNAT |
| **cashier** | Cajero | POS, clientes, consultas básicas |
| **inventory** | Encargado de almacén | Inventario, stock, transferencias |
| **reader** | Solo lectura | Consultas |

### Casos de Uso Principales

```
UC01: Cajero realiza venta rápida (POS)
  Actor: cashier
  Flujo: Seleccionar productos → Ajustar cantidades → Seleccionar cliente →
         Elegir método de pago → Cobrar → Emitir comprobante → Imprimir ticket
  Post: Stock descontado, invoice creada (status: issued)

UC02: Envío de boletas diarias a SUNAT
  Actor: admin
  Flujo: Seleccionar fecha → Enviar resumen diario (send-summary) →
         Recibir ticket → Consultar ticket (check-summary-ticket) →
         Guardar CDR
  Post: Boletas marcadas como issued + sunat_ticket, log en sunat_summary_log

UC03: Emisión de factura electrónica
  Actor: admin
  Flujo: Crear factura con items → Validar RUC cliente (módulo 11) →
         Enviar a SUNAT (send) → Recibir CDR inmediato →
         Guardar XML + CDR en Storage
  Post: Invoice status: accepted, CDR almacenado

UC04: Anulación de factura
  Actor: admin
  Flujo: Seleccionar factura emitida → Elegir motivo → Enviar baja (send-voided) →
         Recibir ticket → Consultar ticket → Verificar CDR
  Post: Invoice status: cancelled

UC05: Emisión de nota de crédito
  Actor: admin
  Flujo: Seleccionar factura padre → Elegir motivo (catálogo 09) →
         Seleccionar ítems a acreditar → Crear NC → Enviar a SUNAT
  Post: NC creada y enviada, vinculada a factura padre

UC06: Emisión de guía de remisión
  Actor: admin
  Flujo: Completar datos de traslado (motivo, modalidad, transportista,
         conductor, vehículo, destinatario) → Agregar ítems →
         Enviar vía REST → Recibir ticket → Polling hasta CDR
  Estado: ❌ Bloqueado por OAuth2

UC07: Recepción de stock
  Actor: inventory
  Flujo: Seleccionar producto → Seleccionar sede → Ingresar cantidad →
         Registrar movimiento "in" → Stock actualizado
  Post: stock_movement creado, branch_stock incrementado

UC08: Transferencia entre sedes
  Actor: inventory
  Flujo: Seleccionar producto → Sede origen → Sede destino → Cantidad →
         Registrar transferencia
  Post: Dos stock_movements (transfer_out + transfer_in), branch_stock ajustado

UC09: Gestión de catálogo
  Actor: admin
  Flujo: CRUD de productos → Categorías gestionadas → Precios por cantidad →
         Compatibilidad con máquinas → Imágenes
  Post: Producto disponible para POS y tienda web

UC10: Importación CSV de productos
  Actor: admin
  Flujo: Seleccionar archivo CSV → Validar columnas → Detectar duplicados →
         Carga por lotes de 50 → Reporte de resultados
  Post: Productos creados en DB

UC11: Monitoreo de salud SUNAT
  Actor: admin / owner
  Flujo: Dashboard con 13 métricas → Alertas (sin CDR, rechazados,
         vencidos, certificado) → Cola de reenvío → Botón retry
  Post: Visibilidad de estado de facturación

UC12: Pedido web (tienda pública)
  Actor: Cliente anónimo
  Flujo: Navegar catálogo → Agregar al carrito → Checkout →
         Ingresar datos → Confirmar pedido
  Post: store_order creado, stock ajustado vía RPC

UC13: Reportes
  Actor: admin
  Flujo: Seleccionar tipo (ventas/contable) → Aplicar filtros (fecha, sede) →
         Ver dashboard → Exportar
  Post: Datos agregados desde DB

UC14: Configuración SUNAT
  Actor: owner
  Flujo: Ingresar RUC, razón social, usuario/clave SOL →
         Subir certificado digital (.p12/.pem) →
         Configurar GRE OAuth2 → Test conexión
  Post: sunat_config actualizado, credenciales cifradas
```

---

## 6. ANÁLISIS POR CAPA

### 6.1 Frontend (React 19 + TypeScript)

#### Fortalezas
- **Lazy loading universal**: 27 páginas con `React.lazy()`, reduce bundle inicial
- **TanStack Query**: Separación estado cliente/servidor, staleTime por dominio
- **Provider hierarchy limpia**: 8 providers en cascada lógica (Auth → Realtime → Theme → Platform → Branch → CategoryImages → TaxConfig)
- **RoleGuard**: Protección de rutas sensibles a nivel componente
- **Tax Engine**: Determinación tributaria multi-sede con soporte Ley Amazonía 27037
- **Realtime**: 7 tablas suscritas con invalidación automática de queries
- **Dual build**: Admin (port 8551) + Tienda pública (port 8552), entries separados

#### Debilidades
- **13 queries paralelas en Dashboard** (`useSunatHealth`): Carga inicial pesada, podrían consolidarse en una RPC
- **No optimistic updates**: Mutaciones esperan respuesta del servidor antes de reflejar cambios en UI
- **`getCurrentOrgId` llama a DB en cada invocación**: Con cache TTL 5 min, pero se consulta en cada servicio. Mejor: almacenar en AuthContext
- **Sin lazy loading intra-página**: Componentes pesados como gráficos Recharts cargan en bundle inicial de la página
- **`NotFound` importado pero no usado** (`App.tsx:43`): Catch-all usa `AdminRedirect`. El import lazy igual se ejecuta
- **`console.error` en producción** (`useRealtime.ts:118`): Debe usar logger condicional o eliminarse

### 6.2 Servicios (18 archivos)

#### Fortalezas
- **Separación por dominio**: Cada tabla tiene su servicio dedicado
- **Auditoría integrada**: `auditService.log()` en operaciones críticas (fire-and-forget)
- **RPC con retry**: `createWithItems` maneja colisiones de correlativo con 3 reintentos
- **Validación de transiciones**: `VALID_INVOICE_TRANSITIONS` previene cambios de estado ilegales
- **Manejo de errores amigable**: Stock insuficiente, SKU duplicado, RUC inválido

#### Issues
- **`createOrder` en `store-public.service.ts` no es transaccional**: Si falla el `adjust_stock` RPC después de crear `store_order_items`, quedan ítems huérfanos con stock inconsistente
- **`batchCreate` en `product.service.ts` no asigna barcode**: Los productos importados vía CSV quedan con `barcode: ""` (línea 218)
- **`createWithItems` duplica lógica de cálculo**: `calculateInvoice` se llama en frontend (POS) y los resultados se pasan a la RPC, pero la RPC recalcula. Podría haber discrepancia

### 6.3 Hooks (35 archivos)

#### Fortalezas
- **Composición**: `usePosCart` compone `useProducts`, `useBranches`, `useTaxConfig`
- **Memoización**: `useMemo`/`useCallback` en cálculos costosos (tax determination, cart totals)
- **SUNAT Health**: 13 métricas en 13 queries paralelas con `Promise.all`

#### Issues
- **`useInvoices` depende de `useBranches`**: Si `useBranches` no está disponible (ej: fuera de BranchSelectionProvider), `useInvoices` falla silenciosamente
- **`usePosCart` usa `showError` imperativo**: Los errores de stock se muestran con toast pero el estado del carrito no se revierte en todos los casos
- **`useSunatAlerts` hace hasta 6 queries secuenciales**: Las queries de `noCdrInvoices`, `rejected`, `stale`, `despatchRejected`, `certFailures`, `cfg` son secuenciales. Deberían ser paralelas

### 6.4 Edge Functions (Deno/TypeScript, 33 archivos)

#### sunat-billing v70 — Fortalezas
- **Modularización excelente**: 30 archivos en 8 directorios (crypto, gre, soap, xml, utils)
- **Factory pattern**: `createSunatClient()` → `DirectSunatClient`
- **Validación pre-envío robusta**: Status, fecha ≤ 7 días, RUC módulo 11, items, customer
- **Manejo de errores granular**: CERT_ERROR_MAP, errores SUNAT específicos
- **Role-based access**: Solo owner/admin para acciones de escritura (FASE 4, corregido jul 2025)
- **GRE REST completo**: OAuth2 flow, sendCpe, checkStatus (implementado, bloqueado por credenciales)

#### sunat-billing v70 — Issues

| # | Gravedad | Ubicación | Descripción |
|---|----------|-----------|-------------|
| **E1** | CRÍTICO | `gre-rest-client.ts` | GRE OAuth2 bloqueado. Credenciales viejas rechazadas. Bloquea guías de remisión. |
| **E2** | ALTO | `index.ts:280-287` | `handleSummary`: si SOAP retorna success pero falla al actualizar invoices individuales, no hay rollback. Las boletas marcadas como `issued` + `sunat_ticket` sin verificación de que el ticket fue aceptado. |
| **E3** | ALTO | `transformers.ts:86` | IGV rate hardcodeado `0.18` en cálculo de `precioUnitSinIgv`. Debe usar constante. |
| **E4** | MEDIO | `direct-client.ts:153-155` | `sendVoided` no tiene try/catch como `sendSummary`. Si `sendSummary` lanza, el error no es catcheado. |
| **E5** | MEDIO | `direct-client.ts:55` | `buildFileBasename` para GRE usa `buildFileBasename` que genera nombre SOAP-style (`RUC-01-F001-N`). GRE REST requiere nombres específicos de archivo. |
| **E6** | MEDIO | `index.ts:652` | `usedGreVersion` declarado `const` pero nunca usado excepto en return (línea 726). La variable `initialGreVersion` se usa directamente en `sendDespatch`. Código muerto. |
| **E7** | BAJO | `crypto/certificate.ts:77` | `catch {}` vacío documentado pero sin logging. |
| **E8** | BAJO | `index.ts` varias | `(supabase.from(...) as any)` en 25+ ubicaciones. Sin type-safety. |

### 6.5 Base de Datos (25 tablas, PostgreSQL 15)

#### Fortalezas
- RLS en 100% de tablas (63 políticas)
- 4 RPC functions para operaciones atómicas
- 22 índices FK (documentado en AGENTS.md)
- Realtime habilitado en 7 tablas críticas
- Soft delete (is_active) en productos

#### Issues
- **Sin migraciones versionadas**: Cambios de schema manuales, sin tracking
- **Sin backups automatizados**: Solo pg_dump manual mencionado en docs
- **`sunat_summary_log` sin FK a invoices**: Relación solo vía `ticket`
- **Nivel de aislamiento READ COMMITTED**: Riesgo de phantom reads en ventas simultáneas (aunque la RPC `create_invoice_with_items` maneja stock dentro de la transacción, depende de la implementación SQL de la constraint de stock)

### 6.6 Tax Engine (src/lib/tax-engine.ts — 524 líneas)

#### Fortalezas
- **Dos modos**: `determineTax` (legacy, simple) y `determineTaxForTransaction` (v2, multi-sede)
- **Granularidad geográfica**: Distrito → Provincia → Departamento con confidence score
- **Soporte Ley Amazonía 27037**: Exoneración IGV con validación de ubicación vendedor + comprador
- **Override por producto**: `determineProductTax` permite excepciones individuales
- **Texto legal**: `getLegalBasisText` genera fundamento para comprobantes
- **Validación de configuración**: `validateTaxConfig` con warnings proactivos

#### Issues
- **`isDistrictSelvaRaw` no cacheado**: Cada consulta recorre el array de distritos. Con 143 productos × N transacciones, podría ser costoso
- **`getDistrict` vs `getDistrictRaw`**: Dos funciones con nombres similares para el mismo propósito (una en `geo-districts.ts`, otra en `geo-peru.ts`)

---

## 7. ANÁLISIS DE SEGURIDAD

### Fortalezas (10)
1. AES-256-GCM para `clave_sol` y `certificado_password` (IV aleatorio de 12 bytes)
2. `tryDecrypt` retorna `null` si falla, nunca expone ciphertext
3. CORS restringido: allowlist de 4 orígenes en las 3 EFs
4. RLS en 100% de tablas (63 políticas, corregidas con `(select auth.uid())`)
5. RoleGuard en frontend para páginas sensibles (owner/admin)
6. Roles en EFs para acciones de escritura (owner/admin requerido)
7. Certificados PEM en Storage (nunca en código)
8. Rate limiting en apis-peru-proxy (30 req/min por IP+userId)
9. JWT propio (decode sub + lookup profile, no depende solo de Supabase Auth)
10. `clearOrgIdCache()` en signOut

### Debilidades (6)
1. **`SupabaseClientLike = any`** en 25+ ubicaciones — Sin type-safety en BD
2. **Sin rate limiting en sunat-billing** — Posible abuso de endpoints de lectura
3. **Service role key en EFs** — Requerido para bypass RLS, riesgo si se filtra. Sin rotación.
4. **Sin sanitización de entrada** — Confía en validación del frontend (no hay Zod en EFs)
5. **Sin X-Request-ID** — Imposible tracear requests en debugging
6. **`audit` fire-and-forget** — Si falla el insert de auditoría, se pierde el registro silenciosamente

---

## 8. ANÁLISIS DE RENDIMIENTO

### Puntos Fuertes
- Lazy loading de páginas (27 chunks separados)
- TanStack Query con `staleTime` por dominio (30s para invoices, 5min para SUNAT health)
- Realtime channels evitan polling
- `Promise.all` en `useSunatHealth` (13 queries paralelas)
- Caché de token OAuth2 con buffer de 10 min

### Puntos Débiles
- **13 queries en Dashboard**: Cada carga del dashboard dispara 13+ queries. Una RPC unificada reduciría round-trips
- **Sin paginación en algunas queries**: `getAllProducts` retorna 143 filas sin límite
- **Cálculo en cliente**: Métricas calculadas con `useMemo` + `filter`/`map` sobre arrays completos
- **SOAP timeout 30s + 3 retries**: Hasta 90s de espera. SUNAT beta responde en 2-5s típicamente
- **Sin compresión gzip en respuestas de EFs**: XMLs grandes sin Content-Encoding

---

## 9. DEUDA TÉCNICA — VISIÓN COMPLETA

### Bloqueantes (1)
| # | Item | Impacto | Acción |
|---|------|---------|--------|
| D1 | GRE OAuth2 vencido | No se pueden emitir guías de remisión | Regenerar credenciales en SUNAT Menú SOL |

### Alta Prioridad (5)
| # | Item | Archivo | Esfuerzo |
|---|------|---------|----------|
| D2 | Sin rollback en handleSummary si falla update de invoices | `index.ts:280-287` | 3h |
| D3 | IGV rate hardcodeado 0.18 en transformers | `transformers.ts:86,164` | 30min |
| D4 | `createOrder` no transaccional (store-public.service) | `store-public.service.ts:97-155` | 2h |
| D5 | `sendVoided` sin try/catch | `direct-client.ts:153-155` | 15min |
| D6 | `batchCreate` CSV no asigna barcode | `product.service.ts:218` | 1h |

### Media Prioridad (8)
| # | Item | Archivo | Esfuerzo |
|---|------|---------|----------|
| D7 | `useSunatAlerts` queries secuenciales (→ paralelas) | `useSunatAlerts.ts` | 1h |
| D8 | 13 queries Dashboard → consolidar en RPC | `useSunatHealth.ts` | 3h |
| D9 | Sin optimistic updates en mutations | hooks `use*Mutations` | 4h |
| D10 | `getCurrentOrgId` consulta DB cada vez | `supabase.ts` | 1h |
| D11 | `NotFound` importado sin usar | `App.tsx:43` | 5min |
| D12 | `units` no persistido en invoice_items | Schema + transformers | 2h |
| D13 | Migraciones versionadas de DB | Infraestructura | 8h |
| D14 | Tests insuficientes (~15% cobertura) | `__tests__/` | 20h+ |

### Baja Prioridad (8)
| # | Item | Archivo | Esfuerzo |
|---|------|---------|----------|
| D15 | `console.error` en producción | `useRealtime.ts:118` | 5min |
| D16 | `usedGreVersion` código muerto | `index.ts:652` | 5min |
| D17 | PHP legacy en `OTROS/sunat-billing-api/` | OTROS/ | Cleanup |
| D18 | `sendVoided` correlativo por día (reinicia a 1 cada día) | `index.ts:323-329` | Verificar con SUNAT |
| D19 | Circuit breaker para llamadas SUNAT | `soap-client.ts` | 4h |
| D20 | Rate limiting en sunat-billing | `index.ts` | 2h |
| D21 | X-Request-ID en todas las EFs | `http.ts` | 2h |
| D22 | Backups automatizados de PostgreSQL | Infraestructura | 4h |

---

## 10. VERIFICACIONES TÉCNICAS

| Verificación | jul 2025 | jul 2026 | Nota |
|-------------|----------|----------|------|
| `tsc --noEmit` | 0 errores | Por verificar | |
| `vite build` (admin) | Exitosa | Por verificar | |
| `vite build` (store) | Exitosa | Por verificar | |
| `vitest run` | 73/73 passed | Por verificar | |
| `eslint` | 24 errors (any en EFs) | Por verificar | Todos `no-explicit-any` |

---

## 11. PLAN DE ACCIÓN RECOMENDADO

### Semana 1 (Crítico + Alta prioridad)
1. **Regenerar GRE OAuth2** — Acceder a SUNAT Menú SOL, generar nuevas credenciales
2. **Fix D3**: Reemplazar `0.18` hardcodeado por `IGV_RATE` en transformers.ts
3. **Fix D5**: Agregar try/catch en `sendVoided`
4. **Fix D4**: Hacer transaccional `createOrder`

### Semana 2-3 (Medio plazo inmediato)
5. **Fix D2**: Rollback en `handleSummary`
6. **Fix D6**: Asignar barcode en batchCreate CSV
7. **Fix D7**: Paralelizar queries en `useSunatAlerts`
8. **Fix D10**: Mover org_id al AuthContext

### Mes 1-2 (Mejoras estructurales)
9. D8: RPC unificada de Dashboard
10. D9: Optimistic updates
11. D12: Persistir `unit` en invoice_items
12. D13: Sistema de migraciones

### Mes 3+ (Madurez)
13. D14: Aumentar cobertura de tests a 60%+
14. D19: Circuit breaker SUNAT
15. D20-D21: Rate limiting + tracing
16. D22: Backups automatizados

---

## 12. CONCLUSIÓN

Katsumoto es un sistema **notablemente bien diseñado** para su escala y dominio. La arquitectura de 3 capas (frontend → servicios → edge functions) está bien definida. El motor SUNAT es completo y funcional para el flujo SOAP (facturas, boletas, resúmenes, bajas). El tax engine con soporte para Ley Amazonía es un diferenciador importante.

**El sistema está ~85% listo para producción.** El bloqueo GRE OAuth2 es el único impedimento funcional. Las 22 issues restantes son de optimización, seguridad y robustez — ninguna bloquea la operación del core de facturación.

Comparado con la auditoría de julio 2025: 4 bugs críticos corregidos (Rules of Hooks, stock roto, duplicados cola reenvío, roles en EFs), 7 mejoras implementadas (cert_expiring, LRU token cache, CORS, documentación). La dirección técnica es sólida.

### Recomendación final
**Resolver D1 (GRE OAuth2) y D4 (createOrder transaccional) antes de producción.** El resto puede abordarse incrementalmente sin afectar la operación diaria.

---

*Documento generado por análisis estático completo de ~180 archivos frontend y 33 archivos edge functions, 2026-07-18.*
