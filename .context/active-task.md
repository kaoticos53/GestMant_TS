# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-NEW-REQUEST-DIALOG`
- **Objetivo:** Fase 2 - Crear subcomponentes `RequestHeaderFields`, `RequestDescriptionField`, `RequestNotesField` y `RequestDialogFooter` con barril unificado.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/dialogs/newRequest/components/RequestHeaderFields.tsx`
  - `src/pages/dashboard/requests/dialogs/newRequest/components/RequestDescriptionField.tsx`
  - `src/pages/dashboard/requests/dialogs/newRequest/components/RequestNotesField.tsx`
  - `src/pages/dashboard/requests/dialogs/newRequest/components/RequestDialogFooter.tsx`
  - `src/pages/dashboard/requests/dialogs/newRequest/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `newRequest/types.ts`: contratos de campos del formulario, footer y props.
- [x] `newRequest/helpers.ts`: funciones puras `getSubmitButtonLabel` e `isSubmitDisabled`.
- [x] `tests/newRequestDialogHelpers.test.ts`: suite de tests unitarios.
- [x] `newRequest/components/RequestHeaderFields.tsx`: solicitante, puesto y prioridad.
- [x] `newRequest/components/RequestDescriptionField.tsx`: descripción rica con RichTextEditor.
- [x] `newRequest/components/RequestNotesField.tsx`: notas y diagnóstico opcional con RichTextEditor.
- [x] `newRequest/components/RequestDialogFooter.tsx`: footer accesible con acciones de cancelar y submit.
- [x] `newRequest/index.ts`: barril unificado.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 2.
