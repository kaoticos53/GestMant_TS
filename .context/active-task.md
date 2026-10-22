# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-TABLE-SORT`
- **Objetivo:** Fase 1 - Crear contratos de tipos en `tableSort/types.ts`, helpers puros en `tableSort/helpers.ts` y tests unitarios en `tests/tableSortUiHelpers.test.ts`.
- **Módulo(s) Afectado(s):**
  - `src/components/tableSort/types.ts`
  - `src/components/tableSort/helpers.ts`
  - `tests/tableSortUiHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/components/tableSort/types.ts`: interfaces tipadas estrictas para barra, botón y cabecera de ordenación.
- [x] `src/components/tableSort/helpers.ts`: funciones puras de accesibilidad y metadatos (`getSortNextDescription`, `getSortButtonTitle`, `getSortButtonAriaLabel`, `getFlipButtonMeta`, `getAriaSort`).
- [x] `tests/tableSortUiHelpers.test.ts`: suite de pruebas unitarias para helpers.
- [ ] `src/components/tableSort/components/SortFlipButton.tsx`: pendiente Fase 2.
- [ ] `src/components/tableSort/components/TableSortBar.tsx`: pendiente Fase 2.
- [ ] `src/components/tableSort/components/SortableTableHead.tsx`: pendiente Fase 2.
- [ ] `src/components/tableSort/index.ts`: pendiente Fase 2.
- [ ] `src/components/TableSort.tsx`: pendiente Fase 3.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 1.
