# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `FASE2-DELETE-VS-ARCHIVE`
- **Objetivo:** Estandarizar la experiencia de borrado vs. archivado en toda la aplicación:
  1. Acciones de archivado / soft-delete: acción directa optimista + toast de éxito con botón `[Deshacer]` (5s de gracia) que revierte la acción mediante mutación `unarchive`.
  2. Borrado definitivo permanente: reservado con `AlertDialog` modal destructivo de confirmación explícita.
- **Módulo(s) Afectado(s):** `src/lib/archiveToasts.ts`, `IncidentsView.tsx`, `IncidentDetailSheet.tsx`, `RequestDetailSheet.tsx`, tests asociados.

---

## 2. Archivos a Modificar / Crear
- [ ] `src/lib/archiveToasts.ts`: Utilidad pura de toasts de archivado con soporte de `[Deshacer]`.
- [ ] `tests/archiveToasts.test.tsx`: Tests unitarios para comprobar la invocación del toast de archivado y la acción `Deshacer`.
- [ ] `src/pages/dashboard/IncidentsView.tsx`: Integración de toast con botón `Deshacer`.
- [ ] `src/pages/dashboard/incidents/components/IncidentDetailSheet.tsx`: Integración de toast con botón `Deshacer`.
- [ ] `src/pages/dashboard/requests/components/RequestDetailSheet.tsx`: Integración de toast con botón `Deshacer`.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? `src/lib/archiveToasts.ts` no importa React ni Convex (cumple con `tests/arquitectura.test.ts`).
- [x] ¿Modifica estados o transiciones de dominio? No.
- [x] ¿Introduce términos prohibidos en el vocabulario ubicuo? No.
- [x] ¿Seguridad en Convex? No altera endpoints de Convex ni esquemas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `src/lib/archiveToasts.ts` (toast con botón Deshacer y confirmación).
- [x] **Paso 2:** Crear tests en `tests/archiveToasts.test.tsx` (2/2 tests pasados).
- [x] **Paso 3:** Integrar en `IncidentsView.tsx`, `IncidentDetailSheet.tsx` y `RequestDetailSheet.tsx`.
- [x] **Paso 4:** Validar con `npx tsc --noEmit` y suite de tests vitest (31 tests en verde).
- [x] **Paso 5:** Validar arquitectura (`tests/arquitectura.test.ts`) y seguridad (`tests/seguridad.test.ts`).
- [x] **Paso 6:** Handover y registro de sesión.






