import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";
import schema from "../src/convex/schema";

/** Todos los módulos de funciones de la app (convex-test los levanta in-process). */
const modules = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

type Test = ReturnType<typeof convexTest>;

/** Lanza la promesa y comprueba que el ConvexError contiene el texto. */
async function expectConvexError(promise: Promise<unknown>, fragment: string) {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error).toBeInstanceOf(ConvexError);
  const message =
    error instanceof ConvexError ? String(error.data) : String(error);
  expect(message).toContain(fragment);
}

/** Coordinador (notas y expediente) y técnico (peticiones y mensajes). */
async function setup() {
  const t = convexTest(schema, modules);
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
  return {
    t,
    coordinator: t.withIdentity({ subject: `${coordinatorId}|session1` }),
    tech: t.withIdentity({ subject: `${techId}|session1` }),
    coordinatorId,
    techId,
  };
}

/** Un archivo distinto en cada prueba: el almacén de mentira identifica las
 * direcciones por el contenido, así que dos fotos iguales comparten dirección. */
let marker = 0;
async function file(t: Test): Promise<Id<"_storage">> {
  marker += 1;
  const bytes = new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    marker,
  ]);
  return await t.run((ctx) =>
    ctx.storage.store(new Blob([bytes], { type: "image/png" })),
  );
}

/** La dirección con la que se enlaza un archivo dentro de un texto. */
async function urlOf(t: Test, storageId: Id<"_storage">): Promise<string> {
  const url = await t.run((ctx) => ctx.storage.getUrl(storageId));
  if (url === null) throw new Error("Ese archivo ya no está en el almacén.");
  return url;
}

/** ¿Sigue el archivo en el almacén del taller? */
async function stillStored(
  t: Test,
  storageId: Id<"_storage">,
): Promise<boolean> {
  return (await t.run((ctx) => ctx.storage.getUrl(storageId))) !== null;
}

/** Los mínimos de un aviso público, para llegar al meollo: sus imágenes. */
const reportArgs = {
  reporterName: "Laura Peña",
  equipmentKind: "Cámara de estudio",
  model: "HDC-3500",
  reportedAt: Date.now() - 60 * 60 * 1000,
};

/** La incidencia notificada, para colgarle notas y versiones. */
async function reportedIncident(t: Test, description: string) {
  await t.mutation(api.incidents.report, { ...reportArgs, description });
  const [incident] = await t.run((ctx) => ctx.db.query("incidents").collect());
  return incident;
}

/**
 * La limpieza, dándolo todo por viejo: las pruebas no dependen del reloj. El
 * corte va un poco por delante de ahora porque el sello de un archivo puede ir
 * unos milisegundos por delante del reloj —los sellos van en orden dentro de una
 * misma milésima— y lo que se quiere aquí es que no quede nada por madurar.
 */
async function sweepEverything(t: Test) {
  return await t.mutation(internal.storageCleanup.sweepOrphanFiles, {
    before: Date.now() + 1000,
  });
}

