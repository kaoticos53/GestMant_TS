import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import schema from "../src/convex/schema";

/** Todos los módulos de funciones de la app (convex-test los levanta in-process). */
const modules = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

/**
 * Una sesión de invitado: el usuario existe, pero es anónimo y el backend no lo
 * considera del taller. Es lo que crea «Entrar como invitado» en `/auth`.
 */
async function guest() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Invitado",
      role: "guest",
      isAnonymous: true,
    }),
  );
  return t.withIdentity({ subject: `${userId}|session1` });
}

describe("el invitado no tumba el panel", () => {
  test("las listas que el panel pide al montar devuelven vacío, no un error", async () => {
    const sesion = await guest();

    // Estas seis se piden al montar el panel (módulos, cabecera, resumen). Antes
    // lanzaban «Debes iniciar sesión con una cuenta registrada…» y dejaban el
    // panel en una pantalla de error; ahora degradan a vacío.
    expect(await sesion.query(api.spareParts.list, {})).toEqual([]);
    expect(await sesion.query(api.equipment.list, {})).toEqual([]);
    expect(
      await sesion.query(api.partRequests.list, { includeArchived: true }),
    ).toEqual([]);
    expect(
      await sesion.query(api.incidents.list, { includeArchived: true }),
    ).toEqual([]);
    expect(await sesion.query(api.maintenance.list, {})).toEqual([]);
    expect(await sesion.query(api.messages.list, {})).toEqual([]);
    expect(await sesion.query(api.messages.contacts, {})).toEqual([]);
  });

  test("el invitado no ve el historial de mantenimiento del taller", async () => {
    const sesion = await guest();

    // El taller de verdad tiene un equipo con una intervención apuntada…
    await sesion.run(async (ctx) => {
      const equipmentId = await ctx.db.insert("equipment", {
        name: "Cámara de estudio",
        model: "HDC-3500",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("maintenanceRecords", {
        equipmentId,
        kind: "repair",
        title: "Cambio de fuente",
        performedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // …y el invitado sigue sin verla por la lista (el panel tampoco se la pide).
    expect(await sesion.query(api.maintenance.list, {})).toEqual([]);
  });

  test("sus permisos son ninguno, sin esperar a que le asignen el rol", async () => {
    const sesion = await guest();
    const permissions = await sesion.query(api.permissions.myPermissions, {});
    expect(permissions.role).toBe("guest");
    expect(Object.values(permissions.grants).every((grant) => !grant)).toBe(
      true,
    );
  });

  test("escribir sigue exigiendo una cuenta de verdad", async () => {
    const sesion = await guest();
    await expect(
      sesion.mutation(api.spareParts.create, {
        code: "X-1",
        name: "Prueba",
        category: "Conectividad",
        unit: "ud",
        stock: 1,
        minStock: 0,
      }),
    ).rejects.toThrow();
  });
});

describe("el invitado sigue su incidencia, y solo eso", () => {
  /**
   * El taller de verdad —una incidencia con cuaderno, papeles y nombre de quien
   * la notificó— y, al lado, la sesión de invitado de quien la notificó. Aquí
   * sí comparten base: es justo lo que hay que comprobar, que el invitado vea su
   * caso y nada más.
   */
  async function tallerConIncidencia() {
    const t = convexTest(schema, modules);
    const guestId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Invitado",
        role: "guest",
        isAnonymous: true,
      }),
    );
    await t.run(async (ctx) => {
      const incidentId = await ctx.db.insert("incidents", {
        reference: "INC-0007",
        reporterName: "Laura Peña",
        reporterRole: "Realización",
        location: "Plató 2",
        equipmentKind: "Monitor de plató",
        model: "PVM-A250",
        serialNumber: "PVM-2505-0007",
        description: "El monitor pierde la señal cada pocos minutos.",
        reportedAt: 1_700_000_000_000,
        status: "reported",
        notes: "Cambiar el cable de vídeo antes del directo del jueves.",
        history: [
          {
            status: "reported",
            at: 1_700_000_000_000,
            by: "Laura Peña",
            note: "Aviso recibido en el panel",
          },
        ],
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      });
      const documentId = await ctx.db.insert("incidentDocuments", {
        incidentId,
        name: "Parte interno.pdf",
        createdAt: 1_700_000_000_000,
      });
      await ctx.db.patch(incidentId, {
        documents: [
          {
            _id: documentId,
            name: "Parte interno.pdf",
            createdAt: 1_700_000_000_000,
          },
        ],
        lifecycleNotes: [
          {
            note: "Llamar al proveedor del cable.",
            author: "Elena Vidal",
            id: "nota-1",
            at: 1_700_000_000_000,
            createdAt: 1_700_000_000_000,
          },
        ],
      });
    });
    return t.withIdentity({ subject: `${guestId}|session1` });
  }

  test("con la referencia ve el seguimiento, sin el expediente del taller", async () => {
    const sesion = await tallerConIncidencia();

    const tracking = await sesion.query(api.incidents.byReference, {
      reference: "inc-7",
    });
    expect(tracking?.reference).toBe("INC-0007");
    expect(tracking?.status).toBe("reported");
    expect(tracking?.location).toBe("Plató 2");
    expect(tracking?.description).toContain("pierde la señal");

    // Lo que es del taller se queda dentro: la nota interna, el cuaderno, los
    // papeles y quién dio cada paso.
    expect(tracking).not.toHaveProperty("notes");
    expect(tracking).not.toHaveProperty("lifecycleNotes");
    expect(tracking).not.toHaveProperty("documents");
    expect(tracking!.history.every((entry) => !("by" in entry))).toBe(true);
    expect(tracking!.history.every((entry) => !("note" in entry))).toBe(true);
  });

  test("la cola entera sigue sin ser suya, ni con la referencia a mano", async () => {
    const sesion = await tallerConIncidencia();
    expect(
      await sesion.query(api.incidents.list, { includeArchived: true }),
    ).toEqual([]);
  });

  test("una referencia que no lleva número no busca nada, y no falla", async () => {
    const sesion = await tallerConIncidencia();
    for (const typed of ["", "   ", "la del monitor", "INC-9999"]) {
      expect(
        await sesion.query(api.incidents.byReference, { reference: typed }),
        `«${typed}»`,
      ).toBeNull();
    }
  });
});
