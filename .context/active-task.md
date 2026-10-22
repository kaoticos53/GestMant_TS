# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-DASHBOARD-CONTENT`
- **Objetivo:** Fase 1 - Creación de tipos, helpers y test suite unitaria para `DashboardContent.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/components/DashboardContent.tsx`
  - `src/pages/dashboard/components/content/types.ts`
  - `src/pages/dashboard/components/content/helpers.ts`
  - `tests/dashboardContentHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/components/content/types.ts`: contratos para props de avisos de invitado, taller vacío y router.
- [x] `src/pages/dashboard/components/content/helpers.ts`: constante `EXEMPT_EMPTY_NOTICE_TABS` y helper `isTabExemptFromEmptyNotice`.
- [x] `tests/dashboardContentHelpers.test.ts`: 16 pruebas unitarias verificando pestañas exentas y operativas.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 34 tests pasados (16 unitarios + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada y validada. Lista para commit atómico 1.

