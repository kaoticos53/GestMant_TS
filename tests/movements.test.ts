import { describe, expect, it } from "vitest";
import {
  EQUIPMENT_MOVEMENT_META,
  STOCK_MOVEMENT_META,
  computeStockDelta,
  detectEquipmentChanges,
} from "@/lib/movements";

describe("Movimientos y trazabilidad (Dominio puro)", () => {
  it("define metadatos completos para movimientos de stock y equipos", () => {
    expect(STOCK_MOVEMENT_META.initial.label).toBe("Alta inicial");
    expect(STOCK_MOVEMENT_META.manual_adjust.label).toBe("Ajuste manual");
    expect(STOCK_MOVEMENT_META.request_reserve.label).toBe("Reserva en petición");
    expect(STOCK_MOVEMENT_META.request_return.label).toBe("Devolución de petición");
    expect(STOCK_MOVEMENT_META.purchase_reception.label).toBe("Recepción de compra");

    expect(EQUIPMENT_MOVEMENT_META.created.label).toBe("Alta en inventario");
    expect(EQUIPMENT_MOVEMENT_META.location_change.label).toBe("Traslado");
    expect(EQUIPMENT_MOVEMENT_META.decommission.label).toBe("Baja");
    expect(EQUIPMENT_MOVEMENT_META.reactivation.label).toBe("Reactivación");
  });

  it("calcula el delta de stock y devuelve null si no hay cambio real", () => {
    expect(computeStockDelta(10, 10)).toBeNull();
    expect(computeStockDelta(5, 8)).toEqual({
      previousStock: 5,
      delta: 3,
      nextStock: 8,
    });
    expect(computeStockDelta(5, 2)).toEqual({
      previousStock: 5,
      delta: -3,
      nextStock: 2,
    });
  });

  it("detecta traslados, bajas y reactivaciones de equipos sin falsos positivos", () => {
    expect(
      detectEquipmentChanges(
        { location: "Plató 1", decommissionDate: undefined },
        { location: "Plató 1", decommissionDate: undefined },
      ),
    ).toEqual([]);

    expect(
      detectEquipmentChanges(
        { location: "Plató 1", decommissionDate: undefined },
        { location: "Unidad Móvil 2", decommissionDate: 1_700_000_000_000 },
      ),
    ).toEqual([
      {
        kind: "location_change",
        fromLocation: "Plató 1",
        toLocation: "Unidad Móvil 2",
      },
      { kind: "decommission" },
    ]);

    expect(
      detectEquipmentChanges(
        { location: "Taller", decommissionDate: 1_700_000_000_000 },
        { location: "Taller", decommissionDate: undefined },
      ),
    ).toEqual([{ kind: "reactivation" }]);
  });
});
