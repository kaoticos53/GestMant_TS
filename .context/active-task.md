# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-EQUIPMENT-FORM`
- **Objetivo:** Fase 4 - Validación integral, guardrails de seguridad/arquitectura, build de producción y cierre de refactorización de `EquipmentFormDialog.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/equipment/dialogs/EquipmentFormDialog.tsx`
  - Subcomponentes, lógica y hook en `src/pages/dashboard/equipment/dialogs/`
  - Pruebas en `tests/equipmentFormLogic.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/equipment/dialogs/equipmentFormLogic.ts`: Lógica pura de búsqueda de plantillas de modelos (`findModelTemplate`), validación de fechas e intervalos (`validateEquipmentForm`) y armado del payload de guardado.
- [x] `tests/equipmentFormLogic.test.ts`: Pruebas unitarias para resolución de plantillas, validación de reglas de negocio y formateo de datos (12 tests al 100%).
- [x] `src/pages/dashboard/equipment/dialogs/useEquipmentForm.ts`: Custom hook que encapsula los 12 estados de formulario, plantillas reactivas, mutaciones y registro en catálogos.
- [x] `src/pages/dashboard/equipment/dialogs/components/EquipmentIdentityFields.tsx`: Subcomponente para código autogenerado, marca, designación y modelo con datalist y botón de plantilla.
- [x] `src/pages/dashboard/equipment/dialogs/components/EquipmentDetailsFields.tsx`: Subcomponente para ubicación, número de serie y proveedor.
- [x] `src/pages/dashboard/equipment/dialogs/components/EquipmentDatesFields.tsx`: Subcomponente para fechas de alta, garantía, baja e intervalo de revisión preventiva.
- [x] `src/pages/dashboard/equipment/dialogs/EquipmentFormDialog.tsx`: Orquestador principal refactorizado, reducido de 537 a 142 líneas (~73.5% de reducción).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios? 12 tests en verde (`tests/equipmentFormLogic.test.ts`).
- [x] ¿Suite completa? 158 suites y 1.985 tests pasando al 100% en Vitest.
- [x] ¿Guardrails de Arquitectura y Seguridad? Pasados al 100% (18/18 tests en `tests/arquitectura.test.ts` y `tests/seguridad.test.ts`).
- [x] ¿Build de producción Vite? Exitoso (`npm run build`).

---

## 4. Estado Final
- **Estado:** ✅ Completado y Verificado. Listo para commit atómico de cierre de Fase 4.
