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
- [x] `src/pages/dashboard/incidents/components/IncidentsHeaderBar.tsx`: Filtros de estado, informes y reporte.
- [x] `src/pages/dashboard/incidents/components/IncidentsEmptyState.tsx`: Estado vacío contextual para IncidentsView.
- [x] `src/pages/dashboard/incidents/components/IncidentCard.tsx`: Tarjeta individual de incidencia con tags y botón archivar.
- [x] `src/pages/dashboard/incidents/components/IncidentsList.tsx`: ListArea, agrupaciones de fecha, tarjetas y paginador.
- [x] `src/pages/dashboard/incidents/hooks/useIncidentsViewState.ts`: Hook de orquestación de queries, mutations y toasts.
- [x] `src/pages/dashboard/IncidentsView.tsx`: Reensamblado a orquestador declarativo de 98 líneas (-74.5%).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de integración? 2.086 tests pasados al 100%.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.
- [x] ¿Build de producción Vite? Exitoso (5.20s).

---

## 4. Estado Final
- **Estado:** Completada y Cerrada.
- **Reducción Métrica:** `IncidentsView.tsx` pasó de 384 a 98 líneas (-74.5%). Se extrajeron 4 subcomponentes modulares especializados (`IncidentsHeaderBar`, `IncidentsEmptyState`, `IncidentCard`, `IncidentsList`), 1 custom hook de orquestación (`useIncidentsViewState`) y 4 tests dedicados en `tests/incidentsViewFlow.test.tsx`. Listo para proponer siguiente candidato.























