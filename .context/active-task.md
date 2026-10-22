# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-REQUEST-ACTIONS-FOOTER`
- **Objetivo:** Fase 3 - Reensamblado declarativo de `RequestActionsFooter.tsx` usando los submódulos de actions.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/components/detail/RequestActionsFooter.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `RequestActionsFooter.tsx`: simplificado de 262 a 65 líneas (-75%), orquestando `computeRequestActionFlags`, `RequestWorkflowButtons` y `RequestWithdrawDialog`.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de integración? 37 tests pasados (9 helpers + 9 arquitectura + 9 seguridad + 10 requestsViewFlow).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada y validada. Lista para commit atómico 3.
