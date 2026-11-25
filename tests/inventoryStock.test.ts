import { backend } from "./backend";
import { describe, expect, test } from "vitest";
import { api, internal } from "../src/convex/_generated/api";
import {
  availableStock,
  computeReservedFromRequests,
  hasReservedStock,
  isRequestReservingStock,
  physicalStock,
  reservedUnits,
} from "../src/lib/inventoryStock";

async function authedTest() {
  const t = backend();
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Responsable de almacén",
      email: "almacen@taller.es",
      role: "admin",
    }),
  );
  return { t, authed: t.withIdentity({ subject: `${userId}|session1` }) };
}

describe("inventoryStock (lógica pura Fase 3)", () => {
  test("calcula stock reservado, disponible y físico", () => {
    expect(reservedUnits(undefined)).toBe(0);
    expect(reservedUnits(-3)).toBe(0);
    expect(reservedUnits(4.9)).toBe(4);

    expect(availableStock(7, 3)).toBe(7);
    expect(physicalStock(7, 3)).toBe(10);
    expect(physicalStock(7, undefined)).toBe(7);

    expect(hasReservedStock({ reservedStock: 0 })).toBe(false);
    expect(hasReservedStock({ reservedStock: 2 })).toBe(true);
    expect(isRequestReservingStock("approved")).toBe(true);
    expect(isRequestReservingStock("onHold", "approved")).toBe(true);
    expect(isRequestReservingStock("onHold", "pending")).toBe(false);
    expect(isRequestReservingStock("issued")).toBe(false);
  });

  test("computeReservedFromRequests suma solo peticiones vivas en curso de entrega", () => {
    const totals = computeReservedFromRequests([
      {
        status: "approved",
        lines: [{ sparePartId: "p1", quantity: 5, deliveredQuantity: 2 }],
      },
      {
        status: "onHold",
        heldFrom: "approved",
        lines: [{ sparePartId: "p1", quantity: 4, deliveredQuantity: 0 }],
      },
      {
        status: "issued",
        lines: [{ sparePartId: "p1", quantity: 3, deliveredQuantity: 3 }],
      },
      {
        status: "approved",
        deletedAt: 1000,
        lines: [{ sparePartId: "p1", quantity: 10, deliveredQuantity: 0 }],
      },
    ]);
    expect(totals.get("p1")).toBe(7); // (5 - 2) + 4
  });
});

