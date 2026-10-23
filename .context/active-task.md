# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-SEND-TO-EXTERNAL-DIALOG`
- **Objetivo:** Fase 3 - Reducir y orquestar limpiamente `SendToExternalDialog.tsx` integrando el hook `useSendToExternalForm`, `ExternalCompanyFields` y `ExternalDefectFields`, reduciendo el diálogo de 204 a ~65 líneas.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/dialogs/SendToExternalDialog.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `sendToExternal/types.ts`: contratos de tipos.
- [x] `sendToExternal/helpers.ts`: funciones puras de validación y formateo de payload.
- [x] `tests/sendToExternalDialogHelpers.test.ts`: suite de pruebas unitarias para helpers.
- [x] `sendToExternal/useSendToExternalForm.ts`: hook con mutaciones Convex y catálogo.
- [x] `sendToExternal/components/ExternalCompanyFields.tsx`: empresa SAT, contacto y teléfono.
- [x] `sendToExternal/components/ExternalDefectFields.tsx`: avería, accesorios y notas de envío.
- [x] `sendToExternal/index.ts`: barril unificado.
- [ ] `dialogs/SendToExternalDialog.tsx`: orquestación de alto nivel limpia.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 3.