describe("limpieza de los archivos que ya no cita nadie", () => {
  test("la foto que solo vive en una versión de la nota se queda", async () => {
    const { t, coordinator } = await setup();
    const storageId = await file(t);
    const url = await urlOf(t, storageId);
    const incident = await reportedIncident(
      t,
      "<p>La cámara se apaga sola en directo.</p>",
    );

    // La nota se escribe con la foto y luego su autor la corrige para quitarla.
    const noteId = await coordinator.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: `<p>Comprobado en plató.</p><img src="${url}">`,
    });
    await coordinator.mutation(api.incidents.updateNote, {
      incidentId: incident._id,
      noteId,
      note: "<p>Comprobado en plató: el conector estaba flojo.</p>",
    });

    // La foto ya no está en la nota, pero sí en lo que decía antes: la limpieza
    // no puede llevársela, porque el expediente todavía la muestra.
    const after = await t.run((ctx) => ctx.db.get(incident._id));
    const note = after?.lifecycleNotes?.[0];
    expect(note?.note).not.toContain(url);
    expect(note?.versions?.[0].note).toContain(url);

    expect(await sweepEverything(t)).toBe(0);
    expect(await stillStored(t, storageId)).toBe(true);
  });

  test("la versión anterior de un manual se queda al sustituir su PDF", async () => {
    const { t, coordinator } = await setup();
    const primero = await file(t);
    const segundo = await file(t);
    await coordinator.mutation(api.manuals.create, {
      title: "Manual de servicio HDC-3500",
      kind: "file",
      type: "Manual de servicio",
      storageId: primero,
      fileName: "v1.pdf",
    });
    const [manual] = await coordinator.query(api.manuals.list, {});
    await coordinator.mutation(api.manuals.update, {
      id: manual._id,
      storageId: segundo,
      fileName: "v2.pdf",
    });

    // El PDF sustituido ya no es el de la ficha, pero su historial sí lo cita:
    // la limpieza no puede llevárselo, porque la ficha aún lo muestra.
    const [actualizado] = await coordinator.query(api.manuals.list, {});
    expect(actualizado.storageId).toBe(segundo);
    // El último movimiento del historial es el del reemplazo, y guarda el PDF
    // que quedó fuera.
    const ultimo = actualizado.history[actualizado.history.length - 1];
    expect(ultimo.file?.storageId).toBe(primero);

    expect(await sweepEverything(t)).toBe(0);
    expect(await stillStored(t, primero)).toBe(true);
    expect(await stillStored(t, segundo)).toBe(true);
  });

  test("la foto de una nota viva se queda", async () => {
    const { t, coordinator } = await setup();
    const storageId = await file(t);
    const url = await urlOf(t, storageId);
    const incident = await reportedIncident(
      t,
      "<p>El monitor pierde la señal cada pocos minutos.</p>",
    );

    await coordinator.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: `<p>Aquí se ve la banda.</p><img src="${url}">`,
    });

    expect(await sweepEverything(t)).toBe(0);
    expect(await stillStored(t, storageId)).toBe(true);
  });

  test("la descripción de una incidencia protege su foto", async () => {
    const { t } = await setup();
    const storageId = await file(t);
    const url = await urlOf(t, storageId);

    // La foto entra por el formulario público, que es quien la acredita antes
    // de que la incidencia pueda citarla.
    await t.run((ctx) =>
      ctx.db.insert("reportUploads", {
        ticket: "a".repeat(32),
        storageId,
        createdAt: Date.now(),
        claimedAt: Date.now(),
      }),
    );
    const incident = await reportedIncident(
      t,
      `<p>La cámara no enciende desde esta mañana.</p><img src="${url}">`,
    );
    // El vale del formulario ya no está: lo único que menciona la foto es la
    // descripción de la incidencia.
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("reportUploads").collect();
      for (const row of rows) await ctx.db.delete(row._id);
    });
    const after = await t.run((ctx) => ctx.db.get(incident._id));
    expect(after?.description).toContain(url);

    expect(await sweepEverything(t)).toBe(0);
    expect(await stillStored(t, storageId)).toBe(true);
  });

  test("el documento del expediente protege su archivo", async () => {
    const { t, coordinator } = await setup();
    const storageId = await file(t);
    const incident = await reportedIncident(
      t,
      "<p>La mesa de mezclas no responde en el canal 12.</p>",
    );

    await coordinator.mutation(api.incidents.attachDocument, {
      incidentId: incident._id,
      name: "canal-12.png",
      storageId,
      note: "<p>Falla del canal 12.</p>",
    });

    expect(await sweepEverything(t)).toBe(0);
    expect(await stillStored(t, storageId)).toBe(true);
  });

  test("el adjunto de una petición protege su archivo", async () => {
    const { t, tech } = await setup();
    const storageId = await file(t);

    await tech.mutation(api.partRequests.create, {
      requesterName: "Iván Torres",
      priority: "normal",
      description: "<p>Necesito dos ventiladores axiales de 120 mm.</p>",
      attachments: [
        { storageId, name: "ventilador.png", kind: "image" as const },
      ],
    });

    expect(await sweepEverything(t)).toBe(0);
    expect(await stillStored(t, storageId)).toBe(true);
  });

  test("lo que menciona un mensaje se queda", async () => {
    const { t, tech, coordinatorId } = await setup();
    const storageId = await file(t);
    const url = await urlOf(t, storageId);

    await tech.mutation(api.messages.send, {
      recipientId: coordinatorId,
      text: `<p>Mira cómo quedó el conector.</p><img src="${url}">`,
    });

    expect(await sweepEverything(t)).toBe(0);
    expect(await stillStored(t, storageId)).toBe(true);
  });

  test("también mira donde nadie piensa: la ficha de un repuesto", async () => {
    const { t } = await setup();
    const storageId = await file(t);
    const url = await urlOf(t, storageId);
    // Ni una nota ni una versión: la limpieza no va con una lista de sitios
    // escogidos a mano, así que también ve el texto de una ficha cualquiera.
    await t.run((ctx) =>
      ctx.db.insert("spareParts", {
        code: "CON-24015",
        name: "Conector XLR de panel",
        category: "Conectores",
        unit: "ud",
        stock: 4,
        minStock: 2,
        description: `[{"type":"image","src":"${url}"}]`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );

    expect(await sweepEverything(t)).toBe(0);
    expect(await stillStored(t, storageId)).toBe(true);
  });

  test("lo que no menciona nadie va a la papelera y lo citado se queda", async () => {
    const { t, coordinator } = await setup();
    const incident = await reportedIncident(
      t,
      "<p>La cámara se apaga sola en directo.</p>",
    );
    // El abandono: una foto que se subió y nunca llegó a ninguna parte.
    const orphan = await file(t);
    // Y la que sí está en la ficha, que se queda donde está.
    const cited = await file(t);
    await coordinator.mutation(api.incidents.attachDocument, {
      incidentId: incident._id,
      name: "banda-roja.png",
      storageId: cited,
    });

    expect(await sweepEverything(t)).toBe(1);
    // Lo retirado sigue en el almacén: se ha ido a la papelera, con su plazo.
    expect(await stillStored(t, orphan)).toBe(true);
    const trashed = await t.run((ctx) => ctx.db.query("trashFiles").collect());
    expect(trashed).toHaveLength(1);
    expect(trashed[0]?.storageId).toBe(orphan);
    expect(await stillStored(t, cited)).toBe(true);
  });

  test("lo que se acaba de subir no se toca", async () => {
    const { t } = await setup();
    const storageId = await file(t);

    // La pasada de verdad, sin argumentos: el archivo de ahora mismo todavía
    // puede acabar en una nota que se está escribiendo.
    expect(await t.mutation(internal.storageCleanup.sweepOrphanFiles, {})).toBe(
      0,
    );
    expect(await stillStored(t, storageId)).toBe(true);
  });

  test("el archivo del formulario público lo limpia su propia limpieza", async () => {
    const { t } = await setup();
    const storageId = await file(t);
    const yesterday = Date.now() - 25 * 60 * 60 * 1000;
    // Un vale acreditado que ninguna incidencia cita: es cosa de la limpieza
    // del formulario, que sabe qué incidencia lo cita. Ésta lo deja en paz.
    await t.run((ctx) =>
      ctx.db.insert("reportUploads", {
        ticket: "a".repeat(32),
        storageId,
        createdAt: yesterday,
        claimedAt: yesterday,
      }),
    );

    expect(await sweepEverything(t)).toBe(0);
    expect(await stillStored(t, storageId)).toBe(true);

    expect(await t.mutation(internal.reportUploads.sweepUnused, {})).toBe(1);
    // A la papelera, no al borrado: sigue en el almacén con su plazo.
    expect(await stillStored(t, storageId)).toBe(true);
    const trashed = await t.run((ctx) => ctx.db.query("trashFiles").collect());
    expect(trashed[0]?.storageId).toBe(storageId);
    expect(trashed[0]?.pass).toBe("reportUploads");
  });
});

