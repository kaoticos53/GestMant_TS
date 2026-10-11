import { ConvexError, v } from "convex/values";
import { AUTO_CLEANUP_BY } from "../lib/cleanupLog";
import type { RemovalPass } from "../lib/cleanupLog";
import {
  DEFAULT_TRASH_RETENTION_DAYS,
  MAX_TRASH_RETENTION_DAYS,
  MIN_TRASH_RETENTION_DAYS,
  trashKindOf,
  trashPurgeAt,
  type TrashKind,
} from "../lib/trash";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { recordCleanupRun } from "./cleanupLog";
import { requireCoordinator } from "./permissions";

/**
 * La papelera del almacén.
 *
 * Lo que la limpieza retira no se borra en el acto: se queda aquí unos días —el
 * archivo sigue en el almacén, es su fila de la papelera la que lo mantiene— y
 * desde Ajustes del taller se puede recuperar mientras tanto. Sin papelera, un
 * purgado por error era irreversible: los archivos no van a ninguna ficha que
 * los pueda reclamar, así que no había de dónde tirar para atrás.
 *
 * La papelera no es un segundo almacén: tiene su plazo (`lib/trash`) y lo deja
 * pasar. Una pasada —la tercera de la limpieza, y también a mano desde la
 * tarjeta de Ajustes del taller— borra de verdad lo que ya cumplió su plazo. Una
 * fila rescatada (`kept`) deja de caducar: se queda hasta que alguien la borre.
 *
 * De un archivo retirado solo se sabe lo que el almacén guarda de él —su tipo y
 * lo que ocupa—, porque ninguna ficha responde ya por él. Lo que sí se apunta es
 * de dónde salió: qué pasada se lo llevó, quién la lanzó y, si venía del
 * formulario público, su vale, que es lo que le permite volver a su sitio.
 */

/**
 * Tope de una pasada de la papelera: no borra de golpe todo lo que haya
 * caducado. Como las demás pasadas, si queda más, la siguiente sigue por donde
 * esta lo dejó.
 */
const PURGE_LIMIT = 100;

/** Una sola fila de ajustes: se lee y se escribe siempre en el mismo sitio. */
const SETTINGS_KEY = "default";

/** El nombre visible de quien firma un ajuste. */
function actorName(user: { name?: string; email?: string }): string {
  return user.name?.trim() || user.email?.trim() || "Coordinación del taller";
}

/** Lo que se sabe de un archivo en el momento de retirarlo. */
export interface TrashedFile {
  storageId: Id<"_storage">;
  /** Lo que ocupa según el almacén. */
  size: number;
  contentType?: string;
  /** Qué pasada lo retira: solo las dos que retiran archivos. */
  pass: RemovalPass;
  /** Quién la lanzó: la limpieza automática o el nombre de quien pulsó. */
  runBy: string;
  /** El vale del formulario, si el archivo vino de ahí. */
  ticket?: string;
  /** Cuándo se retiró; sin él, ahora mismo. */
  removedAt?: number;
}

/**
 * El plazo vigente de la papelera, en días. Lo leen la pasada que retira —para
 * ponerle fecha a lo que guarda— y la pantalla; sin fila guardada vale el de
 * partida del código. No comprueba permisos: quien lo lee aquí es una pasada
 * interna, no una persona; los ajustes que sí se piden desde la pantalla van por
 * `settings`.
 */
export async function trashRetentionDays(
  ctx: QueryCtx | MutationCtx,
): Promise<number> {
  const row = await ctx.db
    .query("storageSettings")
    .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
    .unique();
  return row?.trashRetentionDays ?? DEFAULT_TRASH_RETENTION_DAYS;
}

/**
 * Deja un archivo en la papelera. Lo llaman las dos pasadas que retiran cosas,
 * para que lo retirado se guarde igual venga de donde venga.
 *
 * Si el archivo ya estaba en la papelera —no debería: mientras su fila esté, la
 * limpieza lo deja en paz— se refresca su plazo en vez de apuntarlo dos veces,
 * que es lo que dejaría la papelera con dos filas del mismo archivo y dos
 * plazos para borrarlo.
 */
