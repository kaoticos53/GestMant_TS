import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import { backend } from "./backend";

describe("Incidencias Fase 3 (Sub-fase 3.1)", () => {
  test("reopen, createRecurrence y updateExternalRepair funcionan con trazabilidad y permisos", async () => {
    const t = backend();
    const coordId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Coordinador",
        email: "coord@taller.es",
        role: "admin",
      }),
    );
    const coord = t.withIdentity({ subject: `${coordId}|s1` });

    await t.action(api.incidents.report, {
      reporterName: "Juan",
      equipmentKind: "Cámara",
      model: "Sony PXW",
      location: "Plató 1",
      description: "No enciende",
      reportedAt: Date.now(),
    });

    const [inc] = await coord.query(api.incidents.list, {});
    await coord.mutation(api.incidents.assign, {
      incidentId: inc._id,
      assigneeId: coordId,
    });
    await coord.mutation(api.incidents.sendToExternalRepair, {
      incidentId: inc._id,
      companyName: "SAT Sony",
      defectNotes: "Placa base",
    });

    await coord.mutation(api.incidents.updateExternalRepair, {
      incidentId: inc._id,
      rmaNumber: "RMA-99",
      quoteStatus: "accepted",
      estimatedCost: 420,
    });

    let updated = await t.run((ctx) => ctx.db.get(inc._id));
    expect(updated?.externalRepair?.rmaNumber).toBe("RMA-99");
    expect(updated?.externalRepair?.quoteStatus).toBe("accepted");
    expect(updated?.externalRepair?.estimatedCost).toBe(420);

    await coord.mutation(api.incidents.close, {
      incidentId: inc._id,
      outcome: "resolved",
    });

    // Reapertura controlada
    await coord.mutation(api.incidents.reopen, {
      incidentId: inc._id,
      note: "Cerrada por error antes de probar HDMI",
    });
    updated = await t.run((ctx) => ctx.db.get(inc._id));
    expect(updated?.status).toBe("workshop");
    expect(updated?.closedAt).toBeUndefined();

    // Reincidencia vinculada
    const rec = await coord.mutation(api.incidents.createRecurrence, {
      parentIncidentId: inc._id,
      description: "Vuelve a fallar la fuente",
    });
    expect(rec.reference).toMatch(/^INC-/);
    expect(rec.incidentId).toBeDefined();
    const all = await coord.query(api.incidents.list, {});
    const child = all.find((row) => row.reference === rec.reference);
    expect(child?.parentIncidentId).toBe(inc._id);
  });
});
