# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-NEW-REQUEST-DIALOG`
- **Objetivo:** Fase 3 - Reensamblar `NewRequestDialog.tsx` consumiendo el submódulo modular `newRequest/`, reduciendo su tamaño de 225 a ~105 líneas limpias.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/dialogs/NewRequestDialog.tsx`

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
- [x] `NewRequestDialog.tsx`: reducción de 225 a ~105 líneas orquestando limpiamente.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 3.
