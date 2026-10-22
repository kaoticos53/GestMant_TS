# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-INCIDENT-DOCUMENTS`
- **Objetivo:** Fase 3 - Reensamblar IncidentDocumentsCard como orquestador declarativo desacoplado en subcomponentes modulares.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/detail/IncidentDocumentsCard.tsx`
  - `src/pages/dashboard/incidents/components/detail/documents/types.ts`

---

## 2. Archivos Modificados / Creados
- [x] Reensamblado de `IncidentDocumentsCard.tsx` (366 -> 90 líneas, -75.4%).
- [x] Tipos alineados en `documents/types.ts` con identificadores y storage de Convex.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? Tests verdes (28 tests pasados).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada exitosamente. Listo para commit atómico 3.
