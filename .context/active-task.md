# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-AUDIT-FILTERS-CARD`
- **Objetivo:** Fase 2 - Crear subcomponentes `AuditFiltersGrid`, `AuditPresetsBar` y `AuditSummaryFooter` con barril unificado.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/audit/components/filters/components/AuditFiltersGrid.tsx`
  - `src/pages/dashboard/audit/components/filters/components/AuditPresetsBar.tsx`
  - `src/pages/dashboard/audit/components/filters/components/AuditSummaryFooter.tsx`
  - `src/pages/dashboard/audit/components/filters/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `audit/filters/types.ts`: contratos de props para grid de filtros, presets y footer.
- [x] `audit/filters/helpers.ts`: funciones puras `formatAuthorOption`, `isResetDisabled` y `formatSummaryDetails`.
- [x] `tests/auditFiltersCardHelpers.test.ts`: suite de tests unitarios.
- [x] `audit/filters/components/AuditFiltersGrid.tsx`: selectores de persona, tipo y fechas.
- [x] `audit/filters/components/AuditPresetsBar.tsx`: fila de presets, reinicio y exportación.
- [x] `audit/filters/components/AuditSummaryFooter.tsx`: pie informativo de resumen y desglose.
- [x] `audit/filters/index.ts`: barril unificado.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 2.
