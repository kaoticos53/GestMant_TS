import { backend } from "./backend";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../src/convex/_generated/api";
import { richDocToPlainText } from "../src/lib/richDoc";
import { DEFAULT_TRASH_RETENTION_DAYS } from "../src/lib/trash";

type Test = ReturnType<typeof convexTest>;
type Authed = ReturnType<Test["withIdentity"]>;

const DAY = 24 * 60 * 60 * 1000;

async function setup() {
  const t = backend();
  const managerId = await t.run((ctx) =>
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
  const partId = await t.run((ctx) =>
    ctx.db.insert("spareParts", {
      code: "TRI-60004",
      name: "Triac BTA16-600B",
      category: "Electrónica",
      unit: "ud",
      stock: 10,
      minStock: 2,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
  return {
    t,
    manager: t.withIdentity({ subject: `${managerId}|session1` }),
    tech: t.withIdentity({ subject: `${techId}|session1` }),
    managerId,
    techId,
    partId,
  };
}

/** Lanza la promesa y comprueba que el ConvexError contiene el texto. */
async function expectConvexError(promise: Promise<unknown>, fragment: string) {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(
    error,
    `Se esperaba un error que contuviera: ${fragment}`,
  ).not.toBeNull();
  const message =
    error instanceof ConvexError ? String(error.data) : String(error);
  expect(message).toContain(fragment);
}

/** La petición tal y como está guardada, mire donde mire la cola. */
async function requestByReference(authed: Authed, reference: string) {
  const items = await authed.query(api.partRequests.list, {
    includeArchived: true,
  });
  return items.find((item) => item.reference === reference);
}

describe("papelera de peticiones", () => {
  /** Petición ya rechazada (decidida, sin tocar stock). */
  async function rejectedRequest(
    manager: Authed,
    description = "Conector roto.",
  ) {
    const reference = await manager.mutation(api.partRequests.create, {
      requesterName: "Iván Torres",
      requesterTeam: "Realización",
      priority: "normal",
      description,
    });
    const request = await requestByReference(manager, reference);
    expect(request).toBeDefined();
    await manager.mutation(api.partRequests.reject, {
      requestId: request!._id,
      note: "No procede.",
    });
    return { id: request!._id, reference };
  }

  test("retirar la saca de la cola y del archivo, y la deja en la papelera con su plazo", async () => {
    const { manager } = await setup();
    const { id, reference } = await rejectedRequest(manager);
    await manager.mutation(api.partRequests.archive, { requestId: id });

    await manager.mutation(api.partRequests.withdraw, {
      requestId: id,
      reason: "Duplicada de la PET-0001",
    });

    // Fuera de las dos caras de la cola: ni el día a día ni el archivo la
    // enseñan, porque su sitio es la papelera.
    expect(await manager.query(api.partRequests.list, {})).toEqual([]);
    expect(
      await manager.query(api.partRequests.list, { includeArchived: true }),
    ).toEqual([]);

    const papelera = await manager.query(api.partRequests.trash, {});
    expect(papelera.items).toHaveLength(1);
    expect(papelera.items[0].reference).toBe(reference);
    expect(papelera.items[0].deletedBy).toBe("Elena Vidal");
    expect(papelera.items[0].deletedReason).toBe("Duplicada de la PET-0001");
    // Salió del archivo: recuperarla la devuelve allí, no a la cola.
    expect(papelera.items[0].archived).toBe(true);
    expect(papelera.retentionDays).toBe(DEFAULT_TRASH_RETENTION_DAYS);
    // El plazo se apunta al retirarla: se cuenta desde ahora, no desde el plazo
    // que tenga el taller el día que caduque.
    expect(papelera.items[0].purgeAt - papelera.items[0].deletedAt).toBe(
      DEFAULT_TRASH_RETENTION_DAYS * DAY,
    );
  });

  test("la ficha de una retirada se lee entera, y solo mientras está en la papelera", async () => {
    const { manager } = await setup();
    const { id, reference } = await rejectedRequest(manager);

    // Lo vivo no sale por aquí: se lee por su módulo.
    expect(
      await manager.query(api.partRequests.withdrawn, { requestId: id }),
    ).toBeNull();

    await manager.mutation(api.partRequests.withdraw, {
      requestId: id,
      reason: "Duplicada de la PET-0001",
    });

    const ficha = await manager.query(api.partRequests.withdrawn, {
      requestId: id,
    });
    expect(ficha?.reference).toBe(reference);
    expect(ficha?.status).toBe("rejected");
    expect(ficha?.deletedReason).toBe("Duplicada de la PET-0001");
    // Con los adjuntos resueltos, como la cola: la ficha los enseña y sin la URL
    // solo saldría el hueco.
    expect(ficha?.attachments).toEqual([]);

    await manager.mutation(api.partRequests.restore, { requestId: id });
    expect(
      await manager.query(api.partRequests.withdrawn, { requestId: id }),
    ).toBeNull();
  });

  test("recuperarla la devuelve tal y como estaba, con sus decisiones", async () => {
    const { t, manager } = await setup();
    // Una petición cancelada: lleva su motivo y la traza de la decisión, que es
    // lo que la papelera tiene que devolver intacto.
    const reference = await manager.mutation(api.partRequests.create, {
      requesterName: "Iván Torres",
      priority: "normal",
      description: "Conector roto.",
    });
    const created = await requestByReference(manager, reference);
    await manager.mutation(api.partRequests.cancel, {
      requestId: created!._id,
      note: "Se compró uno compatible.",
    });
    const id = created!._id;
    await manager.mutation(api.partRequests.withdraw, { requestId: id });

    await manager.mutation(api.partRequests.restore, { requestId: id });

    const cola = await manager.query(api.partRequests.list, {});
    expect(cola.map((item) => item.reference)).toEqual([reference]);
    expect(cola[0].status).toBe("cancelled");
    expect(richDocToPlainText(cola[0].cancelNote)).toContain(
      "Se compró uno compatible.",
    );
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("requestDecisions")
          .withIndex("by_request", (q) => q.eq("requestId", id))
          .collect(),
      ),
    ).toHaveLength(1);
    expect((await manager.query(api.partRequests.trash, {})).items).toEqual([]);

    const stored = await t.run((ctx) => ctx.db.get(id));
    expect(stored?.deletedAt).toBeUndefined();
    expect(stored?.deletedBy).toBeUndefined();
    expect(stored?.deletedReason).toBeUndefined();
    expect(stored?.purgeAt).toBeUndefined();
  });

  test("retirar es cosa de quien decide, y borrar exige haber retirado antes", async () => {
    const { t, manager, tech } = await setup();
    const { id } = await rejectedRequest(manager);

    await expectConvexError(
      tech.mutation(api.partRequests.withdraw, { requestId: id }),
      "No tienes permisos para retirar peticiones",
    );
    await expectConvexError(
      tech.query(api.partRequests.trash, {}),
      "No tienes permisos para ver la papelera de peticiones",
    );
    await expectConvexError(
      tech.query(api.partRequests.withdrawn, { requestId: id }),
      "No tienes permisos para ver la papelera de peticiones",
    );
    // Borrar de un tirón lo que nunca pasó por la papelera no se puede: sería
    // irreversible sin margen para arrepentirse.
    await expectConvexError(
      manager.mutation(api.partRequests.deleteNow, { requestId: id }),
      "Retira la petición antes de borrarla",
    );
    expect(await t.run((ctx) => ctx.db.get(id))).not.toBeNull();
  });

  test("borrar ya se lleva la petición y sus adjuntos, y deja las compras", async () => {
    const { t, manager } = await setup();
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["albarán"], { type: "application/pdf" })),
    );
    const reference = await manager.mutation(api.partRequests.create, {
      requesterName: "Iván Torres",
      priority: "normal",
      description: "Con el albarán del proveedor.",
      attachments: [{ storageId, name: "Albarán.pdf", kind: "document" }],
    });
    const request = await requestByReference(manager, reference);
    await manager.mutation(api.partRequests.withdraw, {
      requestId: request!._id,
    });

    await manager.mutation(api.partRequests.deleteNow, {
      requestId: request!._id,
    });

    expect(await t.run((ctx) => ctx.db.get(request!._id))).toBeNull();
    expect(await t.run((ctx) => ctx.storage.get(storageId))).toBeNull();
  });

  test("la pasada de la papelera borra lo caducado y respeta lo que está en plazo", async () => {
    const { t, manager } = await setup();
    const { id } = await rejectedRequest(manager);
    await manager.mutation(api.partRequests.withdraw, { requestId: id });

    // Dentro de plazo: la pasada no la toca.
    expect(await t.mutation(internal.partRequests.purgeExpired, {})).toBe(0);
    expect(await t.run((ctx) => ctx.db.get(id))).not.toBeNull();

    // Cumplido el plazo: se va de verdad, con su fila.
    await t.run((ctx) => ctx.db.patch(id, { purgeAt: Date.now() - 1000 }));
    expect(await t.mutation(internal.partRequests.purgeExpired, {})).toBe(1);
    expect(await t.run((ctx) => ctx.db.get(id))).toBeNull();
  });

  test("el plazo que se le apunta es el que tiene ajustado el taller", async () => {
    const { t, manager } = await setup();
    // El plazo de la papelera es el mismo que el del almacén: 30 días.
    await t.run((ctx) =>
      ctx.db.insert("storageSettings", {
        key: "default",
        trashRetentionDays: 30,
        updatedAt: Date.now(),
        updatedBy: "Ada Admin",
      }),
    );
    const { id } = await rejectedRequest(manager);

    await manager.mutation(api.partRequests.withdraw, { requestId: id });

    const papelera = await manager.query(api.partRequests.trash, {});
    expect(papelera.retentionDays).toBe(30);
    expect(
      (papelera.items[0].purgeAt - papelera.items[0].deletedAt) / DAY,
    ).toBe(30);
  });

  test("una retirada no aparece en la cola de nadie más", async () => {
    const { t, manager, tech } = await setup();
    const { id, reference } = await rejectedRequest(manager);
    await manager.mutation(api.partRequests.withdraw, {
      requestId: id,
      reason: "Pedida por error",
    });

    // El técnico tampoco la ve: la retirada vale para todo el taller, y el
    // motivo queda apuntado para saber por qué está en la papelera.
    expect(await tech.query(api.partRequests.list, {})).toEqual([]);
    expect((await t.run((ctx) => ctx.db.get(id)))?.deletedReason).toBe(
      "Pedida por error",
    );
    // El nombre del repuesto sigue en la fila: la papelera sabe qué se pidió.
    expect(reference).toBe("PET-0001");
  });

  test("lo retirado no se archiva, ni por la noche, ni entra en el resumen", async () => {
    const { t, manager } = await setup();
    const retirada = await rejectedRequest(manager, "Duplicada.");
    const viva = await rejectedRequest(manager, "Conector roto.");
    await manager.mutation(api.partRequests.withdraw, {
      requestId: retirada.id,
      reason: "Es el duplicado de otra",
    });

    // La limpieza a mano se lleva solo la viva: sacar de la papelera lo retirado
    // lo escondería de la pantalla que lo guarda.
    expect(
      await manager.mutation(api.partRequests.archiveDecidedBefore, {
        before: Date.now() + DAY,
      }),
    ).toBe(1);
    expect(
      (await t.run((ctx) => ctx.db.get(retirada.id)))?.archivedAt,
    ).toBeUndefined();
    expect((await t.run((ctx) => ctx.db.get(viva.id)))?.archivedAt).toBeTypeOf(
      "number",
    );

    // Y la pasada de la noche tampoco la toca.
    expect(await t.mutation(internal.archive.runAutoArchive, {})).toBe(0);

    // Ni el resumen semanal la cuenta: se retiró porque se pidió por error.
    const resumen = await t.query(internal.weeklyReport.sendContext, {});
    expect(resumen.text).not.toContain(retirada.reference);
    expect(resumen.text).not.toContain("Duplicada.");
  });
});
