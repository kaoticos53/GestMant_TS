# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-ARCHIVE-LIST-SECTION`
- **Objetivo:** Fase 2 - Crear subcomponentes `ArchiveEmptyState`, `ArchiveEntryCard`, `ArchiveDateSection` y barril `list/index.ts`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/archive/components/list/ArchiveEmptyState.tsx`
  - `src/pages/dashboard/archive/components/list/ArchiveEntryCard.tsx`
  - `src/pages/dashboard/archive/components/list/ArchiveDateSection.tsx`
  - `src/pages/dashboard/archive/components/list/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `archive/components/list/types.ts`: contratos de tipos.
- [x] `archive/components/list/helpers.ts`: funciones puras de textos y permisos.
- [x] `tests/archiveListHelpers.test.ts`: suite de pruebas unitarias para helpers.
- [x] `archive/components/list/ArchiveEmptyState.tsx`: empty state contextual con botón de reseteo.
- [x] `archive/components/list/ArchiveEntryCard.tsx`: tarjeta individual de elemento archivado.
- [x] `archive/components/list/ArchiveDateSection.tsx`: sección agrupada cronológicamente con sticky header.
- [x] `archive/components/list/index.ts`: barril unificado.
- [ ] `archive/components/ArchiveListSection.tsx`: pendiente Fase 3.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 2.
