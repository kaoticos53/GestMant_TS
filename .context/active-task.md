# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-MANUAL-FORM-DIALOG`
- **Objetivo:** Fase 4 - Verificación final de compilación, suite Vitest completa, tests de arquitectura y seguridad, y cierre de la refactorización modular de `ManualFormDialog.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/ManualFormDialog.tsx` (503 -> 138 líneas, -72.5%)
  - Subcomponentes en `src/pages/dashboard/manuals/form/`
  - Tests en `tests/manualFormDialogHelpers.test.ts` (14 tests)

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/manuals/form/types.ts`: Contratos de props del diálogo y estado del formulario.
- [x] `src/pages/dashboard/manuals/form/helpers.ts`: Funciones puras `getUniqueModels`, `suggestBrandForModel`, `validateManualSubmission`, y validación de archivos.
- [x] `tests/manualFormDialogHelpers.test.ts`: Tests unitarios para las funciones puras de helpers (14 tests).
- [x] `src/pages/dashboard/manuals/form/components/ManualKindSelector.tsx`: Selector de botones para Archivo vs. Nota de taller.
- [x] `src/pages/dashboard/manuals/form/components/ManualClassificationFields.tsx`: Título, Tipo, Selector de Equipo asignado, Marca y Modelo con datalist.
- [x] `src/pages/dashboard/manuals/form/components/ManualFileUploadField.tsx`: Input de archivo PDF, límites de peso, feedback del archivo seleccionado con botón de deseleccionar.
- [x] `src/pages/dashboard/manuals/form/components/ManualNotesField.tsx`: RichTextEditor para notas técnicas de taller.
- [x] `src/pages/dashboard/manuals/form/hooks/useManualForm.ts`: Custom hook de orquestación de mutaciones Convex, estados y carga a storage.
- [x] `src/pages/dashboard/ManualFormDialog.tsx`: Diálogo modal desacoplado y declarativo.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No. Lógica pura respetada sin imports prohibidos.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios? 160 suites y 2.010 tests pasando al 100% (incluyendo los 14 tests de helpers).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados (`tests/arquitectura.test.ts` y `tests/seguridad.test.ts`).
- [x] ¿Build de producción Vite? Exitoso (`npm run build`).

---

## 4. Estado Final
- **Estado:** Completado (Fases 1, 2, 3 y 4 de `ManualFormDialog.tsx`).








