# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-ORDERS-SECTION`
- **Objetivo:** Fase 2 - Creación de subcomponentes desacoplados `OrdersEmptyState`, `PurchaseOrderCard`, `CancelOrderDialog` y barril público.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/purchasing/components/orders/OrdersEmptyState.tsx`
  - `src/pages/dashboard/purchasing/components/orders/PurchaseOrderCard.tsx`
  - `src/pages/dashboard/purchasing/components/orders/CancelOrderDialog.tsx`
  - `src/pages/dashboard/purchasing/components/orders/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `OrdersEmptyState.tsx`: pantalla explicativa cuando la lista de órdenes está vacía.
- [x] `PurchaseOrderCard.tsx`: tarjeta individual de orden con badges, referencias, progreso y acciones condicionales.
- [x] `CancelOrderDialog.tsx`: modal accesible para introducir el motivo de anulación.
- [x] `orders/index.ts`: barril unificado.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de integración? 63 tests pasados (8 helpers + 11 journey + 26 compras + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada y validada. Lista para commit atómico 2.
