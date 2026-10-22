# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-ORDERS-SECTION`
- **Objetivo:** Fase 3 - Reensamblado declarativo de `OrdersSection.tsx` usando los submódulos de orders.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/purchasing/components/OrdersSection.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `OrdersSection.tsx`: simplificado de 252 a 125 líneas (-50%), orquestando de forma declarativa `OrdersEmptyState`, `PurchaseOrderCard` y `CancelOrderDialog`.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de integración? 39 tests pasados (8 helpers + 13 purchasing + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada y validada. Lista para commit atómico 3.
