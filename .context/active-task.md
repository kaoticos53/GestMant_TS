# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-INCIDENT-HOOKS`
- **Objetivo:** Fase 1 - Extracción de Custom Hooks de dominio aislado (`useIncidentNotes`, `useIncidentDocuments`, `useIncidentExport`) para `IncidentDetailSheet.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/hooks/useIncidentNotes.ts`
  - `src/pages/dashboard/incidents/hooks/useIncidentDocuments.ts`
  - `src/pages/dashboard/incidents/hooks/useIncidentExport.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/incidents/hooks/useIncidentNotes.ts`: Orquestación de bitácora, versionado y toasts de deshacer.
- [x] `src/pages/dashboard/incidents/hooks/useIncidentDocuments.ts`: Orquestación de expediente documental, compresión y upload.
- [x] `src/pages/dashboard/incidents/hooks/useIncidentExport.ts`: Orquestación de reportes (Markdown, PDF, ZIP).
- [x] `src/pages/dashboard/incidents/components/detail/IncidentHeader.tsx`: Cabecera fija y metadatos de la incidencia.
- [x] `src/pages/dashboard/incidents/components/detail/IncidentEquipmentCard.tsx`: Datos del equipo, notificación, asignación y SAT externo.
- [x] `src/pages/dashboard/incidents/components/detail/IncidentPartRequestsCard.tsx`: Peticiones de material vinculadas y estado de líneas.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Seguridad / Arquitectura? Preservadas (18/18 tests pasados).

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `useIncidentNotes.ts`.
- [x] **Paso 2:** Crear `useIncidentDocuments.ts`.
- [x] **Paso 3:** Crear `useIncidentExport.ts`.
- [x] **Paso 4:** Crear `IncidentHeader.tsx`, `IncidentEquipmentCard.tsx` e `IncidentPartRequestsCard.tsx`.
- [x] **Paso 5:** Validar con `npx tsc --noEmit` y suite de tests.
- [x] **Paso 6:** Commit atómico de la Fase 2.


