# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `FASE3-OPTIMISTIC-LOCKING`
- **Objetivo:** Implementar control de concurrencia optimista (*Optimistic Locking*) en mutaciones críticas de incidencias para prevenir sobreescrituras accidentales entre operarios en planta cuando editan una misma incidencia simultáneamente.
- **Módulo(s) Afectado(s):** Backend Convex (`src/convex/_incidents/helpers.ts`, `src/convex/incidents.ts`, `src/convex/_incidents/notes.ts`), Frontend (`IncidentDetailSheet.tsx`, `CorrectEquipmentDialog.tsx`), Tests (`tests/incidentConcurrency.test.ts`).

---

## 2. Archivos a Modificar / Crear
- [x] `src/convex/_incidents/helpers.ts`: Función `assertIncidentNotModified(incident, expectedUpdatedAt)`.
- [x] `src/convex/incidents.ts`: Validación en mutaciones `assign`, `selfAssign`, `verify`, `assignWorkshop`, `close`, `updateEquipment`.
- [x] `src/convex/_incidents/notes.ts`: Validación en mutaciones `addNote` y `updateNote`.
- [x] `tests/incidentConcurrency.test.ts`: Suite de tests unitarios verificando éxito con versión vigente y bloqueo con CONFLICT ante desactualización.
- [x] `src/pages/dashboard/incidents/components/IncidentDetailSheet.tsx`: Envío de `expectedUpdatedAt` en llamadas reactivas.
- [x] `src/pages/dashboard/incidents/dialogs/CorrectEquipmentDialog.tsx`: Envío de `expectedUpdatedAt` al corregir modelo/serie.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿Modifica estados o transiciones de dominio? No.
- [x] ¿Introduce términos prohibidos en el vocabulario ubicuo? No.
- [x] ¿Seguridad en Convex? Preservada con comprobación estricta de identidad.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Diseñar validación `assertIncidentNotModified`.
- [x] **Paso 2:** Crear tests de concurrencia en `tests/incidentConcurrency.test.ts` (5/5 tests pasados).
- [x] **Paso 3:** Implementar en `src/convex/incidents.ts` y `_incidents/notes.ts`.
- [x] **Paso 4:** Conectar en interfaz de usuario (`IncidentDetailSheet`, `CorrectEquipmentDialog`).
- [x] **Paso 5:** Validar con `npx tsc --noEmit` y suite de incidencias (`tests/incidents.test.ts`: 112/112 pasados).
- [x] **Paso 6:** Validar arquitectura (`tests/arquitectura.test.ts`) y seguridad (`tests/seguridad.test.ts`).
- [x] **Paso 7:** Handover y registro de sesión.






