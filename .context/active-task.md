# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-DECISION-DIALOG`
- **Objetivo:** Fase 3 - Extraer hook useDecisionDialogState y reensamblar DecisionDialog como orquestador declarativo.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/dialogs/decisionDialog/hooks/useDecisionDialogState.ts`
  - `src/pages/dashboard/requests/dialogs/decisionDialog/helpers.ts`
  - `src/pages/dashboard/requests/dialogs/DecisionDialog.tsx`

---

## 2. Archivos Modificados / Creados
- [x] Hook `useDecisionDialogState.ts` encapsulando mutaciones, queries y estado de decisiones.
- [x] Reensamblado de `DecisionDialog.tsx` (337 -> 116 líneas, -65.6%).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? Tests verdes (26 tests pasados).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada exitosamente. Listo para commit atómico 3.
