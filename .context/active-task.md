# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-INCIDENT-ACTION-BUTTONS`
- **Objetivo:** Fase 2 - Crear subcomponentes `IncidentAssignmentActions`, `IncidentWorkflowActions`, `IncidentLogisticsActions` e `IncidentLifecycleActions`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/detail/actions/components/IncidentAssignmentActions.tsx`
  - `src/pages/dashboard/incidents/components/detail/actions/components/IncidentWorkflowActions.tsx`
  - `src/pages/dashboard/incidents/components/detail/actions/components/IncidentLogisticsActions.tsx`
  - `src/pages/dashboard/incidents/components/detail/actions/components/IncidentLifecycleActions.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `actions/components/actionButtonsTypes.ts`: interfaces segregadas.
- [x] `tests/incidentActionButtonsVisibility.test.ts`: tests unitarios de visibilidad.
- [x] `actions/components/IncidentAssignmentActions.tsx`: autoasignación y asignación técnica / orden taller.
- [x] `actions/components/IncidentWorkflowActions.tsx`: verificación y finalización de orden.
- [x] `actions/components/IncidentLogisticsActions.tsx`: peticiones de repuesto y servicio externo.
- [x] `actions/components/IncidentLifecycleActions.tsx`: cerrar, archivar y retirar.
- [ ] `actions/components/IncidentActionButtons.tsx`: pendiente Fase 3.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 2.
