# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-INCIDENT-LOOKUP`
- **Objetivo:** Fase 1 - Extraer tipos de dominio, helpers puros (`helpers.ts`), tests unitarios y custom hook `useIncidentLookup` para `IncidentLookup.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/lookup/types.ts`
  - `src/pages/dashboard/lookup/helpers.ts`
  - `src/pages/dashboard/lookup/hooks/useIncidentLookup.ts`
  - `tests/incidentLookupHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [ ] `src/pages/dashboard/lookup/types.ts`: Contratos de props, modelo `Tracking` y resultado de consulta `LookupOutcome`.
- [ ] `src/pages/dashboard/lookup/helpers.ts`: Funciones puras de avisos de caracteres confusos (`confusableNote`) y derivación de datos del seguimiento.
- [ ] `tests/incidentLookupHelpers.test.ts`: Pruebas unitarias para helpers del seguimiento público de incidencias.
- [ ] `src/pages/dashboard/lookup/hooks/useIncidentLookup.ts`: Custom hook con control de peticiones en vuelo, timestamps y mutación Convex.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [ ] ¿Afecta a `src/lib/`? No.
- [ ] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [ ] ¿Tests unitarios? Verificados con Vitest.
- [ ] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** En progreso (Fase 1).
