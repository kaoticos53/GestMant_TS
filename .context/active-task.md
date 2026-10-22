# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-ASSOCIATE-DIALOG`
- **Objetivo:** Fase 1 - Extraer tipos de dominio (`types.ts`), helpers puros de parseo numérico, compatibilidad y validación (`helpers.ts`) y suite de tests unitarios (`tests/associateDialogHelpers.test.ts`) para `AssociateDialog.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/dialogs/associate/types.ts`
  - `src/pages/dashboard/requests/dialogs/associate/helpers.ts`
  - `tests/associateDialogHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/requests/dialogs/associate/types.ts`: Tipos `AssociateMode`, `AssociateDialogProps`, contratos de props.
- [x] `src/pages/dashboard/requests/dialogs/associate/helpers.ts`: Funciones puras `parseNumericInput`, `getCompatibleParts`, `validateNewPartPayload`.
- [x] `tests/associateDialogHelpers.test.ts`: Tests unitarios para las funciones puras de helpers (12 tests pasados).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios? Verificados con Vitest.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** Completada Fase 1. Lista para commit.























