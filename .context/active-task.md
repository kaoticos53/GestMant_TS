# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-INCIDENT-ACTIONS-BAR`
- **Objetivo:** Fase 1 - Extraer tipos de dominio (`types.ts`), helpers puros de evaluación de notas y transiciones (`helpers.ts`) y suite de tests unitarios (`tests/incidentActionsBarHelpers.test.ts`) para `IncidentActionsBar.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/detail/actions/types.ts`
  - `src/pages/dashboard/incidents/components/detail/actions/helpers.ts`
  - `tests/incidentActionsBarHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/incidents/components/detail/actions/types.ts`: Tipos de contratos, estados de diálogo y props.
- [x] `src/pages/dashboard/incidents/components/detail/actions/helpers.ts`: Funciones puras `getIncidentFootnote`, `canShowSelfAssignAction`, `canShowVerifyAction`, etc.
- [x] `tests/incidentActionsBarHelpers.test.ts`: Tests unitarios para las funciones puras de helpers (11 tests).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios? 11 tests pasando al 100%.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados (18 tests).

---

## 4. Estado Final
- **Estado:** Fase 1 completada. Listo para commit atómico.

















