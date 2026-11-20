# Traspaso de Sesión — 2026-11-20

## Resumen de Cambios
Se implementó la plataforma extensible de IA con DeepSeek y el escáner híbrido de etiquetas de equipos (solo para usuarios autenticados del taller), siguiendo TDD, arquitectura limpia y las invariantes de `AGENTS.md`.

### Fase 1 — Dominio puro (`src/lib/ai/`)
- `src/lib/ai/types.ts`, `limits.ts`, `prompts.ts`, `parsers.ts`, `index.ts`: contratos, límites de uso (`40/hora/usuario`), prompts estrictos (sin inventar datos y con citas verificadas `INC-XXXX`), y parsers defensivos sin dependencias de React ni Convex.
- `tests/aiDomain.test.ts` (6 tests).

### Fase 2 — Backend Convex e Infraestructura
- `src/convex/schema.ts`: tablas `aiSettings` (`by_key`) y `aiUsageLimits` (`by_user`, `by_windowStart`).
- `src/convex/_ai/client.ts`: cliente HTTP unificado compatible OpenAI para DeepSeek.
- `src/convex/aiSettings.ts`: configuración cifrada AES-256-GCM (`secretCrypto.ts`), fallback a `DEEPSEEK_API_KEY`, auditoría en `securityAuditLog` y prueba de conexión `testConnection`.
- `src/convex/ai.ts`: `availability`, `extractEquipmentLabel` (visión + códigos locales + coincidencia de catálogo) y `askIncidents` (preguntas sobre el historial con citas verificadas).
- `src/convex/crons.ts` y `src/convex/workshopReset.ts`: limpieza diaria de ventanas expiradas e inclusión de `aiUsageLimits` en `RESET_TABLES`.
- `docker/synology/docker-compose.yml`, `docker/synology/funciones-lib.sh`, `docker/synology/.env.example`: soporte opcional de `DEEPSEEK_API_KEY`.
- `tests/aiSettings.test.ts` (3 tests) y `tests/aiActions.test.ts` (3 tests).

### Fase 3 — Panel de Administración de IA
- `src/pages/dashboard/settings/ai/hooks/useAiSettingsForm.ts` y `src/pages/dashboard/settings/AiSettingsCard.tsx`.
- Integración en la pestaña `"ai"` ("IA y DeepSeek") de Ajustes del taller (`src/pages/dashboard/settings/view/types.ts`, `helpers.ts`, `WorkshopSettingsTabsPanels.tsx`).
- `tests/aiSettingsCard.test.tsx` (4 tests) y actualización de `tests/workshopSettingsView.test.tsx` y `tests/workshopSettingsViewHelpers.test.ts`.

### Fase 4 — Escáner Híbrido de Etiquetas + Verificación Adaptativa
- `src/components/ai/barcodePreScan.ts`: pre-escaneo local con `BarcodeDetector` (1D/DataMatrix/QR).
- `src/components/ai/useEquipmentLabelScanner.ts`, `LabelReviewDialog.tsx` (escritorio: revisión lado a lado con zoom, rotación 90°, evidencia literal, chips de alternativas y coincidencia de catálogo), `LabelInlineBanner.tsx` (móvil: pre-relleno directo + banner verificable con miniatura desplegable, confirmar y deshacer) y `EquipmentLabelScanner.tsx`.
- Integrado en `EquipmentFormDialog.tsx`, `CorrectEquipmentDialog.tsx`, `EquipmentFields.tsx` y `ReportIncidentForm.tsx` (estrictamente oculto para usuarios anónimos).
- `tests/labelScanner.test.tsx` (4 tests).

### Fase 5 — Asistente IA de Incidencias
- `src/pages/dashboard/incidents/components/IncidentAiAssistantDialog.tsx` integrado en `IncidentsHeaderBar.tsx` e `IncidentsView.tsx` con citas clicables `INC-XXXX`.
- `tests/incidentAiAssistant.test.tsx` (1 test).

## Validación
- `npx tsc --noEmit`
- `npm run lint`
- `npx vitest run`
