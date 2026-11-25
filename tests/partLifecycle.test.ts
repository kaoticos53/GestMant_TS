import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import {
  isPartPurchasable,
  validateReplacementPart,
} from "../src/lib/partLifecycle";
import { backend } from "./backend";

describe("partLifecycle (Sub-fase 2.2)", () => {
  test("isPartPurchasable bloquea solo artículos descatalogados", () => {
    expect(isPartPurchasable(undefined)).toBe(true);
    expect(isPartPurchasable("active")).toBe(true);
    expect(isPartPurchasable("low_availability")).toBe(true);
    expect(isPartPurchasable("discontinued")).toBe(false);
  });

  test("validateReplacementPart detecta auto-referencia y ciclos A -> B -> A", () => {
    const parts = [
      { _id: "p1", replacementPartId: "p2" },
      { _id: "p2", replacementPartId: "p3" },
      { _id: "p3" },
    ];

    expect(() => validateReplacementPart("p1", "p1", parts)).toThrow(
      /sí mismo/i,
    );
    expect(() => validateReplacementPart("p3", "p1", parts)).toThrow(/ciclo/i);
    expect(() => validateReplacementPart("p1", "p3", parts)).not.toThrow();
  });

  test("bloquea compra de repuesto descatalogado y permite sustituirlo por equivalente en petición", async () => {
    const t = backend();
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Responsable",
        email: "resp@taller.es",
        role: "admin",
      }),
    );
    const authed = t.withIdentity({ subject: `${userId}|s1` });
    const now = Date.now();

    const oldPartId = await t.run((ctx) =>
      ctx.db.insert("spareParts", {
        code: "OLD-01",
        name: "Modelo descatalogado",
        category: "Electrónica",
        unit: "ud",
        stock: 0,
        minStock: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );
    const eqPartId = await t.run((ctx) =>
      ctx.db.insert("spareParts", {
        code: "NEW-01",
        name: "Modelo equivalente",
        category: "Electrónica",
        unit: "ud",
        stock: 0,
        minStock: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await authed.mutation(api.spareParts.update, {
      id: oldPartId,
      lifecycleStatus: "discontinued",
      replacementPartId: eqPartId,
    });

    await authed.mutation(api.partRequests.create, {
      requesterName: "Carlos",
      priority: "normal",
      description: "Necesita placa",
      lines: [{ sparePartId: oldPartId, quantity: 2 }],
    });
    const [request] = await authed.query(api.partRequests.list, {});

    await expect(
      authed.mutation(api.purchasing.requestPurchase, {
        requestId: request._id,
      }),
    ).rejects.toThrow(/descatalogado/i);

    await authed.mutation(api.partRequests.replaceLine, {
      requestId: request._id,
      oldSparePartId: oldPartId,
      newSparePartId: eqPartId,
      quantity: 3,
      note: "Sustituido por equivalente actual",
    });

    const updated = await t.run((ctx) => ctx.db.get(request._id));
    expect(updated?.lines[0].sparePartId).toBe(eqPartId);
    expect(updated?.lines[0].quantity).toBe(3);

    const purchaseRes = await authed.mutation(api.purchasing.requestPurchase, {
      requestId: request._id,
    });
    expect(purchaseRes.references).toHaveLength(1);
  });
});
