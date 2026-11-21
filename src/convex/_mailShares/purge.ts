import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { logSecurityEvent } from "../audit";

/**
 * Borra el contenido de una copia y deja la fila como lápida.
 *
 * Es lo común a la purga manual y a la de las huérfanas: los objetos de
 * `_storage` —adjuntos y `.eml`— se borran aquí, y la fila conserva su
 * procedencia y su fecha de purga para que la traza explique qué hubo. El
 * barrido nocturno de `storageCleanup` recoge lo que fallara al borrar.
 */
export async function wipeShareContent(
  ctx: MutationCtx,
  row: Doc<"mailShares">,
  purge: {
    reason: "manual" | "destination" | "orphan";
    by?: Id<"users">;
    now: number;
  },
): Promise<void> {
  for (const attachment of row.attachments ?? []) {
    try {
      await ctx.storage.delete(attachment.storageId);
    } catch {
      // El barrido nocturno recoge lo que quede sin cita.
    }
  }
  if (row.emlStorageId) {
    try {
      await ctx.storage.delete(row.emlStorageId);
    } catch {
      // Igual que los adjuntos.
    }
  }

  await ctx.db.patch(row._id, {
    subject: undefined,
    fromName: undefined,
    fromAddress: undefined,
    summary: undefined,
    bodyText: undefined,
    bodyHtml: undefined,
    bodyTruncated: undefined,
    emlStorageId: undefined,
    emlFileName: undefined,
    emlSize: undefined,
    attachments: undefined,
    sourceMessageId: undefined,
    sourceEmail: undefined,
    contentPurgedAt: purge.now,
    contentPurgedBy: purge.by,
    purgeReason: purge.reason,
  });
}

/**
 * Purga las copias de una incidencia o una petición que se borra de verdad.
 *
 * Incidencias y peticiones no dejan huérfanas: su papelera es la del destino,
 * así que cuando la ficha vence su plazo —o alguien la borra a mano— la copia
 * se va en la misma operación. La fila no se queda como lápida: sin ficha viva
 * no hay dónde leerla, y la constancia queda en `securityAuditLog`. Una copia
 * que ya estaba purgada a mano también se borra, pero no se audita dos veces.
 *
 * Se llama dentro de la mutación que borra la ficha, así que o se van las dos
 * cosas o no se va ninguna.
 */
export async function purgeForDestination(
  ctx: MutationCtx,
  destinationType: "incident" | "request",
  destinationId: Id<"incidents"> | Id<"partRequests">,
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
    if (row.contentPurgedAt === undefined) {
      await wipeShareContent(ctx, row, { reason: "destination", now });
      await logSecurityEvent(ctx, {
        action: "mail_share_purge",
        target: `${row.destinationType}:${row.destinationReference ?? ""}`,
        metadata: { shareId: row._id, reason: "destination" },
      });
    }
    await ctx.db.delete(row._id);
  }
  return rows.length;
}
