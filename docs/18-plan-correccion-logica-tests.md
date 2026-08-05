# Plan de Corrección Final — Lógica y Tests

**Fecha:** 2026-07-19
**Objetivo:** Detectar y corregir errores de lógica, validar con tests unitarios, sin cambios ciegos.

---

## Fase 1 — Tests unitarios para caminos críticos
**Por qué:** Los 73 tests actuales cubren solo cálculos y schemas. Los hooks y servicios no tienen tests. Si cambio lógica sin tests, puedo romper cosas.

### 1.1 Tests para `calculations.ts`
- [ ] `calculateInvoice` con price tier (descuento por cantidad)
- [ ] `calculateInvoice` con producto sin tax_affectation (debe default a gravado)
- [ ] `calcIgvCents` precios-inclusive — verificar fórmula IGV peruana
- [ ] `calcDiscountCents` con redondeo extremo (0.5, 1.5)

### 1.2 Tests para `usePosCart`
- [ ] Agregar producto con stock 0 → no se agrega, toast error
- [ ] Agregar mismo producto 2 veces → cantidad incrementa
- [ ] Exceder stock → no se incrementa, toast error
- [ ] Cambiar cantidad con +/- → price tier se recalcula
- [ ] Remover producto → carrito actualizado

### 1.3 Tests para `invoice.service.ts`
- [ ] `createWithItems` con datos válidos → llama RPC correcta
- [ ] `createWithItems` con colisión de correlativo → reintenta 3 veces
- [ ] `createWithItems` con stock insuficiente → error descriptivo
- [ ] `updateStatus` transición válida → éxito
- [ ] `updateStatus` transición inválida → error

### 1.4 Tests para `useDashboardSales`
- [ ] Sin invoices → todo en 0
- [ ] Con invoice de hoy → todaySales correcto
- [ ] Con invoice de este mes → monthSales correcto
- [ ] Trend últimos 7 días → agrupación correcta por día
- [ ] Filtra draft y cancelled

---

## Fase 2 — Revisión de lógica por módulo
**Por qué:** Los tests expondrán bugs. Aquí los corrijo.

### 2.1 `useDashboardSales` — timezone y fechas
- [ ] ¿`getDateKey` maneja fechas UTC vs local?
- [ ] ¿`todayKey` usa timezone correcto?
- [ ] ¿`monthStart` funciona en cualquier día del mes?

### 2.2 `usePosCart` — price tiers en edge cases
- [ ] ¿Qué pasa si priceTiers está vacío?
- [ ] ¿Qué pasa si product.stock es undefined?
- [ ] ¿Se recalcula el precio al cambiar cantidad con tier activo?

### 2.3 `invoice.service.ts` — retry loop
- [ ] ¿El retry captura correctamente errores de duplicado vs stock?
- [ ] ¿`getNextCorrelativo` se llama en cada intento?

### 2.4 `create_invoice_with_items` RPC — seguridad
- [ ] ¿Qué pasa si `p_items` incluye product_id null?
- [ ] ¿Qué pasa si `p_igv_rate` es 0?

### 2.5 `useSunatHealth` — queries paralelas
- [ ] ¿Alguna query puede fallar sin afectar a las demás?
- [ ] ¿`lastSent` retorna array vacío → null?

---

## Fase 3 — Performance y edge cases
### 3.1 Memoización
- [ ] Verificar que useMemo/useCallback no tengan dependencias incorrectas
- [ ] Verificar que no haya re-renders innecesarios en listas grandes

### 3.2 Validación de entrada
- [ ] ¿Los formularios Zod validan antes de submit?
- [ ] ¿Hay sanitización en búsquedas?

---

## Orden de ejecución

```
1. Escribir tests de calculations.ts (30 min)
2. Escribir tests de useDashboardSales (30 min)
3. Corregir bugs encontrados en fase 2 (1-2h)
4. Escribir tests de invoice.service.ts (30 min)
5. Verificar performance (30 min)
```
