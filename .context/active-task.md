# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-PART-FORM-DIALOG`
- **Objetivo:** Fase 1 - Extracción de tipos, helpers puros de catálogo y pruebas unitarias para `PartFormDialog`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/inventory/dialogs/partForm/types.ts`
  - `src/pages/dashboard/inventory/dialogs/partForm/helpers.ts`
  - `tests/partFormDialogHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `partForm/types.ts`: contratos de props para `PartBasicFields` y `PartStockLocationFields`.
- [x] `partForm/helpers.ts`: función pura `buildPartCategoryOptions` para deduplicar y combinar categorías estándar y personalizadas.
- [x] `tests/partFormDialogHelpers.test.ts`: 4 tests unitarios cubriendo deduplicación, catálogo vacío y formato.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 22 tests pasados (4 helpers + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada y validada. Lista para commit atómico 1.
