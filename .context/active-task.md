# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-NEW-REQUEST-DIALOG`
- **Objetivo:** Fase 1 - Extracción de hooks especializados de dominio (`useRequestAttachments`, `useRequestPartsSelection`, `useNewRequestForm`) y pruebas unitarias puras (`tests/newRequestLogic.test.ts`).
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/hooks/useRequestAttachments.ts`
  - `src/pages/dashboard/requests/hooks/useRequestPartsSelection.ts`
  - `src/pages/dashboard/requests/hooks/useNewRequestForm.ts`
  - `tests/newRequestLogic.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/requests/hooks/useRequestAttachments.ts`: Hook para subida de ficheros, compresión y revocación determinista de blobs.
- [x] `src/pages/dashboard/requests/hooks/useRequestPartsSelection.ts`: Hook para compatibilidad de catálogo, memoización de repuestos y manipulación de líneas.
- [x] `src/pages/dashboard/requests/hooks/useNewRequestForm.ts`: Hook para control de estado del formulario, validaciones puras y creación de petición.
- [x] `tests/newRequestLogic.test.ts`: Pruebas unitarias de compatibilidad, validación de inputs y cálculo de líneas (17 tests).

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Implementar `useRequestAttachments.ts` con limpieza segura de `URL.revokeObjectURL`.
- [x] **Paso 2:** Implementar `useRequestPartsSelection.ts` con memoización y operaciones de líneas.
- [x] **Paso 3:** Implementar `useNewRequestForm.ts` con validación pura y submit.
- [x] **Paso 4:** Crear suite de pruebas `tests/newRequestLogic.test.ts` (17 tests verdes).
- [x] **Paso 5:** Verificar tipos con `npx tsc -b`.
- [x] **Paso 6:** Ejecutar tests unitarios con `npx vitest run tests/newRequestLogic.test.ts`.
- [x] **Paso 7:** Commit atómico de Fase 1.