export async function moveToTrash(
  ctx: MutationCtx,
  file: TrashedFile,
): Promise<void> {
  const removedAt = file.removedAt ?? Date.now();
  const fields = {
    storageId: file.storageId,
    ...(file.contentType !== undefined
      ? { contentType: file.contentType }
      : {}),
    size: file.size,
    pass: file.pass,
    runBy: file.runBy,
    removedAt,
    purgeAt: trashPurgeAt(removedAt, await trashRetentionDays(ctx)),
    ...(file.ticket !== undefined ? { ticket: file.ticket } : {}),
    kept: false,
  };

  const already = await ctx.db
    .query("trashFiles")
    .withIndex("by_storage", (q) => q.eq("storageId", file.storageId))
    .unique();
  if (already) {
    await ctx.db.patch(already._id, fields);
    return;
  }
  await ctx.db.insert("trashFiles", fields);
}

/**
 * Borra de verdad lo que ya cumplió su plazo: los archivos y sus filas. Se mira
 * el tamaño en el almacén y no el que se apuntó al retirarlos, que es lo que
 * cuenta para el sitio liberado; un archivo que ya no esté —borrado a mano
 * mientras estaba en la papelera— deja su fila y no se cuenta.
 */
export async function purgeExpiredRows(
  ctx: MutationCtx,
): Promise<{ files: number; bytes: number }> {
  const rows = await ctx.db
    .query("trashFiles")
    .withIndex("by_kept_purgeAt", (q) =>
      q.eq("kept", false).lt("purgeAt", Date.now()),
    )
    .take(PURGE_LIMIT);

  let files = 0;
  let bytes = 0;
  for (const row of rows) {
    const file = await ctx.db.system.get("_storage", row.storageId);
    if (file) {
      bytes += file.size;
      await ctx.storage.delete(row.storageId);
      files += 1;
    }
    await ctx.db.delete(row._id);
  }
  return { files, bytes };
}

/**
 * La pasada de la papelera: borra lo caducado y deja su constancia firmada por
 * la limpieza automática. Devuelve cuántos archivos borró, que es lo que miran
 * las pruebas.
 */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const result = await purgeExpiredRows(ctx);
    await recordCleanupRun(ctx, "trash", result, AUTO_CLEANUP_BY);
    return result.files;
  },
});

/** Un archivo de la papelera, tal y como lo enseña Ajustes del taller. */
export type TrashItem = {
  id: Id<"trashFiles">;
  /** La dirección del archivo, para verlo o descargarlo mientras esté. */
  url: string | null;
  kind: TrashKind;
  contentType: string | null;
  size: number;
  pass: RemovalPass;
  runBy: string;
  removedAt: number;
  purgeAt: number;
  /** Rescatado: ya no caduca. */
  kept: boolean;
  keptAt: number | null;
  /** Vino del formulario público: recuperarlo es devolverle su vale. */
  fromForm: boolean;
};

/**
 * La papelera, para el panel de Ajustes del taller: lo que está a punto de
 * borrarse —lo primero que se va, delante— y lo que se rescató. Se enseña cada
 * archivo con la dirección que le da el almacén, que es lo que permite abrirlo o
 * descargarlo mientras esté aquí: es la forma de recuperarlo cuando no hay
 * ninguna ficha a la que devolverlo.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireCoordinator(ctx, "ver la papelera del almacén");

    const rows = await ctx.db.query("trashFiles").collect();
    const items: TrashItem[] = [];
    for (const row of rows) {
      const file = await ctx.db.system.get("_storage", row.storageId);
      items.push({
        id: row._id,
        url: await ctx.storage.getUrl(row.storageId),
        kind: trashKindOf(row.contentType),
        contentType: row.contentType ?? null,
        // El tamaño que manda es el que ve el almacén; el apuntado es el de
        // cuando se retiró, que solo se usa si el archivo ya no está.
        size: file?.size ?? row.size,
        pass: row.pass,
        runBy: row.runBy,
        removedAt: row.removedAt,
        purgeAt: row.purgeAt,
        kept: row.kept,
        keptAt: row.keptAt ?? null,
        fromForm: row.ticket !== undefined,
      });
    }

    const pending = items
      .filter((item) => !item.kept)
      .sort((a, b) => a.purgeAt - b.purgeAt);
    const kept = items
      .filter((item) => item.kept)
      .sort((a, b) => (b.keptAt ?? 0) - (a.keptAt ?? 0));

    return {
      pending,
      kept,
      pendingBytes: pending.reduce((total, item) => total + item.size, 0),
      nextPurgeAt: pending[0]?.purgeAt ?? null,
      retentionDays: await trashRetentionDays(ctx),
    };
  },
});

/**
 * Los ajustes de la papelera, para Ajustes del taller: cuántos días se guarda lo
 * retirado antes de borrarlo de verdad. Se enseña siempre el valor vigente —el
 * guardado o el de partida—, para que la pantalla no tenga que saber cuál es, y
 * lo lee quien gobierna el taller, como el resto de la tarjeta.
 */
