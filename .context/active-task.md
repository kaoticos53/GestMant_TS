# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-INCIDENT-EQUIPMENT-CARD`
- **Objetivo:** Fase 3 - Reensamblado modular y declarativo de `IncidentEquipmentCard.tsx` delegando en las subsecciones especializadas de `equipment/`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/detail/IncidentEquipmentCard.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `IncidentEquipmentCard.tsx`: reducción de 244 a 34 líneas, actuando como orquestador limpio y declarativo para `IncidentNotificationSection`, `IncidentAssignmentSection` e `IncidentExternalRepairSection`.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 33 tests pasados (12 helpers + 9 arquitectura + 9 seguridad + 3 integración).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada y validada. Lista para commit atómico 3.
