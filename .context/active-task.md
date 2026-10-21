# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-REQUEST-DETAIL-PRESENTATION`
- **Objetivo:** Fase 2 - Extracción de componentes de presentación (`RequestHeader`, `RequestInfoCard`, `RequestAttachmentsCard`) para `RequestDetailSheet.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/components/detail/RequestHeader.tsx`
  - `src/pages/dashboard/requests/components/detail/RequestInfoCard.tsx`
  - `src/pages/dashboard/requests/components/detail/RequestAttachmentsCard.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/requests/hooks/useRequestLifecycle.ts`: Orquestación de mutaciones archive/withdraw, toasts de deshacer y modal de papelera.
- [x] `src/pages/dashboard/requests/hooks/useRequestLinesStock.ts`: Indexación O(1) memoizada del catálogo, entregas acumuladas y control de stock.
- [x] `tests/requestLinesStock.test.ts`: Pruebas unitarias para enriquecimiento de líneas y control de stock.
- [x] `src/pages/dashboard/requests/components/detail/RequestHeader.tsx`: Cabecera sticky con badges semánticos.
- [x] `src/pages/dashboard/requests/components/detail/RequestInfoCard.tsx`: Metadatos del solicitante, equipo y fechas.
- [x] `src/pages/dashboard/requests/components/detail/RequestAttachmentsCard.tsx`: Fotos con AttachmentGroup y lista de documentos.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Seguridad / Arquitectura? Preservadas (21/21 tests pasados).

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `RequestHeader.tsx`.
- [x] **Paso 2:** Crear `RequestInfoCard.tsx`.
- [x] **Paso 3:** Crear `RequestAttachmentsCard.tsx`.
- [x] **Paso 4:** Validar con `npx tsc --noEmit` y suite de tests.
- [x] **Paso 5:** Commit atómico de la Fase 2.
