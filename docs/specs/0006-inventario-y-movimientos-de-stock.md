# SPEC-0006 — Inventario de Repuestos y Libro Mayor de Movimientos (`stockMovements`)

- **ID:** `SPEC-0006`
- **Título:** Catálogo de repuestos, compatibilidades, stock bajo mínimo y libro mayor de movimientos
- **Estado:** Implementada
- **Fecha:** 2026-11-20
- **Fuentes clave:** `src/convex/spareParts.ts`, `src/convex/stockMovements.ts`, `src/convex/_inventory/movements.ts`, `src/lib/movements.ts`, `src/pages/dashboard/InventoryView.tsx`, `src/pages/dashboard/inventory/*`

---

## 1. Contexto y Objetivos

Centraliza el catálogo de repuestos del almacén (`spareParts`), sus existencias actuales, umbrales de stock mínimo, compatibilidades con equipos y modelos, y mantiene un libro mayor cronológico (`stockMovements`) de cada variación real de stock en el sistema.

---

## 2. Modelo de Dominio

- **`spareParts`:** `code` (`ALI-24015`), `name`, `description?`, `category`, `unit` (`ud`, `m`, `par`), `stock`, `minStock`, `location?`, `supplier?`, `partNumber?`, `unitPrice?`, `purchaseUrl?`, `compatibleWith?: Id<"equipment">[]`, `compatibleModels?: Id<"equipmentModels">[]`.
- **`stockMovements`:** `sparePartId`, `partCode`, `partName`, `kind` (`initial` | `manual_adjust` | `request_reserve` | `request_return` | `purchase_reception`), `previousStock`, `delta`, `nextStock`, `reason?`, `reference?`, `actorId?`, `actorName`, `createdAt`.

---

## 3. Requisitos Funcionales

- **RF-001 (CRUD y ajuste rápido):** `spareParts.create`, `update`, `adjustStock` y `remove` gestionan el catálogo con validación de código único en mayúsculas y derivación automática de `compatibleModels` desde `compatibleWith`.
- **RF-002 (Libro mayor unificado `stockMovements`):** `recordStockMovement` registra automáticamente:
  - `initial`: alta en `spareParts.create` si `stock > 0`.
  - `manual_adjust`: `spareParts.adjustStock` y `spareParts.update` cuando cambia `stock`.
  - `request_reserve`: `partRequests.approve` al descontar existencias (`reference: "PET-XXXX"`).
  - `purchase_reception`: `applyReception` en compras al entrar material (`reference: "OC-XXXX"`).
- **RF-003 (Consultas de movimientos):** `stockMovements.listByPart` (historial de un repuesto) y `stockMovements.listRecent` (últimos movimientos globales del almacén).
- **RF-004 (Exportación CSV y etiquetas):** Exportación CSV segura (`csvSecurity.ts`, `exportInventoryCsv`) e impresión de etiquetas QR (`PrintLabelDialog`).

---

## 4. Reglas de Negocio e Invariantes

- **RN-001:** El stock nunca puede bajar de `0` (`Math.max(0, ...)`).
- **RN-002:** `computeStockDelta` devuelve `null` si `previousStock === nextStock`, evitando movimientos sin variación real.
- **RN-003:** El borrado de un repuesto (`spareParts.remove`) comprueba que no queden dependencias activas inválidas.

---

## 5. Permisos y Seguridad

- Ver catálogo y movimientos: `viewInventory` | `manageInventory` | `lookupCatalog`.
- Crear, editar, ajustar stock y eliminar: `manageInventory` (`secureMutation`).

---

## 6. Requisitos No Funcionales

- **RNF-001:** Exportación CSV protegida frente a inyección de fórmulas (`=`, `+`, `-`, `@`) mediante `tests/csvSecurity.test.ts`.

---

## 7. Interfaz de Usuario

- `InventoryView.tsx`: filtros por categoría, equipo compatible y stock bajo mínimo; botones **Movimientos**, **Exportar CSV** y **Nuevo repuesto**.
- `StockMovementsDialog.tsx`: tabla filtrable por código, nombre, referencia (`PET-`/`OC-`) o usuario con variación (`+N`/`-N`) y saldo (`antes → después`).
- `StockDialog.tsx` y `PartFormDialog.tsx`: ajuste directo de stock y edición completa con `CompatibleModelsSection`.

---

## 8. Criterios de Aceptación (Gherkin)

- **CA-001 — Trazabilidad completa de stock**
  - **Dado** un repuesto creado con `stock: 5`, ajustado `+3` y reservado `2` en una petición aprobada
  - **Cuando** se consulta `stockMovements.listByPart`
  - **Entonces** aparecen 3 movimientos ordenados del más reciente al más antiguo (`request_reserve -2`, `manual_adjust +3`, `initial +5`)

---

## 9. Trazabilidad RF → CA → Tests

| Requisito | Criterio | Cobertura automatizada |
|---|---|---|
| RF-001 | CRUD, compatibilidades y validación | `tests/repuestos.test.ts`, `tests/inventoryCompatibles.test.tsx`, `tests/partFormDomain.test.ts`, `tests/partFormDialogHelpers.test.ts` |
| RF-002, RF-003, CA-001 | Libro mayor `stockMovements` y UI | `tests/movements.test.ts`, `tests/stockMovements.test.ts`, `tests/movementsUi.test.tsx` |
| RF-004, RNF-001 | CSV y etiquetas | `tests/csvSecurity.test.ts`, `tests/inventoryHelpers.test.ts` |

---

## 10. Preguntas Abiertas / Deuda Técnica

- **Q-001:** El tipo `request_return` está definido en `stockMovements` y `movements.ts`; si en el futuro `partRequests.returnMaterial` reintegra unidades físicas al stock general en lugar de marcar solo la devolución en la petición, deberá invocar `recordStockMovement` con `kind: "request_return"`.
