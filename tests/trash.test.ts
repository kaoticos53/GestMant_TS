import { backend } from "./backend";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";
import { AUTO_CLEANUP_BY } from "../src/lib/cleanupLog";
import {
  DEFAULT_TRASH_RETENTION_DAYS,
  MAX_TRASH_RETENTION_DAYS,
  MIN_TRASH_RETENTION_DAYS,
  trashKindOf,
  trashPurgeAt,
  trashRemainingLabel,
  trashRetentionMs,
} from "../src/lib/trash";

type Test = ReturnType<typeof convexTest>;

const DAY = 24 * 60 * 60 * 1000;

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

/** Coordinador (los mandos del taller) y técnico (todo lo demás). */
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
  return {
    t,
    coordinator: t.withIdentity({ subject: `${coordinatorId}|session1` }),
    tech: t.withIdentity({ subject: `${techId}|session1` }),
  };
}

/** Un archivo distinto en cada prueba: el almacén de mentira identifica las
 * direcciones por el contenido, así que dos archivos iguales comparten dirección. */
let marker = 0;
async function file(t: Test, type = "image/png"): Promise<Id<"_storage">> {
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
  return await t.run((ctx) => ctx.storage.store(new Blob([bytes], { type })));
}

/** ¿Sigue el archivo en el almacén del taller? */
async function stillStored(
  t: Test,
  storageId: Id<"_storage">,
): Promise<boolean> {
  return (await t.run((ctx) => ctx.storage.getUrl(storageId))) !== null;
}

/** La pasada de los archivos sin citar, dándolo todo por viejo. */
async function sweepOrphans(t: Test) {
  return await t.mutation(internal.storageCleanup.sweepOrphanFiles, {
    before: Date.now() + 1000,
  });
}

/** Un vale del formulario con su archivo, de hace un día entero. */
async function abandonedFormImage(t: Test): Promise<Id<"_storage">> {
  const storageId = await file(t);
  const yesterday = Date.now() - 25 * 60 * 60 * 1000;
  await t.run((ctx) =>
    ctx.db.insert("reportUploads", {
      ticket: "a".repeat(32),
      storageId,
      createdAt: yesterday,
      claimedAt: yesterday,
    }),
  );
  return storageId;
}

/** Los mínimos de un aviso público, para citar una imagen. */
const reportArgs = {
  reporterName: "Laura Peña",
  equipmentKind: "Cámara de estudio",
  model: "HDC-3500",
  reportedAt: Date.now() - 60 * 60 * 1000,
};

/** Una fila de la papelera que ya cumplió su plazo, para no esperar una semana. */
async function expiredRow(
  t: Test,
  args: { storageId: Id<"_storage">; kept?: boolean; contentType?: string },
) {
  const long = Date.now() - 30 * DAY;
  return await t.run((ctx) =>
    ctx.db.insert("trashFiles", {
      storageId: args.storageId,
      contentType: args.contentType ?? "image/png",
      size: 11,
      pass: "orphanFiles",
      runBy: AUTO_CLEANUP_BY,
      removedAt: long,
      purgeAt: long + trashRetentionMs(DEFAULT_TRASH_RETENTION_DAYS),
      kept: args.kept ?? false,
      ...(args.kept ? { keptAt: long } : {}),
    }),
  );
}

describe("las reglas de la papelera", () => {
  test("el plazo de partida es de una semana y se cuenta por días enteros", () => {
    expect(DEFAULT_TRASH_RETENTION_DAYS).toBe(7);
    expect(trashPurgeAt(0, DEFAULT_TRASH_RETENTION_DAYS)).toBe(
      trashRetentionMs(DEFAULT_TRASH_RETENTION_DAYS),
    );

    const now = Date.now();
    expect(trashRemainingLabel(now + 6 * DAY, now)).toBe("se va en 6 días");
    expect(trashRemainingLabel(now + DAY, now)).toBe("se va mañana");
    // Unas horas de plazo todavía son un día por delante: decir «se va en 0
    // días» no informa de nada.
    expect(trashRemainingLabel(now + DAY / 4, now)).toBe("se va mañana");
    expect(trashRemainingLabel(now - 1, now)).toBe(
      "se va en la próxima pasada",
    );
  });

  test("por su tipo se sabe si lo retirado es una foto", () => {
    expect(trashKindOf("image/png")).toBe("image");
    expect(trashKindOf("application/pdf")).toBe("file");
    expect(trashKindOf(undefined)).toBe("file");
  });
});

