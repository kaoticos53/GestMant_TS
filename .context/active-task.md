# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-CATALOGS-CARD`
- **Objetivo:** Fase 1 - Extraer tipos de dominio (`types.ts`), helpers puros de filtrado/validación (`helpers.ts`) y suite de tests unitarios (`tests/catalogsCardHelpers.test.ts`) para `CatalogsCard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/catalogs/types.ts`
  - `src/pages/dashboard/settings/catalogs/helpers.ts`
  - `tests/catalogsCardHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/settings/catalogs/types.ts`: Tipos `CatalogItemDoc`, `EditingCatalogItem`, `MergingCatalogItem` y contratos de props.
- [x] `src/pages/dashboard/settings/catalogs/helpers.ts`: Funciones puras `filterCatalogItems`, `validateCatalogItemName` y `getAvailableMergeTargets`.
- [x] `tests/catalogsCardHelpers.test.ts`: Tests unitarios para las funciones puras de helpers (8 tests).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios? 8 tests pasando al 100%.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados (18 tests).

---

## 4. Estado Final
- **Estado:** Fase 1 completada. Listo para commit atómico.










