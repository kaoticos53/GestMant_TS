import { describe, expect, test } from "vitest";
import { planMaterialReturn } from "../src/lib/requestFlow";

describe("planMaterialReturn (Sub-fase 1.1)", () => {
  const sampleLines = [
    {
      sparePartId: "part-1",
      code: "SEN-01",
      name: "Sensor inductivo",
      quantity: 4,
      deliveredQuantity: 4,
    },
    {
      sparePartId: "part-2",
      code: "REL-02",
      name: "Relé 24V",
      quantity: 2,
      deliveredQuantity: 2,
    },
  ];

  test("sin líneas explícitas devuelve todas las unidades entregadas como restock y marca fullyReturned", () => {
    const plan = planMaterialReturn(sampleLines, "issued");

    expect(plan.fullyReturned).toBe(true);
    expect(plan.totalReturnedUnits).toBe(6);
    expect(plan.restockUnits).toBe(6);
    expect(plan.damagedUnits).toBe(0);
    expect(plan.items).toEqual([
      {
        sparePartId: "part-1",
        code: "SEN-01",
        name: "Sensor inductivo",
        quantity: 4,
        disposition: "restock",
      },
      {
        sparePartId: "part-2",
        code: "REL-02",
        name: "Relé 24V",
        quantity: 2,
        disposition: "restock",
      },
    ]);
    expect(plan.nextLines.every((l) => l.deliveredQuantity === 0)).toBe(true);
  });

  test("soporta devolución parcial desde approved con entregas previas", () => {
    const partialLines = [
      {
        sparePartId: "part-1",
        code: "SEN-01",
        name: "Sensor inductivo",
        quantity: 5,
        deliveredQuantity: 3,
      },
    ];

    const plan = planMaterialReturn(partialLines, "approved", [
      { sparePartId: "part-1", quantity: 2, disposition: "restock" },
    ]);

    expect(plan.fullyReturned).toBe(false);
    expect(plan.totalReturnedUnits).toBe(2);
    expect(plan.restockUnits).toBe(2);
    expect(plan.damagedUnits).toBe(0);
    expect(plan.nextLines[0].deliveredQuantity).toBe(1);
  });

  test("separa unidades devueltas como dañadas/merma sin sumarlas a restockUnits", () => {
    const plan = planMaterialReturn(sampleLines, "issued", [
      { sparePartId: "part-1", quantity: 3, disposition: "restock" },
      { sparePartId: "part-2", quantity: 2, disposition: "damaged" },
    ]);

    expect(plan.fullyReturned).toBe(false);
    expect(plan.restockUnits).toBe(3);
    expect(plan.damagedUnits).toBe(2);
    expect(plan.nextLines[0].deliveredQuantity).toBe(1);
    expect(plan.nextLines[1].deliveredQuantity).toBe(0);
  });

  test("rechaza devolver más unidades de las entregadas o un repuesto inexistente", () => {
    expect(() =>
      planMaterialReturn(sampleLines, "issued", [
        { sparePartId: "part-1", quantity: 5, disposition: "restock" },
      ]),
    ).toThrow(/entregadas/i);

    expect(() =>
      planMaterialReturn(sampleLines, "issued", [
        { sparePartId: "part-999", quantity: 1, disposition: "restock" },
      ]),
    ).toThrow(/pertenece/i);
  });
});
