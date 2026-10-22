# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-DASHBOARD-CONTENT`
- **Objetivo:** Fase 2 - Desacoplamiento de avisos de invitado, taller vacío y tab router en subcomponentes modulares.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/components/DashboardContent.tsx`
  - `src/pages/dashboard/components/content/`

---

## 2. Archivos Modificados / Creados
- [x] `DashboardViewSkeleton.tsx`: skeleton con animación de pulso para Suspense.
- [x] `DashboardGuestNotice.tsx`: card de aviso, buscador de incidencia y acción para sesión de invitado.
- [x] `DashboardEmptyNotice.tsx`: bienvenida a taller vacío con botón de siembra y arranque vacío.
- [x] `DashboardTabRouter.tsx`: router declarativo protegido con `ModuleErrorBoundary` y `Suspense`.
- [x] `index.ts`: exportación modular limpia.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 34 tests pasados (16 unitarios + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada y validada. Lista para commit atómico 2.


