# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-ARCHIVE-VIEW`
- **Objetivo:** Fase 3 - Reensamblado modular y declarativo de `ArchiveView.tsx` orquestando `useArchiveData`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/ArchiveView.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `ArchiveView.tsx`: reducción de 236 a 180 líneas delegando la carga condicional de Convex, el particionado de activos/archivados y la resolución de filas de papelera a `useArchiveData`.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 49 tests pasados (6 helpers + 25 archivo + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada y validada. Lista para commit atómico 3.