/** El taller de las pruebas, tal y como lo devuelve `setup`. */
type Taller = Awaited<ReturnType<typeof setup>>;

describe("los archivos que la limpieza no puede leer", () => {
  /**
   * Una foto que una nota cita y que el almacén ya no tiene: se borró a mano —o se
   * la llevó otra pasada— y la nota sigue enseñando su hueco. Es el archivo que la
   * limpieza se encuentra y no puede leer.
   */
  async function citedAndGone(
    taller: Taller,
    /** La incidencia donde citarla; sin ella, se notifica una nueva. */
    incidentId?: Id<"incidents">,
  ): Promise<Id<"incidents">> {
    const { t, coordinator } = taller;
    const storageId = await file(t);
    const url = await urlOf(t, storageId);
    const incident =
      incidentId ??
      (await reportedIncident(t, "<p>La cámara se apaga sola en directo.</p>"))
        ._id;
    await coordinator.mutation(api.incidents.addNote, {
      incidentId: incident,
      note: `<p>Comprobado en plató.</p><img src="${url}">`,
    });
    // El archivo se va del almacén; la nota se queda citándolo.
    await t.run((ctx) => ctx.storage.delete(storageId));
    return incident;
  }

  /**
   * Los avisos que ha dejado la limpieza. La campana trae también los del taller
   * —una incidencia nueva avisa—, así que se mira solo lo que es de aquí.
   */
  async function cleanupNotices(t: Test) {
    const rows = await t.run((ctx) => ctx.db.query("notifications").collect());
    return rows.filter((row) => row.text.includes("La limpieza del almacén"));
  }

  test("una imagen citada que ya no está se señala, y no se retira nada", async () => {
    const taller = await setup();
    const { t, coordinator } = taller;
    await citedAndGone(taller);

    // No hay nada que retirar: del archivo no queda nada en el almacén.
    expect(await sweepEverything(t)).toBe(0);

    const runs = await coordinator.query(api.cleanupLog.lastRuns, {});
    const orphans = runs.find((run) => run.pass === "orphanFiles");
    expect(orphans?.ranAt).not.toBeNull();
    expect(orphans?.files).toBe(0);
    expect(orphans?.unreadable).toBe(1);
    // Las otras pasadas no tienen nada que contar: esto es del almacén.
    expect(
      runs
        .filter((run) => run.pass !== "orphanFiles")
        .every((run) => run.unreadable === 0),
    ).toBe(true);
  });

  test("lo que no se puede leer no se mezcla con lo que se retira", async () => {
    const taller = await setup();
    const { t, coordinator } = taller;
    // Una foto que nadie cita —esa sí se retira— y una citada que ya no está.
    const orphan = await file(t);
    await citedAndGone(taller);

    expect(await sweepEverything(t)).toBe(1);

    // Lo retirado va a la papelera; de lo que no se puede leer no hay nada que
    // guardar allí.
    const trashed = await t.run((ctx) => ctx.db.query("trashFiles").collect());
    expect(trashed).toHaveLength(1);
    expect(trashed[0]?.storageId).toBe(orphan);

    const run = (await coordinator.query(api.cleanupLog.lastRuns, {})).find(
      (item) => item.pass === "orphanFiles",
    );
    expect(run?.files).toBe(1);
    expect(run?.unreadable).toBe(1);
  });

  test("el aviso va a quien coordina, y solo cuando la cuenta cambia", async () => {
    const taller = await setup();
    const { t, coordinator, coordinatorId } = taller;
    const incident = await citedAndGone(taller);

    // La pasada no se lleva nada —el archivo ya no está—, pero lo dice.
    expect(await sweepEverything(t)).toBe(0);
    const first = await cleanupNotices(t);
    expect(first).toHaveLength(1);
    expect(first[0]?.userId).toBe(coordinatorId);
    expect(first[0]?.text).toContain("1 archivo que el almacén no puede leer");
    expect(first[0]?.text).toContain("no se decide nada");
    // El aviso es del almacén: no cuelga de ninguna incidencia.
    expect(first[0]?.incidentId).toBeUndefined();

    // La noche siguiente la cuenta es la misma: ya se dijo, y no se repite.
    expect(await sweepEverything(t)).toBe(0);
    expect(await cleanupNotices(t)).toHaveLength(1);

    // Si aparece otro, vuelve a avisar —y dice de dónde viene—.
    await citedAndGone(taller, incident);
    expect(await sweepEverything(t)).toBe(0);
    const after = await cleanupNotices(t);
    expect(after).toHaveLength(2);
    expect(after[1]?.text).toContain("2 archivos que el almacén no puede leer");
    expect(after[1]?.text).toContain("Antes eran 1.");

    // Y la constancia lo apunta igual, que es donde se mira después.
    const run = (await coordinator.query(api.cleanupLog.lastRuns, {})).find(
      (item) => item.pass === "orphanFiles",
    );
    expect(run?.unreadable).toBe(2);
  });

  test("la limpieza a mano lo cuenta y no manda aviso: quien pulsa lo ve", async () => {
    const taller = await setup();
    const { t, coordinator } = taller;
    await citedAndGone(taller);

    const result = await coordinator.action(api.storageCleanup.runNow, {});
    expect(result.orphanFiles.files).toBe(0);
    expect(result.orphanFiles.unreadable).toBe(1);
    // La campana es de la madrugada: aquí el aviso es el de la pantalla.
    expect(await cleanupNotices(t)).toHaveLength(0);
  });
});

