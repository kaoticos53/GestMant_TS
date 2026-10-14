// El armazón del panel: los números que se cuentan sin cargar los módulos.
//
// Lo que comprueba esta suite es que el contador devuelve exactamente lo que
// devolvían las listas que el panel pedía al montar —con lo retirado y lo
// archivado fuera, y cada bloque con el permiso de su lista— y que el aviso de
// trabajo sin constancia llega ya decidido: quién está parado y cuántos días
// lleva, ordenado de lo más parado a lo menos.
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";
import schema from "../src/convex/schema";

/** Todos los módulos de funciones de la app (convex-test los levanta in-process). */
const modules = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

type Test = ReturnType<typeof convexTest>;
type Authed = ReturnType<Test["withIdentity"]>;

const DAY = 24 * 60 * 60 * 1000;

/** El taller con su gente: quien gobierna, quien trabaja y quien no es del taller. */
async function taller() {
  const t = convexTest(schema, modules);
  const gestor = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Rita Repuestos",
      email: "responsable@taller.es",
      role: "manager",
    }),
  );
  const tecnico = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Teo Técnico",
      email: "tecnico@taller.es",
      role: "technician",
    }),
  );
  const invitada = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Invitada",
      email: "invitada@taller.es",
      role: "manager",
      isAnonymous: true,
    }),
  );
  const baja = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Diego de baja",
      email: "baja@taller.es",
      role: "manager",
      active: false,
    }),
  );
  const como = (userId: Id<"users">): Authed =>
    t.withIdentity({ subject: `${userId}|sesion` });
  return {
    t,
    gestor,
    tecnico,
    invitada,
    baja,
    como,
    gestora: como(gestor),
    tecnicoAut: como(tecnico),
  };
}

/**
 * Una incidencia con lo justo que cuenta esta consulta: su estado, quién la
 * lleva (el técnico, que es quien deja constancia con sus notas), cuándo empezó
 * el trabajo —el paso a «asignada» de su historial, que es lo que lee la regla
 * de trabajo sin constancia— y las marcas de archivo y retirada.
 */
function incidencia(
  t: Test,
  fields: {
    reference: string;
    status: "reported" | "assigned" | "resolved";
    /** Cuándo se asignó: de ahí sale «lleva N días en curso». */
    startedAt?: number;
    assignee?: Id<"users">;
    archivedAt?: number;
    deletedAt?: number;
    /** Si su técnico anotó algo en el cuaderno (una constancia del trabajo). */
    withNote?: boolean;
  },
) {
  const now = Date.now();
  const startedAt = fields.startedAt ?? now;
  return t.run((ctx) =>
    ctx.db.insert("incidents", {
      reference: fields.reference,
      reporterName: "Laura Peña",
      description: "Se apaga sola en directo.",
      reportedAt: startedAt - DAY,
      status: fields.status,
      ...(fields.assignee === undefined
        ? {}
        : { assigneeId: fields.assignee, assigneeName: "Teo Técnico" }),
      ...(fields.archivedAt === undefined
        ? {}
        : { archivedAt: fields.archivedAt, archivedBy: "Ada Admin" }),
      ...(fields.deletedAt === undefined
        ? {}
        : {
            deletedAt: fields.deletedAt,
            purgeAt: fields.deletedAt + 30 * DAY,
          }),
      ...(fields.withNote === true
        ? {
            lifecycleNotes: [
              {
                note: "Cambio el cable y lo pruebo.",
                author: "Teo Técnico",
                authorId: fields.assignee,
                at: startedAt + DAY,
              },
            ],
          }
        : {}),
      history: [
        { status: "reported" as const, at: startedAt - DAY, by: "Laura Peña" },
        { status: "assigned" as const, at: startedAt, by: "Elena Vidal" },
      ],
      createdAt: startedAt - DAY,
      updatedAt: startedAt,
    }),
  );
}

