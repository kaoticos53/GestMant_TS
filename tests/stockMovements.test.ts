import { afterEach, describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import { backend } from "./backend";

async function setupUsers() {
  const t = backend();
  const { adminId, guestId } = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", {
      name: "Admin Taller",
      email: "admin@taller.es",
      role: "admin",
      active: true,
    });
    const guestId = await ctx.db.insert("users", {
      name: "Invitado",
      isAnonymous: true,
      role: "guest",
    });
    return { adminId, guestId };
  });

  return {
    t,
    adminId,
    admin: t.withIdentity({ subject: `${adminId}|s-admin` }),
    guest: t.withIdentity({ subject: `${guestId}|s-guest` }),
  };
}

afterEach(() => {
  // Sin estado global pendiente
});

describe("Fase 2 TDD — stockMovements (libro mayor de repuestos)", () => {
  test("registra movimientos en alta, ajuste manual, edición, aprobación de petición y recepción de compra", async () => {
    const { t, admin, guest } = await setupUsers();

    // 1. Alta inicial con stock 5
    const partId = await admin.mutation(api.spareParts.create, {
      code: "AUD-MOV01",
      name: "Cable XLR 5m",
      category: "Cables",
      unit: "ud",
      stock: 5,
      minStock: 2,
      location: "A-01",
    });

    // 2. Ajuste rápido +3 -> 8
    await admin.mutation(api.spareParts.adjustStock, {
      id: partId,
      delta: 3,
    });

    // 3. Edición directa de stock 8 -> 6
    await admin.mutation(api.spareParts.update, {
      id: partId,
      stock: 6,
    });

    // 4. Aprobación de petición de 2 unidades -> 4
    const reqRef = await admin.mutation(api.partRequests.create, {
      requesterName: "Admin Taller",
      priority: "normal",
      lines: [{ sparePartId: partId, quantity: 2 }],
    });
    const reqDoc = await t.run((ctx) =>
      ctx.db
        .query("partRequests")
        .withIndex("by_reference", (q) => q.eq("reference", reqRef))
        .unique(),
    );
    expect(reqDoc).not.toBeNull();
    await admin.mutation(api.partRequests.approve, {
      requestId: reqDoc!._id,
      note: "Aprobada para ensayo",
    });

    // Anónimos e invitados no pueden leer movimientos
    await expect(
      t.query(api.stockMovements.listByPart, { sparePartId: partId }),
    ).rejects.toThrow();
    await expect(
      guest.query(api.stockMovements.listRecent, {}),
    ).rejects.toThrow();

    const byPart = await admin.query(api.stockMovements.listByPart, {
      sparePartId: partId,
    });
    expect(byPart).toHaveLength(4);
    expect(byPart[0]).toMatchObject({
      kind: "request_reserve",
      previousStock: 6,
      delta: -2,
      nextStock: 4,
      reference: reqRef,
    });
    expect(byPart[1]).toMatchObject({
      kind: "manual_adjust",
      previousStock: 8,
      delta: -2,
      nextStock: 6,
    });
    expect(byPart[2]).toMatchObject({
      kind: "manual_adjust",
      previousStock: 5,
      delta: 3,
      nextStock: 8,
    });
    expect(byPart[3]).toMatchObject({
      kind: "initial",
      previousStock: 0,
      delta: 5,
      nextStock: 5,
    });
  });
});
