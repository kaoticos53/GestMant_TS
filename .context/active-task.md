# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-DASHBOARD-NAV-ROLE`
- **Objetivo:** Fase 1 - Extracción de `useEnsureRole.ts` y `useDashboardNavigation.ts` en `src/pages/dashboard/hooks/`, tipado en `types.ts` y pruebas unitarias de navegación.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/types.ts`
  - `src/pages/dashboard/hooks/useEnsureRole.ts`
  - `src/pages/dashboard/hooks/useDashboardNavigation.ts`
  - `src/pages/Dashboard.tsx`
  - `tests/dashboardNavigation.test.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/types.ts`: Definición de `NavigationTarget`.
- [x] `src/pages/dashboard/hooks/useEnsureRole.ts`: Aislamiento de reintentos de rol de usuario.
- [x] `src/pages/dashboard/hooks/useDashboardNavigation.ts`: Estado unificado de tabs, filtros y búsquedas sin remount keys.
- [x] `src/pages/Dashboard.tsx`: Integración de los nuevos hooks de dominio.
- [x] `tests/dashboardNavigation.test.tsx`: Pruebas de transiciones y navegación inter-módulos.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Extender `types.ts` con `NavigationTarget`.
- [x] **Paso 2:** Crear `useEnsureRole.ts`.
- [x] **Paso 3:** Crear `useDashboardNavigation.ts`.
- [x] **Paso 4:** Conectar en `Dashboard.tsx`.
- [x] **Paso 5:** Crear `tests/dashboardNavigation.test.tsx`.
- [x] **Paso 6:** Validar con `npx tsc --noEmit` y suite de tests.
- [x] **Paso 7:** Commit atómico de la Fase 1.
