# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-LANDING`
- **Objetivo:** Fase 4 - Validación integral, guardrails de seguridad/arquitectura, build de producción y cierre de refactorización de `Landing.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/Landing.tsx`
  - Subcomponentes y constantes en `src/pages/landing/`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/landing/constants.ts`: Tokens de espaciado, clases de diseño y contenido editorial (`PASOS`).
- [x] `src/pages/landing/hooks/useLandingStatsSummary.ts`: Hook y función pura de formateo de estadísticas del taller.
- [x] `tests/landingStatsLogic.test.ts`: Pruebas unitarias para el mapeo y formateo de estadísticas (3 tests).
- [x] `TechnicalConsolePreview.tsx`: Consola técnica simulada para pantallas grandes.
- [x] `LandingHeader.tsx`: Cabecera sticky con navegación y estado de sesión.
- [x] `LandingHero.tsx`: Sección Hero con textos condicionales y botones CTA.
- [x] `LandingStatsSection.tsx`: Banda '#taller' con estadísticas públicas cuantitativas.
- [x] `WorkshopDoorsSection.tsx`: Tarjeta dual con puertas de aviso ('#avisar') y seguimiento ('#seguimiento').
- [x] `LandingFooter.tsx`: Pie de página con versión, copyright y diálogo de bitácora.
- [x] `Landing.tsx`: Orquestador principal refactorizado, reducido de 600 a 26 líneas (~95% de reducción).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de ritmo? 17 tests en verde (`tests/landingRitmo.test.tsx`, `tests/landingStatsLogic.test.ts`).
- [x] ¿Suite completa? 155 suites y 1.955 tests pasando al 100% en Vitest.
- [x] ¿Guardrails de Arquitectura y Seguridad? Pasados al 100% (18/18 tests en `tests/arquitectura.test.ts` y `tests/seguridad.test.ts`).
- [x] ¿Build de producción Vite? Exitoso (`npm run build`).

---

## 4. Estado Final
- **Estado:** ✅ Completado y Verificado. Listo para commit atómico de cierre de Fase 4.
