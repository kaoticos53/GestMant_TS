import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import { backend } from "./backend";

describe("Equipos Fase 3 (Sub-fase 3.2)", () => {
  test("decommission bloquea si hay incidencias abiertas, da de baja y recupera piezas (salvage)", async () => {
    const t = backend();
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Técnico Equipos",
        email: "equipos@taller.es",
        role: "admin",
      }),
    );
    const authed = t.withIdentity({ subject: `${userId}|s1` });
    const now = Date.now();

    const partId = await t.run((ctx) =>
      ctx.db.insert("spareParts", {
        code: "SAL-01",
        name: "Fuente ATX",
        category: "Electrónica",
        unit: "ud",
        stock: 1,
        minStock: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const eqId = await authed.mutation(api.equipment.create, {
      code: "EQ-900",
      name: "Monitor Referencia",
      model: "Sony BVM",
      location: "Taller",
    });

    await t.action(api.incidents.report, {
      reporterName: "Ana",
      equipmentKind: "Monitor",
      model: "Sony BVM",
      location: "Taller",
      description: "Sin imagen",
      reportedAt: now,
    });
    const [inc] = await authed.query(api.incidents.list, {});
    await t.run((ctx) => ctx.db.patch(inc._id, { equipmentId: eqId }));

    await expect(
      authed.mutation(api.equipment.decommission, {
        id: eqId,
        reason: "Irreparable",
      }),
    ).rejects.toThrow(/incidencia\(s\) abierta/i);

    await authed.mutation(api.incidents.assign, {
      incidentId: inc._id,
      assigneeId: userId,
    });
    await authed.mutation(api.incidents.verify, {
      incidentId: inc._id,
      outcome: "unresolved",
    });

    const res = await authed.mutation(api.equipment.decommission, {
      id: eqId,
      reason: "Equipo dado de baja para despiece",
      salvagedParts: [{ sparePartId: partId, quantity: 2 }],
    });
    expect(res.salvagedUnits).toBe(2);

    const eq = await t.run((ctx) => ctx.db.get(eqId));
    expect(eq?.operationalState).toBe("decommissioned");
    expect(eq?.decommissionDate).toBeDefined();

    const part = await t.run((ctx) => ctx.db.get(partId));
    expect(part?.stock).toBe(3);

    const movs = await t.run((ctx) =>
      ctx.db
        .query("stockMovements")
        .filter((q) => q.eq(q.field("sparePartId"), partId))
        .collect(),
    );
    expect(movs.map((m) => m.kind)).toContain("salvage");
  });

  test("returnLoan con daños abre incidencia vinculada automáticamente", async () => {
    const t = backend();
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Técnico Equipos",
        email: "equipos2@taller.es",
        role: "admin",
      }),
    );
    const authed = t.withIdentity({ subject: `${userId}|s1` });

    const eqId = await authed.mutation(api.equipment.create, {
      code: "EQ-901",
      name: "Foco LED",
      model: "Arri SkyPanel",
      location: "Almacén",
    });

    await authed.mutation(api.equipment.loanOut, {
      id: eqId,
      borrowerName: "Estudio 2",
      location: "Plató B",
    });

    const ret = await authed.mutation(api.equipment.returnLoan, {
      id: eqId,
      condition: "damaged",
      openIncident: true,
      damageDescription: "Conector DMX doblado en devolución",
    });
    expect(ret.incidentReference).toMatch(/^INC-/);

    const eq = await t.run((ctx) => ctx.db.get(eqId));
    expect(eq?.currentLoan).toBeUndefined();

    const [inc] = await authed.query(api.incidents.list, {});
    expect(inc.equipmentId).toBe(eqId);
    expect(inc.priority).toBe("high");
    expect(inc.description).toContain("Conector DMX doblado");
  });
});
