# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-ARCHIVE-VIEW`
- **Objetivo:** Fase 4 - Verificación exhaustiva (Typecheck, Vitest, Build de Producción) y cierre de la refactorización modular de `ArchiveView.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/ArchiveView.tsx`
  - `src/pages/dashboard/archive/helpers/trashRows.ts`
  - `src/pages/dashboard/archive/hooks/useArchiveData.ts`
  - `tests/archiveDataHelpers.test.ts`
  - `tests/archiveToasts.test.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `archive/helpers/trashRows.ts`: funciones puras de mapeo de papelera y partición de activos/archivados.
- [x] `archive/hooks/useArchiveData.ts`: hook orquestador que centraliza las consultas y estado derivado de archivo.
- [x] `tests/archiveDataHelpers.test.ts`: 6 tests unitarios verificando particionado y permisos de papelera.
- [x] `tests/archiveToasts.test.tsx`: drenaje del timer de Sonner antes del desmontaje en jsdom.
- [x] `ArchiveView.tsx`: orquestador compacto reducido de 236 a 180 líneas.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 2.377 tests pasados en 199 suites (0 fallos).
- [x] ¿Compilación de producción? `npm run build` completado con éxito (9.09s).
- [x] ¿Vocabulario Ubicuo respetado? Sí (Incidencia, Petición de repuesto, Equipo).

---

## 4. Estado Actual
- **Estado:** Completada con éxito. Listo para proponer siguiente candidato.
