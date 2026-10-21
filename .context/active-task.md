# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-REQUEST-DETAIL-HOOKS`
- **Objetivo:** Fase 1 - Extracción de custom hooks de dominio (`useRequestLifecycle`, `useRequestLinesStock`) para `RequestDetailSheet.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/hooks/useRequestLifecycle.ts`
  - `src/pages/dashboard/requests/hooks/useRequestLinesStock.ts`
  - `tests/requestLinesStock.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/requests/hooks/useRequestLifecycle.ts`: Orquestación de mutaciones archive/withdraw, toasts de deshacer y modal de papelera.
- [x] `src/pages/dashboard/requests/hooks/useRequestLinesStock.ts`: Indexación O(1) memoizada del catálogo, entregas acumuladas y control de stock.
- [x] `tests/requestLinesStock.test.ts`: Pruebas unitarias para enriquecimiento de líneas y control de stock.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Seguridad / Arquitectura? Preservadas (18/18 tests pasados).

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `useRequestLifecycle.ts`.
- [x] **Paso 2:** Crear `useRequestLinesStock.ts`.
- [x] **Paso 3:** Crear test unitario `tests/requestLinesStock.test.ts`.
- [x] **Paso 4:** Validar con `npx tsc --noEmit` y `npx vitest run tests/requestLinesStock.test.ts`.
- [x] **Paso 5:** Commit atómico de la Fase 1.
