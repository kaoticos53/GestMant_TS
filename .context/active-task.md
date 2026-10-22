# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-EQUIPMENT-MODEL-DIALOG`
- **Objetivo:** Fase 1 - Extracción de tipos, helpers deterministas de validación y generación de payload para `EquipmentModelDialog`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/modelDialog/types.ts`
  - `src/pages/dashboard/settings/modelDialog/helpers.ts`
  - `tests/equipmentModelDialogHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `modelDialog/types.ts`: interfaces de props, formulario y payload tipadas.
- [x] `modelDialog/helpers.ts`: funciones puras `getInitialModelFormValues` y `validateEquipmentModelForm`.
- [x] `tests/equipmentModelDialogHelpers.test.ts`: 7 tests unitarios cubriendo campos obligatorios, intervalos y normalización.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 25 tests pasados (7 helpers + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada y validada. Lista para commit atómico 1.
