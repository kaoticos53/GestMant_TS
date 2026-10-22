# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-EQUIPMENT-FORM`
- **Objetivo:** Fase 1 - Extraer lógica pura de formulario de equipos (`equipmentFormLogic.ts`) y tests unitarios para `EquipmentFormDialog.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/equipment/dialogs/equipmentFormLogic.ts`
  - `tests/equipmentFormLogic.test.ts`

---

## 2. Archivos Modificados / Creados
- [ ] `src/pages/dashboard/equipment/dialogs/equipmentFormLogic.ts`: Funciones puras de búsqueda de plantillas de modelos (`findModelTemplate`), validación de fechas e intervalos (`validateEquipmentForm`) y armado del payload de guardado.
- [ ] `tests/equipmentFormLogic.test.ts`: Pruebas unitarias para resolución de plantillas, validación de reglas de negocio y formateo de datos.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [ ] ¿Afecta a `src/lib/`? No.
- [ ] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [ ] ¿Tests unitarios? Verificados con Vitest.
- [ ] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** En progreso (Fase 1).
