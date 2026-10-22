# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-LANDING`
- **Objetivo:** Fase 1 - Extraer tokens de diseño, constantes y hook de estadísticas públicas (`useLandingStatsSummary`) con pruebas unitarias para `Landing.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/landing/constants.ts`
  - `src/pages/landing/hooks/useLandingStatsSummary.ts`
  - `tests/landingStatsLogic.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/landing/constants.ts`: Tokens de espaciado, clases de diseño y contenido editorial (`PASOS`).
- [x] `src/pages/landing/hooks/useLandingStatsSummary.ts`: Hook y función pura de formateo de estadísticas del taller.
- [x] `tests/landingStatsLogic.test.ts`: Pruebas unitarias para el mapeo y formateo de estadísticas (3 tests).

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `constants.ts` y hook en `src/pages/landing/`.
- [x] **Paso 2:** Crear test unitario `tests/landingStatsLogic.test.ts`.
- [x] **Paso 3:** Verificar compilación con `npx tsc -b`.
- [x] **Paso 4:** Ejecutar pruebas con Vitest (17 tests verdes).
- [x] **Paso 5:** Commit atómico de Fase 1.
