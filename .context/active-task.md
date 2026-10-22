# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-WORKSHOP-SETTINGS-VIEW`
- **Objetivo:** Fase 2 - Crear subcomponentes `WorkshopSettingsTabsHeader` y `WorkshopSettingsTabsPanels` con barril unificado.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/view/components/WorkshopSettingsTabsHeader.tsx`
  - `src/pages/dashboard/settings/view/components/WorkshopSettingsTabsPanels.tsx`
  - `src/pages/dashboard/settings/view/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `settings/view/types.ts`: contratos de pestañas, permisos y props.
- [x] `settings/view/helpers.ts`: helpers puros `getAvailableTabs`, `resolveActiveTabId` y permisos derivados.
- [x] `tests/workshopSettingsViewHelpers.test.ts`: suite de tests unitarios verificando la resolución de pestañas.
- [x] `settings/view/components/WorkshopSettingsTabsHeader.tsx`: cabecera accesible horizontal con triggers de tabs.
- [x] `settings/view/components/WorkshopSettingsTabsPanels.tsx`: paneles temáticos agrupados y condicionales.
- [x] `settings/view/index.ts`: barril unificado.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 2.
