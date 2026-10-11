import { CLEANUP_PASSES, AUTO_CLEANUP_BY } from "../lib/cleanupLog";
import type { CleanupPass } from "../lib/cleanupLog";
import { MutationCtx, query } from "./_generated/server";
import { requireCoordinator } from "./permissions";

/**
 * La constancia de las pasadas de limpieza del almacén.
 *
 * El taller retira archivos del almacén de madrugada en dos pasadas —lo que dejó
 * a medias el formulario público y lo que ya no cita ninguna ficha— y también
 * puede adelantarlas a mano desde Ajustes del taller. Cada pasada deja aquí una
 * fila con cuándo fue, qué retiró y quién la lanzó, que es lo que se lee en esa
 * pantalla: sin constancia, la única forma de saber si la limpieza hizo algo
 * sería mirar lo que queda, y eso no dice nada de lo que ya se llevó.
 *
 * Una fila por pasada y no un histórico: lo que se quiere saber es la última
 * vez, y las pasadas que de verdad importan son dos. Lo que se llevaron por
 * delante no se puede recuperar, así que guardar la lista de lo borrado no
 * serviría de nada.
 */

/** Lo que retiró una pasada, tal y como lo cuenta su constancia. */
export interface CleanupResult {
  files: number;
  bytes: number;
  tickets?: number;
  /**
   * Archivos que la pasada no pudo leer: se quedan donde están y se señalan. Los
   * retira la noche siguiente a la primera que sí los lea —o los deja para
   * siempre, si no hay forma—; hasta entonces, esta es la cuenta que lo dice.
   */
  unreadable?: number;
}

/** El nombre que firma una limpieza lanzada a mano. */
export function cleanupActor(user: { name?: string; email?: string }): string {
  return user.name?.trim() || user.email?.trim() || "Coordinación del taller";
}

/**
 * La última pasada de una clave, tal y como quedó apuntada: la lee quien tiene que
 * comparar lo de ahora con lo de la vez anterior —el aviso de los archivos que no
 * se pueden leer— y la propia constancia, que actualiza la fila en vez de
 * apuntarla dos veces.
 */
export async function lastRun(ctx: MutationCtx, pass: CleanupPass) {
  return await ctx.db
    .query("storageCleanupRuns")
    .withIndex("by_pass", (q) => q.eq("pass", pass))
    .unique();
}

/** Deja constancia de una pasada: cuándo fue, qué retiró y quién la lanzó. */
export async function recordCleanupRun(
  ctx: MutationCtx,
  pass: CleanupPass,
  result: CleanupResult,
  runBy: string,
): Promise<void> {
  const row = await lastRun(ctx, pass);

  const fields = {
    pass,
    ranAt: Date.now(),
    files: result.files,
    bytes: result.bytes,
    runBy,
    ...(result.tickets !== undefined ? { tickets: result.tickets } : {}),
    ...(result.unreadable !== undefined
      ? { unreadable: result.unreadable }
      : {}),
  };
  if (row) await ctx.db.patch(row._id, fields);
  else await ctx.db.insert("storageCleanupRuns", fields);
}

/** Cuántas purgas a mano enseña la constancia, de la más nueva atrás. */
const PURGE_HISTORY_LIMIT = 10;

/**
 * La constancia de las purgas a mano de las imágenes del formulario: quién las
 * hizo, cuándo y qué se llevó cada una, la más nueva primero. Es una lista, no
 * una última vez: cada purga a mano deja su fila y no hay forma de borrarla desde
 * la aplicación —lo que ya está retirado no vuelve a su sitio solo, así que la
 * constancia tiene que poder leerse meses después—.
 *
 * Se lee desde Ajustes del taller, al lado del botón que purga, y va con el mismo
 * permiso que él: si puedes barrer el almacén, puedes ver quién lo ha barrido. Se
 * enseña solo la última tanda y se dice si quedan más detrás, como en las demás
 * listas largas de la aplicación.
 */
export const purges = query({
  args: {},
  handler: async (ctx) => {
    await requireCoordinator(ctx, "ver las purgas a mano del almacén");

    const rows = await ctx.db
      .query("reportUploadPurges")
      .withIndex("by_ranAt")
      .order("desc")
      .take(PURGE_HISTORY_LIMIT);

    return {
      entries: rows.map((row) => ({
        id: row._id,
        runBy: row.runBy,
        ranAt: row.ranAt,
        images: row.images,
        tickets: row.tickets,
        bytes: row.bytes,
      })),
      // Hay más purgas detrás de la última tanda.
      partial: rows.length === PURGE_HISTORY_LIMIT,
    };
  },
});

/**
 * La última vez de cada pasada, para la tarjeta de Ajustes del taller. Sale
 * siempre una entrada por pasada —con la fecha a `null` mientras no haya
 * corrido—, para que quien pinta no tenga que saber cuántas hay.
 */
export const lastRuns = query({
  args: {},
  handler: async (ctx) => {
    await requireCoordinator(ctx, "ver la limpieza del almacén");
    const rows = await ctx.db.query("storageCleanupRuns").collect();

    return CLEANUP_PASSES.map((pass) => {
      const row = rows.find((item) => item.pass === pass);
      return {
        pass,
        ranAt: row?.ranAt ?? null,
        files: row?.files ?? 0,
        bytes: row?.bytes ?? 0,
        tickets: row?.tickets ?? 0,
        unreadable: row?.unreadable ?? 0,
        runBy: row?.runBy ?? null,
        automatic: row?.runBy === AUTO_CLEANUP_BY,
      };
    });
  },
});
