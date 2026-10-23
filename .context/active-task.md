# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-RECEIVE-DIALOG`
- **Objetivo:** Fase 3 - Reducir y orquestar limpiamente `ReceiveDialog.tsx` componiendo `useReceiveDialogForm`, `ReceiveLinesInputs` y `ReceiveDeliveryNoteInput`, reduciendo el diálogo de 193 a ~75 líneas.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/purchasing/dialogs/ReceiveDialog.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `receive/types.ts`: contratos de tipos.
- [x] `receive/helpers.ts`: funciones puras de cálculo y validación.
- [x] `tests/receiveDialogHelpers.test.ts`: suite de pruebas unitarias para helpers.
- [x] `receive/useReceiveDialogForm.ts`: hook con mutación Convex, storage y feedback de toasts.
- [x] `receive/components/ReceiveLinesInputs.tsx`: inputs numéricos de cantidades por línea pendiente.
- [x] `receive/components/ReceiveDeliveryNoteInput.tsx`: campo de subida de albarán con validación de límite.
- [x] `receive/index.ts`: barril unificado.
- [ ] `dialogs/ReceiveDialog.tsx`: orquestación de alto nivel limpia.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 3.
