# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-INCIDENT-PART-REQUESTS-CARD`
- **Objetivo:** Fase 3 - Reensamblado modular y declarativo de `IncidentPartRequestsCard.tsx` orquestando `IncidentPartRequestItem`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/detail/IncidentPartRequestsCard.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `IncidentPartRequestsCard.tsx`: reducción de 222 a 42 líneas orquestando limpiamente los componentes de petición y líneas.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 34 tests pasados (5 helpers + 11 integración + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada y validada. Lista para commit atómico 3.
