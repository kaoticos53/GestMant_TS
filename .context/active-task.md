# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-RECEIVE-DIALOG`
- **Objetivo:** Fase 4 - Validación completa (2.486 tests de Vitest pasados, build de producción exitoso) y cierre de la refactorización modular de `ReceiveDialog.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/purchasing/dialogs/ReceiveDialog.tsx`
  - `src/pages/dashboard/purchasing/dialogs/receive/`

---

## 2. Archivos Modificados / Creados
- [x] `receive/types.ts`: contratos de tipos.
- [x] `receive/helpers.ts`: funciones puras de cálculo y validación (`buildInitialQuantities`, `parseReceivedItems`, `validateReceiveInput`).
- [x] `tests/receiveDialogHelpers.test.ts`: suite de pruebas unitarias para helpers (6 tests pasados).
- [x] `receive/useReceiveDialogForm.ts`: hook con mutación Convex, storage y feedback de toasts.
- [x] `receive/components/ReceiveLinesInputs.tsx`: inputs numéricos de cantidades por línea pendiente.
- [x] `receive/components/ReceiveDeliveryNoteInput.tsx`: campo de subida de albarán con validación de límite.
- [x] `receive/index.ts`: barril unificado.
- [x] `dialogs/ReceiveDialog.tsx`: orquestación de alto nivel reducida de 193 a 104 líneas.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`. `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 2.486 tests pasados en Vitest.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** Completada y validada con éxito.
