# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-BULK-ARCHIVE-CARD`
- **Objetivo:** Fase 2 - Crear subcomponentes `BulkArchiveHeader`, `BulkArchiveActions`, `BulkArchiveConfirmDialog` y barril `index.ts`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/archive/components/bulkArchive/components/BulkArchiveHeader.tsx`
  - `src/pages/dashboard/archive/components/bulkArchive/components/BulkArchiveActions.tsx`
  - `src/pages/dashboard/archive/components/bulkArchive/components/BulkArchiveConfirmDialog.tsx`
  - `src/pages/dashboard/archive/components/bulkArchive/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `bulkArchive/types.ts`: contratos de tipos para target de archivado y props de subcomponentes.
- [x] `bulkArchive/helpers.ts`: funciones puras de formato de resumen de corte, etiquetas y confirmación.
- [x] `tests/bulkArchiveCardHelpers.test.ts`: suite de 7 pruebas unitarias para helpers.
- [x] `bulkArchive/components/BulkArchiveHeader.tsx`: cabecera con selector de corte.
- [x] `bulkArchive/components/BulkArchiveActions.tsx`: botones de acción y ajustes.
- [x] `bulkArchive/components/BulkArchiveConfirmDialog.tsx`: diálogo de confirmación accesible.
- [x] `bulkArchive/index.ts`: barril unificado.
- [ ] `archive/components/BulkArchiveCard.tsx`: pendiente Fase 3.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada - Commit atómico 2 listo.



