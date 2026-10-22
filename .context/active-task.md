# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-MAINTENANCE-DIALOG`
- **Objetivo:** Fase 4 - Verificación exhaustiva (Typecheck, Vitest, Build de Producción) y cierre de la refactorización modular de `MaintenanceDialog.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/equipment/dialogs/MaintenanceDialog.tsx`
  - `src/pages/dashboard/equipment/dialogs/maintenance/`
  - `tests/maintenanceDialogHelpers.test.ts`
  - `tests/maintenance.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `maintenance/types.ts`: contratos de props para campos, footer y hook de formulario.
- [x] `maintenance/helpers.ts`: funciones puras `validateMaintenanceForm`, `getMaintenanceSubmitLabel` y `getMaintenanceDialogTitle`.
- [x] `tests/maintenanceDialogHelpers.test.ts`: suite de tests unitarios (8 tests).
- [x] `maintenance/hooks/useMaintenanceForm.ts`: hook de estado, mutaciones Convex y validación.
- [x] `maintenance/components/MaintenanceFormFields.tsx`: formulario con tipo, fecha, resumen, técnico, petición y editor.
- [x] `maintenance/components/MaintenanceDialogFooter.tsx`: footer accesible con acciones de cancelar y submit.
- [x] `maintenance/index.ts`: barril unificado.
- [x] `MaintenanceDialog.tsx`: reducción de 218 a 67 líneas orquestando limpiamente.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 2.424 tests pasados en 205 suites (0 fallos).
- [x] ¿Compilación de producción? `npm run build` completado con éxito (código 0).
- [x] ¿Vocabulario Ubicuo respetado? Sí (Equipo, Intervención, Petición de repuesto, Técnico).

---

## 4. Estado Actual
- **Estado:** Completada con éxito. Listo para proponer siguiente candidato.
