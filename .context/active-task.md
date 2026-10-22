# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-MANUAL-FORM-DIALOG`
- **Objetivo:** Fase 1 - Extraer tipos de dominio, helpers puros de validación/deduplicación (`helpers.ts`) y suite de tests unitarios (`tests/manualFormDialogHelpers.test.ts`) para `ManualFormDialog.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/manuals/form/types.ts`
  - `src/pages/dashboard/manuals/form/helpers.ts`
  - `tests/manualFormDialogHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/manuals/form/types.ts`: Contratos de props del diálogo y estado del formulario.
- [x] `src/pages/dashboard/manuals/form/helpers.ts`: Funciones puras `getUniqueModels`, `suggestBrandForModel`, `validateManualSubmission`, y validación de archivos.
- [x] `tests/manualFormDialogHelpers.test.ts`: Tests unitarios para las funciones puras de helpers (14 tests).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios? 14 tests pasando al 100%.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados (18 tests pasando).

---

## 4. Estado Final
- **Estado:** Fase 1 completada. Listo para commit atómico.



