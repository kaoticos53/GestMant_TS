# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-BULK-ARCHIVE-CARD`
- **Objetivo:** Fase 3 - Orquestar `BulkArchiveCard.tsx` delegando en `BulkArchiveHeader`, `BulkArchiveActions`, `BulkArchiveConfirmDialog` y `formatPendingDetail`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/archive/components/BulkArchiveCard.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `bulkArchive/types.ts`: contratos de tipos para target de archivado y props de subcomponentes.
- [x] `bulkArchive/helpers.ts`: funciones puras de formato de resumen de corte, etiquetas y confirmación.
- [x] `tests/bulkArchiveCardHelpers.test.ts`: suite de 7 pruebas unitarias para helpers.
- [x] `bulkArchive/components/BulkArchiveHeader.tsx`: cabecera con selector de corte.
- [x] `bulkArchive/components/BulkArchiveActions.tsx`: botones de acción y ajustes.
- [x] `bulkArchive/components/BulkArchiveConfirmDialog.tsx`: diálogo de confirmación accesible.
- [x] `bulkArchive/index.ts`: barril unificado.
- [x] `archive/components/BulkArchiveCard.tsx`: orquestador modular completado (~60 líneas).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada - Commit atómico 3 listo.





