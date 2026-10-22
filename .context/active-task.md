# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-MAIL-AUDIENCE-CARD`
- **Objetivo:** Fase 4 - Verificación de compilación, suite de pruebas completa y cierre de MailAudienceCard.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/MailAudienceCard.tsx`
  - `src/pages/dashboard/settings/mailAudience/`
  - `tests/mailAudienceCardHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] Subcomponentes, helpers y hook creados en `mailAudience/`.
- [x] `MailAudienceCard.tsx` refactorizado de 336 a 75 líneas (-77.7%).
- [x] Suite de pruebas y build de producción verificados.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 2.183 tests pasados (180 archivos pasados, 0 fallos).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.
- [x] Compilación Vite de producción: Exitosa en 8.29s.

---

## 4. Estado Actual
- **Estado:** Completada y verificada. Lista para commit atómico de cierre de Fase 4.
