# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-INVENTORY-VIEW`
- **Objetivo:** Fase 3 - Extraer hook personalizado `useInventoryState` y reensamblar `InventoryView.tsx` como componente orquestador limpio (~150 líneas).
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/inventory/hooks/useInventoryState.ts`
  - `src/pages/dashboard/InventoryView.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/inventory/hooks/useInventoryState.ts`: Custom hook que encapsula queries Convex, mutaciones, estado de filtros, ordenación y paginación.
- [x] `src/pages/dashboard/InventoryView.tsx`: Reducido de 455 a 148 líneas (-67.5%), integrando subcomponentes modulares.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios? Verificados con Vitest.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** Completada Fase 3. Lista para commit.























