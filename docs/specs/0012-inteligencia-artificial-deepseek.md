# SPEC-0012 — Plataforma de Inteligencia Artificial (DeepSeek)

- **ID:** `SPEC-0012`
- **Título:** Integración DeepSeek Visión + Chat con Tool Calling, Prompts/Variables y Permisos
- **Estado:** Implementada
- **Fecha:** 2026-11-20
- **Fuentes clave:** `src/lib/ai/*`, `src/convex/aiSettings.ts`, `src/convex/ai.ts`, `src/convex/_ai/client.ts`, `src/convex/_ai/workshopTools.ts`, `src/components/ai/*`, `src/pages/dashboard/settings/AiSettingsCard.tsx`, `src/pages/dashboard/settings/AiPromptsCard.tsx`, `src/pages/dashboard/incidents/components/IncidentAiAssistantDialog.tsx`

---

## 1. Contexto y Objetivos

Dotar al taller de capacidades IA extensibles sobre DeepSeek exclusivamente para **miembros autenticados activos**:
1. **Escáner híbrido de etiquetas** (código de barras local + DeepSeek Visión `deepseek-flash`) para autocompletar marca, modelo, nº de serie, tipo de equipo y descripción técnica con verificación humana obligatoria.
2. **Asistente de incidencias** (`askIncidents`) con citas verificadas `INC-XXXX`.
3. **Chat global del taller** (`askWorkshop`) en panel lateral derecho redimensionable con **Tool Calling de solo lectura** sobre todos los módulos operativos.
4. **Gobernanza administrativa:** cifrado de API key, prompts editables con contrato JSON protegido, variables `{{...}}` y permisos por rol y capacidades CASL.

---

## 2. Modelo de Dominio

- **`aiSettings`:** configuración única (`key: "default"`): `enabled`, `baseUrl`, `visionModel` (`deepseek-flash`), `chatModel` (`deepseek-chat`), `apiKey` cifrada AES-256-GCM, `tasks` (`labelScanner`, `incidentQa`, `workshopChat`), `rateLimitPerHour`, `allowedRoles`, `enabledModules`, `taskParams` (`temperature`, `maxTokens`, `customPrompt`).
- **`aiUsageLimits`:** ventana horaria por usuario (`userId`, `windowStart`, `count`).
- **Herramientas de solo lectura (`src/lib/ai/tools.ts`):** `get_workshop_stats`, `search_equipment`, `get_equipment_history` (incluye mantenimientos, incidencias, repuestos compatibles y desplazamientos), `search_incidents`, `search_spare_parts` (incluye `compatibleEquipment` y `compatibleModels`), `search_part_requests`, `search_purchase_orders`, `search_manuals`.
- **Variables (`src/lib/ai/variables.ts`):** `usuario_nombre`, `usuario_rol`, `fecha_actual`, `vista_actual`, `resumen_taller`, `marcas_conocidas`, `codigos_barras`.

---

## 3. Requisitos Funcionales

- **RF-001 (Configuración cifrada):** `aiSettings.save` cifra la API key con `secretCrypto.ts`, permite respaldo en `process.env.DEEPSEEK_API_KEY`, audita en `securityAuditLog` y ofrece `testConnection`.
- **RF-002 (Escáner híbrido adaptativo):** `EquipmentLabelScanner` pre-escanea códigos locales con `BarcodeDetector`, comprime la imagen y llama a `extractEquipmentLabel` (extrayendo también `technicalDetails` para rellenar la descripción). En escritorio abre `LabelReviewDialog` (zoom, rotación 90°, evidencia literal, alternativas, coincidencia de catálogo); en móvil aplica pre-relleno directo + `LabelInlineBanner` con **Confirmar** y **Deshacer**.
- **RF-003 (Tool Calling híbrido en chat global):** `askWorkshop` envía contadores globales y hasta `5` rondas de `callDeepSeekWithTools`. Acepta tanto JSON como Markdown plano tras tool calling extrayendo referencias válidas.
- **RF-004 (Modo depuración):** `debug: true` devuelve `debugTrace` por ronda (endpoint, modelo, mensajes enviados, `tool_calls`, respuesta cruda) sin exponer jamás la `apiKey`.
- **RF-005 (Editor de prompts y variables):** `AiPromptsCard` permite personalizar instrucciones y parámetros por tarea manteniendo `PROTECTED_OUTPUT_CONTRACTS` bloqueado y restaurar por defecto.

