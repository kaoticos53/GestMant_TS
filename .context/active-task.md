# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-REQUESTS-VIEW`
- **Objetivo:** Fase 1 - Extraer helpers puros de exportación CSV de peticiones y suite de tests unitarios exhaustivos.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/helpers.ts`
  - `tests/requestsViewHelpers.test.ts`
  - `src/pages/dashboard/RequestsView.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/requests/helpers.ts`: Extraer `REQUESTS_CSV_HEADER` y `buildRequestsCsvData`.
- [x] `tests/requestsViewHelpers.test.ts`: Batería de 6 tests unitarios de exportación tabular y formateo.
- [x] `src/pages/dashboard/requests/types.ts`: Tipo `RequestSection`.
- [x] `src/pages/dashboard/requests/components/RequestsHeaderBar.tsx`: Filtros de estado, selector de equipo y botones de acción.
- [x] `src/pages/dashboard/requests/components/RequestsEmptyState.tsx`: Estado vacío contextual con soporte a búsqueda/equipo.
- [x] `src/pages/dashboard/requests/components/RequestsList.tsx`: ListArea, secciones, RequestCard y TablePagination.
- [x] `src/pages/dashboard/requests/components/RequestsDialogs.tsx`: Modales de decisión, asociación, detalle y nueva petición.
- [x] `src/pages/dashboard/requests/hooks/useRequestsState.ts`: Custom hook de consultas, mutaciones, estado y exportación CSV.
- [x] `src/pages/dashboard/RequestsView.tsx`: Rediseñado a orquestador declarativo de 107 líneas (-75.3%).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de integración? 16 tests de requests pasados al 100%.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.
- [ ] ¿Build de producción Vite? (Fase 4)

---

## 4. Estado Actual
- **Estado:** Fase 3 completada. Listo para commit atómico de Fase 3.























