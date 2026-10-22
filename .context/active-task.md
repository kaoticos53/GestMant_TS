# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-INCIDENT-DETAIL-SHEET`
- **Objetivo:** Fase 1 - Creación de helpers puros y test suite unitaria para `IncidentDetailSheet.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/IncidentDetailSheet.tsx`
  - `src/pages/dashboard/incidents/components/detail/helpers.ts`
  - `tests/incidentDetailSheetHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/incidents/components/detail/helpers.ts`: funciones puras `getIncidentNextHint`, `getJourneyNowLabel`, `resolveIncidentDerivedState` y `filterAndSortIncidentRequests`.
- [x] `tests/incidentDetailSheetHelpers.test.ts`: 18 pruebas unitarias exhaustivas con 100% de ramas cubiertas.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 36 tests pasados (18 unitarios + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada y validada. Lista para commit atómico 1.





