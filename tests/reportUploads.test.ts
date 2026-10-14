import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api, internal } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";
import { MAX_UPLOADS_PER_HOUR } from "../src/convex/reportUploads";
import schema from "../src/convex/schema";
import { MAX_FILE_SIZE, MAX_REPORT_IMAGES } from "../src/lib/upload";

/** Todos los módulos de funciones de la app (convex-test los levanta in-process). */
const modules = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

type Test = ReturnType<typeof convexTest>;

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

/** Instancia de test. Nadie tiene sesión: es el punto del formulario público. */
function harness() {
  return convexTest(schema, modules);
}

/** Los primeros bytes de un PNG: es lo que mira la acreditación del archivo. */
const PNG_HEAD = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13,
]);

/**
 * Una foto distinta de otra: el almacén de mentira identifica las direcciones por
 * el contenido, así que dos archivos con la misma foto comparten dirección.
 */
function photo(marker: number): Uint8Array {
  const bytes = new Uint8Array(PNG_HEAD.length + 1);
  bytes.set(PNG_HEAD);
  bytes[PNG_HEAD.length] = marker;
  return bytes;
}

/** Un archivo que dice ser una foto y no lo es. */
const NOT_A_PHOTO = new TextEncoder().encode(
  "no soy una foto, aunque el navegador lo diga",
);

/** El vale que el formulario pide antes de subir nada. */
async function ticket(t: Test): Promise<string> {
  return (await t.mutation(api.reportUploads.generateUploadUrl, {})).ticket;
}

/** Lo que sube el navegador: el archivo queda en el almacén con su sello de tiempo. */
async function store(
  t: Test,
  bytes: Uint8Array,
  type = "image/png",
): Promise<Id<"_storage">> {
  return await t.run((ctx) => ctx.storage.store(new Blob([bytes], { type })));
}

/**
 * La subida completa del formulario, en su orden: primero el vale, después el
 * archivo y por último la acreditación.
 */
async function upload(t: Test, bytes: Uint8Array, type?: string) {
  const tk = await ticket(t);
  const storageId = await store(t, bytes, type);
  const url = await t.action(api.reportUploads.attachImage, {
    ticket: tk,
    storageId,
  });
  return { url, storageId };
}

/** ¿Sigue el archivo en el almacén? */
async function stillStored(
  t: Test,
  storageId: Id<"_storage">,
): Promise<boolean> {
  return (await t.run((ctx) => ctx.storage.getUrl(storageId))) !== null;
}

/** Los mínimos de un aviso público, para llegar al meollo: sus imágenes. */
const reportBase = {
  reporterName: "Laura Peña",
  equipmentKind: "Cámara de estudio",
  model: "HDC-3500",
  reportedAt: Date.now() - 60 * 60 * 1000,
};

