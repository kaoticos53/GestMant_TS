# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-INCIDENT-ACTION-BUTTONS`
- **Objetivo:** Fase 1 - Crear contratos de tipos segregados en `actionButtonsTypes.ts` y tests unitarios de visibilidad en `tests/incidentActionButtonsVisibility.test.ts`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/detail/actions/components/actionButtonsTypes.ts`
  - `tests/incidentActionButtonsVisibility.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `actions/components/actionButtonsTypes.ts`: interfaces segregadas para grupos de botones de acción (`AssignmentActionsProps`, `WorkflowActionsProps`, `LogisticsActionsProps`, `LifecycleActionsProps`).
- [x] `tests/incidentActionButtonsVisibility.test.ts`: tests unitarios de reglas de visibilidad de acciones.
- [ ] `actions/components/IncidentAssignmentActions.tsx`: pendiente Fase 2.
- [ ] `actions/components/IncidentWorkflowActions.tsx`: pendiente Fase 2.
- [ ] `actions/components/IncidentLogisticsActions.tsx`: pendiente Fase 2.
- [ ] `actions/components/IncidentLifecycleActions.tsx`: pendiente Fase 2.
- [ ] `actions/components/IncidentActionButtons.tsx`: pendiente Fase 3.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 1.
