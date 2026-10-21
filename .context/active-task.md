# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-DASHBOARD-SEED-ALERTS`
- **Objetivo:** Fase 2 - Extracción de `useWorkAlertState.ts` y `useDashboardSeed.ts` en `src/pages/dashboard/hooks/`, pruebas unitarias e integración en `Dashboard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/hooks/useWorkAlertState.ts`
  - `src/pages/dashboard/hooks/useDashboardSeed.ts`
  - `src/pages/Dashboard.tsx`
  - `tests/dashboardSeedAndAlerts.test.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/hooks/useWorkAlertState.ts`: Centralización de avisos de trabajo, taller vacío y sincronización local/perfil.
- [x] `src/pages/dashboard/hooks/useDashboardSeed.ts`: Centralización de acciones de seeding y toasting informativo.
- [x] `src/pages/Dashboard.tsx`: Integración de los nuevos hooks de dominio.
- [x] `tests/dashboardSeedAndAlerts.test.tsx`: Pruebas de descarte/restauración de alertas y seeding.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `useWorkAlertState.ts`.
- [x] **Paso 2:** Crear `useDashboardSeed.ts`.
- [x] **Paso 3:** Conectar en `Dashboard.tsx`.
- [x] **Paso 4:** Crear `tests/dashboardSeedAndAlerts.test.tsx`.
- [x] **Paso 5:** Validar con `npx tsc --noEmit` y suite de tests.
- [x] **Paso 6:** Commit atómico de la Fase 2.