/** Un repuesto del catálogo: lo que cuenta es su stock y su mínimo. */
function repuesto(
  t: Test,
  fields: { code: string; stock: number; minStock: number },
) {
  const now = Date.now();
  return t.run((ctx) =>
    ctx.db.insert("spareParts", {
      code: fields.code,
      name: `Repuesto ${fields.code}`,
      category: "Electrónica",
      unit: "ud",
      stock: fields.stock,
      minStock: fields.minStock,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

/**
 * Una petición de repuesto con lo que mira el resumen. Sin repuesto (`line`) va
 * sin líneas, que es la petición que no se puede aprobar y el panel señala.
 */
function peticion(
  t: Test,
  fields: {
    reference: string;
    status: "pending" | "issued" | "approved";
    priority?: "urgent" | "normal" | "low";
    line?: Id<"spareParts">;
    archivedAt?: number;
    deletedAt?: number;
  },
) {
  const now = Date.now();
  return t.run((ctx) =>
    ctx.db.insert("partRequests", {
      reference: fields.reference,
      requesterName: "Teo Técnico",
      priority: fields.priority ?? "normal",
      status: fields.status,
      lines:
        fields.line === undefined
          ? []
          : [
              {
                sparePartId: fields.line,
                code: "ALI-24015",
                name: "Fuente de alimentación",
                quantity: 1,
              },
            ],
      ...(fields.archivedAt === undefined
        ? {}
        : { archivedAt: fields.archivedAt }),
      ...(fields.deletedAt === undefined
        ? {}
        : { deletedAt: fields.deletedAt }),
      createdAt: now,
    }),
  );
}

/** Una petición de compra del responsable, colgada de su petición de repuesto. */
function compra(
  t: Test,
  fields: {
    reference: string;
    status: "pending" | "ordered" | "received" | "cancelled";
    part: Id<"spareParts">;
    request: Id<"partRequests">;
  },
) {
  const now = Date.now();
  return t.run((ctx) =>
    ctx.db.insert("purchaseRequests", {
      reference: fields.reference,
      requestId: fields.request,
      requestReference: "PET-0001",
      requestDate: now,
      requesterName: "Teo Técnico",
      sparePartId: fields.part,
      code: "ALI-24015",
      name: "Fuente de alimentación",
      unit: "ud",
      quantity: 2,
      supplier: "Electro Suministros",
      status: fields.status,
      reason: "noStock",
      requestedAt: now,
      requestedBy: "Rita Repuestos",
      createdAt: now,
    }),
  );
}

function equipo(t: Test, model: string) {
  const now = Date.now();
  return t.run((ctx) =>
    ctx.db.insert("equipment", {
      name: `Equipo ${model}`,
      model,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

function manual(t: Test, title: string) {
  const now = Date.now();
  return t.run((ctx) =>
    ctx.db.insert("manuals", {
      title,
      kind: "note",
      type: "Cámara",
      createdAt: now,
      updatedAt: now,
    }),
  );
}

describe("el contador del armazón", () => {
  test("cuenta la cola viva: píldoras, tarjetas y stock bajo", async () => {
    const mundo = await taller();
    const { t } = mundo;

    await incidencia(t, { reference: "INC-0001", status: "reported" });
    // Archivada y retirada: ni una cosa ni la otra son cola viva.
    await incidencia(t, {
      reference: "INC-0002",
      status: "reported",
      archivedAt: Date.now(),
    });
    await incidencia(t, {
      reference: "INC-0003",
      status: "reported",
      deletedAt: Date.now(),
    });
    // Resuelta: no es «sin tratar».
    await incidencia(t, { reference: "INC-0004", status: "resolved" });

    // Los dos repuestos del catálogo no vienen de ninguna petición.
    const conStock = await repuesto(t, {
      code: "ALI-24015",
      stock: 5,
      minStock: 1,
    });
    await repuesto(t, { code: "TOR-1", stock: 0, minStock: 2 });

    await peticion(t, {
      reference: "PET-0001",
      status: "pending",
      line: conStock,
    });
    // Urgente y sin repuesto asociado: no se puede aprobar.
    await peticion(t, {
      reference: "PET-0002",
      status: "pending",
      priority: "urgent",
    });
    await peticion(t, {
      reference: "PET-0003",
      status: "issued",
      line: conStock,
    });
    await peticion(t, {
      reference: "PET-0004",
      status: "pending",
      archivedAt: Date.now(),
    });
    await peticion(t, {
      reference: "PET-0005",
      status: "pending",
      deletedAt: Date.now(),
    });

    await equipo(t, "HDC-3500");
    await equipo(t, "PDW-F800");
    await manual(t, "Cámara HDC-3500: menús");

    await compra(t, {
      reference: "PC-0001",
      status: "pending",
      part: conStock,
      request: await peticion(t, {
        reference: "PET-0006",
        status: "approved",
        line: conStock,
      }),
    });
    await compra(t, {
      reference: "PC-0002",
      status: "cancelled",
      part: conStock,
      request: await peticion(t, {
        reference: "PET-0007",
        status: "approved",
        line: conStock,
      }),
    });

    const resumen = await mundo.gestora.query(api.dashboard.summary, {});

    // Una incidencia sin tratar de cuatro (una archivada, una retirada y una resuelta).
    expect(resumen.incidents.reported).toBe(1);
    // Cinco peticiones vivas: dos pendientes (una urgente, y una de ellas sin
    // repuesto asociado), una entregada y las dos aprobadas de las que salen las
    // compras.
    expect(resumen.requests).toMatchObject({
      active: 5,
      pending: 2,
      urgent: 1,
      withoutReference: 1,
      issued: 1,
    });
    expect(resumen.parts).toEqual({ total: 2, lowStock: 1 });
    expect(resumen.equipment).toBe(2);
    expect(resumen.manuals).toBe(1);
    // Lo cancelado no espera a que nadie monte la orden.
    expect(resumen.purchasing.pending).toBe(1);
  });

  test("el aviso de trabajo sin constancia sale de lo más parado a lo menos", async () => {
    const mundo = await taller();
    const { t, tecnico } = mundo;
    const now = Date.now();

    await incidencia(t, {
      reference: "INC-0001",
      status: "assigned",
      startedAt: now - 8 * DAY,
      assignee: tecnico,
    });
    await incidencia(t, {
      reference: "INC-0002",
      status: "assigned",
      startedAt: now - 4 * DAY,
      assignee: tecnico,
    });
    // Su técnico ya anotó algo: no es un trabajo sin constancia.
    await incidencia(t, {
      reference: "INC-0003",
      status: "assigned",
      startedAt: now - 6 * DAY,
      assignee: tecnico,
      withNote: true,
    });
    // Todavía no ha pasado el margen del taller.
    await incidencia(t, {
      reference: "INC-0004",
      status: "assigned",
      startedAt: now - DAY,
      assignee: tecnico,
    });

    const conMargen = await mundo.gestora.query(api.dashboard.summary, {
      marginDays: 3,
    });
    expect(
      conMargen.staleWork.map((entry) => [
        entry.incident.reference,
        entry.days,
      ]),
    ).toEqual([
      ["INC-0001", 8],
      ["INC-0002", 4],
    ]);
    // Lo que el aviso enseña de la incidencia, y nada más.
    expect(conMargen.staleWork[0].incident).toMatchObject({
      reference: "INC-0001",
      status: "assigned",
      assigneeName: "Teo Técnico",
    });

    // Con un margen más ancho, lo que estaba a cuatro días deja de ser aviso.
    const conMasMargen = await mundo.gestora.query(api.dashboard.summary, {
      marginDays: 9,
    });
    expect(conMasMargen.staleWork).toEqual([]);
  });

  test("cada bloque cuenta lo que su lista deja ver", async () => {
    const mundo = await taller();
    const { t } = mundo;
    const part = await repuesto(t, {
      code: "ALI-24015",
      stock: 0,
      minStock: 2,
    });
    await equipo(t, "HDC-3500");
    await manual(t, "Cámara HDC-3500: menús");
    await compra(t, {
      reference: "PC-0001",
      status: "pending",
      part,
      request: await peticion(t, {
        reference: "PET-0001",
        status: "approved",
        line: part,
      }),
    });

    // El técnico no tiene el módulo de compras (su lista tampoco le contesta),
    // pero sí puede mirar el catálogo y los equipos desde una petición.
    const delTecnico = await mundo.tecnicoAut.query(api.dashboard.summary, {});
    expect(delTecnico.purchasing.pending).toBe(0);
    expect(delTecnico.parts).toEqual({ total: 1, lowStock: 1 });
    expect(delTecnico.equipment).toBe(1);
    expect(delTecnico.manuals).toBe(1);

    // Quien gobierna el taller lo ve todo.
    const delGestor = await mundo.gestora.query(api.dashboard.summary, {});
    expect(delGestor.purchasing.pending).toBe(1);
    expect(delGestor.parts).toEqual(delTecnico.parts);
  });

  test("un invitado o una cuenta de baja no cuenta nada", async () => {
    const mundo = await taller();
    const { t } = mundo;
    await incidencia(t, { reference: "INC-0001", status: "reported" });
    await peticion(t, { reference: "PET-0001", status: "pending" });
    await repuesto(t, { code: "ALI-24015", stock: 0, minStock: 2 });

    // Otro miembro cualquiera ve el taller; estas dos cuentas, no.
    const delGestor = await mundo.gestora.query(api.dashboard.summary, {});
    expect(delGestor.requests.pending).toBe(1);
    expect(delGestor.incidents.reported).toBe(1);

    for (const cuenta of [mundo.invitada, mundo.baja]) {
      const resumen = await mundo.como(cuenta).query(api.dashboard.summary, {});
      expect(resumen).toMatchObject({
        incidents: { reported: 0 },
        requests: {
          active: 0,
          pending: 0,
          urgent: 0,
          withoutReference: 0,
          issued: 0,
        },
        parts: { total: 0, lowStock: 0 },
        equipment: 0,
        manuals: 0,
        purchasing: { pending: 0 },
        staleWork: [],
      });
    }
  });
});
