# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-EQUIPMENT-MODELS-CARD`
- **Objetivo:** Fase 1 - Extraer tipos de dominio (`types.ts`), helpers puros de conteo de uso, filtrado y validación de borrado (`helpers.ts`) y suite de tests unitarios (`tests/equipmentModelsCardHelpers.test.ts`) para `EquipmentModelsCard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/equipmentModels/types.ts`
  - `src/pages/dashboard/settings/equipmentModels/helpers.ts`
  - `tests/equipmentModelsCardHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/settings/equipmentModels/types.ts`: Tipos `UsageStats`, `EquipmentModelDoc`, `EquipmentDoc`, `PartDoc`, `ManualDoc`.
- [x] `src/pages/dashboard/settings/equipmentModels/helpers.ts`: Funciones `computeModelUsageStats`, `filterEquipmentModels`, `getCannotDeleteReason`.
- [x] `tests/equipmentModelsCardHelpers.test.ts`: 11 tests unitarios pasando.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios? Verificados con Vitest (11 tests pasados).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** Completada Fase 1. Lista para commit.























