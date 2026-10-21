# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-ARCHIVE-TYPES-HOOKS`
- **Objetivo:** Fase 1 - Extracción de tipos, mappers puros y custom hooks de dominio (`useArchiveEntries`, `useBulkArchive`, `useTrashOperations`) para la refactorización modular de `ArchiveView.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/archive/types.ts`
  - `src/pages/dashboard/archive/helpers/archiveMappers.ts`
  - `src/pages/dashboard/archive/hooks/useArchiveEntries.ts`
  - `src/pages/dashboard/archive/hooks/useBulkArchive.ts`
  - `src/pages/dashboard/archive/hooks/useTrashOperations.ts`
  - `tests/archiveMappers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/archive/types.ts`: Tipos comunes del módulo de archivo.
- [x] `src/pages/dashboard/archive/helpers/archiveMappers.ts`: Mappers puros testeables para incidencias y peticiones.
- [x] `src/pages/dashboard/archive/hooks/useArchiveEntries.ts`: Pipeline memoizado de unificación, búsqueda, conteos y ordenación.
- [x] `src/pages/dashboard/archive/hooks/useBulkArchive.ts`: Orquestación de corte temporal y archivado masivo.
- [x] `src/pages/dashboard/archive/hooks/useTrashOperations.ts`: Orquestación de recuperaciones y borrados definitivos en papelera.
- [x] `tests/archiveMappers.test.ts`: Pruebas unitarias de los mappers y extracción de campos de búsqueda.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Seguridad / Arquitectura? Preservadas (18/18 tests pasados).

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `types.ts` y `archiveMappers.ts`.
- [x] **Paso 2:** Crear `useArchiveEntries.ts`, `useBulkArchive.ts` y `useTrashOperations.ts`.
- [x] **Paso 3:** Crear test unitario `tests/archiveMappers.test.ts`.
- [x] **Paso 4:** Validar con `npx tsc --noEmit` y `npx vitest run tests/archiveMappers.test.ts`.
- [x] **Paso 5:** Commit atómico de la Fase 1.
