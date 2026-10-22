# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-INCIDENT-ACTIONS-BAR`
- **Objetivo:** Fase 4 - Verificación final de compilación, suite Vitest completa, tests de arquitectura y seguridad, y cierre de la refactorización modular de `IncidentActionsBar.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/detail/IncidentActionsBar.tsx` (491 -> 138 líneas, -71.9%)
  - Subcomponentes en `src/pages/dashboard/incidents/components/detail/actions/`
  - Tests en `tests/incidentActionsBarHelpers.test.ts` (11 tests)

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/incidents/components/detail/actions/types.ts`: Tipos de contratos, estados de diálogo y props.
- [x] `src/pages/dashboard/incidents/components/detail/actions/helpers.ts`: Funciones puras `getIncidentFootnote`, `canShowSelfAssignAction`, `canShowVerifyAction`, etc.
- [x] `tests/incidentActionsBarHelpers.test.ts`: Tests unitarios para las funciones puras de helpers (11 tests).
- [x] `src/pages/dashboard/incidents/components/detail/actions/dialogs/WithdrawIncidentDialog.tsx`: Modal para retirar incidencia a papelera.
- [x] `src/pages/dashboard/incidents/components/detail/actions/dialogs/IncidentTransitionDialogs.tsx`: Contenedor para diálogos subordinados.
- [x] `src/pages/dashboard/incidents/components/detail/actions/components/IncidentExportDropdown.tsx`: Dropdown con descargas de Markdown, PDF y ZIP.
- [x] `src/pages/dashboard/incidents/components/detail/actions/components/IncidentActionButtons.tsx`: Botones de acción del ciclo de vida.
- [x] `src/pages/dashboard/incidents/components/detail/actions/components/IncidentActionsFootnote.tsx`: Nota contextual de pie.
- [x] `src/pages/dashboard/incidents/components/detail/actions/hooks/useIncidentActions.ts`: Hook de mutaciones y estado de diálogos.
- [x] `src/pages/dashboard/incidents/components/detail/IncidentActionsBar.tsx`: Orquestador limpio y conciso.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No. Lógica pura respetada sin imports prohibidos.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios? 162 suites y 2.029 tests pasando al 100%.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados (`tests/arquitectura.test.ts` y `tests/seguridad.test.ts`).
- [x] ¿Build de producción Vite? Exitoso (`npm run build`).

---

## 4. Estado Final
- **Estado:** Completado (Fases 1, 2, 3 y 4 de `IncidentActionsBar.tsx`).






















