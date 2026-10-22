# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-ATTACHMENT-IMAGE`
- **Objetivo:** Fase 1 - Extraer tipos, helper withAttempt y tests unitarios para AttachmentImage.
- **Módulo(s) Afectado(s):**
  - `src/components/attachmentImage/types.ts`
  - `src/components/attachmentImage/helpers.ts`
  - `tests/attachmentImageHelpers.test.ts`
  - `src/components/AttachmentImage.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/components/attachmentImage/types.ts`: Tipos `AttachmentLayout`, `AttachmentImageProps`.
- [x] `src/components/attachmentImage/helpers.ts`: Función pura `withAttempt`.
- [x] `tests/attachmentImageHelpers.test.ts`: Batería de 5 tests unitarios de `withAttempt`.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 22 tests pasados al 100%.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada. Listo para commit atómico de Fase 1.























