# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-ORDER-SHEET`
- **Objetivo:** Fase 3 - Extraer hook useOrderSheetState y reensamblar OrderSheet como orquestador declarativo.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/purchasing/dialogs/orderSheet/hooks/useOrderSheetState.ts`
  - `src/pages/dashboard/purchasing/dialogs/OrderSheet.tsx`

---

## 2. Archivos Modificados / Creados
- [x] Hook `useOrderSheetState.ts` para encapsular mutaciones y estado de edición.
- [x] Reensamblado de `OrderSheet.tsx` (343 -> 97 líneas, -71.7%).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? Tests verdes (25 tests pasados).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada exitosamente. Listo para commit atómico 3.