describe("la constancia de las pasadas", () => {
  test("cada pasada apunta cuándo fue y qué se llevó", async () => {
    const { t, coordinator } = await setup();

    // Todavía no ha corrido ninguna: la consulta devuelve las dos igual, con la
    // fecha a null, para que quien pinta no tenga que saber cuántas hay.
    const before = await coordinator.query(api.cleanupLog.lastRuns, {});
    expect(before.map((run) => run.pass)).toEqual([
      "reportUploads",
      "orphanFiles",
      "trash",
    ]);
    expect(before.every((run) => run.ranAt === null)).toBe(true);
    expect(before.every((run) => run.automatic === false)).toBe(true);

    // Una foto abandonada: la pasada se la lleva y lo deja apuntado.
    await file(t);
    expect(await sweepEverything(t)).toBe(1);

    const after = await coordinator.query(api.cleanupLog.lastRuns, {});
    const orphans = after.find((run) => run.pass === "orphanFiles");
    expect(orphans?.files).toBe(1);
    expect(orphans?.bytes).toBeGreaterThan(0);
    expect(orphans?.runBy).toBe("Limpieza automática");
    expect(orphans?.automatic).toBe(true);
    // La otra pasada no se toca: cada una lleva su cuenta.
    expect(after.find((run) => run.pass === "reportUploads")?.ranAt).toBeNull();
  });

  test("la purga a mano del formulario firma la pasada", async () => {
    const { t, coordinator } = await setup();
    // Un vale sin archivo que nadie acreditó: la pasada del formulario se lo
    // lleva, y con él lo que retiró queda apuntado.
    await t.run((ctx) =>
      ctx.db.insert("reportUploads", {
        ticket: "b".repeat(32),
        createdAt: Date.now() - 25 * 60 * 60 * 1000,
      }),
    );

    expect(
      await coordinator.mutation(api.reportUploads.purgeUnused, {}),
    ).toMatchObject({ images: 0, tickets: 1 });

    const runs = await coordinator.query(api.cleanupLog.lastRuns, {});
    const uploads = runs.find((run) => run.pass === "reportUploads");
    expect(uploads?.tickets).toBe(1);
    expect(uploads?.runBy).toBe("Elena Vidal");
    expect(uploads?.automatic).toBe(false);
  });
});

