# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-CHANGELOG-DIALOG`
- **Objetivo:** Fase 1 - Extraer tipos, helpers puros y crear suite de tests unitarios para ChangelogDialog.
- **Módulo(s) Afectado(s):**
  - `src/components/changelog/types.ts`
  - `src/components/changelog/helpers.ts`
  - `tests/changelogDialogHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/components/changelog/types.ts` creado.
- [x] `src/components/changelog/helpers.ts` creado con función pura de filtrado y opciones.
- [x] `tests/changelogDialogHelpers.test.ts` creado con 13 tests unitarios verdes.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 31 tests verdes.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada. Listo para commit atómico de Fase 1.
