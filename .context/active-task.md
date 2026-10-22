# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-ATTACHMENT-IMAGE`
- **Objetivo:** Fase 2 - Extraer subcomponentes visuales en src/components/attachmentImage/components/.
- **Módulo(s) Afectado(s):**
  - `src/components/attachmentImage/components/Picture.tsx`
  - `src/components/attachmentImage/components/NotOpenedNotice.tsx`
  - `src/components/attachmentImage/components/UnavailableNotice.tsx`
  - `src/components/attachmentImage/components/NoFileNotice.tsx`

---

## 2. Archivos Modificados / Creados
- [x] Subcomponentes visuales de imagen y avisos de fallo (`Picture.tsx`, `NotOpenedNotice.tsx`, `UnavailableNotice.tsx`, `NoFileNotice.tsx`).
- [x] Hook de estado (`usePictureNoticeState.ts`) y ensamblador `PictureWithNotice.tsx`.
- [x] Orquestador declarativo (`AttachmentImage.tsx`, 393 -> 31 líneas, -92.1%).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 45 tests pasados al 100%.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada. Listo para commit atómico de Fase 3.























