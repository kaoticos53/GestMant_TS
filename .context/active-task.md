# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-LANDING`
- **Objetivo:** Fase 2 - Extraer subcomponentes visuales desacoplados (`TechnicalConsolePreview`, `LandingHeader`, `LandingHero`, `LandingStatsSection`, `WorkshopDoorsSection`, `LandingFooter`).
- **Módulo(s) Afectado(s):**
  - `src/pages/landing/components/TechnicalConsolePreview.tsx`
  - `src/pages/landing/components/LandingHeader.tsx`
  - `src/pages/landing/components/LandingHero.tsx`
  - `src/pages/landing/components/LandingStatsSection.tsx`
  - `src/pages/landing/components/WorkshopDoorsSection.tsx`
  - `src/pages/landing/components/LandingFooter.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `TechnicalConsolePreview.tsx`: Consola técnica simulada para pantallas grandes.
- [x] `LandingHeader.tsx`: Cabecera sticky con navegación y estado de sesión.
- [x] `LandingHero.tsx`: Sección Hero con textos condicionales y botones CTA.
- [x] `LandingStatsSection.tsx`: Banda '#taller' con estadísticas públicas cuantitativas.
- [x] `WorkshopDoorsSection.tsx`: Tarjeta dual con puertas de aviso ('#avisar') y seguimiento ('#seguimiento').
- [x] `LandingFooter.tsx`: Pie de página con versión, copyright y diálogo de bitácora.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear los 6 subcomponentes en `src/pages/landing/components/`.
- [x] **Paso 2:** Verificar compilación con `npx tsc -b`.
- [x] **Paso 3:** Commit atómico de Fase 2.
