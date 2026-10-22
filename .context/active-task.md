# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-MAINTENANCE-DIALOG`
- **Objetivo:** Fase 2 - Crear hook `useMaintenanceForm` y subcomponentes visuales (`MaintenanceFormFields`, `MaintenanceDialogFooter`) con barril unificado.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/equipment/dialogs/maintenance/hooks/useMaintenanceForm.ts`
  - `src/pages/dashboard/equipment/dialogs/maintenance/components/MaintenanceFormFields.tsx`
  - `src/pages/dashboard/equipment/dialogs/maintenance/components/MaintenanceDialogFooter.tsx`
  - `src/pages/dashboard/equipment/dialogs/maintenance/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `maintenance/types.ts`: contratos de props para campos, footer y hook de formulario.
- [x] `maintenance/helpers.ts`: funciones puras `validateMaintenanceForm`, `getMaintenanceSubmitLabel` y `getMaintenanceDialogTitle`.
- [x] `tests/maintenanceDialogHelpers.test.ts`: suite de tests unitarios.
- [x] `maintenance/hooks/useMaintenanceForm.ts`: hook de estado, mutaciones Convex y validación.
- [x] `maintenance/components/MaintenanceFormFields.tsx`: formulario con tipo, fecha, resumen, técnico, petición y editor.
- [x] `maintenance/components/MaintenanceDialogFooter.tsx`: footer accesible con acciones de cancelar y submit.
- [x] `maintenance/index.ts`: barril unificado.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 2.
