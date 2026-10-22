# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-INVENTORY-VIEW`
- **Objetivo:** Fase 1 - Extraer helpers puros de filtrado (`filterInventoryParts`), conteo de stock bajo (`countLowStockParts`), columnas de ordenación (`INVENTORY_SORT_COLUMNS`) y suite de tests unitarios (`tests/inventoryHelpers.test.ts`) para `InventoryView.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/inventory/types.ts`
  - `src/pages/dashboard/inventory/helpers.ts`
  - `tests/inventoryHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/inventory/types.ts`: Exportar `EquipmentDoc` y definir `FilterInventoryParams`.
- [x] `src/pages/dashboard/inventory/helpers.ts`: Funciones `filterInventoryParts`, `countLowStockParts`, y `INVENTORY_SORT_COLUMNS`.
- [x] `tests/inventoryHelpers.test.ts`: 9 tests unitarios pasando.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios? Verificados con Vitest (9 tests pasados).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** Completada Fase 1. Lista para commit.























