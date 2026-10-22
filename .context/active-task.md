# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-DATA-TABLE-TOOLBAR`
- **Objetivo:** Fase 4 - Verificación exhaustiva (Typecheck, Vitest, Build de Producción) y cierre de la refactorización modular de `DataTableToolbar.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/components/DataTableToolbar.tsx`
  - `src/components/dataTableToolbar/`
  - `tests/dataTableToolbarHelpers.test.ts`
  - `tests/dataTableToolbar.test.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `dataTableToolbar/types.ts`: contratos de props para la barra completa y sus subcomponentes.
- [x] `dataTableToolbar/helpers.ts`: función pura `resolveIsCompact` y `DENSITY_OPTIONS`.
- [x] `tests/dataTableToolbarHelpers.test.ts`: suite de tests unitarios (5 tests).
- [x] `dataTableToolbar/hooks/useDataTableToolbarSearch.ts`: hook aislado para estado local y debounce de búsqueda.
- [x] `dataTableToolbar/components/DataTableToolbarSearch.tsx`: input de búsqueda accesible con botón X.
- [x] `dataTableToolbar/components/DataTableToolbarReset.tsx`: botón accesible para limpiar filtros.
- [x] `dataTableToolbar/components/DataTableToolbarDensity.tsx`: selector toggle accesible de densidad.
- [x] `dataTableToolbar/index.ts`: barril unificado.
- [x] `DataTableToolbar.tsx`: reducción de 222 a 88 líneas orquestando limpiamente.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 2.416 tests pasados en 204 suites (0 fallos).
- [x] ¿Compilación de producción? `npm run build` completado con éxito (código 0).
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** Completada con éxito. Listo para proponer siguiente candidato.
