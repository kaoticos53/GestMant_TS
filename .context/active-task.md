# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-MANUALS-VIEW`
- **Objetivo:** Fase 3 - Reensamblado de `ManualsView.tsx` como orquestador limpio y desacoplado.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/ManualsView.tsx`

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
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Reensamblar `ManualsView.tsx`.
- [x] **Paso 2:** Verificar tipos con `npx tsc -b`.
- [x] **Paso 3:** Ejecutar tests con `npx vitest run tests/manualsListState.test.ts tests/manuales.test.ts`.
- [x] **Paso 4:** Commit atómico de Fase 3.
