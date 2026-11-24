# SPEC-0015 — Interfaz del Dashboard y Componentes Transversales

- **ID:** `SPEC-0015`
- **Título:** Shell del dashboard, navegación, búsqueda global, editor rico, tablas, densidad y soporte móvil
- **Estado:** Implementada
- **Fecha:** 2026-11-20
- **Fuentes clave:** `src/pages/Dashboard.tsx`, `src/pages/dashboard/components/DashboardSidebar.tsx`, `src/pages/dashboard/components/DashboardHeader.tsx`, `src/pages/dashboard/components/GlobalSearch.tsx`, `src/components/RichTextEditor.tsx`, `src/components/DataTableToolbar.tsx`, `src/components/TablePagination.tsx`, `src/components/TableSort.tsx`, `src/components/ListArea.tsx`, `src/components/SignaturePad.tsx`, `src/components/BarcodeScannerModal.tsx`, `src/hooks/use-mobile.ts`, `src/lib/density.ts`, `src/lib/sidebar.ts`

---

## 1. Contexto y Objetivos

Define la experiencia de usuario común de Pulso Taller: navegación lateral plegable y adaptativa, búsqueda global transversal, editor de texto enriquecido, tablas ordenables/paginadas con densidad configurable, firma manuscrita, lector de códigos de barras y comportamiento responsive móvil/escritorio.

---

## 2. Modelo de UI y Navegación

- **Pestañas del panel (`NavId`):** `summary`, `incidents`, `requests`, `purchasing`, `equipment`, `inventory`, `manuals`, `archive`, `users`, `audit`, `settings`, `profile` (filtradas dinámicamente por `AbilityProvider` y `navConfig`).
- **Layout:** barra lateral fija a la izquierda (`DashboardSidebar` + `SidebarHeader` con `NotificationBell`, `MessagesCenter` y `WorkshopAiChatButton`), barra superior en móvil o cuando el menú lateral está plegado (`DashboardHeader`), y área de contenido protegida por `ModuleErrorBoundary`.

---

## 3. Requisitos Funcionales

- **RF-001 (Navegación y badges):** Muestra contadores vivos por módulo (incidencias abiertas, peticiones pendientes, compras sin tratar, stock bajo) y permite reordenar secciones del menú (`saveSidebarLayout`).
- **RF-002 (Búsqueda global `GlobalSearch`):** Busca de forma unificada en incidencias, equipos, repuestos, peticiones y manuales respetando permisos de lectura.
- **RF-003 (Tablas, paginación y densidad):** `DataTableToolbar`, `TablePagination`, `TableSort` y `ListArea` estandarizan ordenación persistente, paginación y densidad cómoda/compacta (`density.ts`).
- **RF-004 (Editor rico `RichTextEditor`):** Basado en TipTap (`src/lib/richDoc`), soporta formato, listas, imágenes y diff visual (`richDocDiff.ts`), serializado sin HTML peligroso.
- **RF-005 (Firma y escáner):** `SignaturePad` captura firma en partes de trabajo; `BarcodeScannerModal` escanea códigos desde cámara con fallback manual.

---

## 4. Reglas de Negocio e Invariantes

- **RN-001:** Ninguna vista `*View.tsx` puede renderizar listas largas sin paginación o virtualización (`tests/longLists.test.ts`).
- **RN-002:** `useIsMobile()` (`< 768px`) gobierna las adaptaciones móviles, incluyendo el escáner de etiquetas IA (`LabelInlineBanner` vs `LabelReviewDialog`) y la cabecera móvil.

---

## 5. Permisos y Seguridad

- Cada entrada del menú lateral y resultado de `GlobalSearch` se filtra por las capacidades CASL reales del usuario.

---

## 6. Requisitos No Funcionales

- **RNF-001:** Code-splitting por ruta (`React.lazy` en `src/main.tsx`) y límites de error aislados por módulo (`ModuleErrorBoundary`).
- **RNF-002:** El filtrado de colas (`useIncidentFilters`) memoiza los campos buscables y calcula los conteos por estado en una sola pasada $O(n)$; `usePersistentDraft` lee `localStorage` una sola vez al montar.

---

## 7. Criterios de Aceptación (Gherkin)

- **CA-001 — Menú adaptado a permisos**
  - **Dado** un usuario sin capacidad `viewPurchasing` ni `manageUsers`
  - **Cuando** abre `/dashboard`
  - **Entonces** las pestañas de Compras y Usuarios no aparecen en `DashboardSidebar`

---

## 8. Trazabilidad RF → CA → Tests

| Requisito | Criterio | Cobertura automatizada |
|---|---|---|
| RF-001, CA-001 | Navegación, sidebar y router | `tests/dashboardNavigation.test.tsx`, `tests/dashboardSidebarHelpers.test.ts`, `tests/dashboardTabRouterRules.test.ts`, `tests/navConfig.test.ts`, `tests/sidebar.test.ts` |
| RF-002 | Búsqueda global | `tests/globalSearch.test.tsx`, `tests/globalSearchHelpers.test.ts` |
| RF-003, RN-001 | Tablas, ordenación, densidad | `tests/dataTableToolbar.test.tsx`, `tests/tablePagination.test.tsx`, `tests/tableSort.test.ts`, `tests/density.test.ts`, `tests/longLists.test.ts` |
| RF-004, RF-005 | Editor rico, firma, escáner | `tests/richDoc.test.ts`, `tests/richTextEditorExpand.test.tsx`, `tests/signaturePad.test.tsx`, `tests/barcodeScanner.test.tsx` |

---

## 9. Preguntas Abiertas / Deuda Técnica

- Ninguna abierta en este módulo.
