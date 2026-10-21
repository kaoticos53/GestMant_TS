# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-PURCHASING-HISTORY-FILTERS`
- **Objetivo:** Fase 2 - Extracción de `useHistoryFilters.ts` y `HistoryFilterDrawer.tsx`, pruebas unitarias en `tests/purchasingHistoryFilters.test.tsx` e integración de estado.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/purchasing/hooks/useHistoryFilters.ts`
  - `src/pages/dashboard/purchasing/components/history/HistoryFilterDrawer.tsx`
  - `tests/purchasingHistoryFilters.test.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/purchasing/hooks/useHistoryFilters.ts`: Gestión de 10 campos de filtros, ordenación, proveedores y conteo reactivo.
- [x] `src/pages/dashboard/purchasing/components/history/HistoryFilterDrawer.tsx`: Subcomponente colapsable de formulario de filtros avanzados.
- [x] `tests/purchasingHistoryFilters.test.tsx`: Pruebas de conteo de filtros activos, reset y filtrado reactivo.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `useHistoryFilters.ts`.
- [x] **Paso 2:** Crear `HistoryFilterDrawer.tsx`.
- [x] **Paso 3:** Crear `tests/purchasingHistoryFilters.test.tsx`.
- [x] **Paso 4:** Validar con `npx tsc --noEmit` y suite de tests.
- [x] **Paso 5:** Commit atómico de la Fase 2.
