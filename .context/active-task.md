# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-EQUIPMENT-VIEW`
- **Objetivo:** Fase 1 - Extraer tipos, helpers puros y crear suite de tests unitarios para EquipmentView.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/equipment/types.ts`
  - `src/pages/dashboard/equipment/helpers.ts`
  - `tests/equipmentViewHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] Interfaces `EquipmentTableProps` y `EquipmentModalsProps` añadidas en `equipment/types.ts`.
- [x] Helpers `getManualRights` y `canAddManualNotes` añadidos en `equipment/helpers.ts`.
- [x] `tests/equipmentViewHelpers.test.ts` creado con 11 tests unitarios verdes.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 29 tests verdes.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada. Listo para commit atómico de Fase 1.
