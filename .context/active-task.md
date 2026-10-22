# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-WORKSHOP-DATA-CARD`
- **Objetivo:** Fase 2 - Crear hook personalizado `useWorkshopDataActions` y subcomponentes visuales (`WorkshopDataHeader`, `WorkshopDataActions`, `WorkshopResetDialog`) con barril unificado.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/workshopData/hooks/useWorkshopDataActions.ts`
  - `src/pages/dashboard/settings/workshopData/components/WorkshopDataHeader.tsx`
  - `src/pages/dashboard/settings/workshopData/components/WorkshopDataActions.tsx`
  - `src/pages/dashboard/settings/workshopData/components/WorkshopResetDialog.tsx`
  - `src/pages/dashboard/settings/workshopData/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `workshopData/types.ts`: contratos de tipos e interfaces.
- [x] `workshopData/helpers.ts`: helpers de confirmación y formateo.
- [x] `tests/workshopDataCardHelpers.test.ts`: tests unitarios de helpers.
- [x] `workshopData/hooks/useWorkshopDataActions.ts`: hook con actions/mutations de Convex y estados de carga.
- [x] `workshopData/components/WorkshopDataHeader.tsx`: cabecera explicativa con icono Database.
- [x] `workshopData/components/WorkshopDataActions.tsx`: botones de carga de datos y vaciado.
- [x] `workshopData/components/WorkshopResetDialog.tsx`: diálogo modal de confirmación con input VACIAR.
- [x] `workshopData/index.ts`: barril unificado.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 2.
