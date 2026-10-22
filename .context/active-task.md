# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-MANUALS-VIEW-CIERRE`
- **Objetivo:** Fase 4 - Validación integral, build de producción y cierre de refactorización arquitectónica de `ManualsView.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/ManualsView.tsx`
  - `src/pages/dashboard/manuals/types.ts`
  - `src/pages/dashboard/manuals/hooks/useManualsListState.ts`
  - `src/pages/dashboard/manuals/hooks/useManualExport.ts`
  - `src/pages/dashboard/manuals/components/ManualsFilterBar.tsx`
  - `src/pages/dashboard/manuals/components/ManualsEmptyState.tsx`
  - `src/pages/dashboard/manuals/components/ManualsTableRow.tsx`
  - `tests/manualsListState.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/manuals/types.ts`: Tipos base (`ManualDoc`, `ManualChangeDoc`, `EquipmentDoc`, etc.).
- [x] `src/pages/dashboard/manuals/hooks/useManualsListState.ts`: Hook de estado de filtros, brands/models e indexación $O(1)$ de equipos.
- [x] `src/pages/dashboard/manuals/hooks/useManualExport.ts`: Hook para exportación a CSV con resolución $O(1)$.
- [x] `tests/manualsListState.test.ts`: Pruebas unitarias de filtrado por texto, tipo, marca, modelo y filtro especial `__none__` (8 tests).
- [x] `src/pages/dashboard/manuals/components/ManualsFilterBar.tsx`: Barra superior con buscador, selects en cascada y botones de acción.
- [x] `src/pages/dashboard/manuals/components/ManualsEmptyState.tsx`: Estados vacíos para módulo sin manuales y sin resultados de búsqueda.
- [x] `src/pages/dashboard/manuals/components/ManualsTableRow.tsx`: Fila individual con badges, columnas responsivas y acciones con comprobación de permisos.
- [x] `src/pages/dashboard/ManualsView.tsx`: Vista orquestadora limpia, reducida de 580 a 237 líneas (~59% de reducción).

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas (`tests/arquitectura.test.ts` y `tests/seguridad.test.ts` 100% verdes).
- [x] ¿Build de producción? Verificada con `npm run build` en 5.80s.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Verificación de tipos estricta (`npx tsc -b`).
- [x] **Paso 2:** Verificación de guardrails de arquitectura (`tests/arquitectura.test.ts`).
- [x] **Paso 3:** Verificación de guardrails de seguridad (`tests/seguridad.test.ts`).
- [x] **Paso 4:** Suite completa de tests (`1935 passed`, 0 fallos).
- [x] **Paso 5:** Compilación de producción exitosa (`npm run build`).
- [x] **Paso 6:** Commit atómico de Fase 4 y cierre.
