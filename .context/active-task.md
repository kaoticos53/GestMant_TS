# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-INCIDENT-EQUIPMENT-CARD`
- **Objetivo:** Fase 1 - Extracción de tipos, helpers puros de formateo y tests unitarios para `IncidentEquipmentCard`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/detail/equipment/types.ts`
  - `src/pages/dashboard/incidents/components/detail/equipment/helpers.ts`
  - `tests/incidentEquipmentCardHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `equipment/types.ts`: contratos de props para las subsecciones de la tarjeta de equipo.
- [x] `equipment/helpers.ts`: funciones puras `formatExternalRepairCost`, `getExternalRepairBadge`, `formatSatContact`, `getEquipmentInventoryInfo`.
- [x] `tests/incidentEquipmentCardHelpers.test.ts`: 12 tests unitarios cubriendo los helpers con tipado estricto sin `any`.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 30 tests pasados (12 helpers + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada y validada. Lista para commit atómico 1.
