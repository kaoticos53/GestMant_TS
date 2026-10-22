# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-ORDERS-SECTION`
- **Objetivo:** Fase 1 - Extracción de tipos, helpers deterministas de formato de subtítulos y de retorno de anulación y pruebas unitarias para `OrdersSection`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/purchasing/components/orders/types.ts`
  - `src/pages/dashboard/purchasing/components/orders/helpers.ts`
  - `tests/ordersSectionHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `orders/types.ts`: interfaces de props y de órdenes desacopladas.
- [x] `orders/helpers.ts`: funciones puras `formatOrderSubtitle`, `formatOrderRequestRefs` y `formatCancelSuccessDescription`.
- [x] `tests/ordersSectionHelpers.test.ts`: 8 tests unitarios cubriendo singular/plural de artículos, referencias de peticiones y textos explicativos de retorno.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 26 tests pasados (8 helpers + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada y validada. Lista para commit atómico 1.
