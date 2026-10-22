# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-PURCHASING-HISTORY-SECTION`
- **Objetivo:** Fase 1 - Crear tests unitarios y de integración para la tabla interactiva y renderizado de `HistorySection`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/purchasing/components/HistorySection.tsx`
  - `tests/purchasingHistoryTable.test.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `tests/purchasingHistoryTable.test.tsx`: Batería de 5 tests para renderizado de tabla, empty state y selección interactiva de celdas/filas.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios nuevos? 5 tests pasados al 100%.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.
- [ ] ¿Build de producción Vite? (Fase 4)

---

## 4. Estado Actual
- **Estado:** Fase 1 completada. Listo para commit atómico de Fase 1.























