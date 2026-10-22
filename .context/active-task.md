# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-REQUEST-DETAIL-SHEET`
- **Objetivo:** Fase 3 - Reensamblado declarativo de `RequestDetailSheet.tsx` usando los submódulos de detail.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/components/RequestDetailSheet.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `RequestDetailSheet.tsx`: simplificado de 252 a 198 líneas con composición limpia, orquestando de forma declarativa `RequestStatusBanners`, `RequestNotesSection` y `RequestJourneyCard`.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de integración? 53 tests pasados (14 helpers + 10 requestsViewFlow + 11 incidentPartRequests + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada y validada. Lista para commit atómico 3.