---

## 4. Reglas de Negocio e Invariantes

- **RN-001:** Los usuarios anónimos/invitados o inactivos nunca ven ni pueden invocar funciones de IA (en `/reportar` solo se muestra si `isAuthenticated === true`).
- **RN-002:** Las herramientas disponibles se calculan como la intersección entre `enabledModules` (Ajustes) y las capacidades reales CASL del usuario que pregunta.
- **RN-003:** Las citas devueltas al cliente (`citedReferences`) se filtran contra el conjunto de referencias reales presentes en el contexto/herramientas.

---

## 5. Permisos y Seguridad

- `aiSettings.settings`, `save` y `testConnection` requieren rol `admin`.
- `availability` y acciones de IA comprueban `activeMemberDoc`, `allowedRoles` y cuota en `aiUsageLimits`.
- Prohibida la exposición de `securityAuditLog`, claves o tokens a las herramientas del modelo.

---

## 6. Requisitos No Funcionales

- **RNF-001:** Timeout HTTP de `25_000 ms` por petición en `src/convex/_ai/client.ts` con reintento sin `response_format: json_object` si el endpoint devuelve contenido vacío con `image_url`.
- **RNF-002:** Panel lateral derecho renderizado vía `createPortal(..., document.body)` (`z-50`), redimensionable (`320px`–`760px`), con renderizador Markdown React seguro (sin `dangerouslySetInnerHTML`) y auto-scroll al final.

---

## 7. Interfaz de Usuario

- Ajustes → **IA y DeepSeek** (`AiSettingsCard` + `AiPromptsCard` agrupadas).
- Menú lateral y cabecera (`SidebarHeader`, `DashboardHeader`): `WorkshopAiChatButton` con botón `Debug`, chips de variables `{{}}` y etiquetas de herramientas consultadas.
- Formularios autenticados con `EquipmentLabelScanner`: `EquipmentFormDialog`, `CorrectEquipmentDialog`, `EquipmentFields` (si autenticado).

---

## 8. Criterios de Aceptación (Gherkin)

- **CA-001 — Ocultación para anónimos**
  - **Dado** un visitante no autenticado o invitado
  - **Cuando** abre `/reportar` o consulta `api.ai.availability`
  - **Entonces** `available` es `false` y no se renderiza ningún control de IA

- **CA-002 — Filtrado CASL en herramientas**
  - **Dado** un técnico sin `viewPurchasing`
  - **Cuando** consulta el chat global `askWorkshop`
  - **Entonces** la herramienta `search_purchase_orders` no se envía al modelo ni se ejecuta

---

## 9. Trazabilidad RF → CA → Tests

| Requisito | Criterio | Cobertura automatizada |
|---|---|---|
| RF-003, RF-005, RN-002 | Dominio, variables, prompts, tools | `tests/aiDomain.test.ts`, `tests/aiPromptsAndPermissions.test.ts` |
| RF-001 | Ajustes cifrados y permisos | `tests/aiSettings.test.ts`, `tests/aiSettingsCard.test.tsx`, `tests/aiPromptsTab.test.tsx` |
| RF-002, RF-003, RF-004 | Acciones, tool calling, cuotas, debug | `tests/aiActions.test.ts` |
| RF-002, CA-001 | Escáner híbrido escritorio/móvil | `tests/labelScanner.test.tsx` |
| RF-003, RNF-002 | Chat global, Markdown, resize, debug | `tests/workshopAiChat.test.tsx` |
| Asistente incidencias | Consultas en Incidencias | `tests/incidentAiAssistant.test.tsx` |

---

## 10. Preguntas Abiertas / Deuda Técnica

- Ninguna abierta; la limpieza diaria de `aiUsageLimits` se ejecuta en `crons.ts` a las `06:00` UTC.
