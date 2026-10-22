# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-PART-FORM-DIALOG`
- **Objetivo:** Fase 2 - Desacoplamiento de subcomponentes de campos (`PartBasicFields`, `PartStockLocationFields`) y barril en `partForm/`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/inventory/dialogs/partForm/PartBasicFields.tsx`
  - `src/pages/dashboard/inventory/dialogs/partForm/PartStockLocationFields.tsx`
  - `src/pages/dashboard/inventory/dialogs/partForm/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `partForm/PartBasicFields.tsx`: campos de código, nombre, categoría autocompletable y unidad.
- [x] `partForm/PartStockLocationFields.tsx`: campos de stock actual, mínimo, ubicación, proveedor, nº parte, precio y url.
- [x] `partForm/index.ts`: barril unificado para el submódulo partForm.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 22 tests pasados (4 helpers + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada y validada. Lista para commit atómico 2.
