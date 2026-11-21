import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { orphanPurgeAt } from "../../lib/mailShare";

/**
 * Marca como huérfanas las copias de un equipo o un manual que se acaba de
 * borrar.
 *
 * Equipos y manuales no tienen papelera de módulo: el borrado es inmediato, así
 * que la copia no se purga en el acto. Queda con su contenido, visible solo
 * para el administrador, hasta que venza el plazo fijo de siete días
 * (`orphanPurgeAt`) o alguien la purgue a mano. No hay forma de volver a
 * engancharla a otra ficha: la referencia se conserva solo para la papelera.
 *
 * Se llama dentro de la misma mutación que borra la ficha, así que o quedan las
 * dos cosas —ficha fuera y copia huérfana— o no queda ninguna.
 */
export async function markDestinationDeleted(
  ctx: MutationCtx,
  destinationType: "equipment" | "manual",
  destinationId: Id<"equipment"> | Id<"manuals">,
  now: number,
): Promise<number> {
  const rows = await ctx.db
    .query("mailShares")
    .withIndex("by_destination", (q) =>
      q
        .eq("destinationType", destinationType)
        .eq("destinationId", destinationId),
    )
    .collect();

  for (const row of rows) {
    // Una copia ya marcada conserva su plazo: el borrado no lo reinicia.
    if (row.destinationDeletedAt !== undefined) continue;
    await ctx.db.patch(row._id, {
      destinationDeletedAt: now,
      orphanPurgeAt: orphanPurgeAt(now),
    });
  }
  return rows.length;
}
