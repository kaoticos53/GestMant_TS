# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-MANUALS-VIEW`
- **Objetivo:** Fase 1 - Extracción de tipos y hooks de dominio (`useManualsListState`, `useManualExport`) y pruebas unitarias puras (`tests/manualsListState.test.ts`).
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/manuals/types.ts`
  - `src/pages/dashboard/manuals/hooks/useManualsListState.ts`
  - `src/pages/dashboard/manuals/hooks/useManualExport.ts`
  - `tests/manualsListState.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/manuals/types.ts`: Tipos base (`ManualDoc`, `ManualChangeDoc`, `EquipmentDoc`, etc.).
- [x] `src/pages/dashboard/manuals/hooks/useManualsListState.ts`: Hook de estado de filtros, brands/models e indexación $O(1)$ de equipos.
- [x] `src/pages/dashboard/manuals/hooks/useManualExport.ts`: Hook para exportación a CSV con resolución $O(1)$.
- [x] `tests/manualsListState.test.ts`: Pruebas unitarias de filtrado por texto, tipo, marca, modelo y filtro especial `__none__` (8 tests).

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `src/pages/dashboard/manuals/types.ts`.
- [x] **Paso 2:** Implementar `src/pages/dashboard/manuals/hooks/useManualsListState.ts`.
- [x] **Paso 3:** Implementar `src/pages/dashboard/manuals/hooks/useManualExport.ts`.
- [x] **Paso 4:** Crear `tests/manualsListState.test.ts`.
- [x] **Paso 5:** Verificar tipos con `npx tsc -b`.
- [x] **Paso 6:** Ejecutar tests unitarios con `npx vitest run tests/manualsListState.test.ts`.
- [x] **Paso 7:** Commit atómico de Fase 1.
