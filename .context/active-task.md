# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-INCIDENT-REPORTS-DIALOG`
- **Objetivo:** Fase 1 - Extraer tipos y funciones auxiliares puras de IncidentReportsDialog en incidentReports/ con tests unitarios.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidentReports/types.ts`
  - `src/pages/dashboard/incidentReports/helpers.ts`
  - `tests/incidentReportsHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/incidentReports/types.ts`
- [x] `src/pages/dashboard/incidentReports/helpers.ts`
- [x] `tests/incidentReportsHelpers.test.ts` (12 tests unitarios nuevos)

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? Tests verdes (30 tests pasados).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada exitosamente. Listo para commit atómico 1.
