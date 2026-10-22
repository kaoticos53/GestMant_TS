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

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios nuevos? 6 tests pasados al 100%.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.
- [ ] ¿Build de producción Vite? (Fase 4)

---

## 4. Estado Actual
- **Estado:** Fase 1 completada. Listo para commit atómico de Fase 1.























