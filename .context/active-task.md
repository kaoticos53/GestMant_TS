# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-REQUEST-ACTIONS-FOOTER`
- **Objetivo:** Fase 2 - Creación de subcomponentes desacoplados `RequestWithdrawDialog` y `RequestWorkflowButtons` con barril público.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/components/detail/actions/RequestWithdrawDialog.tsx`
  - `src/pages/dashboard/requests/components/detail/actions/RequestWorkflowButtons.tsx`
  - `src/pages/dashboard/requests/components/detail/actions/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `RequestWithdrawDialog.tsx`: diálogo accesible con captura de motivo para papelera.
- [x] `RequestWorkflowButtons.tsx`: barra completa de acciones de flujo de trabajo tipadas y condicionales.
- [x] `actions/index.ts`: barril público que expone helpers, componentes y tipos.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 27 tests pasados (9 helpers + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada y validada. Lista para commit atómico 2.
