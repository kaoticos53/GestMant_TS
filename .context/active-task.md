# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-DASHBOARD-NAVCONFIG-DESACOP`
- **Objetivo:** Fase 3 - Creación de `navConfig.ts`, desacoplamiento de props en `DashboardContent.tsx`, pruebas unitarias en `tests/navConfig.test.ts` y reensamblado limpio de `Dashboard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/constants/navConfig.ts`
  - `src/pages/dashboard/components/DashboardContent.tsx`
  - `src/pages/dashboard/hooks/useDashboardNavigation.ts`
  - `src/pages/Dashboard.tsx`
  - `tests/navConfig.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/constants/navConfig.ts`: `MODULE_META`, `buildNavItems`, `computeNavBadges`, `buildDashboardStats`, `isSummaryHidden`, `getHeadingInfo`, `buildHeaderActions`.
- [x] `src/pages/dashboard/hooks/useDashboardNavigation.ts`: Export del tipo `DashboardNavigation`.
- [x] `src/pages/dashboard/components/DashboardContent.tsx`: Reducción de 34 props a interfaz limpia con `navigation: DashboardNavigation`.
- [x] `src/pages/Dashboard.tsx`: Reensamblado orquestador conciso (308 líneas) delegando configuración y acciones.
- [x] `tests/navConfig.test.ts`: Pruebas de configuración de navegación, badges, stats y acciones de cabecera.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `navConfig.ts` con funciones puras y metadatos.
- [x] **Paso 2:** Crear suite de pruebas `tests/navConfig.test.ts`.
- [x] **Paso 3:** Refactorizar `DashboardContent.tsx` para recibir `navigation`.
- [x] **Paso 4:** Reensamblar `Dashboard.tsx` conectando las nuevas utilidades.
- [x] **Paso 5:** Validar con `npx tsc --noEmit` y suite de tests.
- [x] **Paso 6:** Commit atómico de la Fase 3.
