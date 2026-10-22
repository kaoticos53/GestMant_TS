# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-ARCHIVE-VIEW`
- **Objetivo:** Fase 1 - Extracción de funciones puras de mapeo de papelera y partición de archivo con pruebas unitarias.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/archive/helpers/trashRows.ts`
  - `tests/archiveDataHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `archive/helpers/trashRows.ts`: funciones puras `buildTrashedIncidentRows`, `buildTrashedRequestRows` y `partitionByArchived`.
- [x] `tests/archiveDataHelpers.test.ts`: 6 tests unitarios con tipado estricto verificando permisos condicionales y particionado de colecciones.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 24 tests pasados (6 helpers + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada y validada. Lista para commit atómico 1.
