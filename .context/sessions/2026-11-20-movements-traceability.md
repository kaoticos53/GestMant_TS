# Traspaso de Sesión — 2026-11-20 (Movimientos de Stock y Desplazamientos de Equipos)

## Resumen de Cambios
- **Fase 1 (`src/lib/movements.ts`):** dominio puro de `StockMovementKind`, `EquipmentMovementKind`, `computeStockDelta` y `detectEquipmentChanges` (`tests/movements.test.ts`).
- **Fase 2 (`stockMovements`):** tabla e índices en `schema.ts`, helper `recordStockMovement` en `src/convex/_inventory/movements.ts`, emisión automática en `spareParts.ts` (`create`, `update`, `adjustStock`), `partRequests.ts` (`approve`) y `_purchasing/helpers.ts` (`applyReception`), queries protegidas en `src/convex/stockMovements.ts` e inclusión en `RESET_TABLES` (`tests/stockMovements.test.ts`).
- **Fase 3 (`equipmentMovements`):** tabla e índices en `schema.ts`, emisión automática en `equipment.ts` (`create`, `update` para traslados/baja/reactivación), query protegida en `src/convex/equipmentMovements.ts`, exposición en `get_equipment_history` de la IA e inclusión en `RESET_TABLES` (`tests/equipmentMovements.test.ts`).
- **Fase 4 (UI):** `StockMovementsDialog.tsx` accesible desde **Inventario → Movimientos** y `EquipmentMovementsSection.tsx` dentro de `EquipmentDetailSheet.tsx` (`tests/movementsUi.test.tsx`).
