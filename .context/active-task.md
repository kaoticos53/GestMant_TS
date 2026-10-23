# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-AUTOMATIC-ARCHIVE-CARD`
- **Objetivo:** Fase 2 - Crear hook `useAutomaticArchive`, subcomponentes `AutomaticArchiveHeader`, `AutomaticArchiveControls` y barril `automaticArchive/index.ts`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/automaticArchive/useAutomaticArchive.ts`
  - `src/pages/dashboard/settings/automaticArchive/components/AutomaticArchiveHeader.tsx`
  - `src/pages/dashboard/settings/automaticArchive/components/AutomaticArchiveControls.tsx`
  - `src/pages/dashboard/settings/automaticArchive/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `automaticArchive/types.ts`: contratos de tipos.
- [x] `automaticArchive/helpers.ts`: funciones puras de cálculo y formato.
- [x] `tests/automaticArchiveHelpers.test.ts`: suite de pruebas unitarias para helpers.
- [x] `automaticArchive/useAutomaticArchive.ts`: hook de queries, mutaciones y acciones de archivo automático.
- [x] `automaticArchive/components/AutomaticArchiveHeader.tsx`: cabecera descriptiva con switch de activación.
- [x] `automaticArchive/components/AutomaticArchiveControls.tsx`: selector de antigüedad y botón ejecutar ahora.
- [x] `automaticArchive/index.ts`: barril unificado.
- [ ] `settings/AutomaticArchiveCard.tsx`: pendiente Fase 3.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada - Commit atómico 2 listo.

