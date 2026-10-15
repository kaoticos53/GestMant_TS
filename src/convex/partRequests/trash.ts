import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  type MutationCtx,
  internalMutation,
  mutation,
  query,
} from "../_generated/server";
import { richDocToPlainText } from "../../lib/richDoc";
import { trashPurgeAt } from "../../lib/trash";
import { trashRetentionDays } from "../trash";
import { actorName, requireDecisionCapability } from "./helpers";

/** Tandas de la pasada nocturna, como en la papelera de incidencias. */
const PURGE_LIMIT = 100;

/**
 * Borra de verdad una petición retirada: su fila y los archivos que adjuntaba.
 * Es lo irreversible, así que solo lo llaman el borrado a mano y la pasada de la
 * papelera, nunca la retirada.
 *
 * Lo que sí se queda son las peticiones de compra que se pidieron por ella: son
 * la constancia de lo que se compró, y guardan copiada la referencia de la
 * petición, así que siguen leyéndose —y recibiéndose— sin la petición de la que
 * salieron.
 */
async function purgeRequest(
  ctx: MutationCtx,
  request: Doc<"partRequests">,
): Promise<void> {
  for (const attachment of request.attachments ?? []) {
    await ctx.storage.delete(attachment.storageId);
  }
  await ctx.db.delete(request._id);
}

/* ------------------------------------------------------------------ */
/* Papelera: retirar, recuperar, borrar y vaciar lo cumplido          */
/* ------------------------------------------------------------------ */

/**
 * Retira una petición: se pidió por error o es el duplicado de otra. No se borra
 * —eso sería irreversible— sino que sale de la cola y espera en la papelera con
 * el mismo plazo que lo retirado del almacén y de las incidencias (`lib/trash`).
 *
 * Vale para cualquier estado: lo que se retira es la petición entera, con sus
 * decisiones, no un paso de su flujo. Retirar dos veces la misma petición no es
 * un error.
 */
export const withdraw = mutation({
  args: { requestId: v.id("partRequests"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireDecisionCapability(ctx, "retirar peticiones");
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("La petición ya no existe.");
    if (request.deletedAt !== undefined) return;

    const now = Date.now();
    const reason = args.reason?.trim();
    await ctx.db.patch(args.requestId, {
      deletedAt: now,
      deletedBy: await actorName(ctx, userId),
      ...(reason ? { deletedReason: reason } : {}),
      // El plazo vigente se cuenta ahora, no al recuperarla: lo retirado cumple
      // el plazo con el que entró, igual que en la papelera del almacén.
      purgeAt: trashPurgeAt(now, await trashRetentionDays(ctx)),
    });
  },
});

/**
 * Recupera una petición de la papelera: vuelve a la cola —o al archivo, si de
 * ahí salió— tal y como estaba, con sus repuestos asociados, sus decisiones y
 * sus adjuntos.
 */
export const restore = mutation({
  args: { requestId: v.id("partRequests") },
  handler: async (ctx, args) => {
    await requireDecisionCapability(ctx, "recuperar peticiones");
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("La petición ya no existe.");
    if (request.deletedAt === undefined) return;

    await ctx.db.patch(args.requestId, {
      deletedAt: undefined,
      deletedBy: undefined,
      deletedReason: undefined,
      purgeAt: undefined,
    });
  },
});

/**
 * Borra ya una petición retirada, sin esperar el plazo: lo que alguien retiró y
 * ahora confirma que no quiere. Es la única forma de borrar de verdad, así que
 * pide que la petición esté retirada: lo que no ha pasado por la papelera no se
 * borra de un tirón.
 */
export const deleteNow = mutation({
  args: { requestId: v.id("partRequests") },
  handler: async (ctx, args) => {
    await requireDecisionCapability(ctx, "borrar peticiones");
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("La petición ya no existe.");
    if (request.deletedAt === undefined) {
      throw new ConvexError(
        "Retira la petición antes de borrarla: lo que no pasa por la papelera no se puede recuperar.",
      );
    }
    await purgeRequest(ctx, request);
  },
});

/**
 * La pasada de la papelera de peticiones: borra de verdad lo que cumplió su
 * plazo sin que nadie lo recuperara. Va por tandas, como la del almacén y la de
 * incidencias, y no toca nada más: lo que está dentro de plazo espera a su
 * noche.
 */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("partRequests")
      .withIndex("by_purgeAt", (q) => q.lt("purgeAt", Date.now()))
      .take(PURGE_LIMIT);

    let purged = 0;
    for (const request of rows) {
      // El índice solo guarda lo retirado; aun así, un `purgeAt` suelto —un dato
      // viejo— no borra una petición que está en la cola.
      if (request.deletedAt === undefined) continue;
      await purgeRequest(ctx, request);
      purged += 1;
    }
    return purged;
  },
});

/** Una petición en la papelera, tal y como la enseña el módulo Archivo. */
export interface WithdrawnRequestItem {
  id: Id<"partRequests">;
  reference: string;
  status: Doc<"partRequests">["status"];
  requesterName: string;
  requesterTeam: string | null;
  equipment: string | null;
  /** Lo que pide —repuestos o descripción—, en texto plano: una línea de lista. */
  summary: string;
  deletedAt: number;
  deletedBy: string | null;
  deletedReason: string | null;
  purgeAt: number;
  /** Salió del archivo: recuperarla la devuelve allí, no a la cola. */
  archived: boolean;
}

/**
 * La papelera de peticiones, para el módulo Archivo: lo retirado —lo que antes
 * se borra, delante— y el plazo vigente. La ve quien decide peticiones: es la
 * pantalla desde la que se deshace, y lo retirado no es del día a día de nadie.
 */
export const trash = query({
  args: {},
  handler: async (ctx) => {
    await requireDecisionCapability(ctx, "ver la papelera de peticiones");

    const rows = await ctx.db
      .query("partRequests")
      .withIndex("by_deletedAt")
      .collect();
    const items: WithdrawnRequestItem[] = rows
      .filter((row) => row.deletedAt !== undefined)
      .map((row) => ({
        id: row._id,
        reference: row.reference,
        status: row.status,
        requesterName: row.requesterName,
        requesterTeam: row.requesterTeam ?? null,
        equipment: row.equipment ?? null,
        summary:
          row.lines.map((line) => `${line.code} ${line.name}`).join(" · ") ||
          richDocToPlainText(row.description),
        deletedAt: row.deletedAt!,
        deletedBy: row.deletedBy ?? null,
        deletedReason: row.deletedReason ?? null,
        // Sin fecha de borrado —dato viejo— se cuenta desde que se retiró.
        purgeAt: row.purgeAt ?? row.deletedAt!,
        archived: row.archivedAt !== undefined,
      }))
      // Lo que antes se va, delante: es lo que pide una decisión.
      .sort((a, b) => a.purgeAt - b.purgeAt);

    return {
      items,
      nextPurgeAt: items[0]?.purgeAt ?? null,
      retentionDays: await trashRetentionDays(ctx),
    };
  },
});
