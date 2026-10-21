import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  lineDelivered,
  lineRemaining,
  requestDelivery,
  requestMaterialState,
} from "@/lib/requestFlow";
import type { PartDoc, RequestDoc } from "@/pages/dashboard/requests/types";

describe("useRequestLinesStock domain logic", () => {
  const mockPart1: PartDoc = {
    _id: "part_1" as Id<"spareParts">,
    _creationTime: 1000,
    code: "REP-01",
    name: "Filtro de aire",
    stock: 5,
    unit: "ud",
    minStock: 2,
    price: 15,
  };

  const mockPart2: PartDoc = {
    _id: "part_2" as Id<"spareParts">,
    _creationTime: 1000,
    code: "REP-02",
    name: "Correa trapezoidal",
    stock: 1, // Shortage if quantity > 1
    unit: "ud",
    minStock: 2,
    price: 30,
  };

  const mockLines: RequestDoc["lines"] = [
    {
      sparePartId: "part_1" as Id<"spareParts">,
      code: "REP-01",
      name: "Filtro de aire",
      quantity: 3,
      deliveredQuantity: 3,
      deliveredAt: 2000,
    },
    {
      sparePartId: "part_2" as Id<"spareParts">,
      code: "REP-02",
      name: "Correa trapezoidal",
      quantity: 2,
      deliveredQuantity: 0,
    },
  ];

  it("calcula correctamente la entrega parcial y remanente", () => {
    const delivery = requestDelivery(mockLines, "approved");
    expect(delivery.anyDelivered).toBe(true);
    expect(delivery.complete).toBe(false);
    expect(delivery.deliveredUnits).toBe(3);
    expect(delivery.totalUnits).toBe(5);

    const materialState = requestMaterialState("approved", delivery);
    expect(materialState).toBe("partial");
  });

  it("detecta rotura de stock correctamente en base al catálogo", () => {
    const partById = new Map([
      [mockPart1._id, mockPart1],
      [mockPart2._id, mockPart2],
    ]);

    const line1 = mockLines[0];
    const part1 = partById.get(line1.sparePartId);
    const hasShortage1 = !part1 || part1.stock < line1.quantity;
    expect(hasShortage1).toBe(false); // stock 5 >= quantity 3

    const line2 = mockLines[1];
    const part2 = partById.get(line2.sparePartId);
    const hasShortage2 = !part2 || part2.stock < line2.quantity;
    expect(hasShortage2).toBe(true); // stock 1 < quantity 2
  });

  it("calcula cantidades remanentes y entregadas por línea", () => {
    const line1 = mockLines[0];
    expect(lineDelivered(line1, "approved")).toBe(3);
    expect(lineRemaining(line1, "approved")).toBe(0);

    const line2 = mockLines[1];
    expect(lineDelivered(line2, "approved")).toBe(0);
    expect(lineRemaining(line2, "approved")).toBe(2);
  });
});
