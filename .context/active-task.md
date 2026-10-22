# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-GLOBAL-SEARCH`
- **Objetivo:** Fase 2 - Modularizar subcomponentes visuales de entrada de texto (`SearchInput`) y menú flotante de resultados (`SearchResultsDropdown`) para `GlobalSearch.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/search/components/SearchInput.tsx`
  - `src/pages/dashboard/search/components/SearchResultsDropdown.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/search/components/SearchInput.tsx`: Campo de búsqueda con icono, badges de atajo Kbd y botón de escaneo.
- [x] `src/pages/dashboard/search/components/SearchResultsDropdown.tsx`: Dropdown flotante con grupos categorizados, resaltado de índice activo y estado vacío.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios? Verificados con Vitest.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** Completada Fase 2. Lista para commit.