export const settings = query({
  args: {},
  handler: async (ctx) => {
    await requireCoordinator(ctx, "ver los ajustes de la papelera del almacén");

    const row = await ctx.db
      .query("storageSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique();
    return {
      days: row?.trashRetentionDays ?? DEFAULT_TRASH_RETENTION_DAYS,
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
    };
  },
});

/**
 * Fija el plazo de la papelera, en días.
 *
 * Vale para lo que se retire a partir de ahora: lo que ya está guardado cumple el
 * plazo con el que entró, y su fecha no se toca. Reescribirla cambiaría la suerte
 * de un archivo por un ajuste que no lo tenía delante —y acortar el plazo de
 * golpe sería justo lo que no se debe hacer sin querer—. Cada fila dice cuándo se
 * va; lo que cambia es lo que se apunta de aquí en adelante.
 */
export const setSettings = mutation({
  args: { days: v.number() },
  handler: async (ctx, args) => {
    const user = await requireCoordinator(
      ctx,
      "ajustar el plazo de la papelera del almacén",
    );
    const days = Math.round(args.days);
    if (
      !Number.isFinite(days) ||
      days < MIN_TRASH_RETENTION_DAYS ||
      days > MAX_TRASH_RETENTION_DAYS
    ) {
      throw new ConvexError(
        `El plazo de la papelera debe estar entre ${MIN_TRASH_RETENTION_DAYS} y ${MAX_TRASH_RETENTION_DAYS} días.`,
      );
    }

    const now = Date.now();
    const by = actorName(user);
    const row = await ctx.db
      .query("storageSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique();
    if (row) {
      await ctx.db.patch(row._id, {
        trashRetentionDays: days,
        updatedAt: now,
        updatedBy: by,
      });
      return;
    }
    await ctx.db.insert("storageSettings", {
      key: SETTINGS_KEY,
      trashRetentionDays: days,
      updatedAt: now,
      updatedBy: by,
    });
  },
});

/**
 * Recupera un archivo antes de que se lo lleve la pasada de la papelera.
 *
 * Lo que se puede hacer con él depende de si tiene a dónde volver. Un archivo
 * del formulario público vuelve a su sitio: se le devuelve su vale con la
 * ventana nueva —vuelve a la lista de imágenes sin usar del panel y, si quien
 * notificaba el aviso todavía estaba a medio escribirlo, su foto vuelve a estar
 * donde la dejó—. Uno que retiró la limpieza de los archivos sin citar no tiene
 * a dónde volver: ninguna ficha lo reclama —por eso se lo llevó—, así que se
 * queda en la papelera marcado como rescatado, que es esta fila la que lo
 * mantiene a salvo.
 */
export const restore = mutation({
  args: { id: v.id("trashFiles") },
  handler: async (ctx, args) => {
    await requireCoordinator(ctx, "recuperar un archivo de la papelera");

    const row = await ctx.db.get(args.id);
    if (!row) throw new ConvexError("Ese archivo ya no está en la papelera.");

    if (row.ticket !== undefined) {
      const now = Date.now();
      await ctx.db.insert("reportUploads", {
        ticket: row.ticket,
        storageId: row.storageId,
        createdAt: now,
        // Vuelve acreditada: es lo que hace falta para que una incidencia pueda
        // citarla otra vez.
        claimedAt: now,
      });
      await ctx.db.delete(row._id);
      return { kept: false };
    }

    await ctx.db.patch(row._id, { kept: true, keptAt: Date.now() });
    return { kept: true };
  },
});

/**
 * Borra un archivo de la papelera sin esperar su plazo: lo que alguien retiró y
 * ahora confirma que no quiere. Es la única forma de borrar lo rescatado, que ya
 * no caduca solo.
 */
export const deleteNow = mutation({
  args: { id: v.id("trashFiles") },
  handler: async (ctx, args) => {
    await requireCoordinator(ctx, "borrar un archivo de la papelera");

    const row = await ctx.db.get(args.id);
    if (!row) throw new ConvexError("Ese archivo ya no está en la papelera.");

    const file = await ctx.db.system.get("_storage", row.storageId);
    if (file) await ctx.storage.delete(row.storageId);
    await ctx.db.delete(row._id);

    return { files: file ? 1 : 0, bytes: file?.size ?? 0 };
  },
});
