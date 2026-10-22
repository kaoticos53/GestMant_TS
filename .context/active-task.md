# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-NEW-REQUEST-DIALOG-CIERRE`
- **Objetivo:** Fase 4 - Validación integral, build de producción y cierre de refactorización arquitectónica de `NewRequestDialog.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/dialogs/NewRequestDialog.tsx`
  - `src/pages/dashboard/requests/hooks/useRequestAttachments.ts`
  - `src/pages/dashboard/requests/hooks/useRequestPartsSelection.ts`
  - `src/pages/dashboard/requests/hooks/useNewRequestForm.ts`
  - `src/pages/dashboard/requests/dialogs/components/RequestEquipmentSection.tsx`
  - `src/pages/dashboard/requests/dialogs/components/RequestAttachmentsSection.tsx`
  - `src/pages/dashboard/requests/dialogs/components/RequestPartsSection.tsx`
  - `tests/newRequestLogic.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/requests/hooks/useRequestAttachments.ts`: Hook para subida de ficheros, compresión y revocación determinista de blobs.
- [x] `src/pages/dashboard/requests/hooks/useRequestPartsSelection.ts`: Hook para compatibilidad de catálogo, memoización de repuestos y manipulación de líneas.
- [x] `src/pages/dashboard/requests/hooks/useNewRequestForm.ts`: Hook para control de estado del formulario, validaciones puras y creación de petición.
- [x] `tests/newRequestLogic.test.ts`: Pruebas unitarias de compatibilidad, validación de inputs y cálculo de líneas (17 tests).
- [x] `src/pages/dashboard/requests/dialogs/components/RequestEquipmentSection.tsx`: Selector accesible de inventario con opción manual y etiquetas aria.
- [x] `src/pages/dashboard/requests/dialogs/components/RequestAttachmentsSection.tsx`: Subida, previews, spinners de progreso y borrado accesible de ficheros.
- [x] `src/pages/dashboard/requests/dialogs/components/RequestPartsSection.tsx`: Filtrado de compatibilidad, dropdown de catálogo y filas de repuesto con inputs numéricos.
- [x] `src/pages/dashboard/requests/dialogs/NewRequestDialog.tsx`: Orquestador declarativo reducido de 648 a 210 líneas (~68% de reducción).

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas (`tests/arquitectura.test.ts` y `tests/seguridad.test.ts` 100% verdes).
- [x] ¿Build de producción? Verificada con `npm run build` en 5.06s.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Verificación de tipos estricta (`npx tsc -b`).
- [x] **Paso 2:** Verificación de guardrails de arquitectura (`tests/arquitectura.test.ts`).
- [x] **Paso 3:** Verificación de guardrails de seguridad (`tests/seguridad.test.ts`).
- [x] **Paso 4:** Suite completa de tests (`1927 passed`, 0 fallos).
- [x] **Paso 5:** Compilación de producción exitosa (`npm run build`).
- [x] **Paso 6:** Commit atómico de Fase 4 y cierre.
