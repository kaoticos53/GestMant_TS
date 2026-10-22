# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-EQUIPMENT-MODEL-DIALOG`
- **Objetivo:** Fase 2 - Creación de subcomponentes desacoplados `ModelBasicFields`, `ModelDetailsFields`, hook `useEquipmentModelForm` y barril público.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/modelDialog/ModelBasicFields.tsx`
  - `src/pages/dashboard/settings/modelDialog/ModelDetailsFields.tsx`
  - `src/pages/dashboard/settings/modelDialog/useEquipmentModelForm.ts`
  - `src/pages/dashboard/settings/modelDialog/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `ModelBasicFields.tsx`: inputs de código de modelo comercial, autocompletado de marca y designación genérica.
- [x] `ModelDetailsFields.tsx`: inputs de categoría, proveedor habitual, intervalo preventivo y notas técnicas.
- [x] `useEquipmentModelForm.ts`: hook con control de estados, carga de catálogos y submit hacia mutaciones Convex.
- [x] `modelDialog/index.ts`: barril unificado.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 25 tests pasados (7 helpers + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada y validada. Lista para commit atómico 2.
