import { describe, expect, test } from "vitest";
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
    admin: t.withIdentity({ subject: `${adminId}|s-admin` }),
    guest: t.withIdentity({ subject: `${guestId}|s-guest` }),
  };
}

describe("Fase 3 TDD — equipmentMovements (desplazamientos y ciclo de vida)", () => {
  test("registra alta, traslados de ubicación, baja y reactivación sin falsos positivos", async () => {
    const { t, admin, guest } = await setupUsers();

    const eqId = await admin.mutation(api.equipment.create, {
      code: "EQ-MOV01",
      name: "Cámara estudio",
      model: "HDC-3500",
      location: "Plató 1",
    });

    // Edición sin cambiar ubicación ni baja -> no añade movimiento
    await admin.mutation(api.equipment.update, {
      id: eqId,
      code: "EQ-MOV01",
      name: "Cámara estudio A",
      model: "HDC-3500",
      location: "Plató 1",
    });

    // Traslado + baja
    await admin.mutation(api.equipment.update, {
      id: eqId,
      code: "EQ-MOV01",
      name: "Cámara estudio A",
      model: "HDC-3500",
      location: "Unidad Móvil 2",
      decommissionDate: 1_700_000_000_000,
    });

    // Reactivación
    await admin.mutation(api.equipment.update, {
      id: eqId,
      code: "EQ-MOV01",
      name: "Cámara estudio A",
      model: "HDC-3500",
      location: "Unidad Móvil 2",
      decommissionDate: undefined,
    });

    await expect(
      t.query(api.equipmentMovements.listByEquipment, { equipmentId: eqId }),
    ).rejects.toThrow();
    await expect(
      guest.query(api.equipmentMovements.listByEquipment, { equipmentId: eqId }),
    ).rejects.toThrow();

    const history = await admin.query(api.equipmentMovements.listByEquipment, {
      equipmentId: eqId,
    });

    expect(history).toHaveLength(4);
    const kinds = history.map((h) => h.kind);
    expect(kinds).toContain("created");
    expect(kinds).toContain("location_change");
    expect(kinds).toContain("decommission");
    expect(kinds).toContain("reactivation");

    const move = history.find((h) => h.kind === "location_change");
    expect(move).toMatchObject({
      fromLocation: "Plató 1",
      toLocation: "Unidad Móvil 2",
    });
  });
});