describe("subida de imágenes del formulario público", () => {
  test("la dirección de subida se pide sin sesión y cada vale es distinto", async () => {
    const t = harness();

    const first = await t.mutation(api.reportUploads.generateUploadUrl, {});
    expect(first.uploadUrl).toContain("upload");
    expect(first.ticket).toMatch(/^[0-9a-f]{32}$/);

    const second = await t.mutation(api.reportUploads.generateUploadUrl, {});
    expect(second.ticket).not.toBe(first.ticket);
  });

  test("el formulario no puede pedir archivos sin freno", async () => {
    const t = harness();
    for (let i = 0; i < MAX_UPLOADS_PER_HOUR; i += 1) await ticket(t);

    await expectConvexError(
      t.mutation(api.reportUploads.generateUploadUrl, {}),
      "demasiados archivos en la última hora",
    );
  });

  test("una foto se acredita con su vale y queda enlazada", async () => {
    const t = harness();

    const { url, storageId } = await upload(t, PNG_HEAD);
    expect(url).toContain("/api/storage/");

    const [row] = await t.run((ctx) => ctx.db.query("reportUploads").collect());
    expect(row.storageId).toBe(storageId);
    expect(row.claimedAt).toBeTypeOf("number");
  });

  test("lo que no es una foto no se acepta, aunque diga que lo es", async () => {
    const t = harness();
    // El navegador manda un tipo de imagen, pero el archivo no lo es: manda el
    // archivo.
    const tk = await ticket(t);
    const storageId = await store(t, NOT_A_PHOTO, "image/png");

    await expectConvexError(
      t.action(api.reportUploads.attachImage, { ticket: tk, storageId }),
      "Solo se pueden adjuntar fotos",
    );
    // Y no se queda ocupando sitio en el almacén del taller.
    expect(await stillStored(t, storageId)).toBe(false);
  });

  test("una foto que se pasa del límite no se acepta", async () => {
    const t = harness();
    const tk = await ticket(t);
    const big = new Uint8Array(MAX_FILE_SIZE + 1);
    big.set(PNG_HEAD);
    const storageId = await store(t, big);

    await expectConvexError(
      t.action(api.reportUploads.attachImage, { ticket: tk, storageId }),
      "puede pesar como mucho",
    );
    expect(await stillStored(t, storageId)).toBe(false);
  });

  test("un vale sirve una sola vez", async () => {
    const t = harness();
    const tk = await ticket(t);
    const first = await store(t, PNG_HEAD);
    await t.action(api.reportUploads.attachImage, {
      ticket: tk,
      storageId: first,
    });

    const second = await store(t, photo(9));
    await expectConvexError(
      t.action(api.reportUploads.attachImage, {
        ticket: tk,
        storageId: second,
      }),
      "ya tenía su imagen",
    );
    expect(await stillStored(t, second)).toBe(false);
  });

  test("de lo ajeno no se toca nada: sin vale, o con un archivo de antes", async () => {
    const t = harness();

    // El archivo ya estaba en el almacén —el documento de un expediente, por
    // ejemplo— antes de que existiera el vale.
    const old = await store(t, PNG_HEAD);
    await expectConvexError(
      t.action(api.reportUploads.attachImage, {
        ticket: await ticket(t),
        storageId: old,
      }),
      "no lo ha subido este formulario",
    );
    expect(await stillStored(t, old)).toBe(true);

    // Y con un vale que nadie pidió, tampoco se toca el archivo.
    const tk = await ticket(t);
    const fresh = await store(t, PNG_HEAD);
    await expectConvexError(
      t.action(api.reportUploads.attachImage, {
        ticket: "0".repeat(32),
        storageId: fresh,
      }),
      "vuelve a elegirla",
    );
    expect(await stillStored(t, fresh)).toBe(true);
    expect(tk).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("imágenes de la incidencia notificada sin cuenta", () => {
  test("la incidencia acepta las fotos acreditadas", async () => {
    const t = harness();
    const { url } = await upload(t, PNG_HEAD);

    const { reference } = await t.mutation(api.incidents.report, {
      ...reportBase,
      description: `<p>La cámara no enciende desde esta mañana.</p><img src="${url}">`,
    });
    expect(reference).toBe("INC-0001");
  });

  test("una imagen que no ha acreditado el formulario se queda fuera", async () => {
    const t = harness();

    await expectConvexError(
      t.mutation(api.incidents.report, {
        ...reportBase,
        description:
          '<p>Otra avería descrita con calma.</p><img src="https://taller.convex.cloud/api/storage/00000000">',
      }),
      "No se han podido comprobar las imágenes",
    );
  });

  test("una incidencia no es un álbum", async () => {
    const t = harness();
    const urls: string[] = [];
    for (let i = 0; i < MAX_REPORT_IMAGES + 1; i += 1) {
      urls.push((await upload(t, PNG_HEAD)).url);
    }

    await expectConvexError(
      t.mutation(api.incidents.report, {
        ...reportBase,
        description: `<p>Un aviso con demasiadas fotos.</p>${urls
          .map((url) => `<img src="${url}">`)
          .join("")}`,
      }),
      `como mucho ${MAX_REPORT_IMAGES} imágenes`,
    );
  });
});

describe("limpieza de lo que nadie usó", () => {
  test("barre lo abandonado y respeta lo que está en una incidencia", async () => {
    const t = harness();
    const yesterday = Date.now() - 25 * 60 * 60 * 1000;

    // Un vale sin archivo y un archivo acreditado que ninguna incidencia cita.
    await t.run((ctx) =>
      ctx.db.insert("reportUploads", {
        ticket: "b".repeat(32),
        createdAt: yesterday,
      }),
    );
    const orphan = await store(t, photo(1));
    await t.run((ctx) =>
      ctx.db.insert("reportUploads", {
        ticket: "a".repeat(32),
        storageId: orphan,
        createdAt: yesterday,
        claimedAt: yesterday,
      }),
    );

    // Una foto vieja que sí está en una incidencia: se queda donde está.
    const cited = await store(t, photo(2));
    const citedUrl = await t.run((ctx) => ctx.storage.getUrl(cited));
    await t.run((ctx) =>
      ctx.db.insert("reportUploads", {
        ticket: "c".repeat(32),
        storageId: cited,
        createdAt: yesterday,
        claimedAt: yesterday,
      }),
    );
    await t.mutation(api.incidents.report, {
      ...reportBase,
      description: `<p>La cámara no enciende desde esta mañana.</p><img src="${citedUrl}">`,
    });

    expect(await t.mutation(internal.reportUploads.sweepUnused, {})).toBe(2);
    // Lo retirado no se borra: se queda en la papelera, con su plazo por delante.
    expect(await stillStored(t, orphan)).toBe(true);
    const trashed = await t.run((ctx) => ctx.db.query("trashFiles").collect());
    expect(trashed).toHaveLength(1);
    expect(trashed[0].storageId).toBe(orphan);
    expect(trashed[0].pass).toBe("reportUploads");
    expect(await stillStored(t, cited)).toBe(true);

    const rows = await t.run((ctx) => ctx.db.query("reportUploads").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].storageId).toBe(cited);
  });

  test("lo que se acaba de subir no se toca", async () => {
    const t = harness();
    const { storageId } = await upload(t, PNG_HEAD);

    expect(await t.mutation(internal.reportUploads.sweepUnused, {})).toBe(0);
    expect(await stillStored(t, storageId)).toBe(true);
  });
});

/** Instancia con un mando del taller dentro: el panel de Ajustes es cosa suya. */
async function harnessWithManager() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Iván Torres",
      email: "jefe@taller.es",
      role: "manager",
    }),
  );
  return { t, manager: t.withIdentity({ subject: `${userId}|session1` }) };
}

