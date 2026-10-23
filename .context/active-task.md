# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-RECEIVE-DIALOG`
- **Objetivo:** Fase 1 - Crear interfaces tipadas en `purchasing/dialogs/receive/types.ts`, helpers puros en `purchasing/dialogs/receive/helpers.ts` y tests unitarios en `tests/receiveDialogHelpers.test.ts`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/purchasing/dialogs/receive/types.ts`
  - `src/pages/dashboard/purchasing/dialogs/receive/helpers.ts`
  - `tests/receiveDialogHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `receive/types.ts`: contratos de items recibidos y props de subcomponentes.
- [x] `receive/helpers.ts`: funciones puras `buildInitialQuantities`, `parseReceivedItems` y `validateReceiveInput`.
- [x] `tests/receiveDialogHelpers.test.ts`: suite de pruebas unitarias para helpers de recepción.
- [ ] `receive/useReceiveDialogForm.ts`: pendiente Fase 2.
- [ ] `receive/components/ReceiveLinesInputs.tsx`: pendiente Fase 2.
- [ ] `receive/components/ReceiveDeliveryNoteInput.tsx`: pendiente Fase 2.
- [ ] `receive/index.ts`: pendiente Fase 2.
- [ ] `dialogs/ReceiveDialog.tsx`: pendiente Fase 3.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 1.
