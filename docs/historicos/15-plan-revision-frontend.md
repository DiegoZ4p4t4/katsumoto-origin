# Plan de Revisión Frontend — Katsumoto

**Fecha:** 2026-07-19
**Objetivo:** Revisión sistemática de la interacción frontend-backend, calidad de código, estados, tipos y estándares. Sin cambios ciegos.

---

## Agrupación por capas y dominio

En vez de revisar módulo por módulo aislado, agrupo por capa de la arquitectura frontend. Esto permite ver patrones, duplicación y problemas transversales.

```
┌──────────────────────────────────────────────────┐
│ GRUPO A: Capa de Datos (Services + Supabase)      │
│ ──────────────────────────────────────────────── │
│ A1. supabase.ts — cliente, org_id, caché          │
│ A2. Patrón de servicios — 18 archivos             │
│ A3. Manejo de errores en capa de datos            │
│ A4. Type safety en queries Supabase               │
├──────────────────────────────────────────────────┤
│ GRUPO B: Capa de Estado (Hooks + TanStack Query)  │
│ ──────────────────────────────────────────────── │
│ B1. useCrudMutations — el patrón genérico         │
│ B2. Mutaciones por dominio (Product, Invoice, ...)│
│ B3. Queries — staleTime, refetchOnWindowFocus     │
│ B4. Invalidation patterns — queries invalidadas   │
│ B5. Cache consistency — lecturas de cache         │
├──────────────────────────────────────────────────┤
│ GRUPO C: Capa de Presentación (Pages)              │
│ ──────────────────────────────────────────────── │
│ C1. Estados: loading, empty, error, edge cases    │
│ C2. Formularios: Zod, react-hook-form, validación │
│ C3. Navegación: rutas, redirects, guards          │
├──────────────────────────────────────────────────┤
│ GRUPO D: Flujos Completos (End-to-End)            │
│ ──────────────────────────────────────────────── │
│ D1. Flujo de venta (POS → Invoice → SUNAT)        │
│ D2. Flujo de inventario (Producto → Stock → Mov.) │
│ D3. Flujo de tienda (Catálogo → Carrito → Pedido) │
├──────────────────────────────────────────────────┤
│ GRUPO E: Calidad Transversal                       │
│ ──────────────────────────────────────────────── │
│ E1. TypeScript — casts, any, tipos rotos          │
│ E2. Performance — re-renders, memo, useMemo       │
│ E3. Manejo de errores — toast, recovery, retry    │
│ E4. Consistencia de nomenclatura                  │
└──────────────────────────────────────────────────┘
```

---

## Orden de revisión (priorizado por impacto)

### 1. GRUPO A — Capa de Datos [prioridad: crítica]
**Por qué primero:** Todo depende de esta capa. Si los servicios están mal, lo demás hereda los problemas.

**Archivos a revisar:**
| # | Archivo | Qué revisar |
|---|---------|-------------|
| A1 | `src/lib/supabase.ts` | ¿`getCurrentOrgId()` ya es O(1) con VITE_ORG_ID? ¿Se eliminó el cache TTL correctamente? ¿Quedan referencias a `clearOrgIdCache`? |
| A2 | `src/services/*.ts` (18) | ¿Todos usan `await getCurrentOrgId()` sincrónico ahora? ¿Hay `as any` en queries? ¿Manejan errores consistentemente? |
| A3 | `src/services/invoice.service.ts` | `createWithItems` retry loop ¿funciona con org_id constante? |
| A4 | `src/services/store-public.service.ts` | `createOrder` ¿ya tiene try/catch por item? |

**Criterio de aceptación:**
- [ ] `getCurrentOrgId()` no hace query a DB
- [ ] Todos los servicios compilan sin errores de tipo
- [ ] No hay `as any` innecesarios en queries Supabase
- [ ] Errores de DB se propagan como `Error` con mensaje descriptivo

---

### 2. GRUPO E — Calidad Transversal [prioridad: alta]
**Por qué segundo:** TypeScript roto y performance afectan a todo. Hay que arreglarlo temprano.

**Archivos a revisar:**
| # | Archivo | Qué revisar |
|---|---------|-------------|
| E1 | `src/hooks/useCrudMutations.ts` | Genéricos rotos (`_TEntity`, `Record<string, unknown>`) — ¿se usan correctamente los tipos en los 4 consumidores? |
| E2 | `src/hooks/useInvoices.ts` | `invoices` y `branchInvoices` mismo array — ¿quién consume cada uno? ¿Hay confusión? |
| E3 | `src/hooks/useProductMutations.ts:56` | Cast `as ProductFormData` sobre `Partial<ProductFormData>` — ¿puede faltar algún campo? |
| E4 | `src/hooks/useProductMutations.ts:152` | `nextSku` lee de cache `getQueryData` — ¿riesgo real de colisión? |
| E5 | `src/hooks/useProductMutations.ts:177` | `resolveAdjustBranch` — ¿puede retornar warehouse? |

**Criterio de aceptación:**
- [ ] `useCrudMutations` usa los genéricos correctamente (sin `Record<string, unknown>`)
- [ ] `useInvoices` devuelve nombres no confusos
- [ ] No hay casts inseguros entre `Partial<T>` y `T`
- [ ] `resolveAdjustBranch` filtra warehouses

