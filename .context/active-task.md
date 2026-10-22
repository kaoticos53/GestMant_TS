# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-TABLE-SORT`
- **Objetivo:** Fase 2 - Crear subcomponentes `SortFlipButton`, `TableSortBar` y `SortableTableHead` con su barril `index.ts`.
- **Módulo(s) Afectado(s):**
  - `src/components/tableSort/components/SortFlipButton.tsx`
  - `src/components/tableSort/components/TableSortBar.tsx`
  - `src/components/tableSort/components/SortableTableHead.tsx`
  - `src/components/tableSort/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/components/tableSort/types.ts`: interfaces tipadas.
- [x] `src/components/tableSort/helpers.ts`: funciones puras de accesibilidad y metadatos.
- [x] `tests/tableSortUiHelpers.test.ts`: suite de pruebas unitarias para helpers.
- [x] `src/components/tableSort/components/SortFlipButton.tsx`: botón para invertir sentido con icono reactivo.
- [x] `src/components/tableSort/components/TableSortBar.tsx`: barra horizontal con selector y reset.
- [x] `src/components/tableSort/components/SortableTableHead.tsx`: cabecera sortable accesible.
- [x] `src/components/tableSort/index.ts`: barril unificado.
- [ ] `src/components/TableSort.tsx`: pendiente Fase 3.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 2.
