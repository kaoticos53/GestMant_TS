# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-MANUALS-VIEW`
- **Objetivo:** Fase 2 - Desacoplamiento de componentes visuales (`ManualsTable` y `ManualsModals`) y barril en `src/pages/dashboard/manuals/`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/manuals/components/ManualsTable.tsx`
  - `src/pages/dashboard/manuals/components/ManualsModals.tsx`
  - `src/pages/dashboard/manuals/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `manuals/components/ManualsTable.tsx`: tabla con ordenación tipada por columnas, estados de carga/vacío integrados y renderizado de celdas.
- [x] `manuals/components/ManualsModals.tsx`: contenedor desacoplado para detalle, formulario y eliminación de manuales.
- [x] `manuals/index.ts`: barril unificado exportando componentes, hooks y helpers del módulo de manuales.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 24 tests pasados (6 helpers + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada y validada. Lista para commit atómico 2.
