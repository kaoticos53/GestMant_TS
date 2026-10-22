# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-EQUIPMENT-MODEL-DIALOG`
- **Objetivo:** Fase 3 - Reensamblado declarativo de `EquipmentModelDialog.tsx` usando los submódulos de modelDialog.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/EquipmentModelDialog.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `EquipmentModelDialog.tsx`: simplificado de 258 a 87 líneas (-66%), orquestando de forma declarativa `useEquipmentModelForm`, `ModelBasicFields` y `ModelDetailsFields`.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de integración? 40 tests pasados (7 helpers + 11 card helpers + 4 models + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada y validada. Lista para commit atómico 3.
