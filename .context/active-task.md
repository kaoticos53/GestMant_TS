# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-REQUEST-ACTIONS-FOOTER`
- **Objetivo:** Fase 1 - Extracción de tipos, helpers deterministas de visibilidad de acciones y pruebas unitarias para `RequestActionsFooter`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/components/detail/actions/types.ts`
  - `src/pages/dashboard/requests/components/detail/actions/helpers.ts`
  - `tests/requestActionsFooterHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `actions/types.ts`: interfaces de props y de flags de acciones (`RequestActionFlags`, `RequestWorkflowButtonsProps`, etc.).
- [x] `actions/helpers.ts`: funciones puras `computeRequestActionFlags` y `sanitizeWithdrawReason`.
- [x] `tests/requestActionsFooterHelpers.test.ts`: 9 tests unitarios cubriendo todos los estados clave y permisos.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 27 tests pasados (9 helpers + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada y validada. Lista para commit atómico 1.
