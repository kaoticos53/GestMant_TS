# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-INCIDENT-ACTIONS-BAR`
- **Objetivo:** Fase 3 - Modularizar botones (`IncidentActionButtons`), nota de pie (`IncidentActionsFootnote`), hook `useIncidentActions` y reensamblar `IncidentActionsBar.tsx` como orquestador limpio.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/detail/actions/components/IncidentActionButtons.tsx`
  - `src/pages/dashboard/incidents/components/detail/actions/components/IncidentActionsFootnote.tsx`
  - `src/pages/dashboard/incidents/components/detail/actions/hooks/useIncidentActions.ts`
  - `src/pages/dashboard/incidents/components/detail/IncidentActionsBar.tsx`

---

## 2. Archivos Modificados / Creados
- [x] Subcomponentes visuales en `actions/components/` (`IncidentActionButtons`, `IncidentActionsFootnote`).
- [x] Hook `useIncidentActions.ts`: Mutaciones Convex, estado de diálogos y descargas.
- [x] `IncidentActionsBar.tsx`: Orquestador limpio y conciso (491 -> 138 líneas, -71.9%).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios? 29 tests pasando al 100% (helpers, arquitectura, seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** Fase 3 completada. Listo para commit atómico.





















