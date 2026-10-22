# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-EQUIPMENT-MODELS-CARD`
- **Objetivo:** Fase 2 - Modularizar subcomponentes visuales de cabecera (`EquipmentModelsHeader`), barra de búsqueda (`EquipmentModelsSearchBar`), estados vacíos (`EquipmentModelsEmptyState`), tabla con insignias de uso (`EquipmentModelsTable`) y diálogo de borrado (`DeleteEquipmentModelDialog`) para `EquipmentModelsCard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/equipmentModels/components/EquipmentModelsHeader.tsx`
  - `src/pages/dashboard/settings/equipmentModels/components/EquipmentModelsSearchBar.tsx`
  - `src/pages/dashboard/settings/equipmentModels/components/EquipmentModelsEmptyState.tsx`
  - `src/pages/dashboard/settings/equipmentModels/components/EquipmentModelsTable.tsx`
  - `src/pages/dashboard/settings/equipmentModels/components/DeleteEquipmentModelDialog.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/settings/equipmentModels/components/EquipmentModelsHeader.tsx`: Cabecera de tarjeta y botón de alta.
- [x] `src/pages/dashboard/settings/equipmentModels/components/EquipmentModelsSearchBar.tsx`: Input de búsqueda con contador de modelos.
- [x] `src/pages/dashboard/settings/equipmentModels/components/EquipmentModelsEmptyState.tsx`: Estado vacío descriptivo.
- [x] `src/pages/dashboard/settings/equipmentModels/components/EquipmentModelsTable.tsx`: Tabla responsiva con badges de uso e icono de preventivo.
- [x] `src/pages/dashboard/settings/equipmentModels/components/DeleteEquipmentModelDialog.tsx`: Diálogo modal con restricción explicativa o confirmación.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios? Verificados con Vitest.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** Completada Fase 2. Lista para commit.























