# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-PENDING-SECTION`
- **Objetivo:** Fase 1 - Extraer tipos, hooks de dominio (`usePendingPurchaseSelection`, `useMissingStockActions`) y pruebas unitarias para `PendingSection.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/purchasing/components/pending/types.ts`
  - `src/pages/dashboard/purchasing/components/pending/hooks/usePendingPurchaseSelection.ts`
  - `src/pages/dashboard/purchasing/components/pending/hooks/useMissingStockActions.ts`
  - `tests/pendingSectionLogic.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/purchasing/components/pending/types.ts`: Tipos base (`PurchaseActionType`, `PurchaseActionTarget`, etc.).
- [x] `src/pages/dashboard/purchasing/components/pending/hooks/usePendingPurchaseSelection.ts`: Hook de selección y validación de proveedor único.
- [x] `src/pages/dashboard/purchasing/components/pending/hooks/useMissingStockActions.ts`: Hook de stock faltante y apartado masivo.
- [x] `tests/pendingSectionLogic.test.ts`: Pruebas unitarias para validación de proveedor y selección de grupos (6 tests).

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `types.ts` y hooks en `pending/`.
- [x] **Paso 2:** Crear test unitario `tests/pendingSectionLogic.test.ts`.
- [x] **Paso 3:** Verificar compilación con `npx tsc -b`.
- [x] **Paso 4:** Ejecutar pruebas con Vitest (6 tests verdes).
- [x] **Paso 5:** Commit atómico de Fase 1.
