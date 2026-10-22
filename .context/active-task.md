# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-MANUAL-FORM-DIALOG`
- **Objetivo:** Fase 3 - Crear custom hook `useManualForm` y reensamblar `ManualFormDialog.tsx` como orquestador limpio.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/manuals/form/hooks/useManualForm.ts`
  - `src/pages/dashboard/ManualFormDialog.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/manuals/form/hooks/useManualForm.ts`: Orquestación de mutaciones Convex, estados de validación, storage uploads y callbacks.
- [x] `src/pages/dashboard/ManualFormDialog.tsx`: Reensamblado con composición declarativa y reducción de líneas (503 -> 138 líneas).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios? 32 tests pasando al 100%.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** Fase 3 completada. Listo para commit atómico.







