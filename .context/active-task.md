# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-INVENTORY-VIEW`
- **Objetivo:** Fase 2 - Modularizar subcomponentes visuales de barra de herramientas (`InventoryToolbarFilters`), tabla con ordenación (`InventoryTable`), estados vacíos (`InventoryEmptyState`) y diálogo de borrado (`InventoryDeleteDialog`) para `InventoryView.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/inventory/components/InventoryToolbarFilters.tsx`
  - `src/pages/dashboard/inventory/components/InventoryTable.tsx`
  - `src/pages/dashboard/inventory/components/InventoryEmptyState.tsx`
  - `src/pages/dashboard/inventory/components/InventoryDeleteDialog.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/inventory/components/InventoryToolbarFilters.tsx`: Selectores de categoría, equipo, toggle de stock bajo y acciones.
- [x] `src/pages/dashboard/inventory/components/InventoryTable.tsx`: Tabla responsiva con cabecera fija, ordenación por columna y filas `PartRow`.
- [x] `src/pages/dashboard/inventory/components/InventoryEmptyState.tsx`: Vistas para catálogo vacío y búsqueda sin coincidencias.
- [x] `src/pages/dashboard/inventory/components/InventoryDeleteDialog.tsx`: Diálogo modal de confirmación de eliminación.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios? Verificados con Vitest.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** Completada Fase 2. Lista para commit.























