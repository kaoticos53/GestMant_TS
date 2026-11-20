# SPEC-0008 — Compras y Recepciones (`PC-XXXX`, `OC-XXXX`)

- **ID:** `SPEC-0008`
- **Título:** Peticiones de compra, órdenes de compra a proveedor y recepciones con albarán
- **Estado:** Implementada
- **Fecha:** 2026-11-20
- **Fuentes clave:** `src/lib/purchaseFlow.ts`, `src/lib/purchasing.ts`, `src/lib/orderJourney.ts`, `src/convex/purchasing.ts`, `src/convex/_purchasing/helpers.ts`, `src/convex/_purchasing/queries.ts`, `src/pages/dashboard/PurchasingView.tsx`, `src/pages/dashboard/purchasing/*`

---

## 1. Contexto y Objetivos

Gestiona el aprovisionamiento externo de repuestos cuando el almacén no cubre una petición (`PC-XXXX`), la agrupación por proveedor en órdenes de compra (`OC-XXXX`) y la recepción parcial o total con albarán obligatorio (`receptions`), dando entrada automática al stock (`stockMovements`).

---

## 2. Modelo de Dominio

- **Petición de compra (`purchaseRequests`, `PC-XXXX`):** estados `pending` (Sin tratar) → `ordered` (Pedida) → `received` (Recibida) | `cancelled` (Retirada). Si se anula su orden, pasa por `unorder` (`ordered` → `pending`).
- **Orden de compra (`purchaseOrders`, `OC-XXXX`):** estados `pending` (Pendiente) / `partial` (Parcial) → `completed` (Completada) | `cancelled` (Anulada).
- **Recepción (`receptions`):** vinculada a `orderId`, incluye `deliveryNote` (albarán obligatorio en almacenamiento) y líneas recibidas.

---

## 3. Requisitos Funcionales

- **RF-001 (Cola sin tratar):** Apartado de líneas desde peticiones de repuesto (`PC-XXXX`), agrupadas por proveedor (`Sin proveedor` si no tiene) con edición de proveedor o retirada (`cancel`).
- **RF-002 (Montaje de órdenes):** Creación manual de `OC-XXXX` agrupando peticiones de compra de un proveedor (`order`), pasando las `PC-XXXX` a `ordered`.
- **RF-003 (Recepción con albarán):** `purchasing.receive` exige albarán (`deliveryNote`), suma `cantidad` a `spareParts.stock`, emite movimiento `purchase_reception` en `stockMovements`, actualiza `purchaseRequests` a `received`, marca `partRequests` como `materialReceived` si todo lo comprado llegó y notifica a los solicitantes.
- **RF-004 (Anulación de orden):** `cancelOrder` anula la orden y devuelve las `PC-XXXX` no recibidas (`unorder`) a `pending`.

---

## 4. Reglas de Negocio e Invariantes

- **RN-001:** No se puede registrar una recepción sin documento de albarán adjunto.
- **RN-002:** Las transiciones están gobernadas por `PURCHASE_REQUEST_STEPS` y `PURCHASE_ORDER_STEPS` (`src/lib/purchaseFlow.ts`).

---

## 5. Permisos y Seguridad

- Ver cola e historial de compras: `viewPurchasing`.
- Crear órdenes, recepcionar, cambiar proveedor, retirar o anular: `managePurchasing`.

---

## 6. Requisitos No Funcionales

- **RNF-001:** Filtros persistentes y paginación en el historial de compras (`PurchasingView.tsx`).

---

## 7. Interfaz de Usuario

- `PurchasingView.tsx`: pestañas **Sin tratar** (agrupado por proveedor) e **Historial de órdenes**, diálogos de creación de orden, recepción con albarán (`ReceiveDialog`), ficha lateral de orden y anulación.

---

## 8. Criterios de Aceptación (Gherkin)

- **CA-001 — Entrada de stock al recepcionar**
  - **Dado** una orden `OC-0001` en estado `pending`
  - **Cuando** se recepcionan `4` unidades de un repuesto con albarán válido
  - **Entonces** `spareParts.stock` aumenta en `4`, se registra `purchase_reception` en `stockMovements` y la orden pasa a `partial` o `completed`

---

## 9. Trazabilidad RF → CA → Tests

| Requisito | Criterio | Cobertura automatizada |
|---|---|---|
| RN-002 | Máquinas de compra y orden | `tests/purchaseFlow.test.ts`, `tests/orderJourney.test.ts`, `tests/maquinas.test.ts` |
| RF-001..RF-004, CA-001 | Backend compras y recepciones | `tests/compras.test.ts`, `tests/purchasingSample.test.ts`, `tests/stockMovements.test.ts` |
| UI Compras | Cola, historial, filtros y recepción | `tests/purchasingView.test.tsx`, `tests/purchasingHistoryFilters.test.tsx`, `tests/receiveDialogHelpers.test.ts` |

---

## 10. Preguntas Abiertas / Deuda Técnica

- **Q-001:** Igual que en peticiones, `purchaseOrders` no guarda un array `history` unificado de transiciones de estado (Fase 5 opcional de `movements_and_traceability_plan.md`).
