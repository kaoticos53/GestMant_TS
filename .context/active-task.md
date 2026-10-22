# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-CATALOGS-CARD`
- **Objetivo:** Fase 3 - Modularización visual (`CatalogsKindSelector`, `CatalogsSearchBar`, `CatalogsTable`), hook `useCatalogsState` y simplificación de `CatalogsCard.tsx` como orquestador limpio.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/catalogs/components/CatalogsKindSelector.tsx`
  - `src/pages/dashboard/settings/catalogs/components/CatalogsSearchBar.tsx`
  - `src/pages/dashboard/settings/catalogs/components/CatalogsTable.tsx`
  - `src/pages/dashboard/settings/catalogs/hooks/useCatalogsState.ts`
  - `src/pages/dashboard/settings/CatalogsCard.tsx`

---

## 2. Archivos Modificados / Creados
- [x] Subcomponentes visuales en `src/pages/dashboard/settings/catalogs/components/` (`CatalogsKindSelector`, `CatalogsSearchBar`, `CatalogsTable`).
- [x] Hook `src/pages/dashboard/settings/catalogs/hooks/useCatalogsState.ts`: Orquestación de mutaciones Convex, paginación y handlers.
- [x] `src/pages/dashboard/settings/CatalogsCard.tsx`: Orquestador limpio y declarativo (485 -> 147 líneas, -69.7%).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios? 38 tests pasando al 100% (helpers, catálogos, arquitectura, seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** Fase 3 completada. Listo para commit atómico.














