# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-INCIDENT-ACTIONS-BAR`
- **Objetivo:** Fase 2 - Modularizar diálogos (`WithdrawIncidentDialog`, `IncidentTransitionDialogs`) y dropdown de descargas (`IncidentExportDropdown`).
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/detail/actions/dialogs/WithdrawIncidentDialog.tsx`
  - `src/pages/dashboard/incidents/components/detail/actions/dialogs/IncidentTransitionDialogs.tsx`
  - `src/pages/dashboard/incidents/components/detail/actions/components/IncidentExportDropdown.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/incidents/components/detail/actions/dialogs/WithdrawIncidentDialog.tsx`: Modal para retirar incidencia a papelera.
- [x] `src/pages/dashboard/incidents/components/detail/actions/dialogs/IncidentTransitionDialogs.tsx`: Contenedor para diálogos subordinados (Assign, Verify, Close, Request, SendExternal, ReceiveExternal).
- [x] `src/pages/dashboard/incidents/components/detail/actions/components/IncidentExportDropdown.tsx`: Dropdown con descargas de Markdown, PDF y ZIP.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios? 29 tests pasando al 100% (helpers, arquitectura, seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** Fase 2 completada. Listo para commit atómico.



















