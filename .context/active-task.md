# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-SEND-TO-EXTERNAL-DIALOG`
- **Objetivo:** Fase 4 - Validación completa (2.480 tests de Vitest pasados, build de producción exitoso) y cierre de la refactorización modular de `SendToExternalDialog.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/dialogs/SendToExternalDialog.tsx`
  - `src/pages/dashboard/incidents/dialogs/sendToExternal/`

---

## 2. Archivos Modificados / Creados
- [x] `sendToExternal/types.ts`: contratos de tipos.
- [x] `sendToExternal/helpers.ts`: funciones puras de validación y formateo de payload (`validateSendToExternalForm`, `buildSendToExternalArgs`).
- [x] `tests/sendToExternalDialogHelpers.test.ts`: suite de pruebas unitarias para helpers (5 tests pasados).
- [x] `sendToExternal/useSendToExternalForm.ts`: hook con mutaciones Convex y catálogo.
- [x] `sendToExternal/components/ExternalCompanyFields.tsx`: empresa SAT, contacto y teléfono.
- [x] `sendToExternal/components/ExternalDefectFields.tsx`: avería, accesorios y notas de envío.
- [x] `sendToExternal/index.ts`: barril unificado.
- [x] `dialogs/SendToExternalDialog.tsx`: orquestación de alto nivel reducida de 204 a 98 líneas.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`. `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 2.480 tests pasados en Vitest.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** Completada y validada con éxito.
