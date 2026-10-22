# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-JOURNEY-SUMMARY`
- **Objetivo:** Fase 3 - Reducir y orquestar `JourneySummary.tsx` usando los subcomponentes modulares `JourneyStagesList`, `JourneyNowNextStatus` y `JourneyBlockedSteps` junto a la función pura `groupBlockedByStage`.
- **Módulo(s) Afectado(s):**
  - `src/components/JourneySummary.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `journeySummary/types.ts`: contratos de props para etapas, bloqueos y subcomponentes.
- [x] `journeySummary/helpers.ts`: funciones puras `groupBlockedByStage`, `getStageAccessibilityLabel` y `formatNowStepLabel`.
- [x] `tests/journeySummaryHelpers.test.ts`: suite de tests unitarios.
- [x] `journeySummary/components/StageDot.tsx`: punto indicador visual de estado.
- [x] `journeySummary/components/JourneyStagesList.tsx`: lista horizontal de etapas con conector responsivo.
- [x] `journeySummary/components/JourneyNowNextStatus.tsx`: estado actual y paso siguiente.
- [x] `journeySummary/components/JourneyBlockedSteps.tsx`: bloque descriptivo de motivos bloqueados.
- [x] `journeySummary/index.ts`: barril unificado.
- [ ] `src/components/JourneySummary.tsx`: orquestación de alto nivel desacoplada.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 3.
