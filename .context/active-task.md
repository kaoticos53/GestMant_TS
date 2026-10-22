# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-DATA-TABLE-TOOLBAR`
- **Objetivo:** Fase 3 - Reensamblar `DataTableToolbar.tsx` consumiendo el submódulo modular `dataTableToolbar/`, reduciendo su tamaño de 222 a ~65 líneas.
- **Módulo(s) Afectado(s):**
  - `src/components/DataTableToolbar.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `dataTableToolbar/types.ts`: contratos de props para la barra completa y sus subcomponentes.
- [x] `dataTableToolbar/helpers.ts`: función pura `resolveIsCompact` y `DENSITY_OPTIONS`.
- [x] `tests/dataTableToolbarHelpers.test.ts`: suite de tests unitarios.
- [x] `dataTableToolbar/hooks/useDataTableToolbarSearch.ts`: hook aislado para estado local y debounce de búsqueda.
- [x] `dataTableToolbar/components/DataTableToolbarSearch.tsx`: input de búsqueda accesible con botón X.
- [x] `dataTableToolbar/components/DataTableToolbarReset.tsx`: botón accesible para limpiar filtros.
- [x] `dataTableToolbar/components/DataTableToolbarDensity.tsx`: selector toggle accesible de densidad.
- [x] `dataTableToolbar/index.ts`: barril unificado.
- [x] `DataTableToolbar.tsx`: reducción de 222 a ~65 líneas orquestando limpiamente.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 3.
