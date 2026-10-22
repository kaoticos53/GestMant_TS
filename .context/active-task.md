# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-ARCHIVE-TRASH-SECTION`
- **Objetivo:** Fase 2 - Desacoplar subcomponentes modulares de ArchiveTrashSection en trashSection/components/.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/archive/components/trashSection/components/TrashGroup.tsx`
  - `src/pages/dashboard/archive/components/trashSection/components/TrashButtons.tsx`
  - `src/pages/dashboard/archive/components/trashSection/components/TrashedIncidentItem.tsx`
  - `src/pages/dashboard/archive/components/trashSection/components/TrashedRequestItem.tsx`
  - `src/pages/dashboard/archive/components/trashSection/components/TrashDeleteDialog.tsx`
  - `src/pages/dashboard/archive/components/trashSection/components/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] Subcomponentes visuales de la papelera implementados y exportados.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 32 tests verdes.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada. Listo para commit atómico de Fase 2 y proceder a Fase 3.
