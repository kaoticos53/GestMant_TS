# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-ARCHIVE-LIST-SECTION`
- **Objetivo:** Fase 4 - Validación completa (2.467 tests de Vitest pasados, build de producción exitoso) y cierre de la refactorización modular de `ArchiveListSection.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/archive/components/ArchiveListSection.tsx`
  - `src/pages/dashboard/archive/components/list/`

---

## 2. Archivos Modificados / Creados
- [x] `archive/components/list/types.ts`: contratos de tipos.
- [x] `archive/components/list/helpers.ts`: funciones puras de textos y permisos (`getEmptyStateTitle`, `getEmptyStateDescription`, `canRestoreEntry`).
- [x] `tests/archiveListHelpers.test.ts`: suite de pruebas unitarias para helpers (8 tests pasados).
- [x] `archive/components/list/ArchiveEmptyState.tsx`: empty state contextual con botón de reseteo.
- [x] `archive/components/list/ArchiveEntryCard.tsx`: tarjeta individual de elemento archivado.
- [x] `archive/components/list/ArchiveDateSection.tsx`: sección agrupada cronológicamente con sticky header.
- [x] `archive/components/list/index.ts`: barril unificado.
- [x] `archive/components/ArchiveListSection.tsx`: orquestación de alto nivel reducida de 205 a 85 líneas.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`. `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 2.467 tests pasados en Vitest.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** Completada y validada con éxito.
