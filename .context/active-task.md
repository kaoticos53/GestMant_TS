# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-DECISION-DIALOG`
- **Objetivo:** Fase 1 - Extraer tipos y funciones auxiliares puras de DecisionDialog en decisionDialog/ con tests unitarios.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/dialogs/decisionDialog/types.ts`
  - `src/pages/dashboard/requests/dialogs/decisionDialog/helpers.ts`
  - `tests/decisionDialogHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/requests/dialogs/decisionDialog/types.ts`
- [x] `src/pages/dashboard/requests/dialogs/decisionDialog/helpers.ts`
- [x] `tests/decisionDialogHelpers.test.ts` (8 tests unitarios nuevos)

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? Tests verdes (26 tests pasados).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada exitosamente. Listo para commit atómico 1.
