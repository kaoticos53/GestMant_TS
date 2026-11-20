# Auditoría Exhaustiva de UI/UX y Arquitectura Frontend

**Proyecto:** Pulso Taller (`GestMant_TS`)  
**Fecha:** 2026-11-20  
**Tipo:** Auditoría de solo lectura (sin alteración de código fuente)

---

## 1. Consistencia Visual y Sistema de Diseño

### [CRÍTICO] Colores semánticos hardcodeados sin variante `dark:` (pérdida de contraste en modo oscuro)
- **Archivos afectados:**
  - [src/lib/workshop.ts](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/lib/workshop.ts#L83-L260)
  - [src/lib/purchasing.ts](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/lib/purchasing.ts#L35-L68)
  - [src/lib/roles.ts](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/lib/roles.ts#L57)
  - [src/components/AttachmentGroup.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/components/AttachmentGroup.tsx#L95-L112)
  - [src/components/DocumentLink.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/components/DocumentLink.tsx#L104-L135)
  - [src/components/PrintLabelDialog.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/components/PrintLabelDialog.tsx#L178)
  - [src/pages/dashboard/lookup/components/TrackingPendingParts.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/pages/dashboard/lookup/components/TrackingPendingParts.tsx#L20-L43)
  - [src/pages/dashboard/requests/components/detail/RequestLinesCard.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/pages/dashboard/requests/components/detail/RequestLinesCard.tsx#L45-L49)
- **Diagnóstico:** Existen 98 líneas en 46 archivos con clases de paleta fija (`text-amber-700`, `text-amber-800`, `text-emerald-700`, `bg-amber-50`) sin par `dark:*`. En `.dark` (`--card: oklch(0.195 0.015 250)` en [src/index.css](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/index.css#L92)), los tonos oscuros de texto degradan el contraste por debajo de WCAG AA.
- **Recomendación:** Introducir tokens semánticos en `src/index.css` (`--status-warning`, `--status-success`, `--status-info` y sus pares `-foreground` / `-surface`) y migrar badges y avisos a esos tokens o a pares `dark:*` consistentes.

### [MEDIO] Controles `<select>` e `<input>` nativos divergentes del sistema de diseño
- **Archivos afectados:**
  - [src/pages/dashboard/purchasing/components/history/HistoryToolbar.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/pages/dashboard/purchasing/components/history/HistoryToolbar.tsx#L69-L77)
  - [src/pages/dashboard/purchasing/components/history/drawer/HistoryDateFilters.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/pages/dashboard/purchasing/components/history/drawer/HistoryDateFilters.tsx#L30-L33)
  - [src/pages/dashboard/purchasing/components/history/drawer/HistoryFieldFilters.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/pages/dashboard/purchasing/components/history/drawer/HistoryFieldFilters.tsx#L67-L70)
  - [src/components/barcode/ScannerManualFallback.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/components/barcode/ScannerManualFallback.tsx#L21-L27)
  - [src/pages/dashboard/search/components/SearchInput.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/pages/dashboard/search/components/SearchInput.tsx#L25-L35)
- **Diagnóstico:** Se emplean `<select>` e `<input>` HTML nativos con estilos locales (`h-8`, `h-9`, `focus:ring-primary`) en lugar de los primitivos `Select` e `Input` de `src/components/ui/`.
- **Recomendación:** Migrar los selectores e inputs divergentes a los componentes base del sistema de diseño.

### [MEDIO] Duplicación de barras de herramientas (`QueueToolbar` vs `DataTableToolbar`)
- **Archivos afectados:**
  - [src/pages/dashboard/QueueToolbar.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/pages/dashboard/QueueToolbar.tsx)
  - [src/components/DataTableToolbar.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/components/DataTableToolbar.tsx)
- **Diagnóstico:** Coexisten dos barras de control paralelas para búsqueda, limpieza, ordenación y densidad (`compact`), lo que introduce pequeñas diferencias visuales y de comportamiento.
- **Recomendación:** Hacer que `QueueToolbar` reutilice `DataTableToolbarSearch` y `DataTableToolbarDensity` o se construya sobre `DataTableToolbar`.

---

## 2. Ergonomía, Usabilidad y Flujo de Usuario (UX)

### [MEDIO] Estados de carga heterogéneos (texto plano frente a `Skeleton`)
- **Archivos afectados:**
  - [src/pages/dashboard/AnalyticsView.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/pages/dashboard/AnalyticsView.tsx#L24-L28)
  - [src/pages/dashboard/inventory/components/PartDetailSheet.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/pages/dashboard/inventory/components/PartDetailSheet.tsx#L186-L190)
  - [src/pages/dashboard/users/components/UserDetailSheet.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/pages/dashboard/users/components/UserDetailSheet.tsx#L129-L133)
- **Diagnóstico:** Mientras vistas como `AuditView`, `ProfileView` y `DashboardStats` usan `<Skeleton />` que respetan la geometría final, `AnalyticsView` y las cargas secundarias de los `Sheet` nuevos muestran texto plano (`Cargando...`), provocando saltos de layout.
- **Recomendación:** Incorporar `AnalyticsSkeleton` y skeletons ligeros dentro de `PartDetailSheet` y `UserDetailSheet`.

### [MEDIO] Fricción en navegación cruzada desde `PartDetailSheet`
- **Archivos afectados:**
  - [src/pages/dashboard/inventory/components/PartDetailSheet.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/pages/dashboard/inventory/components/PartDetailSheet.tsx#L163-L176)
- **Diagnóstico:** Los modelos compatibles se muestran como badges estáticos sin permitir navegar al módulo de Equipos filtrado por ese modelo.
- **Recomendación:** Convertir los badges de modelos compatibles en botones de salto rápido hacia Equipos.

### [MENOR / PULIDO] Estandarización de estructura interna en `Sheet` de detalle
- **Archivos afectados:** `IncidentDetailSheet`, `RequestDetailSheet`, `EquipmentDetailSheet`, `PartDetailSheet`, `UserDetailSheet`.
- **Diagnóstico:** Cada panel lateral define su propia distribución de cabecera, barra de acciones y scroll.
- **Recomendación:** Unificar mediante un patrón común (`SheetHeader + ActionRow + ScrollBody`).

---

## 3. Accesibilidad (a11y) y Diseño Responsivo

### [CRÍTICO] Supresión de `outline-none` sin indicador de foco visible consistente
- **Archivos afectados:**
  - [src/pages/dashboard/components/sidebar/SidebarResizeHandle.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/pages/dashboard/components/sidebar/SidebarResizeHandle.tsx#L21)
  - [src/components/ai/WorkshopAiChatButton.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/components/ai/WorkshopAiChatButton.tsx#L202)
  - [src/components/barcode/ScannerManualFallback.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/components/barcode/ScannerManualFallback.tsx#L27)
  - [src/pages/dashboard/search/components/SearchInput.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/pages/dashboard/search/components/SearchInput.tsx#L35)
- **Diagnóstico:** `SidebarResizeHandle` suprime el outline en foco por teclado sin sustituirlo por `focus-visible:ring-2 focus-visible:ring-ring`, y los inputs manuales usan combinaciones heterogéneas de foco.
- **Recomendación:** Garantizar `focus-visible:ring-2 focus-visible:ring-ring` en todo elemento enfocable por teclado.

### [MEDIO] Anchos fijos en selects y contenedores en viewports estrechos
- **Archivos afectados:**
  - [src/pages/dashboard/audit/components/SecurityAuditPanel.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/pages/dashboard/audit/components/SecurityAuditPanel.tsx#L77) (`w-[220px]`)
  - [src/pages/dashboard/users/components/UserTableRow.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/pages/dashboard/users/components/UserTableRow.tsx#L90) (`w-32`)
- **Diagnóstico:** En móviles (< 380px), los anchos fijos pueden causar desbordamientos o compresión excesiva de filas.
- **Recomendación:** Usar clases responsivas (`w-full sm:w-[220px]`).

### [MENOR / PULIDO] Regiones `aria-live="polite"` en contadores de resultados
- **Archivos afectados:** [DataTableToolbar.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/components/DataTableToolbar.tsx), [TablePagination.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/components/TablePagination.tsx).
- **Diagnóstico:** Al filtrar tablas, los lectores de pantalla no anuncian dinámicamente el recuento actualizado.
- **Recomendación:** Añadir `aria-live="polite"` al resumen de paginación/resultados.

---

## 4. Deuda Técnica en UI

### [MEDIO] Componentes monolíticos (> 250 líneas)
- **Archivos afectados:**
  - [RichTextEditorCore.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/components/richtext/RichTextEditorCore.tsx) (488 líneas)
  - [WorkshopAiChatButton.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/components/ai/WorkshopAiChatButton.tsx) (451 líneas)
  - [AiSettingsCard.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/pages/dashboard/settings/AiSettingsCard.tsx) (376 líneas)
  - [AiPromptsCard.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/pages/dashboard/settings/AiPromptsCard.tsx) (269 líneas)
  - [PartDetailSheet.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/pages/dashboard/inventory/components/PartDetailSheet.tsx) (256 líneas)
  - [LabelReviewDialog.tsx](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/src/components/ai/LabelReviewDialog.tsx) (255 líneas)
- **Recomendación:** Extraer hooks de estado y subcomponentes de presentación siguiendo la estructura modular de `equipment/`, `requests/` y `analytics/`.

### [MENOR / PULIDO] Avisos inline duplicados
- **Archivos afectados:** `AttachmentGroup.tsx`, `NotOpenedNotice.tsx`, `DocumentLink.tsx`, `NoFileNotice.tsx`.
- **Recomendación:** Centralizar en un componente `<InlineNotice tone="warning" | "info" | "success" />`.
