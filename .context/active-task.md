# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-ARCHIVE-TRASH-SECTION`
- **Objetivo:** Fase 1 - Extraer tipos, helpers puros y crear suite de tests unitarios para la papelera de archivo.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/archive/components/trashSection/types.ts`
  - `src/pages/dashboard/archive/components/trashSection/helpers.ts`
  - `tests/archiveTrashSectionHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/archive/components/trashSection/types.ts` creado.
- [x] `src/pages/dashboard/archive/components/trashSection/helpers.ts` creado con funciones puras de formateo.
- [x] `tests/archiveTrashSectionHelpers.test.ts` creado con 14 tests unitarios verdes.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 32 tests verdes.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada. Listo para commit atómico de Fase 1.