describe("imágenes del formulario sin usar (panel del taller)", () => {
  const YESTERDAY = 25 * 60 * 60 * 1000;

  /** Una foto acreditada que ninguna incidencia cita, con su fecha. */
  async function abandoned(
    t: Test,
    marker: number,
    ageMs: number,
  ): Promise<Id<"_storage">> {
    const storageId = await store(t, photo(marker));
    const createdAt = Date.now() - ageMs;
    await t.run((ctx) =>
      ctx.db.insert("reportUploads", {
        ticket: String(marker).repeat(32).slice(0, 32),
        storageId,
        createdAt,
        claimedAt: createdAt,
      }),
    );
    return storageId;
  }

  /** Una foto vieja que sí está en una incidencia: nadie la va a barrer. */
  async function cited(t: Test): Promise<Id<"_storage">> {
    const storageId = await abandoned(t, 7, YESTERDAY);
    const url = await t.run((ctx) => ctx.storage.getUrl(storageId));
    await t.mutation(api.incidents.report, {
      ...reportBase,
      description: `<p>La cámara no enciende desde esta mañana.</p><img src="${url}">`,
    });
    return storageId;
  }

  /**
   * Un vale con su archivo, borrado a mano después: el vale sigue ahí y el
   * almacén ya no puede leer lo que citaba.
   */
  async function unreadable(t: Test, marker: number): Promise<void> {
    const storageId = await abandoned(t, marker, YESTERDAY);
    await t.run((ctx) => ctx.storage.delete(storageId));
  }

  /** Un vale que nadie acreditó: sin archivo, pero también se va. */
  async function emptyTicket(t: Test, ageMs: number): Promise<void> {
    await t.run((ctx) =>
      ctx.db.insert("reportUploads", {
        ticket: "e".repeat(32),
        createdAt: Date.now() - ageMs,
      }),
    );
  }

  test("enseña lo que la limpieza de la noche se va a llevar, y solo eso", async () => {
    const { t, manager } = await harnessWithManager();
    const stale = await abandoned(t, 1, YESTERDAY);
    const fresh = await abandoned(t, 2, 60 * 60 * 1000);
    const inIncident = await cited(t);
    await emptyTicket(t, YESTERDAY);

    const panel = await manager.query(api.reportUploads.unusedImages, {});

    const file = await t.run((ctx) => ctx.db.system.get("_storage", stale));
    expect(panel.images.map((image) => image.id)).toHaveLength(1);
    expect(panel.images[0].url).toContain("/api/storage/");
    expect(panel.images[0].size).toBe(file?.size);
    expect(panel.totalBytes).toBe(file?.size);
    // El vale sin archivo va en la misma pasada, pero no es una imagen.
    expect(panel.tickets).toBe(1);
    expect(panel.partial).toBe(false);
    expect(panel.retentionMs).toBeGreaterThan(0);

    // La que se acaba de subir todavía puede acabar en un aviso que se escribe,
    // y la que está en una incidencia es parte de su ficha.
    const shown = panel.images.map((image) => image.url);
    const freshUrl = await t.run((ctx) => ctx.storage.getUrl(fresh));
    const citedUrl = await t.run((ctx) => ctx.storage.getUrl(inIncident));
    expect(shown).not.toContain(freshUrl);
    expect(shown).not.toContain(citedUrl);
  });

  test("purgar a mano barre lo mismo que la noche y no toca lo citado", async () => {
    const { t, manager } = await harnessWithManager();
    const stale = await abandoned(t, 3, YESTERDAY);
    const fresh = await abandoned(t, 4, 60 * 60 * 1000);
    const inIncident = await cited(t);
    await emptyTicket(t, YESTERDAY);

    const result = await manager.mutation(api.reportUploads.purgeUnused, {});

    expect(result).toMatchObject({ removed: 2, images: 1, tickets: 1 });
    expect(result.bytes).toBeGreaterThan(0);
    // La purga a mano tampoco borra: deja lo purgado en la papelera, con el vale
    // que permite devolverle su sitio si alguien se arrepiente.
    expect(await stillStored(t, stale)).toBe(true);
    const trashed = await t.run((ctx) => ctx.db.query("trashFiles").collect());
    expect(trashed).toHaveLength(1);
    expect(trashed[0].storageId).toBe(stale);
    expect(trashed[0].ticket).toHaveLength(32);
    expect(await stillStored(t, inIncident)).toBe(true);
    expect(await stillStored(t, fresh)).toBe(true);

    // Y el panel se queda sin nada que enseñar.
    const panel = await manager.query(api.reportUploads.unusedImages, {});
    expect(panel.images).toHaveLength(0);
    expect(panel.tickets).toBe(0);
    expect(panel.totalBytes).toBe(0);
  });

  test("un vale cuyo archivo ya no se puede leer no es una imagen más", async () => {
    const { t, manager } = await harnessWithManager();
    await unreadable(t, 8);
    const live = await abandoned(t, 9, YESTERDAY);

    const panel = await manager.query(api.reportUploads.unusedImages, {});
    // El que no se puede leer no está entre las imágenes: no hay miniatura que
    // enseñar, y una imagen de 0 KB no cuenta lo que pasó.
    expect(panel.images).toHaveLength(1);
    expect(panel.unreadable).toBe(1);
    expect(panel.tickets).toBe(0);
    const liveFile = await t.run((ctx) => ctx.db.system.get("_storage", live));
    expect(panel.totalBytes).toBe(liveFile?.size);

    // La purga se lo lleva, pero sin dejar una imagen fantasma en la papelera.
    const result = await manager.mutation(api.reportUploads.purgeUnused, {});
    expect(result).toMatchObject({ removed: 2, images: 1, unreadable: 1 });
    const trashed = await t.run((ctx) => ctx.db.query("trashFiles").collect());
    expect(trashed).toHaveLength(1);
    expect(trashed[0]?.storageId).toBe(live);

    // Y la constancia lo cuenta aparte de lo retirado.
    const run = (await manager.query(api.cleanupLog.lastRuns, {})).find(
      (item) => item.pass === "reportUploads",
    );
    expect(run?.files).toBe(1);
    expect(run?.unreadable).toBe(1);
    expect(run?.runBy).toBe("Iván Torres");
  });

  test("la pasada de la madrugada lo cuenta igual, sin tocar la papelera", async () => {
    const { t } = await harnessWithManager();
    await unreadable(t, 5);

    // El vale se va —ya no sirve para nada—, pero no hay archivo que guardar.
    expect(await t.mutation(internal.reportUploads.sweepUnused, {})).toBe(1);
    expect(
      await t.run((ctx) => ctx.db.query("trashFiles").collect()),
    ).toHaveLength(0);
    const [run] = await t.run((ctx) =>
      ctx.db.query("storageCleanupRuns").collect(),
    );
    expect(run?.files).toBe(0);
    expect(run?.bytes).toBe(0);
    expect(run?.unreadable).toBe(1);
  });

  test("el panel y su purga son de quien gobierna el taller", async () => {
    const t = harness();
    const technicianId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Nuria Cano",
        email: "tecnica@taller.es",
        role: "technician",
      }),
    );
    const technician = t.withIdentity({ subject: `${technicianId}|session1` });

    await expectConvexError(
      t.query(api.reportUploads.unusedImages, {}),
      "Debes iniciar sesión",
    );
    await expectConvexError(
      technician.query(api.reportUploads.unusedImages, {}),
      "Solo quien coordina las incidencias o decide las peticiones",
    );
    await expectConvexError(
      technician.mutation(api.reportUploads.purgeUnused, {}),
      "Solo quien coordina las incidencias o decide las peticiones",
    );
  });
});