describe("la papelera del almacén", () => {
  test("lo retirado se guarda con su plazo, y la limpieza ya no lo toca", async () => {
    const { t, coordinator } = await setup();
    const orphan = await file(t);

    expect(await sweepOrphans(t)).toBe(1);

    // La fila apunta a ese archivo, y solo a ese.
    const stored = await t.run((ctx) => ctx.db.query("trashFiles").collect());
    expect(stored).toHaveLength(1);
    expect(stored[0].storageId).toBe(orphan);

    const trash = await coordinator.query(api.trash.list, {});
    expect(trash.pending).toHaveLength(1);
    const [item] = trash.pending;
    // El tipo del archivo lo pone el almacén, y el de mentira no lo guarda (solo
    // el tamaño y el hash): cómo se traduce a foto o a archivo se prueba más
    // abajo, con filas de la papelera escritas a mano.
    expect(item.pass).toBe("orphanFiles");
    expect(item.fromForm).toBe(false);
    expect(item.url).toContain("/api/storage/");
    expect(item.purgeAt - item.removedAt).toBe(
      trashRetentionMs(DEFAULT_TRASH_RETENTION_DAYS),
    );
    expect(trash.pendingBytes).toBe(item.size);
    expect(trash.nextPurgeAt).toBe(item.purgeAt);
    expect(trash.retentionDays).toBe(DEFAULT_TRASH_RETENTION_DAYS);

    // Sigue en el almacén: la papelera es un plazo, no un borrado.
    expect(await stillStored(t, orphan)).toBe(true);
    // Y mientras su fila esté ahí, la limpieza lo deja en paz: es esa fila la
    // que lo cita.
    expect(await sweepOrphans(t)).toBe(0);
    expect(await stillStored(t, orphan)).toBe(true);
  });

  test("la pasada de la papelera borra lo caducado y respeta lo rescatado", async () => {
    const { t, coordinator } = await setup();
    const expired = await file(t);
    const rescued = await file(t, "application/pdf");
    const fresh = await file(t);
    await expiredRow(t, { storageId: expired });
    await expiredRow(t, {
      storageId: rescued,
      kept: true,
      contentType: "application/pdf",
    });
    // Uno que acaba de caer en la papelera: tiene su plazo por delante.
    await t.run((ctx) =>
      ctx.db.insert("trashFiles", {
        storageId: fresh,
        contentType: "image/png",
        size: 11,
        pass: "orphanFiles",
        runBy: AUTO_CLEANUP_BY,
        removedAt: Date.now(),
        purgeAt: Date.now() + 3 * DAY,
        kept: false,
      }),
    );

    expect(await t.mutation(internal.trash.purgeExpired, {})).toBe(1);
    expect(await stillStored(t, expired)).toBe(false);
    // Lo rescatado no caduca, y lo recién retirado tiene su plazo por delante:
    // solo se va si alguien lo borra a mano.
    expect(await stillStored(t, rescued)).toBe(true);
    expect(await stillStored(t, fresh)).toBe(true);

    const trash = await coordinator.query(api.trash.list, {});
    expect(trash.pending).toHaveLength(1);
    expect(trash.pending[0].kind).toBe("image");
    expect(trash.pending[0].contentType).toBe("image/png");
    expect(trash.retentionDays).toBe(DEFAULT_TRASH_RETENTION_DAYS);
    expect(trash.kept).toHaveLength(1);
    expect(trash.kept[0].kind).toBe("file");
    // Lo que queda en la papelera es el rescatado y el recién retirado, no el
    // caducado.
    const left = await t.run((ctx) => ctx.db.query("trashFiles").collect());
    expect(left).toHaveLength(2);
    expect(left.map((row) => row.storageId).sort()).toEqual(
      [rescued, fresh].sort(),
    );

    // Y la pasada deja su constancia, como las otras dos.
    const runs = await coordinator.query(api.cleanupLog.lastRuns, {});
    const recorded = runs.find((run) => run.pass === "trash");
    expect(recorded?.files).toBe(1);
    expect(recorded?.bytes).toBeGreaterThan(0);
    expect(recorded?.runBy).toBe(AUTO_CLEANUP_BY);
  });

  test("recuperar una imagen del formulario le devuelve su vale", async () => {
    const { t, coordinator } = await setup();
    const storageId = await abandonedFormImage(t);
    await t.mutation(internal.reportUploads.sweepUnused, {});

    const [item] = (await coordinator.query(api.trash.list, {})).pending;
    expect(item.fromForm).toBe(true);

    const url = await t.run((ctx) => ctx.storage.getUrl(storageId));
    const description = `<p>La cámara se apaga sola en directo.</p><img src="${url}">`;
    // Sin su vale, el aviso que se quedó a medias ya no puede citarla.
    await expectConvexError(
      t.mutation(api.incidents.report, { ...reportArgs, description }),
      "No se han podido comprobar las imágenes",
    );

    // El instante desde el que cuenta lo que venga: el vale que vuelve es una
    // fila **nueva**, no la de ayer resucitada. Se compara con este instante y no
    // con «hace menos de un segundo», que era una pregunta sobre lo que tarda la
    // máquina en llegar hasta aquí: en una máquina cargada fallaba por tardar, no
    // por otra cosa.
    const antes = Date.now();
    expect(
      await coordinator.mutation(api.trash.restore, { id: item.id }),
    ).toEqual({ kept: false });

    // Recuperada, vuelve a poder: el vale está de vuelta con su ventana nueva.
    await t.mutation(api.incidents.report, { ...reportArgs, description });
    const rows = await t.run((ctx) => ctx.db.query("reportUploads").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].storageId).toBe(storageId);
    expect(rows[0].claimedAt).toBeTypeOf("number");
    expect(rows[0].createdAt).toBeGreaterThanOrEqual(antes);
    // Y sale de la papelera: ya no hay nada que borrar.
    expect((await coordinator.query(api.trash.list, {})).pending).toHaveLength(
      0,
    );
  });

  test("rescatar un archivo sin citar lo deja a salvo", async () => {
    const { t, coordinator } = await setup();
    const orphan = await file(t);
    await sweepOrphans(t);

    const [item] = (await coordinator.query(api.trash.list, {})).pending;
    expect(item.fromForm).toBe(false);

    // Sin ficha a la que volver, lo único que se puede hacer con él es que se
    // quede: la fila de la papelera es la que lo mantiene.
    expect(
      await coordinator.mutation(api.trash.restore, { id: item.id }),
    ).toEqual({ kept: true });

    const trash = await coordinator.query(api.trash.list, {});
    expect(trash.pending).toHaveLength(0);
    expect(trash.kept).toHaveLength(1);
    expect(trash.kept[0].keptAt).toBeTypeOf("number");
    expect(await sweepOrphans(t)).toBe(0);
    expect(await stillStored(t, orphan)).toBe(true);

    // Ni la pasada de la papelera se lo lleva, aunque haya caducado de sobra.
    expect(await t.mutation(internal.trash.purgeExpired, {})).toBe(0);
    expect(await stillStored(t, orphan)).toBe(true);
  });

  test("borrar a mano lo quita del almacén sin esperar el plazo", async () => {
    const { t, coordinator } = await setup();
    const orphan = await file(t);
    await sweepOrphans(t);
    const [item] = (await coordinator.query(api.trash.list, {})).pending;

    const result = await coordinator.mutation(api.trash.deleteNow, {
      id: item.id,
    });
    expect(result.files).toBe(1);
    expect(result.bytes).toBeGreaterThan(0);
    expect(await stillStored(t, orphan)).toBe(false);
    expect((await coordinator.query(api.trash.list, {})).pending).toHaveLength(
      0,
    );
  });

  test("el botón de la limpieza también vacía la papelera", async () => {
    const { t, coordinator } = await setup();
    const expired = await file(t);
    await expiredRow(t, { storageId: expired });

    const result = await coordinator.action(api.storageCleanup.runNow, {});
    expect(result.trash.files).toBe(1);
    expect(await stillStored(t, expired)).toBe(false);

    // Las tres pasadas quedan apuntadas, y esta vez firmadas por quien pulsó.
    const runs = await coordinator.query(api.cleanupLog.lastRuns, {});
    expect(runs).toHaveLength(3);
    for (const run of runs) {
      expect(run.ranAt).not.toBeNull();
      expect(run.runBy).toBe("Elena Vidal");
      expect(run.automatic).toBe(false);
    }
  });

  test("la papelera es de quien gobierna el taller", async () => {
    const { t, tech } = await setup();
    const rowId = await expiredRow(t, { storageId: await file(t) });

    await expectConvexError(
      tech.query(api.trash.list, {}),
      "Solo quien coordina las incidencias o decide las peticiones",
    );
    await expectConvexError(
      tech.mutation(api.trash.restore, { id: rowId }),
      "Solo quien coordina las incidencias o decide las peticiones",
    );
    await expectConvexError(
      tech.mutation(api.trash.deleteNow, { id: rowId }),
      "Solo quien coordina las incidencias o decide las peticiones",
    );
    // Sin sesión tampoco: no es una puerta abierta como la del formulario.
    await expectConvexError(
      t.query(api.trash.list, {}),
      "Debes iniciar sesión",
    );
  });
});