---

### 3. GRUPO B — Capa de Estado (Queries + Mutations) [prioridad: alta]
**Por qué tercero:** La configuración de TanStack Query define el rendimiento y la experiencia de usuario.

**Archivos a revisar:**
| # | Tema | Qué revisar |
|---|------|-------------|
| B1 | `staleTime` | Comparar valores entre recursos. ¿Hay criterio? ¿5 min para products es aceptable en POS? |
| B2 | `refetchOnWindowFocus` | ¿Cuántas queries se disparan al volver a la pestaña? ¿Debería ser `false` por default? |
| B3 | `invalidateQueries` | Cuando se crea un producto, ¿cuántas queries se invalidan? ¿Es necesario invalidar 7? |
| B4 | Optimistic updates | ¿Hay algún optimistic update en el sistema? ¿Las mutaciones esperan respuesta del servidor? |
| B5 | Cache consistency | ¿`getQueryData` se usa en más lugares? ¿Hay riesgo de leer datos stale? |
| B6 | `queryKeys` | ¿La estructura de query keys es correcta? ¿Hay colisiones? |

**Criterio de aceptación:**
- [ ] `staleTime` documentado y consistente por tipo de recurso
- [ ] `refetchOnWindowFocus: false` en queries de solo lectura
- [ ] Invalidaciones agrupadas lógicamente (no 7 por cada save)
- [ ] Plan claro para optimistic updates (si aplica)

---

### 4. GRUPO C — Capa de Presentación (Pages) [prioridad: media]
**Por qué cuarto:** Los estados de UI solo importan si la capa de datos funciona. Ya se verificaron visualmente en runtime.

**Archivos a revisar:**
| # | Tema | Qué revisar |
|---|------|-------------|
| C1 | Estados loading | ¿Todas las páginas tienen `<Loader2>` spinner? ¿Hay skeletons? |
| C2 | Estados empty | ¿Mensaje descriptivo + acción sugerida? (ej: "No hay comprobantes. Crea el primero") |
| C3 | Estados error | ¿Mensaje + botón reintentar? ¿Se muestra el error técnico? |
| C4 | Formularios | ¿Zod resolver en todos? ¿Validación client-side antes de submit? |
| C5 | Navegación | ¿Rutas protegidas? ¿Redirect correcto? ¿URLs significativas? |

**Criterio de aceptación:**
- [ ] 100% de páginas con loading state
- [ ] 100% de páginas con empty state
- [ ] 100% de páginas con error state + retry
- [ ] Todos los formularios usan Zod

---

### 5. GRUPO D — Flujos Completos [prioridad: media]
**Por qué quinto:** Solo se puede validar si las capas anteriores están bien. Requiere auth real.

**Flujos a revisar:**
| # | Flujo | Recorrido |
|---|-------|-----------|
| D1 | Venta POS | Seleccionar sucursal → productos → cliente → método pago → cobrar → PDF |
| D2 | Factura manual | CreateInvoice → agregar items → cliente → emitir → enviar SUNAT |
| D3 | Inventario | Crear producto → ajustar stock → transferir → ver kardex |
| D4 | Tienda web | Navegar catálogo → carrito → checkout → pedido confirmado |
| D5 | Admin pedidos | Ver pedido → cambiar estado → fulfill → invoice generada |

**Criterio de aceptación:**
- [ ] Cada flujo se completa sin errores de consola
- [ ] Los datos se reflejan correctamente después de cada acción
- [ ] Las queries se invalidan y refrescan correctamente
- [ ] No hay race conditions visibles (datos antiguos tras mutate)

---

## Orden de ejecución propuesto

```
Día 1: Grupo A (Capa de Datos) → 2 horas
Día 2: Grupo E (Calidad Transversal) → 2 horas
Día 3: Grupo B (Estado / TanStack Query) → 3 horas
Día 4: Grupo C (Presentación / Pages) → 2 horas
Día 5: Grupo D (Flujos completos, requiere auth) → 3 horas
```

---

## Issues ya identificados (para no repetir)

| ID | Grupo | Descripción | Archivo |
|----|-------|-------------|---------|
| E1 | E | `useCrudMutations` genéricos ignorados | `useCrudMutations.ts:12-13` |
| E2 | E | `useInvoices` nombres duplicados | `useInvoices.ts:28-29` |
| E3 | E | `resolveAdjustBranch` puede retornar warehouse | `useProductMutations.ts:177` |
| E4 | E | `productPayload as ProductFormData` cast inseguro | `useProductMutations.ts:56` |
| E5 | B | `staleTime` inconsistente (30s-30min) | 6 hooks |
| E6 | B | `refetchOnWindowFocus` default true → 15+ queries | Todo useQuery sin config |
| E7 | B | `saveProduct` invalida 7 queries | `useProductMutations.ts:16-24` |
| E8 | B | `nextSku` lee de cache, no DB | `useProductMutations.ts:152` |
| E9 | A | `stockService.adjust` sin rollback si falla post-create | `useProductMutations.ts:72-77` |
| E10 | C | Verificar loading/empty/error en páginas no revisadas | Pages/* |

---

*Plan de revisión. Empezar por Grupo A.*
