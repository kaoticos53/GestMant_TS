# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-INVENTORY-VIEW`
- **Objetivo:** Fase 4 - Verificación integral de compilación, tests unitarios, arquitectura y cierre formal de `InventoryView.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/InventoryView.tsx`
  - `src/pages/dashboard/inventory/`
  - `tests/inventoryHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/inventory/types.ts`: Exportar `EquipmentDoc` y definir `FilterInventoryParams`.
- [x] `src/pages/dashboard/inventory/helpers.ts`: Funciones `filterInventoryParts`, `countLowStockParts`, y `INVENTORY_SORT_COLUMNS`.
- [x] `tests/inventoryHelpers.test.ts`: 9 tests unitarios pasando.
- [x] `src/pages/dashboard/inventory/components/`: Subcomponentes modulares de toolbar, tabla, estados vacíos y diálogo de borrado.
- [x] `src/pages/dashboard/inventory/hooks/useInventoryState.ts`: Custom hook de consultas, filtros, ordenación y paginación.
- [x] `src/pages/dashboard/InventoryView.tsx`: Reducido de 455 a 148 líneas (-67.5%).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios? 2.060 tests pasados (100%).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.
- [x] ¿Build de producción Vite? Exitoso (5.84s).

---

## 4. Estado Final
- **Estado:** Completada y Cerrada. Listo para proponer siguiente candidato.























