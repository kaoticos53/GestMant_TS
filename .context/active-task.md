# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-PURCHASING-HISTORY-CELL-TABLE`
- **Objetivo:** Fase 3 - Creación de `HistoryCell.tsx`, `HistoryToolbar.tsx` y reensamblado desacoplado de `HistorySection.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/purchasing/components/history/HistoryCell.tsx`
  - `src/pages/dashboard/purchasing/components/history/HistoryToolbar.tsx`
  - `src/pages/dashboard/purchasing/components/HistorySection.tsx`
  - `src/convex/_purchasing/queries.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/purchasing/components/history/HistoryCell.tsx`: Celda interactiva memoizada con `React.memo`.
- [x] `src/pages/dashboard/purchasing/components/history/HistoryToolbar.tsx`: Controles superiores de búsqueda, proveedor, badges y exportación.
- [x] `src/pages/dashboard/purchasing/components/HistorySection.tsx`: Orquestador desacoplado, sin bucles de render anidados.
- [x] `src/convex/_purchasing/queries.ts`: Desempate determinista por `_creationTime` en `listReceptions`.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `HistoryCell.tsx`.
- [x] **Paso 2:** Crear `HistoryToolbar.tsx`.
- [x] **Paso 3:** Reensamblar `HistorySection.tsx` conectando hooks y subcomponentes.
- [x] **Paso 4:** Validar con `npx tsc --noEmit` y suite de tests.
- [x] **Paso 5:** Commit atómico de la Fase 3.
