# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-MAINTENANCE-DIALOG`
- **Objetivo:** Fase 1 - Definición de contratos de tipos, helpers puros de validación/labels y tests unitarios para `MaintenanceDialog.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/equipment/dialogs/maintenance/types.ts`
  - `src/pages/dashboard/equipment/dialogs/maintenance/helpers.ts`
  - `tests/maintenanceDialogHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/equipment/dialogs/maintenance/types.ts`: contratos de props para campos, footer y hook de formulario.
- [x] `src/pages/dashboard/equipment/dialogs/maintenance/helpers.ts`: funciones puras `validateMaintenanceForm`, `getMaintenanceSubmitLabel` y `getMaintenanceDialogTitle`.
- [x] `tests/maintenanceDialogHelpers.test.ts`: suite de tests unitarios para validación y labels.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, tipos inferidos y comprobados.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí (Equipo, Intervención, Petición de repuesto, Técnico).

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 1.
