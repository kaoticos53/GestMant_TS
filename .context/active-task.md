# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-DATA-TABLE-TOOLBAR`
- **Objetivo:** Fase 1 - Definición de contratos de tipos, helpers puros de resolución de densidad y tests unitarios para `DataTableToolbar.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/components/dataTableToolbar/types.ts`
  - `src/components/dataTableToolbar/helpers.ts`
  - `tests/dataTableToolbarHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/components/dataTableToolbar/types.ts`: contratos de props para la barra completa y sus subcomponentes.
- [x] `src/components/dataTableToolbar/helpers.ts`: función pura `resolveIsCompact` y `DENSITY_OPTIONS`.
- [x] `tests/dataTableToolbarHelpers.test.ts`: suite de tests unitarios para la resolución de densidad y opciones.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, tipos inferidos y comprobados.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 1.
