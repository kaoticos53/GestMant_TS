import { backend } from "./backend";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";

async function setup() {
  const t = backend();
  const coordinatorId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Elena Vidal",
      email: "coord@taller.es",
      role: "manager",
    }),
  );
  const techId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Iván Torres",
      email: "tecnico@taller.es",
      role: "technician",
    }),
  );
  const tech2Id = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Carlos Ruiz",
      email: "carlos@taller.es",
      role: "technician",
    }),
  );
  const equipmentId = await t.run((ctx) =>
    ctx.db.insert("equipment", {
      code: "EQ-001",
      name: "Cámara HDC",
      model: "HDC-3500",
      createdAt: 1000,
      updatedAt: 1000,
    }),
  );

  return {
    t,
    coordinator: t.withIdentity({ subject: `${coordinatorId}|session1` }),
    tech: t.withIdentity({ subject: `${techId}|session1` }),
    tech2: t.withIdentity({ subject: `${tech2Id}|session1` }),
    coordinatorId,
    techId,
    tech2Id,
    equipmentId,
  };
}

const baseIncident = {
  reporterName: "Laura Peña",
  location: "Control Central",
  description: "Fallo de alimentación",
  reportedAt: 1000,
  status: "reported" as const,
  reference: "INC-2026-0001",
  history: [{ status: "reported" as const, at: 1000 }],
  createdAt: 1000,
  updatedAt: 1000,
};

describe("Control de concurrencia optimista en incidencias (Optimistic Locking)", () => {
  test("permite actualizar cuando expectedUpdatedAt coincide con el updatedAt en base de datos", async () => {
    const { t, coordinator, techId } = await setup();
    const incidentId = await t.run((ctx) =>
      ctx.db.insert("incidents", {
        ...baseIncident,
        updatedAt: 5000,
      }),
    );

    await coordinator.mutation(api.incidents.assign, {
      incidentId,
      assigneeId: techId,
      expectedUpdatedAt: 5000,
    });

    const updated = await t.run((ctx) => ctx.db.get(incidentId));
    expect(updated?.status).toBe("assigned");
    expect(updated?.assigneeId).toBe(techId);
    expect(updated?.updatedAt).toBeGreaterThan(5000);
  });

  test("bloquea con error CONFLICT cuando expectedUpdatedAt es anterior al updatedAt actual", async () => {
    const { t, coordinator, techId } = await setup();
    const incidentId = await t.run((ctx) =>
      ctx.db.insert("incidents", {
        ...baseIncident,
        updatedAt: 6000,
      }),
    );

    // El cliente cree que la versión es 5000, pero en BD ya es 6000 (otro usuario guardó antes)
    await expect(
      coordinator.mutation(api.incidents.assign, {
        incidentId,
        assigneeId: techId,
        expectedUpdatedAt: 5000,
      }),
    ).rejects.toThrowError(/CONFLICT/);

    const untouched = await t.run((ctx) => ctx.db.get(incidentId));
    expect(untouched?.status).toBe("reported");
    expect(untouched?.updatedAt).toBe(6000);
  });

  test("mantiene compatibilidad retroactiva cuando expectedUpdatedAt no se envía", async () => {
    const { t, coordinator, techId } = await setup();
    const incidentId = await t.run((ctx) =>
      ctx.db.insert("incidents", {
        ...baseIncident,
        updatedAt: 5000,
      }),
    );

    // Sin enviar expectedUpdatedAt, la mutación se ejecuta normalmente
    await coordinator.mutation(api.incidents.assign, {
      incidentId,
      assigneeId: techId,
    });

    const updated = await t.run((ctx) => ctx.db.get(incidentId));
    expect(updated?.status).toBe("assigned");
  });

  test("detecta colisión concurrente al añadir notas en el cuaderno", async () => {
    const { t, tech, techId } = await setup();
    const incidentId = await t.run((ctx) =>
      ctx.db.insert("incidents", {
        ...baseIncident,
        status: "assigned",
        assigneeId: techId,
        updatedAt: 8000,
      }),
    );

    // Intento con versión desactualizada
    await expect(
      tech.mutation(api.incidents.addNote, {
        incidentId,
        note: "Revisando cableado",
        expectedUpdatedAt: 7500,
      }),
    ).rejects.toThrowError(/CONFLICT/);

    // Intento con versión correcta
    const noteId = await tech.mutation(api.incidents.addNote, {
      incidentId,
      note: "Revisando cableado",
      expectedUpdatedAt: 8000,
    });
    expect(noteId).toBeDefined();

    const incident = await t.run((ctx) => ctx.db.get(incidentId));
    expect(incident?.lifecycleNotes?.length).toBe(1);
  });

  test("detecta colisión concurrente al modificar datos de equipo", async () => {
    const { t, coordinator } = await setup();
    const incidentId = await t.run((ctx) =>
      ctx.db.insert("incidents", {
        ...baseIncident,
        model: "HDC-1500",
        updatedAt: 9000,
      }),
    );

    // Versión desactualizada
    await expect(
      coordinator.mutation(api.incidents.updateEquipment, {
        incidentId,
        model: "HDC-4300",
        expectedUpdatedAt: 8500,
      }),
    ).rejects.toThrowError(/CONFLICT/);

    // Versión correcta
    await coordinator.mutation(api.incidents.updateEquipment, {
      incidentId,
      model: "HDC-4300",
      expectedUpdatedAt: 9000,
    });

    const updated = await t.run((ctx) => ctx.db.get(incidentId));
    expect(updated?.model).toBe("HDC-4300");
  });
});
