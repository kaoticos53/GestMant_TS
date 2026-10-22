# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-PENDING-SECTION`
- **Objetivo:** Fase 4 - Validación integral, guardrails de seguridad/arquitectura, build de producción y cierre de refactorización de `PendingSection.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/purchasing/components/PendingSection.tsx`
  - Subcomponentes y hooks en `src/pages/dashboard/purchasing/components/pending/`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/purchasing/components/pending/types.ts`: Tipos base (`PurchaseActionType`, `PurchaseActionTarget`, etc.).
- [x] `src/pages/dashboard/purchasing/components/pending/hooks/usePendingPurchaseSelection.ts`: Hook de selección y validación de proveedor único.
- [x] `src/pages/dashboard/purchasing/components/pending/hooks/useMissingStockActions.ts`: Hook de stock faltante y apartado masivo.
- [x] `tests/pendingSectionLogic.test.ts`: Pruebas unitarias para validación de proveedor y selección de grupos (6 tests).
- [x] `PurchaseRequestActionDialog.tsx`: Diálogo modal singleton elevado para proveedor/nota/retirar.
- [x] `PurchaseRequestRow.tsx`: Fila puramente presentacional sin modales en el DOM.
- [x] `MissingStockCard.tsx`: Tarjeta de peticiones de repuesto sin material en almacén.
- [x] `SupplierGroupCard.tsx`: Tarjeta de agrupación por proveedor con selector de grupo.
- [x] `PendingSection.tsx`: Orquestador principal refactorizado, reducido de 552 a 129 líneas (~77% de reducción).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de compras? 38 tests en verde (`tests/purchasingView.test.tsx`, `tests/pendingSectionLogic.test.ts`, `tests/compras.test.ts`).
- [x] ¿Suite completa? 154 suites y 1.952 tests pasando al 100% en Vitest.
- [x] ¿Guardrails de Arquitectura y Seguridad? Pasados al 100% (18/18 tests en `tests/arquitectura.test.ts` y `tests/seguridad.test.ts`).
- [x] ¿Build de producción Vite? Exitoso (`npm run build`).

---

## 4. Estado Final
- **Estado:** ✅ Completado y Verificado. Listo para commit atómico de cierre de Fase 4.
