# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-INCIDENT-ACTION-BUTTONS`
- **Objetivo:** Fase 3 - Reducir y orquestar limpiamente `IncidentActionButtons.tsx` componiendo los subcomponentes modulares `IncidentAssignmentActions`, `IncidentWorkflowActions`, `IncidentLogisticsActions` e `IncidentLifecycleActions` junto a `computeIncidentActionStates`, reduciendo el archivo de 213 a ~65 líneas.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/detail/actions/components/IncidentActionButtons.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `actions/components/actionButtonsTypes.ts`: interfaces segregadas.
- [x] `tests/incidentActionButtonsVisibility.test.ts`: tests unitarios de visibilidad.
- [x] `actions/components/IncidentAssignmentActions.tsx`: autoasignación y asignación técnica / taller.
- [x] `actions/components/IncidentWorkflowActions.tsx`: verificación y finalización de orden.
- [x] `actions/components/IncidentLogisticsActions.tsx`: peticiones de repuesto y servicio externo.
- [x] `actions/components/IncidentLifecycleActions.tsx`: cerrar, archivar y retirar.
- [ ] `actions/components/IncidentActionButtons.tsx`: orquestación de alto nivel limpia.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 3.
