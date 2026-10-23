# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-SEND-TO-EXTERNAL-DIALOG`
- **Objetivo:** Fase 2 - Crear hook `useSendToExternalForm`, subcomponentes `ExternalCompanyFields`, `ExternalDefectFields` y barril `sendToExternal/index.ts`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/dialogs/sendToExternal/useSendToExternalForm.ts`
  - `src/pages/dashboard/incidents/dialogs/sendToExternal/components/ExternalCompanyFields.tsx`
  - `src/pages/dashboard/incidents/dialogs/sendToExternal/components/ExternalDefectFields.tsx`
  - `src/pages/dashboard/incidents/dialogs/sendToExternal/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `sendToExternal/types.ts`: contratos de tipos.
- [x] `sendToExternal/helpers.ts`: funciones puras de validación y formateo de payload.
- [x] `tests/sendToExternalDialogHelpers.test.ts`: suite de pruebas unitarias para helpers.
- [x] `sendToExternal/useSendToExternalForm.ts`: hook con mutaciones Convex y catálogo.
- [x] `sendToExternal/components/ExternalCompanyFields.tsx`: empresa SAT, contacto y teléfono.
- [x] `sendToExternal/components/ExternalDefectFields.tsx`: avería, accesorios y notas de envío.
- [x] `sendToExternal/index.ts`: barril unificado.
- [ ] `dialogs/SendToExternalDialog.tsx`: pendiente Fase 3.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 2.
