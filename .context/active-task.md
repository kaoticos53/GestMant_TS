# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-DASHBOARD-PAGE`
- **Objetivo:** Fase 1 - Creación de helpers puros y test suite unitaria para `Dashboard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/Dashboard.tsx`
  - `src/pages/dashboard/helpers/dashboardHelpers.ts`
  - `tests/dashboardHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `dashboardHelpers.ts`: funciones puras `getDisplayName`, `getDisplayNameInitial`, `isAccountDeactivated` y `formatDocumentTitle`.
- [x] `tests/dashboardHelpers.test.ts`: 9 pruebas unitarias verificando derivación de nombres, iniciales de avatar, estados de cuenta inactiva y formato de título.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 27 tests pasados (9 unitarios + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada y validada. Lista para commit atómico 1.













