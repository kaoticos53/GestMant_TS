# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-ARCHIVE-TRASH-SECTION`
- **Objetivo:** Fase 4 - Verificación de compilación, suite de pruebas completa y cierre de ArchiveTrashSection.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/archive/components/ArchiveTrashSection.tsx`
  - `src/pages/dashboard/archive/components/trashSection/`
  - `tests/archiveTrashSectionHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] Subcomponentes, helpers y tipos creados en `trashSection/`.
- [x] `ArchiveTrashSection.tsx` refactorizado de 313 a 89 líneas (-71.6%).
- [x] Suite de pruebas y build de producción verificados.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 2.197 tests pasados (181 archivos pasados, 0 fallos).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.
- [x] Compilación Vite de producción: Exitosa en 9.42s.

---

## 4. Estado Actual
- **Estado:** Completada y verificada. Lista para commit atómico de cierre de Fase 4.
