# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-SEND-TO-EXTERNAL-DIALOG`
- **Objetivo:** Fase 1 - Crear interfaces tipadas en `sendToExternal/types.ts`, helpers puros en `sendToExternal/helpers.ts` y tests unitarios en `tests/sendToExternalDialogHelpers.test.ts`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/dialogs/sendToExternal/types.ts`
  - `src/pages/dashboard/incidents/dialogs/sendToExternal/helpers.ts`
  - `tests/sendToExternalDialogHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `sendToExternal/types.ts`: contratos de valores del formulario y props de subcomponentes.
- [x] `sendToExternal/helpers.ts`: funciones puras `validateSendToExternalForm` y `buildSendToExternalArgs`.
- [x] `tests/sendToExternalDialogHelpers.test.ts`: suite de pruebas unitarias para validación y payload.
- [ ] `sendToExternal/useSendToExternalForm.ts`: pendiente Fase 2.
- [ ] `sendToExternal/components/ExternalCompanyFields.tsx`: pendiente Fase 2.
- [ ] `sendToExternal/components/ExternalDefectFields.tsx`: pendiente Fase 2.
- [ ] `sendToExternal/index.ts`: pendiente Fase 2.
- [ ] `dialogs/SendToExternalDialog.tsx`: pendiente Fase 3.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 1.
