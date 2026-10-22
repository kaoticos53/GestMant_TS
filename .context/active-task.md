# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-MANUALS-VIEW`
- **Objetivo:** Fase 4 - Validación exhaustiva (Typecheck, Vitest, Build de Producción) y cierre de la refactorización modular de `ManualsView.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/ManualsView.tsx`
  - `src/pages/dashboard/manuals/`
  - `tests/manualsColumns.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `manuals/helpers/columns.ts`: lógica de ordenación de columnas y tipos asociados.
- [x] `tests/manualsColumns.test.ts`: 6 tests unitarios verificando resolución de columnas.
- [x] `manuals/components/ManualsTable.tsx`: tabla tipada desacoplada con sorting nativo.
- [x] `manuals/components/ManualsModals.tsx`: contenedor de diálogos modales CRUD.
- [x] `manuals/index.ts`: barril unificado para el submódulo manuals.
- [x] `ManualsView.tsx`: orquestador declarativo reducido de 248 a 130 líneas.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 2.355 tests pasados en 196 suites (0 fallos).
- [x] ¿Compilación de producción? `npm run build` completado con éxito (10.22s).
- [x] ¿Vocabulario Ubicuo respetado? Sí (Equipo, Manual).

---

## 4. Estado Actual
- **Estado:** Completada con éxito. Listo para proponer siguiente candidato.
