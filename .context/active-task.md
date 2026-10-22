# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-GLOBAL-SEARCH`
- **Objetivo:** Fase 1 - Extraer tipos de búsqueda (`types.ts`), helpers puros de normalización y filtrado agrupado (`helpers.ts`) y suite de tests unitarios (`tests/globalSearchHelpers.test.ts`) para `GlobalSearch.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/search/types.ts`
  - `src/pages/dashboard/search/helpers.ts`
  - `tests/globalSearchHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/search/types.ts`: Tipos `SearchHit`, `SearchGroup`, `GlobalSearchProps`, `FilterSearchGroupsParams`.
- [x] `src/pages/dashboard/search/helpers.ts`: Funciones puras `normalize`, `includesQuery`, `filterSearchGroups`, constante `MAX_PER_GROUP`.
- [x] `tests/globalSearchHelpers.test.ts`: 10 tests unitarios pasando.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios? Verificados con Vitest (10 tests pasados).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** Completada Fase 1. Lista para commit.























