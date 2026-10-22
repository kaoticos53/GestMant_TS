# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-REQUEST-CARD`
- **Objetivo:** Fase 1 - Creación de tipos, helpers y test suite unitaria para `RequestCard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/components/RequestCard.tsx`
  - `src/pages/dashboard/requests/components/card/types.ts`
  - `src/pages/dashboard/requests/components/card/helpers.ts`
  - `tests/requestCardHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `card/types.ts`: contratos de props para subcomponentes de RequestCard.
- [x] `card/helpers.ts`: funciones puras `getRequestUnitsCount`, `getRequestUnitsSummary` y `getRequestActionFlags`.
- [x] `tests/requestCardHelpers.test.ts`: 9 pruebas unitarias verificando conteo, resúmenes y matriz de acciones del ciclo de vida.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 27 tests pasados (9 unitarios + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada y validada. Lista para commit atómico 1.









