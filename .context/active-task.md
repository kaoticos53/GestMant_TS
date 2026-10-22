# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-INCIDENT-PART-REQUESTS-CARD`
- **Objetivo:** Fase 1 - Extracción de tipos, helpers puros de estado de material de petición y líneas con pruebas unitarias.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/detail/partRequests/types.ts`
  - `src/pages/dashboard/incidents/components/detail/partRequests/helpers.ts`
  - `tests/incidentPartRequestsCardHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `partRequests/types.ts`: contratos de props para `IncidentPartRequestsCard`, `IncidentPartRequestItem` e `IncidentPartRequestLine`.
- [x] `partRequests/helpers.ts`: funciones puras `untouchedLineLabel`, `resolveRequestDeliveryMeta` y `getLineProgress`.
- [x] `tests/incidentPartRequestsCardHelpers.test.ts`: 5 tests unitarios verificando estados de material, líneas y resolución de metadatos.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 23 tests pasados (5 helpers + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada y validada. Lista para commit atómico 1.
