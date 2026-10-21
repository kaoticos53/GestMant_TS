# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-ARCHIVE-LIST-DETAIL-HOST`
- **Objetivo:** Fase 3 - Extracción de componentes de listado (`ArchiveListSection`) y host de hojas (`ArchiveDetailHost`) para `ArchiveView.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/archive/components/ArchiveListSection.tsx`
  - `src/pages/dashboard/archive/components/ArchiveDetailHost.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/archive/types.ts`: Tipos comunes del módulo de archivo.
- [x] `src/pages/dashboard/archive/helpers/archiveMappers.ts`: Mappers puros testeables para incidencias y peticiones.
- [x] `src/pages/dashboard/archive/hooks/useArchiveEntries.ts`: Pipeline memoizado de unificación, búsqueda, conteos y ordenación.
- [x] `src/pages/dashboard/archive/hooks/useBulkArchive.ts`: Orquestación de corte temporal y archivado masivo.
- [x] `src/pages/dashboard/archive/hooks/useTrashOperations.ts`: Orquestación de recuperaciones y borrados definitivos en papelera.
- [x] `tests/archiveMappers.test.ts`: Pruebas unitarias de los mappers y extracción de campos de búsqueda.
- [x] `src/pages/dashboard/archive/components/BulkArchiveCard.tsx`: Tarjeta de corte manual masivo y diálogo de confirmación.
- [x] `src/pages/dashboard/archive/components/ArchiveFilterTabs.tsx`: Pestañas accesibles Todo / Incidencias / Peticiones.
- [x] `src/pages/dashboard/archive/components/ArchiveTrashSection.tsx`: Sección de papelera con grupos, botones y diálogo de purga definitiva.
- [x] `src/pages/dashboard/archive/components/ArchiveListSection.tsx`: Presentación de listado paginado y agrupado por meses.
- [x] `src/pages/dashboard/archive/components/ArchiveDetailHost.tsx`: Montaje desacoplado de hojas de detalle de incidencia y petición.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Seguridad / Arquitectura? Preservadas (21/21 tests pasados).

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `ArchiveListSection.tsx`.
- [x] **Paso 2:** Crear `ArchiveDetailHost.tsx`.
- [x] **Paso 3:** Validar con `npx tsc --noEmit` y suite de tests.
- [x] **Paso 4:** Commit atómico de la Fase 3.
