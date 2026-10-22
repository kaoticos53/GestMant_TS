# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-PART-FORM-DIALOG`
- **Objetivo:** Fase 4 - Verificación exhaustiva (Typecheck, Vitest, Build de Producción) y cierre de la refactorización modular de `PartFormDialog.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/inventory/dialogs/PartFormDialog.tsx`
  - `src/pages/dashboard/inventory/dialogs/partForm/`
  - `tests/partFormDialogHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `partForm/types.ts`: contratos de props para `PartBasicFields` y `PartStockLocationFields`.
- [x] `partForm/helpers.ts`: función pura `buildPartCategoryOptions` para deduplicar y combinar categorías estándar y personalizadas.
- [x] `tests/partFormDialogHelpers.test.ts`: 4 tests unitarios cubriendo deduplicación, catálogo vacío y formato.
- [x] `partForm/PartBasicFields.tsx`: campos de código, nombre, categoría autocompletable y unidad.
- [x] `partForm/PartStockLocationFields.tsx`: campos de stock actual, mínimo, ubicación, proveedor, nº parte, precio y url.
- [x] `partForm/index.ts`: barril unificado para el submódulo partForm.
- [x] `PartFormDialog.tsx`: reducción de 228 a 115 líneas orquestando los grupos de campos modulares.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 2.371 tests pasados en 198 suites (0 fallos).
- [x] ¿Compilación de producción? `npm run build` completado con éxito (5.30s).
- [x] ¿Vocabulario Ubicuo respetado? Sí (Repuesto, Catálogo).

---

## 4. Estado Actual
- **Estado:** Completada con éxito. Listo para proponer siguiente candidato.
