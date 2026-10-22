# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-WORKSHOP-DATA-CARD`
- **Objetivo:** Fase 1 - Definición de contratos de tipos, helpers puros de formateo/validación de datos de taller y tests unitarios para `WorkshopDataCard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/workshopData/types.ts`
  - `src/pages/dashboard/settings/workshopData/helpers.ts`
  - `tests/workshopDataCardHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/settings/workshopData/types.ts`: tipos e interfaces para hook de acciones, diálogo y componentes.
- [x] `src/pages/dashboard/settings/workshopData/helpers.ts`: helpers de confirmación ("VACIAR") y formateo de resúmenes de seed/reset.
- [x] `tests/workshopDataCardHelpers.test.ts`: suite de tests unitarios verificando la lógica pura.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, tipos inferidos y comprobados.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí (Taller, repuestos, compras, incidencias, peticiones).

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 1.
