# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-INCIDENT-EQUIPMENT-CARD`
- **Objetivo:** Fase 2 - Desacoplamiento de subsecciones visuales (`IncidentNotificationSection`, `IncidentAssignmentSection`, `IncidentExternalRepairSection`) y barril en `equipment/`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/detail/equipment/IncidentNotificationSection.tsx`
  - `src/pages/dashboard/incidents/components/detail/equipment/IncidentAssignmentSection.tsx`
  - `src/pages/dashboard/incidents/components/detail/equipment/IncidentExternalRepairSection.tsx`
  - `src/pages/dashboard/incidents/components/detail/equipment/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `equipment/IncidentNotificationSection.tsx`: datos de notificación, equipamiento en inventario, seguimiento y descripción.
- [x] `equipment/IncidentAssignmentSection.tsx`: asignación de técnicos, entrada a taller, fecha de cierre y notas.
- [x] `equipment/IncidentExternalRepairSection.tsx`: gestión de SAT, costes en EUR, fechas de retorno e informes.
- [x] `equipment/index.ts`: barril unificado para el submódulo equipment.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 30 tests pasados (12 helpers + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada y validada. Lista para commit atómico 2.
