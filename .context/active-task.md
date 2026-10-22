# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-MAIL-AUDIENCE-CARD`
- **Objetivo:** Fase 1 - Extraer tipos, constantes de matriz y funciones auxiliares puras de MailAudienceCard en mailAudience/ con tests unitarios.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/mailAudience/types.ts`
  - `src/pages/dashboard/settings/mailAudience/helpers.ts`
  - `tests/mailAudienceCardHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/settings/mailAudience/types.ts`
- [x] `src/pages/dashboard/settings/mailAudience/helpers.ts`
- [x] `tests/mailAudienceCardHelpers.test.ts` (14 tests unitarios nuevos)

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? Tests verdes (32 tests pasados).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada exitosamente. Listo para commit atómico 1.