describe("la limpieza a mano del almacén", () => {
  test("hace las dos pasadas de una vez y las firma quien la lanza", async () => {
    const { t, coordinator } = await setup();
    // Una imagen abandonada por el formulario: la pasada del formulario se la
    // lleva aunque la de los archivos sin citar no la tocaría —su vale la
    // menciona—, que es justo lo que hace la limpieza de la madrugada.
    const storageId = await file(t);
    const yesterday = Date.now() - 25 * 60 * 60 * 1000;
    await t.run((ctx) =>
      ctx.db.insert("reportUploads", {
        ticket: "c".repeat(32),
        storageId,
        createdAt: yesterday,
        claimedAt: yesterday,
      }),
    );

    const result = await coordinator.action(api.storageCleanup.runNow, {});
    expect(result.reportUploads.files).toBe(1);
    // Lo que se acaba de subir no entra, así que la pasada de los archivos sin
    // citar no tiene nada que hacer todavía.
    expect(result.orphanFiles.files).toBe(0);
    // Y la papelera tampoco borra lo que acaba de entrar: tiene su plazo por
    // delante, así que sigue en el almacén.
    expect(result.trash.files).toBe(0);
    expect(await stillStored(t, storageId)).toBe(true);

    const runs = await coordinator.query(api.cleanupLog.lastRuns, {});
    expect(runs.every((run) => run.ranAt !== null)).toBe(true);
    expect(runs.every((run) => run.runBy === "Elena Vidal")).toBe(true);
    expect(runs.every((run) => run.automatic === false)).toBe(true);
  });

  test("un técnico no puede lanzarla ni ver su constancia", async () => {
    const { t, tech } = await setup();

    // El permiso se lee una sola vez, antes de la primera pasada: la negativa no
    // deja ninguna pasada a medias ni constancia que leer.
    await expectConvexError(
      tech.action(api.storageCleanup.runNow, {}),
      "Solo quien coordina",
    );
    expect(
      await t.run((ctx) => ctx.db.query("storageCleanupRuns").collect()),
    ).toHaveLength(0);
    await expectConvexError(
      tech.query(api.cleanupLog.lastRuns, {}),
      "Solo quien coordina",
    );
  });
});

