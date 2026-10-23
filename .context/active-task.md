# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-AUTOMATIC-ARCHIVE-CARD`
- **Objetivo:** Fase 1 - Crear interfaces tipadas en `settings/automaticArchive/types.ts`, helpers puros en `settings/automaticArchive/helpers.ts` y tests unitarios en `tests/automaticArchiveHelpers.test.ts`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/automaticArchive/types.ts`
  - `src/pages/dashboard/settings/automaticArchive/helpers.ts`
  - `tests/automaticArchiveHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `automaticArchive/types.ts`: contratos de configuración y props de subcomponentes.
- [x] `automaticArchive/helpers.ts`: funciones puras `resolveAutoOptions`, `formatRunNowResultToast` y `formatArchiveFooter`.
- [x] `tests/automaticArchiveHelpers.test.ts`: suite de pruebas unitarias para helpers de archivado automático.
- [ ] `automaticArchive/useAutomaticArchive.ts`: pendiente Fase 2.
- [ ] `automaticArchive/components/AutomaticArchiveHeader.tsx`: pendiente Fase 2.
- [ ] `automaticArchive/components/AutomaticArchiveControls.tsx`: pendiente Fase 2.
- [ ] `automaticArchive/index.ts`: pendiente Fase 2.
- [ ] `settings/AutomaticArchiveCard.tsx`: pendiente Fase 3.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 1.
