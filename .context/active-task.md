# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-CATALOGS-CARD`
- **Objetivo:** Fase 4 - Verificación final de compilación, suite Vitest completa, tests de arquitectura y seguridad, y cierre de la refactorización modular de `CatalogsCard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/CatalogsCard.tsx` (485 -> 147 líneas, -69.7%)
  - Subcomponentes en `src/pages/dashboard/settings/catalogs/`
  - Tests en `tests/catalogsCardHelpers.test.ts` (8 tests)

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/settings/catalogs/types.ts`: Tipos `CatalogItemDoc`, `EditingCatalogItem`, `MergingCatalogItem`, `CatalogKindMeta`.
- [x] `src/pages/dashboard/settings/catalogs/helpers.ts`: Funciones puras `filterCatalogItems`, `validateCatalogItemName` y `getAvailableMergeTargets`.
- [x] `tests/catalogsCardHelpers.test.ts`: Tests unitarios para las funciones puras de helpers (8 tests).
- [x] `src/pages/dashboard/settings/catalogs/dialogs/AddCatalogItemDialog.tsx`: Modal para añadir nueva opción canónica.
- [x] `src/pages/dashboard/settings/catalogs/dialogs/EditCatalogItemDialog.tsx`: Modal para editar nombre canónico existente.
- [x] `src/pages/dashboard/settings/catalogs/dialogs/MergeCatalogItemDialog.tsx`: Modal para fusionar duplicados.
- [x] `src/pages/dashboard/settings/catalogs/dialogs/DeleteCatalogItemDialog.tsx`: Modal de confirmación de eliminación.
- [x] `src/pages/dashboard/settings/catalogs/components/CatalogsKindSelector.tsx`: Selector horizontal de tipo de catálogo maestro.
- [x] `src/pages/dashboard/settings/catalogs/components/CatalogsSearchBar.tsx`: Barra de búsqueda y contador para el catálogo maestro.
- [x] `src/pages/dashboard/settings/catalogs/components/CatalogsTable.tsx`: Tabla y paginación para elementos de catálogos maestros.
- [x] `src/pages/dashboard/settings/catalogs/hooks/useCatalogsState.ts`: Hook de estado y mutaciones Convex para el catálogo maestro.
- [x] `src/pages/dashboard/settings/CatalogsCard.tsx`: Orquestador limpio y declarativo.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No. Lógica pura respetada sin imports prohibidos.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios? 161 suites y 2.018 tests pasando al 100%.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados (`tests/arquitectura.test.ts` y `tests/seguridad.test.ts`).
- [x] ¿Build de producción Vite? Exitoso (`npm run build`).

---

## 4. Estado Final
- **Estado:** Completado (Fases 1, 2, 3 y 4 de `CatalogsCard.tsx`).















