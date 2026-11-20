# Traspaso de Sesión — 2026-11-20 (Herramientas BD, Prompts/Variables y Permisos IA)

## Resumen de Cambios
Implementado el plan aprobado **A2 + B1 + C1** con TDD y arquitectura limpia:

- **Fase 1 (`src/lib/ai/`):**
  - `variables.ts`: catálogo `AI_VARIABLE_CATALOG` e interpolador seguro `interpolateAiTemplate`.
  - `tools.ts`: 8 herramientas de solo lectura (`get_workshop_stats`, `search_equipment`, `get_equipment_history`, `search_incidents`, `search_spare_parts`, `search_part_requests`, `search_purchase_orders`, `search_manuals`) + `resolveAllowedAiTools`.
  - `prompts.ts`: `DEFAULT_AI_PROMPTS` editables + `PROTECTED_OUTPUT_CONTRACTS` separados.
- **Fase 2 (`src/convex/`):**
  - `schema.ts` y `aiSettings.ts`: persistencia de tareas activas, cuota por hora (`rateLimitPerHour`), `allowedRoles`, `enabledModules` y `taskParams` (`temperature`, `maxTokens`, `customPrompt`).
  - `_ai/client.ts` y `_ai/workshopTools.ts`: bucle `callDeepSeekWithTools` (hasta 5 rondas) y consultas acotadas por módulo usando helpers de dominio (`isClosedIncident`).
  - `ai.ts`: `availability` con granularidad por tarea y rol; `askWorkshop` con filtrado de herramientas según capacidades CASL reales del usuario.
- **Fase 3 (`src/pages/dashboard/settings/`):**
  - `AiSettingsCard.tsx` ampliada con capacidades activas, límite/hora, roles permitidos y módulos consultables.
  - `AiPromptsCard.tsx` en nueva pestaña `ai-prompts` (**Prompts y permisos IA**), con chips de variables, contrato JSON protegido y botón **Restaurar por defecto**.
- **Fase 4 (`src/components/ai/WorkshopAiChatButton.tsx`):**
  - Panel lateral derecho con `createPortal` (`z-50`), chips de variables `{{}}` y visualización de herramientas consultadas (`usedTools`).
