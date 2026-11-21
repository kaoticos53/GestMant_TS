import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { MailShareDestinationType } from "../../lib/mailShare";

/** Lo que la ficha destino aporta a la copia: referencia visible y si está retirada. */
export interface ResolvedDestination {
  reference: string;
  /** La ficha está en la papelera de su módulo (solo incidencias y peticiones). */
  deleted: boolean;
}

/**
 * Resuelve la ficha destino de una copia.
 *
 * La referencia se copia en la fila porque sobrevive al destino: es lo que se
 * lee en la papelera administrativa cuando el equipo o el manual ya no existen.
 * Incidencias y peticiones pueden estar retiradas —su copia sigue viva hasta el
 * `purgeAt`—; equipos, manuales y compras no tienen papelera de módulo, así que
 * si la ficha existe, está viva.
 */
export async function resolveDestination(
  ctx: QueryCtx,
  type: MailShareDestinationType,
  destinationId: string,
): Promise<ResolvedDestination> {
  switch (type) {
    case "incident": {
      const row = await ctx.db.get(destinationId as Id<"incidents">);
      if (!row) throw new ConvexError("Esa incidencia ya no existe.");
      return { reference: row.reference, deleted: row.deletedAt !== undefined };
    }
    case "request": {
      const row = await ctx.db.get(destinationId as Id<"partRequests">);
      if (!row) throw new ConvexError("Esa petición ya no existe.");
      return { reference: row.reference, deleted: row.deletedAt !== undefined };
    }
    case "equipment": {
      const row = await ctx.db.get(destinationId as Id<"equipment">);
      if (!row) throw new ConvexError("Ese equipo ya no existe.");
      return { reference: row.code?.trim() || row.name, deleted: false };
    }
    case "manual": {
      const row = await ctx.db.get(destinationId as Id<"manuals">);
      if (!row) throw new ConvexError("Ese manual ya no existe.");
      return { reference: row.title, deleted: false };
    }
    case "purchaseOrder": {
      const row = await ctx.db.get(destinationId as Id<"purchaseOrders">);
      if (!row) throw new ConvexError("Esa orden de compra ya no existe.");
      return { reference: row.reference, deleted: false };
    }
    case "purchaseRequest": {
      const row = await ctx.db.get(destinationId as Id<"purchaseRequests">);
      if (!row) throw new ConvexError("Esa petición de compra ya no existe.");
      return { reference: row.reference, deleted: false };
    }
  }
}
