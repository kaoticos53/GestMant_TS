# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-NEW-REQUEST-DIALOG`
- **Objetivo:** Fase 2 - Modularización de subcomponentes visuales (`RequestEquipmentSection`, `RequestAttachmentsSection`, `RequestPartsSection`).
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/dialogs/components/RequestEquipmentSection.tsx`
  - `src/pages/dashboard/requests/dialogs/components/RequestAttachmentsSection.tsx`
  - `src/pages/dashboard/requests/dialogs/components/RequestPartsSection.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/requests/hooks/useRequestAttachments.ts`: Hook para subida de ficheros, compresión y revocación determinista de blobs.
- [x] `src/pages/dashboard/requests/hooks/useRequestPartsSelection.ts`: Hook para compatibilidad de catálogo, memoización de repuestos y manipulación de líneas.
- [x] `src/pages/dashboard/requests/hooks/useNewRequestForm.ts`: Hook para control de estado del formulario, validaciones puras y creación de petición.
- [x] `tests/newRequestLogic.test.ts`: Pruebas unitarias de compatibilidad, validación de inputs y cálculo de líneas (17 tests).
- [x] `src/pages/dashboard/requests/dialogs/components/RequestEquipmentSection.tsx`: Selector accesible de inventario con opción manual y etiquetas aria.
- [x] `src/pages/dashboard/requests/dialogs/components/RequestAttachmentsSection.tsx`: Subida, previews, spinners de progreso y borrado accesible de ficheros.
- [x] `src/pages/dashboard/requests/dialogs/components/RequestPartsSection.tsx`: Filtrado de compatibilidad, dropdown de catálogo y filas de repuesto con inputs numéricos.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Implementar `RequestEquipmentSection.tsx`.
- [x] **Paso 2:** Implementar `RequestAttachmentsSection.tsx`.
- [x] **Paso 3:** Implementar `RequestPartsSection.tsx`.
- [x] **Paso 4:** Verificar tipos con `npx tsc -b`.
- [x] **Paso 5:** Ejecutar tests con `npx vitest run tests/newRequestLogic.test.ts tests/requestsViewFlow.test.tsx`.
- [x] **Paso 6:** Commit atómico de Fase 2.
