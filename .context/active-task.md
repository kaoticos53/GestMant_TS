# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-EQUIPMENT-MODEL-DIALOG`
- **Objetivo:** Fase 4 - Validación integral, suite completa de pruebas, verificación de build de producción y cierre de la refactorización de `EquipmentModelDialog.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/EquipmentModelDialog.tsx`
  - `src/pages/dashboard/settings/modelDialog/`
  - `tests/equipmentModelDialogHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] Submódulo desacoplado en `src/pages/dashboard/settings/modelDialog/`:
  - `types.ts`: interfaces de props, formulario y payload tipadas.
  - `helpers.ts`: funciones puras `getInitialModelFormValues` y `validateEquipmentModelForm`.
  - `ModelBasicFields.tsx`: inputs de código de modelo, marca y designación genérica.
  - `ModelDetailsFields.tsx`: inputs de categoría, proveedor, intervalo y notas técnicas.
  - `useEquipmentModelForm.ts`: hook de ciclo de vida del formulario y mutaciones Convex.
  - `index.ts`: barril unificado.
- [x] `tests/equipmentModelDialogHelpers.test.ts`: 7 tests unitarios cubriendo validación de campos e intervalo.
- [x] `EquipmentModelDialog.tsx`: orquestador declarativo reducido de 258 a 87 líneas (-66%).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Suite completa de tests? 2.327 tests pasados en 193 suites de Vitest.
- [x] ¿Compilación de producción? Vite build completado con éxito (5.23s).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Tarea completada y cerrada con éxito.
