# Plan de Mejora POS — Katsumoto

**Fecha:** 2026-07-21

---

## Diagnóstico

### Problema 1: Toolbar saturada, no escala
- 7 grupos de botones en una fila: Search | Familia | Grupo | Tax | Stock | Count | Paginación
- Grupos truncados a 3 chars (`Rep`, `Herr`, `Maq`) — pierde legibilidad
- Si se agregan más familias/grupos, la toolbar se desborda
- En móvil, todo colapsa y es inusable

### Problema 2: Filtro de grupo con abreviaturas hardcodeadas
```typescript
g === "repuestos" ? "Rep" : g === "herramientas" ? "Herr" : ...
```
No escala con nuevos grupos dinámicos.

### Problema 3: Tarjetas de producto poco informativas
- No muestra stock disponible en la tarjeta (el badge solo dice "AGOT" o el número)
- Price tier visible pero muy pequeño
- Sin indicador visual de "recién agregado" claro

### Problema 4: Móvil no usable
- Filtros ocultos o truncados
- Grid de 2 columnas con tarjetas muy pequeñas
- Carrito ocupa toda la pantalla al abrirse

---

## Solución propuesta

### 1. Toolbar reorganizada en 2 filas

```
Fila 1: [🔍 Buscar producto o SKU...                    ] [5 productos] [◀ 1/1 ▶]
Fila 2: [📂 Categoría ▾] [💰 IGV ▾] [📦 Stock ▾] [🧹 Limpiar]
```

- Familia + Grupo se fusionan en un solo dropdown "Categoría" con estructura jerárquica:
  ```
  📂 Todas las categorías
  ─────────────────────
  📁 Productos
    ├── 🔧 Repuestos
    ├── 🔨 Herramientas  
    ├── 🚜 Máquinas
    └── 🚚 Transporte
  📁 Servicios
    └── 🛠️ Mantenimiento
  ```
- Tax → dropdown compacto
- Stock → dropdown compacto  
- "Limpiar filtros" → botón con icono

Esto escala infinitamente porque el dropdown maneja cualquier cantidad de familias/grupos.

### 2. Dropdown de categoría jerárquico
- Lee de `CATEGORY_TREE` dinámicamente
- Muestra íconos por grupo (ya definidos en `familyIcons`)
- Indentación visual para subcategorías
- Badge con conteo de productos por categoría

### 3. Tarjetas mejoradas
- Badge de stock más visible (color-coded: verde >10, amarillo ≤10, rojo 0)
- Price tier con tooltip de "Desde X unidades"
- Feedback visual al agregar (pulso verde)

### 4. Móvil: filtros colapsables
- Botón "Filtros" que abre un sheet/drawer con todos los filtros
- Grid adaptable: 2 cols en móvil pequeño, 3 cols en tablet

---

## Implementación (fases)

### Fase 1: Dropdown de categoría jerárquico [1h]
- Reemplazar filtros Familia + Grupo por un solo dropdown
- Dinámico, lee de CATEGORY_TREE
- Con íconos y conteo

### Fase 2: Dropdowns de Tax y Stock [30min]
- Convertir botones inline → dropdowns compactos
- Con íconos/badges de color

### Fase 3: Layout 2 filas + limpiar filtros [30min]
- Reorganizar toolbar
- Botón "Limpiar filtros" visible

### Fase 4: Mejoras visuales en tarjetas [30min]
- Badge de stock color-coded
- Tooltip de price tier
