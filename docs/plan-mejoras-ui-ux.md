# Plan Detallado de Implementación: Mejoras UI/UX y Consistencia Frontend

**Base:** [auditoria-ui-ux.md](file:///e:/Users/kaoti/Documentos/GitHub/repuestos-taller-web/docs/auditoria-ui-ux.md)  
**Garantía:** Ninguna fase eliminará funcionalidades, capacidades CASL, mutaciones Convex, atajos ni eventos existentes.

---

## Fase 1 — Fundamentos, Tokens Semánticos y Modo Oscuro

### Objetivos
1. Eliminar los problemas de contraste en modo oscuro de badges y avisos semánticos.
2. Centralizar los avisos repetidos en un componente único.

### Tareas técnicas
1. **Tokens semánticos en `src/index.css`:**
   - Añadir en `:root` y `.dark` variables `--status-warning`, `--status-warning-foreground`, `--status-warning-surface`, `--status-success`, `--status-success-foreground`, `--status-success-surface`.
2. **Actualización de mapas de estado (`src/lib/`):**
   - Actualizar `badgeClassName` en `src/lib/workshop.ts`, `src/lib/purchasing.ts` y `src/lib/roles.ts` para incluir pares `dark:*` o clases basadas en tokens semánticos con contraste ≥ 4.5:1.
3. **Componente `<InlineNotice />` (`src/components/InlineNotice.tsx`):**
   - Soportar variantes `warning`, `success`, `info`, `destructive` con soporte completo claro/oscuro.
   - Reemplazar los bloques duplicados en `AttachmentGroup.tsx`, `NotOpenedNotice.tsx`, `NoFileNotice.tsx`, `DocumentLink.tsx`, `TrackingPendingParts.tsx` y `RequestLinesCard.tsx`.

### Criterios de verificación
- `npx tsc --noEmit` y `npm run lint` sin errores.
- Tests de `workshop`, `purchasing`, `roles`, `attachmentGroup`, `documentLink` y `arquitectura.test.ts` en verde.
- Comprobación visual de contraste en tema claro y oscuro.

---

## Fase 2 — Estandarización de Componentes Base y Controles de Formulario

### Objetivos
1. Unificar todos los inputs y selectores con los primitivos de `src/components/ui/`.
2. Eliminar saltos de layout en estados de carga.

### Tareas técnicas
1. **Migración de controles HTML nativos:**
   - Reemplazar `<select>` por `Select` (`@/components/ui/select`) en `HistoryToolbar.tsx`, `HistoryDateFilters.tsx` y `HistoryFieldFilters.tsx`.
   - Reemplazar `<input>` por `Input` (`@/components/ui/input`) en `ScannerManualFallback.tsx` y alinear `SearchInput.tsx`.
2. **Alineación de `QueueToolbar` y `DataTableToolbar`:**
   - Reutilizar `DataTableToolbarSearch` y `DataTableToolbarDensity` dentro de `QueueToolbar.tsx` manteniendo exactamente sus props actuales (`QueueToolbar` sigue siendo compatible con `IncidentsView`, `RequestsView` y `ArchiveView`).
3. **Skeletons de carga:**
   - Crear `AnalyticsSkeleton` en `src/pages/dashboard/analytics/AnalyticsSkeleton.tsx` y renderizarlo en `AnalyticsView.tsx` cuando `analytics === undefined`.
   - Sustituir textos `"Cargando..."` en `PartDetailSheet.tsx` y `UserDetailSheet.tsx` por `<Skeleton />` compactos.

### Criterios de verificación
- `npx vitest run tests/purchasingHistoryFilters.test.tsx tests/purchasingHistoryTable.test.tsx tests/dataTableToolbar.test.tsx tests/analyticsView.test.tsx tests/partDetailSheet.test.tsx tests/userDetailSheet.test.tsx`.
- Verificación funcional de filtros, búsqueda y exportación CSV en Historial de Compras.

---

## Fase 3 — Modularización de Deuda Técnica y Flujos Cruzados

### Objetivos
1. Reducir componentes monolíticos (> 250 líneas) a módulos mantenibles y testables.
2. Completar la navegación cruzada entre fichas de Inventario y Equipos.

### Tareas técnicas
1. **Navegación cruzada en `PartDetailSheet.tsx`:**
   - Añadir prop opcional `onSelectModel?: (modelLabel: string) => void` en `PartDetailSheet` e `InventoryView`, conectándola desde `DashboardTabRenderer.tsx` a `handleSearchSelect({ kind: "equipment", term })`.
   - Convertir los badges de modelos compatibles en botones interactivos cuando `onSelectModel` esté disponible.
2. **Descomposición modular:**
   - `WorkshopAiChatButton.tsx` (451 líneas) → extraer hook `useAiChatPanel` (redimensionado, persistencia y envío) y subcomponente `AiChatMessagesList`.
   - `AiSettingsCard.tsx` (376 líneas) → extraer `AiProviderTestBanner` y `AiModelParamsSection`.
   - `PartDetailSheet.tsx` (256 líneas) → extraer `PartMovementsSection` si supera 220 líneas.
   - `RichTextEditorCore.tsx` (488 líneas) → extraer barra de herramientas (`RichTextToolbar.tsx`) manteniendo todas las extensiones TipTap y atajos.

### Criterios de verificación
- `npx vitest run tests/workshopAiChat.test.tsx tests/aiSettingsCard.test.tsx tests/richTextEditorExpand.test.tsx tests/partDetailSheet.test.tsx tests/arquitectura.test.ts tests/longLists.test.ts`.
- Ninguna pérdida de eventos, atajos ni bindings de editor/chat IA.

---

## Fase 4 — Accesibilidad (a11y) y Pulido Responsivo

### Objetivos
1. Garantizar foco visible por teclado en el 100% de elementos interactivos.
2. Evitar desbordamientos en viewports móviles y mejorar anuncios a lectores de pantalla.

### Tareas técnicas
1. **Foco por teclado:**
   - Añadir `focus-visible:ring-2 focus-visible:ring-ring` a `SidebarResizeHandle.tsx`, el tirador de redimensionado de `WorkshopAiChatButton.tsx`, `ScannerManualFallback.tsx` y `SearchInput.tsx`.
2. **Responsividad móvil:**
   - Cambiar anchos fijos (`w-[220px]` en `SecurityAuditPanel.tsx`) a `w-full sm:w-[220px]`.
   - Revisar tablas con scroll horizontal para garantizar lectura cómoda en 360px.
3. **Anuncios `aria-live="polite"`:**
   - Añadir `aria-live="polite"` al contador de resultados en `TablePagination.tsx`.

### Criterios de verificación
- `npx tsc -p src/convex/tsconfig.json --noEmit && npx tsc --noEmit`
- `npm run lint` (0 errores)
- `npx vitest run` (suite completa en verde)
- `npm run build` (compilación de producción sin errores)
