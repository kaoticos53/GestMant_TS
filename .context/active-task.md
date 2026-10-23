# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-WORK-ALERT-SETTINGS-CARD`
- **Objetivo:** Fase 3 - Orquestar `WorkAlertSettingsCard.tsx` delegando en `useWorkAlertSettings`, `WorkAlertHeader`, `WorkAlertDaysField` y `WorkAlertRolesList`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/WorkAlertSettingsCard.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `workAlertSettings/types.ts`: contratos de tipos para roles, ajustes y props.
- [x] `workAlertSettings/helpers.ts`: funciones puras de validación de días, filtrado de audiencia y textos informativos.
- [x] `tests/workAlertSettingsCardHelpers.test.ts`: suite de 16 pruebas unitarias para helpers.
- [x] `workAlertSettings/useWorkAlertSettings.ts`: hook de consulta, seeding y guardado.
- [x] `workAlertSettings/components/WorkAlertHeader.tsx`: cabecera descriptiva con icono BellRing.
- [x] `workAlertSettings/components/WorkAlertDaysField.tsx`: campo numérico con validación.
- [x] `workAlertSettings/components/WorkAlertRolesList.tsx`: lista de roles con switch y resumen.
- [x] `workAlertSettings/index.ts`: barril unificado.
- [x] `settings/WorkAlertSettingsCard.tsx`: orquestador modular completado (~55 líneas).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada - Commit atómico 3 listo.