describe("la constancia de las purgas a mano", () => {
  /** Vales distintos para cada foto: son la identidad de una imagen del formulario. */
  let ticketSeed = 0;
  function newTicket(): string {
    ticketSeed += 1;
    return ticketSeed.toString(16).padStart(32, "0");
  }

  /**
   * Una foto acreditada ayer que ninguna incidencia cita: lo que una purga a
   * mano se lleva, tal y como queda apuntado en su constancia.
   */
  async function abandoned(
    t: Test,
  ): Promise<{ ticket: string; storageId: Id<"_storage">; size: number }> {
    const storageId = await file(t);
    const ticket = newTicket();
    const createdAt = Date.now() - 25 * 60 * 60 * 1000;
    await t.run((ctx) =>
      ctx.db.insert("reportUploads", {
        ticket,
        storageId,
        createdAt,
        claimedAt: createdAt,
      }),
    );
    const stored = await t.run((ctx) =>
      ctx.db.system.get("_storage", storageId),
    );
    return { ticket, storageId, size: stored?.size ?? 0 };
  }

  test("la purga deja quién, cuándo y qué se llevó", async () => {
    const { t, coordinator } = await setup();
    const image = await abandoned(t);
    const empty = newTicket();
    await t.run((ctx) =>
      ctx.db.insert("reportUploads", {
        ticket: empty,
        createdAt: Date.now() - 25 * 60 * 60 * 1000,
      }),
    );

    const result = await coordinator.mutation(
      api.reportUploads.purgeUnused,
      {},
    );

    const entries = await t.run((ctx) =>
      ctx.db.query("reportUploadPurges").collect(),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].runBy).toBe("Elena Vidal");
    expect(entries[0].ranAt).toBeTypeOf("number");
    // Qué se llevó, una entrada por archivo con su vale y lo que ocupaba.
    expect(entries[0].images).toEqual([
      { ticket: image.ticket, size: image.size },
    ]);
    // Y los vales sin archivo aparte: se fueron con ellas, pero no eran imágenes.
    expect(entries[0].tickets).toEqual([empty]);
    expect(entries[0].bytes).toBe(image.size);
    // La constancia cuenta lo mismo que la purga que acaba de hacer.
    expect(entries[0].images).toHaveLength(result.images);
    expect(entries[0].tickets).toHaveLength(result.tickets);
    expect(entries[0].bytes).toBe(result.bytes);
  });

  test("la limpieza de la madrugada no firma esta constancia", async () => {
    const { t, coordinator } = await setup();
    await abandoned(t);

    // La pasada de verdad, sin argumentos: se lleva lo abandonado...
    expect(await t.mutation(internal.reportUploads.sweepUnused, {})).toBe(1);

    // ...pero no firma nada aquí: la automática tiene la suya, sin nombre.
    expect(
      await t.run((ctx) => ctx.db.query("reportUploadPurges").collect()),
    ).toHaveLength(0);
    const log = await coordinator.query(api.cleanupLog.purges, {});
    expect(log.entries).toHaveLength(0);
    expect(log.partial).toBe(false);
  });

  test("cada purga es una fila: ni se pisan ni se pierden", async () => {
    const { t, coordinator } = await setup();

    await abandoned(t);
    await coordinator.mutation(api.reportUploads.purgeUnused, {});
    await abandoned(t);
    await coordinator.mutation(api.reportUploads.purgeUnused, {});
    // Y la que se lanza con toda la limpieza a mano también firma: se lleva lo
    // mismo de este formulario, y a mano.
    await abandoned(t);
    await coordinator.action(api.storageCleanup.runNow, {});

    const log = await coordinator.query(api.cleanupLog.purges, {});
    expect(log.entries).toHaveLength(3);
    // La más nueva primero, y cada una con su archivo.
    expect(log.entries[0].ranAt).toBeGreaterThanOrEqual(log.entries[1].ranAt);
    expect(log.entries[1].ranAt).toBeGreaterThanOrEqual(log.entries[2].ranAt);
    for (const entry of log.entries) {
      expect(entry.runBy).toBe("Elena Vidal");
      expect(entry.images).toHaveLength(1);
      expect(entry.tickets).toHaveLength(0);
    }
    expect(log.partial).toBe(false);

    // Una purga sin nada que llevarse no deja fila: no hay nada que contar. Lo
    // que sí hace es refrescar la constancia de la última pasada.
    await coordinator.mutation(api.reportUploads.purgeUnused, {});
    const after = await coordinator.query(api.cleanupLog.purges, {});
    expect(after.entries).toHaveLength(3);
    expect(
      await t.run((ctx) => ctx.db.query("reportUploadPurges").collect()),
    ).toHaveLength(3);
  });

  test("la constancia es de quien puede purgar", async () => {
    const { tech } = await setup();

    await expectConvexError(
      tech.query(api.cleanupLog.purges, {}),
      "Solo quien coordina",
    );
  });
});
