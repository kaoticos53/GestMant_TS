# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-WORK-ALERT-SETTINGS-CARD`
- **Objetivo:** Fase 1 - Crear `types.ts`, `helpers.ts` y suite de pruebas unitarias `tests/workAlertSettingsCardHelpers.test.ts` para `WorkAlertSettingsCard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/workAlertSettings/types.ts`
  - `src/pages/dashboard/settings/workAlertSettings/helpers.ts`
  - `tests/workAlertSettingsCardHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `workAlertSettings/types.ts`: contratos de tipos para roles, ajustes y props.
- [x] `workAlertSettings/helpers.ts`: funciones puras de validación de días, filtrado de audiencia y textos informativos.
- [x] `tests/workAlertSettingsCardHelpers.test.ts`: suite de 16 pruebas unitarias para helpers.
- [ ] `workAlertSettings/useWorkAlertSettings.ts`: pendiente Fase 2.
- [ ] `workAlertSettings/components/WorkAlertHeader.tsx`: pendiente Fase 2.
- [ ] `workAlertSettings/components/WorkAlertDaysField.tsx`: pendiente Fase 2.
- [ ] `workAlertSettings/components/WorkAlertRolesList.tsx`: pendiente Fase 2.
- [ ] `workAlertSettings/index.ts`: pendiente Fase 2.
- [ ] `settings/WorkAlertSettingsCard.tsx`: pendiente Fase 3.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? 16 tests de helpers y arquitectura aprobados.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada - Commit atómico 1 listo.

