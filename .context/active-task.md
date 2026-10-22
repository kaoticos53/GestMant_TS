# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-INCIDENT-DOCUMENTS`
- **Objetivo:** Fase 1 - Extraer tipos, helpers de textos y tests unitarios para IncidentDocumentsCard.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/detail/documents/types.ts`
  - `src/pages/dashboard/incidents/components/detail/documents/helpers.ts`
  - `tests/incidentDocumentsCardHelpers.test.ts`
  - `src/pages/dashboard/incidents/components/detail/IncidentDocumentsCard.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/incidents/components/detail/documents/types.ts`: Contratos de props para subcomponentes.
- [x] `src/pages/dashboard/incidents/components/detail/documents/helpers.ts`: Funciones puras de textos y labels.
- [x] `tests/incidentDocumentsCardHelpers.test.ts`: Batería de 10 tests unitarios de helpers de textos (10 tests pasando).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 10 tests pasados al 100%.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada. Listo para commit atómico de Fase 1.























