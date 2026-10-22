# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-INCIDENT-NOTES-CARD`
- **Objetivo:** Fase 1 - Extraer tipos y funciones auxiliares puras de IncidentNotesCard en notes/ con tests unitarios.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/detail/notes/types.ts`
  - `src/pages/dashboard/incidents/components/detail/notes/helpers.ts`
  - `tests/incidentNotesCardHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/incidents/components/detail/notes/types.ts`
- [x] `src/pages/dashboard/incidents/components/detail/notes/helpers.ts`
- [x] `tests/incidentNotesCardHelpers.test.ts` (12 tests unitarios nuevos)

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? Tests verdes (30 tests pasados).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada exitosamente. Listo para commit atómico 1.