describe("el plazo de la papelera, ajustable desde el taller", () => {
  test("lo que se retira con un plazo nuevo se guarda esos días", async () => {
    const { t, coordinator } = await setup();
    await coordinator.mutation(api.trash.setSettings, { days: 30 });

    // El ajuste queda guardado, con su fecha y firmado por quien lo puso.
    const settings = await coordinator.query(api.trash.settings, {});
    expect(settings.days).toBe(30);
    expect(settings.updatedBy).toBe("Elena Vidal");
    expect(settings.updatedAt).toBeTypeOf("number");

    // Un archivo que se retira ahora entra con el plazo nuevo.
    await file(t);
    expect(await sweepOrphans(t)).toBe(1);
    const [row] = await t.run((ctx) => ctx.db.query("trashFiles").collect());
    expect(row.purgeAt - row.removedAt).toBe(trashRetentionMs(30));

    // Y la papelera lo cuenta con el vigente, no con el de partida.
    expect((await coordinator.query(api.trash.list, {})).retentionDays).toBe(
      30,
    );
  });

  test("lo que ya está dentro cumple el plazo con el que entró", async () => {
    const { t, coordinator } = await setup();
    const already = await file(t);
    const now = Date.now();
    await t.run((ctx) =>
      ctx.db.insert("trashFiles", {
        storageId: already,
        contentType: "image/png",
        size: 11,
        pass: "orphanFiles",
        runBy: AUTO_CLEANUP_BY,
        removedAt: now,
        purgeAt: now + 7 * DAY,
        kept: false,
      }),
    );

    await coordinator.mutation(api.trash.setSettings, { days: 30 });

    // Su fecha no se toca: el ajuste no cambia la suerte que ya tenía decidida.
    const [row] = await t.run((ctx) => ctx.db.query("trashFiles").collect());
    expect(row.purgeAt - row.removedAt).toBe(7 * DAY);
  });

  test("el plazo tiene límites y lo pone quien gobierna el taller", async () => {
    const { t, coordinator, tech } = await setup();

    await expectConvexError(
      tech.query(api.trash.settings, {}),
      "Solo quien coordina las incidencias o decide las peticiones",
    );
    await expectConvexError(
      tech.mutation(api.trash.setSettings, { days: 30 }),
      "Solo quien coordina las incidencias o decide las peticiones",
    );
    for (const days of [
      MIN_TRASH_RETENTION_DAYS - 1,
      MAX_TRASH_RETENTION_DAYS + 1,
    ]) {
      await expectConvexError(
        coordinator.mutation(api.trash.setSettings, { days }),
        "debe estar entre",
      );
    }

    // Sin fila guardada vale el de partida, y no se ha escrito nada por el camino.
    expect((await coordinator.query(api.trash.settings, {})).days).toBe(
      DEFAULT_TRASH_RETENTION_DAYS,
    );
    expect(
      await t.run((ctx) => ctx.db.query("storageSettings").collect()),
    ).toHaveLength(0);
  });
});
