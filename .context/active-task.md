# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-REPORT-INCIDENT`
- **Objetivo:** Fase 1 - Extraer tipos, funciones puras de fecha, validación de reglas de negocio y tests unitarios para ReportIncident.
- **Módulo(s) Afectado(s):**
  - `src/pages/reportIncident/types.ts`
  - `src/pages/reportIncident/helpers.ts`
  - `tests/reportIncidentHelpers.test.ts`
  - `src/pages/ReportIncident.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/reportIncident/types.ts`: Tipos del formulario y payload de la mutación.
- [x] `src/pages/reportIncident/helpers.ts`: Helpers de fechas y validación pura `validateReportIncidentForm`.
- [x] `tests/reportIncidentHelpers.test.ts`: Batería de tests unitarios de validación y fechas (10 tests pasando).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 12 tests pasados al 100%.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada. Listo para commit atómico de Fase 1.























