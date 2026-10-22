# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-PART-FORM-DIALOG`
- **Objetivo:** Fase 3 - Reensamblado modular y declarativo de `PartFormDialog.tsx` orquestando `PartBasicFields` y `PartStockLocationFields`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/inventory/dialogs/PartFormDialog.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `PartFormDialog.tsx`: reducción de 228 a 115 líneas delegando los grupos de campos en componentes modulares limpios y reutilizables.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 31 tests pasados (4 helpers + 9 dominio + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada y validada. Lista para commit atómico 3.
