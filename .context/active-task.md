# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-INCIDENT-REPORTS-DIALOG`
- **Objetivo:** Fase 3 - Extraer hook useIncidentReportsState y reensamblar IncidentReportsDialog como orquestador declarativo.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidentReports/hooks/useIncidentReportsState.ts`
  - `src/pages/dashboard/incidentReports/types.ts`
  - `src/pages/dashboard/IncidentReportsDialog.tsx`

---

## 2. Archivos Modificados / Creados
- [x] Hook `useIncidentReportsState.ts` encapsulando queries, periodos, mapas y exportación.
- [x] Reensamblado de `IncidentReportsDialog.tsx` (348 -> 100 líneas, -71.3%).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? Tests verdes (30 tests pasados).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada exitosamente. Listo para commit atómico 3.
