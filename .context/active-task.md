# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-MANUALS-VIEW`
- **Objetivo:** Fase 3 - Reensamblado modular y declarativo de `ManualsView.tsx` orquestando `ManualsTable` y `ManualsModals`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/ManualsView.tsx`
  - `src/pages/dashboard/manuals/components/ManualsTable.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `ManualsView.tsx`: reducción de 248 a 130 líneas delegando la tabla y los modales CRUD a componentes modulares especializados.
- [x] `manuals/components/ManualsTable.tsx`: tipado polimórfico de `areaRef` con `React.Ref<HTMLDivElement>`.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 24 tests pasados (6 helpers + 9 arquitectura + 9 seguridad) + 8 de estado de lista.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada y validada. Lista para commit atómico 3.
