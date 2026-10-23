# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-STORAGE-CLEANUP-CARD`
- **Objetivo:** Fase 2 - Crear hook `useStorageCleanup`, subcomponentes UI `StorageCleanupHeader`, `StorageCleanupRunItem`, `StorageCleanupRunsList` y barril `index.ts`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/storageCleanup/useStorageCleanup.ts`
  - `src/pages/dashboard/settings/storageCleanup/components/StorageCleanupHeader.tsx`
  - `src/pages/dashboard/settings/storageCleanup/components/StorageCleanupRunItem.tsx`
  - `src/pages/dashboard/settings/storageCleanup/components/StorageCleanupRunsList.tsx`
  - `src/pages/dashboard/settings/storageCleanup/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `storageCleanup/types.ts`: contratos de tipos para pasadas y componentes.
- [x] `storageCleanup/helpers.ts`: funciones puras de formato de toast, timestamps, detalles y disparador.
- [x] `tests/storageCleanupCardHelpers.test.ts`: suite de 16 pruebas unitarias para helpers.
- [x] `storageCleanup/useStorageCleanup.ts`: hook de consulta y ejecución.
- [x] `storageCleanup/components/StorageCleanupHeader.tsx`: cabecera con botón de ejecución.
- [x] `storageCleanup/components/StorageCleanupRunItem.tsx`: fila de pasada con formato limpio.
- [x] `storageCleanup/components/StorageCleanupRunsList.tsx`: lista de pasadas con soporte de Skeleton.
- [x] `storageCleanup/index.ts`: barril unificado.
- [ ] `settings/StorageCleanupCard.tsx`: pendiente Fase 3.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada - Commit atómico 2 listo.



