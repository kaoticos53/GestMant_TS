# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-NEW-REQUEST-DIALOG`
- **Objetivo:** Fase 4 - Verificación exhaustiva (Typecheck, Vitest, Build de Producción) y cierre de la refactorización modular de `NewRequestDialog.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/dialogs/NewRequestDialog.tsx`
  - `src/pages/dashboard/requests/dialogs/newRequest/`
  - `tests/newRequestDialogHelpers.test.ts`
  - `tests/newRequestLogic.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `newRequest/types.ts`: contratos de campos del formulario, footer y props.
- [x] `newRequest/helpers.ts`: funciones puras `getSubmitButtonLabel` e `isSubmitDisabled`.
- [x] `tests/newRequestDialogHelpers.test.ts`: suite de tests unitarios (6 tests).
- [x] `newRequest/components/RequestHeaderFields.tsx`: solicitante, puesto y prioridad.
- [x] `newRequest/components/RequestDescriptionField.tsx`: descripción rica con RichTextEditor.
- [x] `newRequest/components/RequestNotesField.tsx`: notas y diagnóstico opcional con RichTextEditor.
- [x] `newRequest/components/RequestDialogFooter.tsx`: footer accesible con acciones de cancelar y submit.
- [x] `newRequest/index.ts`: barril unificado.
- [x] `NewRequestDialog.tsx`: reducción de 225 a 140 líneas orquestando limpiamente.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 2.411 tests pasados en 203 suites (0 fallos).
- [x] ¿Compilación de producción? `npm run build` completado con éxito (código 0).
- [x] ¿Vocabulario Ubicuo respetado? Sí (Petición de repuesto, repuestos, equipos).

---

## 4. Estado Actual
- **Estado:** Completada con éxito. Listo para proponer siguiente candidato.
