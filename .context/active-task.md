# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-STORAGE-CLEANUP-CARD`
- **Objetivo:** Fase 1 - Crear `types.ts`, `helpers.ts` y suite de tests unitarios `tests/storageCleanupCardHelpers.test.ts` para `StorageCleanupCard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/storageCleanup/types.ts`
  - `src/pages/dashboard/settings/storageCleanup/helpers.ts`
  - `tests/storageCleanupCardHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `storageCleanup/types.ts`: contratos de tipos para pasadas y componentes.
- [x] `storageCleanup/helpers.ts`: funciones puras de formato de toast, timestamps, detalles y disparador.
- [x] `tests/storageCleanupCardHelpers.test.ts`: suite de 16 pruebas unitarias para helpers.
- [ ] `storageCleanup/useStorageCleanup.ts`: pendiente Fase 2.
- [ ] `storageCleanup/components/StorageCleanupHeader.tsx`: pendiente Fase 2.
- [ ] `storageCleanup/components/StorageCleanupRunsList.tsx`: pendiente Fase 2.
- [ ] `storageCleanup/components/StorageCleanupRunItem.tsx`: pendiente Fase 2.
- [ ] `storageCleanup/index.ts`: pendiente Fase 2.
- [ ] `settings/StorageCleanupCard.tsx`: pendiente Fase 3.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? 16 tests de helpers y arquitectura aprobados.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada - Commit atómico 1 listo.