/**
 * Gente del taller con papel en esto: quien administra —que siempre puede—,
 * quien coordina las incidencias y un técnico, que no tiene nada que ver con el
 * almacén.
 */
async function harnessWithRoles() {
  const t = convexTest(schema, modules);
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Ana Ruiz",
      email: "admin@taller.es",
      role: "admin",
    }),
  );
  const coordinatorId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Elena Vidal",
      email: "coord@taller.es",
      role: "manager",
    }),
  );
  const techId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Nuria Cano",
      email: "tecnica@taller.es",
      role: "technician",
    }),
  );
  return { t, adminId, coordinatorId, techId };
}

/** Los avisos de una persona, tal y como los lee la campana. */
async function notificationsOf(t: Test, userId: Id<"users">) {
  return await t.run((ctx) =>
    ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
  );
}

describe("el aviso de lo que la limpieza se va a llevar del formulario", () => {
  const YESTERDAY = 25 * 60 * 60 * 1000;

  /** Una foto acreditada que ninguna incidencia cita: se la lleva la pasada. */
  async function abandoned(t: Test, marker: number): Promise<Id<"_storage">> {
    const storageId = await store(t, photo(marker));
    const createdAt = Date.now() - YESTERDAY;
    await t.run((ctx) =>
      ctx.db.insert("reportUploads", {
        ticket: String(marker).repeat(32).slice(0, 32),
        storageId,
        createdAt,
        claimedAt: createdAt,
      }),
    );
    return storageId;
  }

  /** Un vale que nadie acreditó: se va con las imágenes, pero no es una imagen. */
  async function emptyTicket(t: Test): Promise<void> {
    await t.run((ctx) =>
      ctx.db.insert("reportUploads", {
        ticket: "e".repeat(32),
        createdAt: Date.now() - YESTERDAY,
      }),
    );
  }

  test("avisa a quien gobierna el taller, con lo pendiente y sin ficha detrás", async () => {
    const { t, adminId, coordinatorId, techId } = await harnessWithRoles();
    await abandoned(t, 5);
    await emptyTicket(t);

    // Quien administra siempre puede coordinar, así que los avisados son dos.
    expect(await t.mutation(internal.reportUploads.warnUnused, {})).toBe(2);

    for (const userId of [adminId, coordinatorId]) {
      const [aviso] = await notificationsOf(t, userId);
      expect(aviso?.read).toBe(false);
      expect(aviso?.text).toContain("1 imagen sin usar");
      expect(aviso?.text).toContain("y 1 vale sin archivo");
      expect(aviso?.text).toContain("7 días en la papelera");
      // El aviso no cuelga de ninguna incidencia: es cosa del almacén.
      expect(aviso?.incidentId).toBeUndefined();
      expect(aviso?.createdAt).toBeTypeOf("number");
    }
    // Y quien no gobierna el taller no se entera: esto no es un permiso.
    expect(await notificationsOf(t, techId)).toHaveLength(0);
  });

  test("lo que no se puede leer se avisa, y no pasa por una imagen de 0 KB", async () => {
    const { t, coordinatorId } = await harnessWithRoles();
    const storageId = await abandoned(t, 8);
    await t.run((ctx) => ctx.storage.delete(storageId));

    expect(await t.mutation(internal.reportUploads.warnUnused, {})).toBe(2);
    const [aviso] = await notificationsOf(t, coordinatorId);
    expect(aviso?.text).toContain("1 archivo que el almacén no puede leer");
    expect(aviso?.text).toContain("no queda nada en la papelera");
    // Ni una imagen de 0 KB, ni un plazo para algo que no se guarda.
    expect(aviso?.text).not.toContain("0 KB");
    expect(aviso?.text).not.toContain("por si hay que recuperarlo");
  });

  test("no avisa de lo que está en una incidencia ni de lo que se acaba de subir", async () => {
    const { t, coordinatorId } = await harnessWithRoles();
    // Una foto vieja que sí está en una incidencia: nadie se la va a llevar...
    const inIncident = await abandoned(t, 6);
    const url = await t.run((ctx) => ctx.storage.getUrl(inIncident));
    await t.mutation(api.incidents.report, {
      ...reportBase,
      description: `<p>La cámara no enciende desde esta mañana.</p><img src="${url}">`,
    });
    // ...y una que se acaba de subir, que todavía puede acabar en un aviso.
    await upload(t, photo(7));

    // La incidencia recién notificada avisa por su cuenta a quien coordina, así
    // que lo que se mira es que el aviso de la limpieza no añada nada.
    const before = await t.run((ctx) =>
      ctx.db.query("notifications").collect(),
    );
    const mineBefore = await notificationsOf(t, coordinatorId);
    expect(before.length).toBeGreaterThan(0);

    expect(await t.mutation(internal.reportUploads.warnUnused, {})).toBe(0);

    const after = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(after).toHaveLength(before.length);
    expect(after.some((item) => item.text.includes("formulario público"))).toBe(
      false,
    );
    expect(await notificationsOf(t, coordinatorId)).toHaveLength(
      mineBefore.length,
    );
  });

  test("el aviso no retira nada: la pasada de después sigue teniendo lo suyo", async () => {
    const { t } = await harnessWithRoles();
    const storageId = await abandoned(t, 8);

    expect(await t.mutation(internal.reportUploads.warnUnused, {})).toBe(2);

    // La fila y el archivo siguen donde estaban y la papelera no ha visto nada:
    // avisar no es limpiar.
    const rows = await t.run((ctx) => ctx.db.query("reportUploads").collect());
    expect(rows).toHaveLength(1);
    expect(await stillStored(t, storageId)).toBe(true);
    expect(
      await t.run((ctx) => ctx.db.query("trashFiles").collect()),
    ).toHaveLength(0);

    // Y la pasada de la noche se encuentra lo mismo que anunció el aviso.
    expect(await t.mutation(internal.reportUploads.sweepUnused, {})).toBe(1);
  });
});
