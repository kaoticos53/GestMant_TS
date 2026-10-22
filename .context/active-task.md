# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-JOURNEY-SUMMARY`
- **Objetivo:** Fase 1 - Definición de contratos de tipos, helpers puros de agrupación/accesibilidad y tests unitarios para `JourneySummary.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/components/journeySummary/types.ts`
  - `src/components/journeySummary/helpers.ts`
  - `tests/journeySummaryHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/components/journeySummary/types.ts`: contratos de props para etapas, bloqueos y subcomponentes.
- [x] `src/components/journeySummary/helpers.ts`: funciones puras `groupBlockedByStage`, `getStageAccessibilityLabel` y `formatNowStepLabel`.
- [x] `tests/journeySummaryHelpers.test.ts`: suite de tests unitarios verificando la agrupación y textos accesibles.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, tipos inferidos y comprobados.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí (Incidencia, Petición de repuesto, etapas, recorrido).

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 1.
