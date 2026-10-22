# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-INCIDENTS-VIEW`
- **Objetivo:** Fase 1 - Definir tipos de sección y asegurar tests de renderizado y flujo de cola para `IncidentsView`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/types.ts`
  - `tests/incidentsViewFlow.test.tsx`
  - `src/pages/dashboard/IncidentsView.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/incidents/types.ts`: Tipo `IncidentSection`.
- [x] `tests/incidentsViewFlow.test.tsx`: Batería de 4 tests de renderizado, empty state, filtrado y acción de archivo.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios nuevos? 4 tests pasados al 100%.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.
- [ ] ¿Build de producción Vite? (Fase 4)

---

## 4. Estado Actual
- **Estado:** Fase 1 completada. Listo para commit atómico de Fase 1.























