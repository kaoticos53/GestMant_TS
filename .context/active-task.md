# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-BULK-ARCHIVE-CARD`
- **Objetivo:** Fase 1 - Crear `types.ts`, `helpers.ts` y suite de pruebas unitarias `tests/bulkArchiveCardHelpers.test.ts` para `BulkArchiveCard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/archive/components/bulkArchive/types.ts`
  - `src/pages/dashboard/archive/components/bulkArchive/helpers.ts`
  - `tests/bulkArchiveCardHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `bulkArchive/types.ts`: contratos de tipos para target de archivado y props de subcomponentes.
- [x] `bulkArchive/helpers.ts`: funciones puras de formato de resumen de corte, etiquetas y confirmación.
- [x] `tests/bulkArchiveCardHelpers.test.ts`: suite de 7 pruebas unitarias para helpers.
- [ ] `bulkArchive/components/BulkArchiveHeader.tsx`: pendiente Fase 2.
- [ ] `bulkArchive/components/BulkArchiveActions.tsx`: pendiente Fase 2.
- [ ] `bulkArchive/components/BulkArchiveConfirmDialog.tsx`: pendiente Fase 2.
- [ ] `bulkArchive/index.ts`: pendiente Fase 2.
- [ ] `archive/components/BulkArchiveCard.tsx`: pendiente Fase 3.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? 7 tests de helpers y arquitectura aprobados.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada - Commit atómico 1 listo.

