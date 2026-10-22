# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-MANUALS-VIEW`
- **Objetivo:** Fase 1 - Extracción de definición de columnas ordenables y pruebas unitarias para `ManualsView`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/manuals/helpers/columns.ts`
  - `tests/manualsColumns.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `manuals/helpers/columns.ts`: funciones puras `formatManualBrandModel` y constructora tipada `buildManualsSortColumns`.
- [x] `tests/manualsColumns.test.ts`: 6 tests unitarios cubriendo concatenación de marca/modelo y resolución de cada columna de la tabla.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 24 tests pasados (6 helpers + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada y validada. Lista para commit atómico 1.
