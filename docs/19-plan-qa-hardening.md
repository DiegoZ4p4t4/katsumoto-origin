# Plan de QA y Hardening — Katsumoto

**Fecha:** 2026-07-19
**Objetivo:** Blindar el sistema contra errores de usuario, datos inválidos, fallos de red y edge cases.

---

## Diagnóstico actual

### Lo que SÍ tiene
- Zod en formularios de producto, factura, cliente, sucursal, máquina
- Loading/error/empty states en páginas principales
- Retry en creación de facturas (colisiones de correlativo)
- Rate limiting en Edge Functions

### Lo que NO tiene
- Validación en formularios de guía de remisión (CreateDespatch) — 15 campos sin Zod
- Validación en formulario de distribuidor (StoreIndex) — HTML puro sin validación
- Sanitización de entrada en el checkout de la tienda
- Manejo de errores de red (Supabase caído = pantalla en blanco)
- Protección contra fuerza bruta en login (sin rate limiting)
- Tests unitarios para hooks (0 tests de hooks)
- Tests de integración para flujos críticos (0 tests E2E)
- Confirmación antes de acciones destructivas (solo delete tiene confirm dialog)
- Manejo de timeout en operaciones largas

---

## Fase 1: Blindaje de Entrada (Input Validation)
**Prioridad:** Crítica | **Tiempo estimado:** 2 horas
**Objetivo:** Que ningún formulario acepte datos inválidos o maliciosos.

### 1.1 Validar CreateDespatch con Zod
- [ ] Crear `despatchFormSchema` con Zod
- [ ] Validar: serie, motivo_traslado, modalidad, fechas, ubigeos, transportista, conductor, vehículo, items
- [ ] RUC/DNI del transportista y conductor con checksum
- [ ] Fecha de inicio de traslado no puede ser pasada
- [ ] Peso bruto y bultos > 0

### 1.2 Validar formulario de checkout (tienda)
- [ ] Longitud máxima de nombre (200 chars)
- [ ] Teléfono: solo dígitos, 7-15 caracteres
- [ ] Email: validación de formato
- [ ] DNI/RUC: validación de longitud
- [ ] Dirección: máximo 500 chars
- [ ] Sanitización de caracteres especiales

### 1.3 Sanitización global
- [ ] Función `sanitizeInput(str)` que remueva XSS vectors
- [ ] Aplicar a todos los campos de texto libre (nombres, notas, direcciones)

---

## Fase 2: Robustez de Red (Network Resilience)
**Prioridad:** Alta | **Tiempo estimado:** 1.5 horas
**Objetivo:** El sistema no crashea si Supabase/SUNAT no responden.

### 2.1 Error Boundary global
- [ ] Envolver el `AppRoutes` en un `<ErrorBoundary>` con fallback UI
- [ ] Mostrar: "Algo salió mal" + botón "Recargar"
- [ ] Loguear el error para debugging (solo en DEV)

### 2.2 Pantalla de "Sin conexión"
- [ ] Detectar `navigator.onLine` + listeners
- [ ] Mostrar banner "Sin conexión a internet" persistente
- [ ] Deshabilitar botones que requieren red
- [ ] Reconectar automáticamente al recuperar conexión

### 2.3 Timeout en queries TanStack Query
- [ ] Agregar `retry: 2` en todas las queries
- [ ] Agregar `retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000)`
- [ ] Mostrar toast "Reintentando..." en queries que fallan

---

## Fase 3: Tests Unitarios (Hooks y Servicios)
**Prioridad:** Alta | **Tiempo estimado:** 3 horas
**Objetivo:** Los paths críticos tienen cobertura de tests.

### 3.1 Tests de hooks
- [ ] `usePosCart` — agregar, quitar, actualizar cantidad, price tiers, stock validation
- [ ] `useDashboardSales` — sin datos, con datos, filtrado de estados
- [ ] `useCrudMutations` — save, delete, error handling

### 3.2 Tests de servicios
- [ ] `invoice.service.ts` — createWithItems retry, updateStatus transiciones
- [ ] `customer.service.ts` — upsertFromLookup, search sanitization

### 3.3 Tests de schemas Zod
- [ ] `invoice.schema.ts` (ya tiene 17 tests ✅)
- [ ] `product.schema.ts` — valores límite, campos requeridos
- [ ] `client.schema.ts` — RUC/DNI inválidos
- [ ] `branch.schema.ts` — UBIGEO inválido

---

## Fase 4: Boundary Testing (Pruebas de Borde)
**Prioridad:** Media | **Tiempo estimado:** 1.5 horas
**Objetivo:** El sistema no se rompe con datos extremos.

### 4.1 Tests de valores límite
- [ ] Nombres de 1 carácter y 500 caracteres
- [ ] Precios de 0 soles y 999,999 soles
- [ ] Cantidades de 0 y 999,999
- [ ] Porcentajes de descuento negativos y >100%
- [ ] SKU vacío o con caracteres especiales
- [ ] Campos de texto con emojis, RTL, caracteres Unicode

### 4.2 Revisión manual de componentes
- [ ] ¿Qué pasa si `products` es `null` en vez de `[]`?
- [ ] ¿Qué pasa si `invoice.items` es `undefined`?
- [ ] ¿Qué pasa si un select no tiene opciones?

---

## Fase 5: UX Defensiva
**Prioridad:** Media | **Tiempo estimado:** 1 hora
**Objetivo:** Prevenir errores de usuario comunes.

### 5.1 Confirmaciones
- [ ] Anular factura → confirm dialog con motivo
- [ ] Cambiar estado de pedido → confirmación
- [ ] Cerrar caja → confirmación con resumen
- [ ] Eliminar cliente con facturas → advertencia

### 5.2 Prevención de doble click
- [ ] Deshabilitar botones durante operaciones async
- [ ] Spinner en botones de submit
- [ ] `isPending` de TanStack Mutation en todos los botones

---

## Orden de ejecución propuesto

```
Fase 1 (2h):  Validación de entrada — lo más urgente
Fase 2 (1.5h): Robustez de red — evitar pantallas en blanco
Fase 3 (3h):  Tests unitarios — base para no romper nada
Fase 4 (1.5h): Boundary testing — edge cases
Fase 5 (1h):  UX defensiva — pulido final
```

---

*Empezar por Fase 1.*
