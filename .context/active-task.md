# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-AUDIT-FILTERS-CARD`
- **Objetivo:** Fase 1 - Definición de contratos de tipos, helpers puros de formato/resumen y tests unitarios para `AuditFiltersCard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/audit/components/filters/types.ts`
  - `src/pages/dashboard/audit/components/filters/helpers.ts`
  - `tests/auditFiltersCardHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/audit/components/filters/types.ts`: contratos de props para grid de filtros, presets y footer.
- [x] `src/pages/dashboard/audit/components/filters/helpers.ts`: funciones puras `formatAuthorOption`, `isResetDisabled` y `formatAuditSummaryParts`.
- [x] `tests/auditFiltersCardHelpers.test.ts`: suite de tests unitarios para formato y lógica pura de auditoría.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, tipos inferidos y comprobados.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí (Incidencia, movimientos, personas).

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 1.
