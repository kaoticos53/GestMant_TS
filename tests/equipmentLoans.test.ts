import { backend } from "./backend";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import {
  EQUIPMENT_MOVEMENT_META,
  EQUIPMENT_OPERATIONAL_META,
  resolveOperationalState,
} from "../src/lib/movements";

async function authedTest() {
  const t = backend();
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Coordinador",
      email: "coord@taller.es",
      role: "admin",
    }),
  );
  return { t, userId, authed: t.withIdentity({ subject: `${userId}|s1` }) };
}

describe("Estado operativo y préstamos temporales (Fase 5)", () => {
  test("resolveOperationalState y metadatos cubren todos los estados", () => {
    expect(EQUIPMENT_MOVEMENT_META.loan_out.label).toBe("Préstamo temporal");
    expect(EQUIPMENT_MOVEMENT_META.loan_return.label).toBe(
      "Devolución de préstamo",
    );
    expect(EQUIPMENT_OPERATIONAL_META.loaned.label).toBe("Prestado");

    expect(resolveOperationalState({})).toBe("operational");
    expect(
      resolveOperationalState({
        decommissionDate: 1000,
        currentLoan: { borrowerName: "Ana", loanedAt: 500 },
      }),
    ).toBe("decommissioned");
    expect(
      resolveOperationalState({
        operationalState: "in_workshop",
        currentLoan: { borrowerName: "Ana", loanedAt: 500 },
      }),
    ).toBe("loaned");
    expect(
      resolveOperationalState({ operationalState: "external_repair" }),
    ).toBe("external_repair");
  });

  test("loanOut y returnLoan registran movimientos y actualizan estado operativo", async () => {
    const { t, authed } = await authedTest();
    const eqId = await authed.mutation(api.equipment.create, {
      code: "CAM-10",
      name: "Cámara ENG",
      model: "PXW-Z280",
      location: "Almacén",
    });

    await authed.mutation(api.equipment.loanOut, {
      id: eqId,
      borrowerName: "Unidad Móvil 2",
      location: "Exterior Madrid",
      notes: "Cobertura evento",
    });

    let eq = await t.run((ctx) => ctx.db.get(eqId));
    expect(eq?.operationalState).toBe("loaned");
    expect(eq?.currentLoan?.borrowerName).toBe("Unidad Móvil 2");
    expect(eq?.currentLoan?.location).toBe("Exterior Madrid");

    let movements = await authed.query(api.equipmentMovements.listByEquipment, {
      equipmentId: eqId,
    });
    expect(movements.some((m) => m.kind === "loan_out")).toBe(true);

    await authed.mutation(api.equipment.returnLoan, {
      id: eqId,
      notes: "Devuelta sin incidencias",
    });

    eq = await t.run((ctx) => ctx.db.get(eqId));
    expect(eq?.operationalState).toBe("operational");
    expect(eq?.currentLoan).toBeUndefined();

    movements = await authed.query(api.equipmentMovements.listByEquipment, {
      equipmentId: eqId,
    });
    expect(movements.some((m) => m.kind === "loan_return")).toBe(true);
  });

  test("incidencias en taller y SAT externo sincronizan operationalState del equipo", async () => {
    const { t, userId, authed } = await authedTest();
    const eqId = await authed.mutation(api.equipment.create, {
      code: "MON-05",
      name: "Monitor técnico",
      model: "BVM-HX310",
      location: "Control A",
    });

    const now = Date.now();
    const incidentId = await t.run((ctx) =>
      ctx.db.insert("incidents", {
        reference: "INC-9001",
        reporterName: "Técnico",
        description: "No enciende fuente",
        reportedAt: now,
        status: "assigned",
        assigneeId: userId,
        assigneeName: "Coordinador",
        equipmentId: eqId,
        createdAt: now,
        updatedAt: now,
        history: [],
      }),
    );

    await authed.mutation(api.incidents.verify, {
      incidentId,
      outcome: "workshop",
      equipmentId: eqId,
      notes: "Pasa a taller",
    });
    let eq = await t.run((ctx) => ctx.db.get(eqId));
    expect(eq?.operationalState).toBe("in_workshop");

    await authed.mutation(api.incidents.sendToExternalRepair, {
      incidentId,
      companyName: "Sony SAT",
      defectNotes: "Placa fuente dañada",
    });
    eq = await t.run((ctx) => ctx.db.get(eqId));
    expect(eq?.operationalState).toBe("external_repair");

    await authed.mutation(api.incidents.receiveFromExternalRepair, {
      incidentId,
      repairNotes: "Placa sustituida",
    });
    eq = await t.run((ctx) => ctx.db.get(eqId));
    expect(eq?.operationalState).toBe("in_workshop");

    await authed.mutation(api.incidents.close, {
      incidentId,
      outcome: "resolved",
      equipmentId: eqId,
      notes: "Verificado OK",
    });
    eq = await t.run((ctx) => ctx.db.get(eqId));
    expect(eq?.operationalState).toBe("operational");
  });
});
