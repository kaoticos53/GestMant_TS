import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import { backend } from "./backend";

async function authedPurchasingTest() {
  const t = backend();
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Responsable de compras",
      email: "compras@taller.es",
      role: "admin",
    }),
  );
  return { t, authed: t.withIdentity({ subject: `${userId}|session1` }) };
}

describe("Compras Fase 1 (Sub-fase 1.2 y 1.3)", () => {
  test("cancelOrder sobre orden parcial devuelve a pending solo las unidades pendientes", async () => {
    const { t, authed } = await authedPurchasingTest();
    const now = Date.now();
    const sparePartId = await t.run((ctx) =>
      ctx.db.insert("spareParts", {
        code: "COM-01",
        name: "Fuente 24V 5A",
        category: "Electrónica",
        unit: "ud",
        stock: 0,
        minStock: 1,
        supplier: "Moncada",
        createdAt: now,
        updatedAt: now,
      }),
    );

    await authed.mutation(api.partRequests.create, {
      requesterName: "Pedro",
      priority: "normal",
      description: "Repuesto sin stock",
      lines: [{ sparePartId, quantity: 5 }],
    });
    const [request] = await authed.query(api.partRequests.list, {});
    await authed.mutation(api.purchasing.requestPurchase, {
      requestId: request._id,
    });

    const prList = await authed.query(api.purchasing.listPurchaseRequests, {});
    expect(prList.requests).toHaveLength(1);
    const pr = prList.requests[0];

    const { orderId } = await authed.mutation(api.purchasing.createOrder, {
      purchaseRequestIds: [pr._id],
    });

    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["albaran-pdf"], { type: "application/pdf" })),
    );

    await authed.mutation(api.purchasing.receive, {
      orderId,
      items: [{ purchaseRequestId: pr._id, quantity: 2 }],
      deliveryNote: {
        storageId,
        name: "albaran-parcial.pdf",
        kind: "document",
      },
      note: "Entrega parcial inicial",
    });

    let part = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(part?.stock).toBe(2);

    const cancelRes = await authed.mutation(api.purchasing.cancelOrder, {
      orderId,
      note: "El proveedor no puede servir el resto",
    });
    expect(cancelRes.returned).toBe(1);

    const updatedPr = await t.run((ctx) => ctx.db.get(pr._id));
    expect(updatedPr?.status).toBe("pending");
    expect(updatedPr?.quantity).toBe(3);
    expect(updatedPr?.orderId).toBeUndefined();

    // El stock ya recibido sigue en almacén
    part = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(part?.stock).toBe(2);
  });

  test("reverseReception revierte entrada en almacén, reabre OC y PC, y valida stock disponible", async () => {
    const { t, authed } = await authedPurchasingTest();
    const now = Date.now();
    const sparePartId = await t.run((ctx) =>
      ctx.db.insert("spareParts", {
        code: "COM-02",
        name: "Ventilador axial 24V",
        category: "Refrigeración",
        unit: "ud",
        stock: 0,
        minStock: 2,
        supplier: "RS",
        createdAt: now,
        updatedAt: now,
      }),
    );

    await authed.mutation(api.partRequests.create, {
      requesterName: "Carlos",
      priority: "normal",
      description: "Ventilación armario",
      lines: [{ sparePartId, quantity: 4 }],
    });
    const [request] = await authed.query(api.partRequests.list, {});
    await authed.mutation(api.purchasing.requestPurchase, {
      requestId: request._id,
    });
    const prList = await authed.query(api.purchasing.listPurchaseRequests, {});
    const pr = prList.requests[0];

    const { orderId } = await authed.mutation(api.purchasing.createOrder, {
      purchaseRequestIds: [pr._id],
    });
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["albaran"], { type: "application/pdf" })),
    );

    await authed.mutation(api.purchasing.receive, {
      orderId,
      items: [{ purchaseRequestId: pr._id, quantity: 4 }],
      deliveryNote: {
        storageId,
        name: "albaran-completo.pdf",
        kind: "document",
      },
    });

    const receptions = await authed.query(api.purchasing.listReceptions, {});
    expect(receptions).toHaveLength(1);
    const receptionId = receptions[0]._id;

    let part = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(part?.stock).toBe(4);
    let order = await t.run((ctx) => ctx.db.get(orderId));
    expect(order?.status).toBe("completed");
    let updatedPr = await t.run((ctx) => ctx.db.get(pr._id));
    expect(updatedPr?.status).toBe("received");

    // Si el stock actual es menor que lo recibido (ej. ya se consumió parte), rechaza
    await t.run((ctx) => ctx.db.patch(sparePartId, { stock: 2 }));
    await expect(
      authed.mutation(api.purchasing.reverseReception, {
        receptionId,
        note: "Material defectuoso",
      }),
    ).rejects.toThrow(/stock disponible suficiente/i);

    // Restauramos stock a 4 y revertimos
    await t.run((ctx) => ctx.db.patch(sparePartId, { stock: 4 }));
    await authed.mutation(api.purchasing.reverseReception, {
      receptionId,
      note: "Material llegado defectuoso (DOA)",
    });

    part = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(part?.stock).toBe(0);
    order = await t.run((ctx) => ctx.db.get(orderId));
    expect(order?.status).toBe("pending");
    expect(order?.lines[0].receivedQuantity).toBe(0);
    updatedPr = await t.run((ctx) => ctx.db.get(pr._id));
    expect(updatedPr?.status).toBe("ordered");

    const updatedRec = await t.run((ctx) => ctx.db.get(receptionId));
    expect(updatedRec?.reversedAt).toBeDefined();

    const movements = await t.run((ctx) =>
      ctx.db
        .query("stockMovements")
        .filter((q) => q.eq(q.field("sparePartId"), sparePartId))
        .collect(),
    );
    expect(movements.map((m) => m.kind)).toContain("supplier_return");

    // No permite revertir dos veces
    await expect(
      authed.mutation(api.purchasing.reverseReception, {
        receptionId,
        note: "Segundo intento",
      }),
    ).rejects.toThrow(/ya fue revertida/i);
  });
});
