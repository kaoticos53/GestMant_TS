# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-TABLE-SORT`
- **Objetivo:** Fase 4 - Validación completa (2.447 tests de Vitest pasados, build de producción exitoso) y cierre de la refactorización modular de `TableSort.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/components/TableSort.tsx`
  - `src/components/tableSort/`

---

## 2. Archivos Modificados / Creados
- [x] `src/components/tableSort/types.ts`: interfaces tipadas estrictas.
- [x] `src/components/tableSort/helpers.ts`: funciones puras de accesibilidad y metadatos (`getSortNextDescription`, `getSortButtonTitle`, `getSortButtonAriaLabel`, `getFlipButtonMeta`, `getAriaSort`).
- [x] `tests/tableSortUiHelpers.test.ts`: suite de pruebas unitarias para helpers (9 tests pasados).
- [x] `src/components/tableSort/components/SortFlipButton.tsx`: botón para invertir sentido con icono reactivo.
- [x] `src/components/tableSort/components/TableSortBar.tsx`: barra horizontal con selector y reset.
- [x] `src/components/tableSort/components/SortableTableHead.tsx`: cabecera sortable accesible.
- [x] `src/components/tableSort/index.ts`: barril unificado.
- [x] `src/components/TableSort.tsx`: orquestación de alto nivel reducida de 210 a 35 líneas.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`. `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 2.447 tests pasados en Vitest.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** Completada y validada con éxito.
