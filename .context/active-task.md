# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-REQUEST-DETAIL-LINES-FOOTER`
- **Objetivo:** Fase 3 - Extracción de componentes de líneas de repuesto (`RequestLinesCard`) y footer de acciones (`RequestActionsFooter`) para `RequestDetailSheet.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/components/detail/RequestLinesCard.tsx`
  - `src/pages/dashboard/requests/components/detail/RequestActionsFooter.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/requests/hooks/useRequestLifecycle.ts`: Orquestación de mutaciones archive/withdraw, toasts de deshacer y modal de papelera.
- [x] `src/pages/dashboard/requests/hooks/useRequestLinesStock.ts`: Indexación O(1) memoizada del catálogo, entregas acumuladas y control de stock.
- [x] `tests/requestLinesStock.test.ts`: Pruebas unitarias para enriquecimiento de líneas y control de stock.
- [x] `src/pages/dashboard/requests/components/detail/RequestHeader.tsx`: Cabecera sticky con badges semánticos.
- [x] `src/pages/dashboard/requests/components/detail/RequestInfoCard.tsx`: Metadatos del solicitante, equipo y fechas.
- [x] `src/pages/dashboard/requests/components/detail/RequestAttachmentsCard.tsx`: Fotos con AttachmentGroup y lista de documentos.
- [x] `src/pages/dashboard/requests/components/detail/RequestLinesCard.tsx`: Lista de repuestos con comprobación de stock y estado vacío.
- [x] `src/pages/dashboard/requests/components/detail/RequestActionsFooter.tsx`: Botonera sticky con 9 acciones condicionales y modal de retirada.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Seguridad / Arquitectura? Preservadas (21/21 tests pasados).

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `RequestLinesCard.tsx`.
- [x] **Paso 2:** Crear `RequestActionsFooter.tsx`.
- [x] **Paso 3:** Validar con `npx tsc --noEmit` y suite de tests.
- [x] **Paso 4:** Commit atómico de la Fase 3.
