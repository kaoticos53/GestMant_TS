import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import schema from "../src/convex/schema";
import { PUBLIC_CODE_LENGTH } from "../src/lib/publicCode";

/** Todos los módulos de funciones de la app (convex-test los levanta in-process). */
const modules = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

/**
 * Una sesión de invitado: el usuario existe, pero es anónimo y el backend no lo
 * considera del taller. Es lo que crea «Entrar como invitado» en `/auth`.
 */
/**
 * Lo que dice el error que lanza una consulta: `ConvexError` viaja en `data`, y
 * lo que el invitado lee es ese mensaje, no el envoltorio.
 */
async function refusal(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error, "Se esperaba un error y no lo hubo.").not.toBeNull();
  return error instanceof ConvexError ? String(error.data) : String(error);
}

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
        publicCode: "A7K2QX9M",
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

  test("con su código ve el seguimiento, sin el expediente del taller", async () => {
    const sesion = await tallerConIncidencia();

    // El código, escrito como se escriba: es lo que se le dio al notificar y lo
    // único que un invitado puede consultar.
    const tracking = await sesion.query(api.incidents.byCode, {
      code: "a7k2-qx9m",
    });
    expect(tracking?.code).toBe("A7K2QX9M");
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

  test("la cola entera sigue sin ser suya, ni con el código a mano", async () => {
    const sesion = await tallerConIncidencia();
    expect(
      await sesion.query(api.incidents.list, { includeArchived: true }),
    ).toEqual([]);
  });

  test("no puede ir probando referencias: la puerta del taller no es la suya", async () => {
    const sesion = await tallerConIncidencia();

    // Aquí estaba el agujero: la referencia es un correlativo, así que con una
    // sesión de invitado bastaba con probar «1», «2», «3»… para leer el
    // seguimiento de todos los casos del taller.
    for (const typed of ["7", "INC-0007", "inc-7"]) {
      const message = await refusal(
        sesion.query(api.incidents.byReference, { reference: typed }),
      );
      expect(message, `«${typed}»`).toContain("Solo el taller");
    }
  });

  test("un código que no lleva a nada no busca nada, y no falla", async () => {
    const sesion = await tallerConIncidencia();
    for (const typed of ["", "   ", "la del monitor", "ZZZZZZZZ", "INC-0007"]) {
      expect(
        await sesion.query(api.incidents.byCode, { code: typed }),
        `«${typed}»`,
      ).toBeNull();
    }
  });
});

/**
 * Y notificar no es una excepción: el alta de una incidencia no pide cuenta
 * —avisa quien está en el plató, no quien está dado de alta en la aplicación—,
 * así que una sesión de invitado entra por la misma puerta que un visitante sin
 * sesión, la del formulario público. Lo que hay que comprobar es que entra y
 * que no le abre nada más del taller.
 */
describe("el invitado puede notificar: notificar es la puerta pública", () => {
  /** El taller (un coordinador al lado, que es quien ve la cola) y el invitado. */
  async function tallerConGestor() {
    const t = convexTest(schema, modules);
    const managerId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Elena Vidal",
        email: "coord@taller.es",
        role: "manager",
      }),
    );
    const guestId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Invitado",
        role: "guest",
        isAnonymous: true,
      }),
    );
    return {
      manager: t.withIdentity({ subject: `${managerId}|session1` }),
      guest: t.withIdentity({ subject: `${guestId}|session1` }),
    };
  }

  /** El aviso de siempre, tal y como lo manda el formulario público. */
  const aviso = {
    reporterName: "Laura Peña",
    reporterRole: "Realización",
    location: "Plató 2",
    equipmentKind: "Monitor de plató",
    model: "PVM-A250",
    description: "El monitor pierde la señal cada pocos minutos.",
    reportedAt: 1_700_000_000_000,
  };

  test("su aviso entra en la cola del taller y él se lo lleva con el código", async () => {
    const { manager, guest } = await tallerConGestor();

    const created = await guest.mutation(api.incidents.report, aviso);

    // Las dos caras del mismo caso: la referencia con la que lo cita el taller y
    // el código con el que lo sigue quien avisó.
    expect(created.reference).toMatch(/^INC-\d+$/);
    expect(created.code).toHaveLength(PUBLIC_CODE_LENGTH);

    // Y en el taller ha entrado de verdad: la cola del coordinador la trae
    // notificada y sin asignar, esperando a que alguien la coja.
    const cola = await manager.query(api.incidents.list, {});
    expect(cola).toHaveLength(1);
    expect(cola[0].reference).toBe(created.reference);
    expect(cola[0].status).toBe("reported");

    // El invitado sigue su caso con el código —como cualquier visitante— y sigue
    // sin ver la cola: notificar le da un caso que seguir, no una ventana al
    // taller.
    const seguimiento = await guest.query(api.incidents.byCode, {
      code: created.code,
    });
    expect(seguimiento?.code).toBe(created.code);
    expect(seguimiento?.status).toBe("reported");
    expect(await guest.query(api.incidents.list, {})).toEqual([]);
  });

  test("notificar no le abre el caso: no lo trabaja él", async () => {
    const { manager, guest } = await tallerConGestor();

    await guest.mutation(api.incidents.report, aviso);
    const cola = await manager.query(api.incidents.list, {});
    const incidentId = cola[0]._id;

    // Ni se lo queda el caso que él mismo avisó…
    expect(
      await refusal(guest.mutation(api.incidents.selfAssign, { incidentId })),
    ).toContain("cuenta registrada para gestionar incidencias");
    // …ni lo cierra: el aviso entra por la puerta pública, pero el trabajo del
    // taller se queda dentro, y la puerta del taller no es la suya.
    expect(
      await refusal(
        guest.mutation(api.incidents.verify, {
          incidentId,
          outcome: "onsite",
        }),
      ),
    ).toContain("cuenta registrada para gestionar incidencias");
  });
});
