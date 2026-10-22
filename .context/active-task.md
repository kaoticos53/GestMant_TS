# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-ORDERS-SECTION`
- **Objetivo:** Fase 4 - Validación integral, suite completa de pruebas, verificación de build de producción y cierre de la refactorización de `OrdersSection.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/purchasing/components/OrdersSection.tsx`
  - `src/pages/dashboard/purchasing/components/orders/`
  - `tests/ordersSectionHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] Submódulo desacoplado en `src/pages/dashboard/purchasing/components/orders/`:
  - `types.ts`: interfaces de props y de orden desacopladas.
  - `helpers.ts`: funciones puras `formatOrderSubtitle`, `formatOrderRequestRefs` y `formatCancelSuccessDescription`.
  - `OrdersEmptyState.tsx`: pantalla explicativa cuando la lista de órdenes está vacía.
  - `PurchaseOrderCard.tsx`: tarjeta individual de orden con badges, referencias, progreso y acciones condicionales.
  - `CancelOrderDialog.tsx`: modal accesible para introducir el motivo de anulación.
  - `index.ts`: barril unificado.
- [x] `tests/ordersSectionHelpers.test.ts`: 8 tests unitarios cubriendo subtítulos, referencias y mensajes de anulación.
- [x] `OrdersSection.tsx`: orquestador declarativo reducido de 252 a 125 líneas (-50%).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Suite completa de tests? 2.335 tests pasados en 194 suites de Vitest.
- [x] ¿Compilación de producción? Vite build completado con éxito (5.82s).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Tarea completada y cerrada con éxito.
