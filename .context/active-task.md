# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-WORKSHOP-SETTINGS-VIEW`
- **Objetivo:** Fase 1 - Definición de contratos de tipos, helpers puros de resolución de pestañas según permisos y tests unitarios para `WorkshopSettingsView.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/view/types.ts`
  - `src/pages/dashboard/settings/view/helpers.ts`
  - `tests/workshopSettingsViewHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/settings/view/types.ts`: contratos de pestañas, permisos y props.
- [x] `src/pages/dashboard/settings/view/helpers.ts`: helpers puros `getAvailableTabs`, `resolveActiveTabId` y permisos derivados.
- [x] `tests/workshopSettingsViewHelpers.test.ts`: suite de tests unitarios verificando la resolución de pestañas.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, tipos inferidos y comprobados.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí (Taller, repuestos, equipos, incidencias, peticiones, almacén).

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 1.
