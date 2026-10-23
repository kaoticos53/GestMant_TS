# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-STORAGE-CLEANUP-CARD`
- **Objetivo:** Fase 3 - Orquestar `StorageCleanupCard.tsx` delegando en `useStorageCleanup`, `StorageCleanupHeader` y `StorageCleanupRunsList`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/StorageCleanupCard.tsx`

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
- [x] `settings/StorageCleanupCard.tsx`: orquestador modular completado (~25 líneas).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** Tarea completada con éxito. 4 commits atómicos realizados.






