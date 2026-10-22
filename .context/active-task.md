# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-NEW-REQUEST-DIALOG`
- **Objetivo:** Fase 1 - Definición de contratos de tipos, helpers puros de submit/etiquetas y tests unitarios para `NewRequestDialog.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/dialogs/newRequest/types.ts`
  - `src/pages/dashboard/requests/dialogs/newRequest/helpers.ts`
  - `tests/newRequestDialogHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/requests/dialogs/newRequest/types.ts`: contratos de campos del formulario, footer y props.
- [x] `src/pages/dashboard/requests/dialogs/newRequest/helpers.ts`: funciones puras `getSubmitButtonLabel` e `isSubmitDisabled`.
- [x] `tests/newRequestDialogHelpers.test.ts`: suite de tests unitarios para etiquetas y deshabilitación de submit.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, tipos inferidos y comprobados.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí (Petición de repuesto, repuestos, equipos).

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 1.
