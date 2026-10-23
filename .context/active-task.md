# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-ARCHIVE-LIST-SECTION`
- **Objetivo:** Fase 1 - Crear interfaces tipadas en `archive/components/list/types.ts`, helpers puros en `archive/components/list/helpers.ts` y tests unitarios en `tests/archiveListHelpers.test.ts`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/archive/components/list/types.ts`
  - `src/pages/dashboard/archive/components/list/helpers.ts`
  - `tests/archiveListHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `archive/components/list/types.ts`: contratos de props para componentes de listado del archivo.
- [x] `archive/components/list/helpers.ts`: funciones puras `getEmptyStateTitle`, `getEmptyStateDescription` y `canRestoreEntry`.
- [x] `tests/archiveListHelpers.test.ts`: suite de pruebas unitarias para helpers del listado de archivo.
- [ ] `archive/components/list/ArchiveEmptyState.tsx`: pendiente Fase 2.
- [ ] `archive/components/list/ArchiveEntryCard.tsx`: pendiente Fase 2.
- [ ] `archive/components/list/ArchiveDateSection.tsx`: pendiente Fase 2.
- [ ] `archive/components/list/index.ts`: pendiente Fase 2.
- [ ] `archive/components/ArchiveListSection.tsx`: pendiente Fase 3.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 1.
