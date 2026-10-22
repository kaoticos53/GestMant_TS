# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-EQUIPMENT-MODELS-CARD`
- **Objetivo:** Fase 3 - Extraer custom hook `useEquipmentModelsState` y reensamblar `EquipmentModelsCard.tsx` como componente orquestador limpio (~84 líneas).
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/equipmentModels/hooks/useEquipmentModelsState.ts`
  - `src/pages/dashboard/settings/EquipmentModelsCard.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/settings/equipmentModels/hooks/useEquipmentModelsState.ts`: Custom hook que encapsula queries Convex, mutación removeModel, estados modales y paginación.
- [x] `src/pages/dashboard/settings/EquipmentModelsCard.tsx`: Reducido de 428 a 84 líneas (-80.4%), integrando subcomponentes.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios? Verificados con Vitest.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** Completada Fase 3. Lista para commit.























