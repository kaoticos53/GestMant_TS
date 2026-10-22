# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-CHANGELOG-DIALOG`
- **Objetivo:** Fase 2 - Modularizar cabecera, timeline y filas de cambios en changelog/components/.
- **Módulo(s) Afectado(s):**
  - `src/components/changelog/components/ChangelogHeader.tsx`
  - `src/components/changelog/components/ChangelogChangeRow.tsx`
  - `src/components/changelog/components/ChangelogReleaseItem.tsx`
  - `src/components/changelog/components/ChangelogEmptyState.tsx`
  - `src/components/changelog/components/ChangelogFooter.tsx`
  - `src/components/changelog/components/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] Subcomponentes modulares de ChangelogDialog implementados y exportados.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 31 tests verdes.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada. Listo para commit atómico de Fase 2 y proceder a Fase 3.
