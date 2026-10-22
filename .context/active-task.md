# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-EQUIPMENT-MODELS-CARD`
- **Objetivo:** Fase 4 - Verificación integral de compilación, tests unitarios, arquitectura y cierre formal de `EquipmentModelsCard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/EquipmentModelsCard.tsx`
  - `src/pages/dashboard/settings/equipmentModels/`
  - `tests/equipmentModelsCardHelpers.test.ts`
  - `tests/equipmentModels.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/settings/equipmentModels/types.ts`: Tipos `UsageStats`, `EquipmentModelDoc`, `EquipmentDoc`, `PartDoc`, `ManualDoc`.
- [x] `src/pages/dashboard/settings/equipmentModels/helpers.ts`: Funciones `computeModelUsageStats`, `filterEquipmentModels`, `getCannotDeleteReason`.
- [x] `tests/equipmentModelsCardHelpers.test.ts`: 11 tests unitarios pasando.
- [x] `src/pages/dashboard/settings/equipmentModels/components/`: Subcomponentes modulares de cabecera, buscador, estados vacíos, tabla y diálogo de borrado.
- [x] `src/pages/dashboard/settings/equipmentModels/hooks/useEquipmentModelsState.ts`: Custom hook de consultas, mutaciones, estado y paginación.
- [x] `src/pages/dashboard/settings/EquipmentModelsCard.tsx`: Reducido de 428 a 84 líneas (-80.4%).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios? 2.071 tests pasados (100%).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.
- [x] ¿Build de producción Vite? Exitoso (5.15s).

---

## 4. Estado Final
- **Estado:** Completada y Cerrada. Listo para proponer siguiente candidato.