describe("stock reservado en backend (Fase 3)", () => {
  test("approve reserva stock, issueLines/markIssued liberan reserva y reconcileReservedStock es idempotente", async () => {
    const { t, authed } = await authedTest();
    const now = Date.now();
    const sparePartId = await t.run((ctx) =>
      ctx.db.insert("spareParts", {
        code: "RES-01",
        name: "Rodamiento 6204",
        category: "Mecánica",
        unit: "ud",
        stock: 10,
        minStock: 2,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await authed.mutation(api.partRequests.create, {
      requesterName: "Laura",
      priority: "normal",
      description: "Cambio de rodamientos",
      lines: [{ sparePartId, quantity: 4 }],
    });
    const [request] = await authed.query(api.partRequests.list, {});

    // Al aprobar: stock disponible baja a 6, reservedStock sube a 4 (físico = 10)
    await authed.mutation(api.partRequests.approve, {
      requestId: request._id,
    });
    let part = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(part?.stock).toBe(6);
    expect(part?.reservedStock).toBe(4);
    expect(physicalStock(part!.stock, part!.reservedStock)).toBe(10);

    // Entrega parcial de 1 unidad: reservedStock baja a 3, stock sigue en 6 (físico = 9)
    await authed.mutation(api.partRequests.issueLines, {
      requestId: request._id,
      lines: [{ sparePartId, quantity: 1 }],
    });
    part = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(part?.stock).toBe(6);
    expect(part?.reservedStock).toBe(3);

    // Entrega completa del resto: reservedStock baja a 0, stock sigue en 6 (físico = 6)
    await authed.mutation(api.partRequests.markIssued, {
      requestId: request._id,
    });
    part = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(part?.stock).toBe(6);
    expect(part?.reservedStock).toBe(0);

    // Reconciliación manual tras un desajuste simulado
    await t.run((ctx) => ctx.db.patch(sparePartId, { reservedStock: 99 }));
    const res = await t.mutation(internal.spareParts.reconcileReservedStock, {});
    expect(res.updatedParts).toBe(1);
    part = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(part?.reservedStock).toBe(0);
  });

  test("cancelar una petición suspendida desde aprobada libera reserva y devuelve stock", async () => {
    const { t, authed } = await authedTest();
    const now = Date.now();
    const sparePartId = await t.run((ctx) =>
      ctx.db.insert("spareParts", {
        code: "RES-02",
        name: "Correa dentada",
        category: "Mecánica",
        unit: "ud",
        stock: 8,
        minStock: 2,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await authed.mutation(api.partRequests.create, {
      requesterName: "Carlos",
      priority: "normal",
      description: "Reparación cinta",
      lines: [{ sparePartId, quantity: 3 }],
    });
    const [request] = await authed.query(api.partRequests.list, {});

    await authed.mutation(api.partRequests.approve, {
      requestId: request._id,
    });
    await authed.mutation(api.partRequests.onHold, {
      requestId: request._id,
      note: "Esperando parada",
    });

    let part = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(part?.stock).toBe(5);
    expect(part?.reservedStock).toBe(3);

    await authed.mutation(api.partRequests.cancel, {
      requestId: request._id,
      note: "Ya no hace falta",
    });

    part = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(part?.stock).toBe(8);
    expect(part?.reservedStock).toBe(0);
  });

  test("revertApproval devuelve la petición a pendiente y libera reserva", async () => {
    const { t, authed } = await authedTest();
    const now = Date.now();
    const sparePartId = await t.run((ctx) =>
      ctx.db.insert("spareParts", {
        code: "REV-01",
        name: "Sensor inductivo",
        category: "Eléctrica",
        unit: "ud",
        stock: 5,
        minStock: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await authed.mutation(api.partRequests.create, {
      requesterName: "Lucía",
      priority: "normal",
      description: "Cambio de sensor",
      lines: [{ sparePartId, quantity: 2 }],
    });
    const [request] = await authed.query(api.partRequests.list, {});
    await authed.mutation(api.partRequests.approve, {
      requestId: request._id,
    });

    let part = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(part?.stock).toBe(3);
    expect(part?.reservedStock).toBe(2);

    await authed.mutation(api.partRequests.revertApproval, {
      requestId: request._id,
      adjustCatalogStockToZero: false,
      note: "Se asignó por error",
    });

    const reverted = await t.run((ctx) => ctx.db.get(request._id));
    expect(reverted?.status).toBe("pending");
    expect(reverted?.decidedBy).toBeUndefined();
    expect(reverted?.decidedAt).toBeUndefined();

    part = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(part?.stock).toBe(5);
    expect(part?.reservedStock).toBe(0);
  });

  test("revertApproval con adjustCatalogStockToZero ajusta el stock real a 0 y permite entrega parcial + ajuste a Y", async () => {
    const { t, authed } = await authedTest();
    const now = Date.now();
    const sparePartId = await t.run((ctx) =>
      ctx.db.insert("spareParts", {
        code: "REV-02",
        name: "Válvula solenoide",
        category: "Neumática",
        unit: "ud",
        stock: 5,
        minStock: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await authed.mutation(api.partRequests.create, {
      requesterName: "Mario",
      priority: "urgent",
      description: "Fallo neumático",
      lines: [{ sparePartId, quantity: 4 }],
    });
    const [request] = await authed.query(api.partRequests.list, {});
    await authed.mutation(api.partRequests.approve, {
      requestId: request._id,
    });

    await authed.mutation(api.partRequests.revertApproval, {
      requestId: request._id,
      adjustCatalogStockToZero: true,
      note: "No quedan unidades reales en estantería",
    });

    let reverted = await t.run((ctx) => ctx.db.get(request._id));
    expect(reverted?.status).toBe("pending");

    let part = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(part?.stock).toBe(0);
    expect(part?.reservedStock).toBe(0);

    const movements = await t.run((ctx) =>
      ctx.db
        .query("stockMovements")
        .filter((q) => q.eq(q.field("sparePartId"), sparePartId))
        .collect(),
    );
    expect(movements.map((m) => m.kind)).toContain("request_return");
    expect(movements.map((m) => m.kind)).toContain("manual_adjust");

    // Reponemos 5, aprobamos y entregamos 2 en el propio revertApproval dejando stock en 1
    await t.run((ctx) => ctx.db.patch(sparePartId, { stock: 5 }));
    await authed.mutation(api.partRequests.approve, {
      requestId: request._id,
    });
    await authed.mutation(api.partRequests.revertApproval, {
      requestId: request._id,
      deliverLines: [{ sparePartId, quantity: 2 }],
      stockAdjustments: [{ sparePartId, targetStock: 1 }],
      note: "Entregadas 2 unidades; 1 reservada en almacén",
    });

    reverted = await t.run((ctx) => ctx.db.get(request._id));
    expect(reverted?.status).toBe("pending");
    expect(reverted?.lines[0].deliveredQuantity).toBe(2);

    part = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(part?.stock).toBe(1);
    expect(part?.reservedStock).toBe(0);

    // Al volver a aprobar tras reponer 2, solo debe reservar las 2 unidades restantes
    await t.run((ctx) => ctx.db.patch(sparePartId, { stock: 3 }));
    await authed.mutation(api.partRequests.approve, {
      requestId: request._id,
    });
    part = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(part?.stock).toBe(1);
    expect(part?.reservedStock).toBe(2);
  });

  test("requestPurchase tras entrega parcial solo pide las unidades pendientes", async () => {
    const { t, authed } = await authedTest();
    const now = Date.now();
    const sparePartId = await t.run((ctx) =>
      ctx.db.insert("spareParts", {
        code: "REV-03",
        name: "Relé térmico",
        category: "Eléctrica",
        unit: "ud",
        stock: 5,
        minStock: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await authed.mutation(api.partRequests.create, {
      requesterName: "Elena",
      priority: "normal",
      description: "Cuadro principal",
      lines: [{ sparePartId, quantity: 5 }],
    });
    const [request] = await authed.query(api.partRequests.list, {});
    await authed.mutation(api.partRequests.approve, {
      requestId: request._id,
    });
    await authed.mutation(api.partRequests.revertApproval, {
      requestId: request._id,
      deliverLines: [{ sparePartId, quantity: 2 }],
      stockAdjustments: [{ sparePartId, targetStock: 0 }],
    });

    const res = await authed.mutation(api.purchasing.requestPurchase, {
      requestId: request._id,
    });
    expect(res.references.length).toBe(1);

    const linked = await authed.query(api.purchasing.byRequest, {
      requestId: request._id,
    });
    expect(linked.requests.length).toBe(1);
    expect(linked.requests[0].quantity).toBe(3);
  });
});
