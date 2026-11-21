import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { estimateCacheUsage } from "../../lib/mailClient/cache";

/**
 * Operaciones de la caché de contenido compartidas por cuerpo, cuenta y barrido.
 * La unidad es siempre el mensaje completo: cuerpo, adjuntos y objetos.
 */

export async function deleteMessageContent(
  ctx: MutationCtx,
  header: Pick<Doc<"mailHeaders">, "userId" | "accountId" | "messageId">,
): Promise<void> {
  const attachments = await ctx.db
    .query("mailAttachments")
    .withIndex("by_user_message", (q) =>
      q
        .eq("userId", header.userId)
        .eq("accountId", header.accountId)
        .eq("messageId", header.messageId),
    )
    .collect();
  for (const attachment of attachments) {
    await ctx.storage.delete(attachment.storageId);
    await ctx.db.delete(attachment._id);
  }

  const bodies = await ctx.db
    .query("mailBodies")
    .withIndex("by_user_message", (q) =>
      q
        .eq("userId", header.userId)
        .eq("accountId", header.accountId)
        .eq("messageId", header.messageId),
    )
    .collect();
  for (const body of bodies) await ctx.db.delete(body._id);
}

/** Limpia las marcas de caché de una cabecera sin tocarla como mensaje. */
export async function clearHeaderCache(
  ctx: MutationCtx,
  header: Doc<"mailHeaders">,
): Promise<void> {
  await ctx.db.patch(header._id, {
    bodyState: "none",
    cachedAt: undefined,
    lastOpenedAt: undefined,
    cachedBytes: undefined,
  });
}

/** Borra todo el contenido descargado de una cuenta, incluidas sus cabeceras. */
export async function deleteAccountContent(
  ctx: MutationCtx,
  accountId: Id<"mailAccounts">,
): Promise<void> {
  const attachments = await ctx.db
    .query("mailAttachments")
    .withIndex("by_account", (q) => q.eq("accountId", accountId))
    .collect();
  for (const attachment of attachments) {
    await ctx.storage.delete(attachment.storageId);
    await ctx.db.delete(attachment._id);
  }

  const bodies = await ctx.db
    .query("mailBodies")
    .withIndex("by_account", (q) => q.eq("accountId", accountId))
    .collect();
  for (const body of bodies) await ctx.db.delete(body._id);

  const headers = await ctx.db
    .query("mailHeaders")
    .withIndex("by_account", (q) => q.eq("accountId", accountId))
    .collect();
  for (const header of headers) {
    if (header.bodyState !== "none") await clearHeaderCache(ctx, header);
  }
}

/** Recalcula los tres contadores desde las filas, en la misma transacción. */
export async function recountAccount(
  ctx: MutationCtx,
  account: Doc<"mailAccounts">,
): Promise<{ totalBytes: number; bodyBytes: number; attachmentBytes: number }> {
  const bodies = await ctx.db
    .query("mailBodies")
    .withIndex("by_account", (q) => q.eq("accountId", account._id))
    .collect();
  const attachments = await ctx.db
    .query("mailAttachments")
    .withIndex("by_account", (q) => q.eq("accountId", account._id))
    .collect();

  const bodyBytes = bodies.reduce((sum, body) => sum + body.bodyBytes, 0);
  const attachmentBytes = attachments.reduce(
    (sum, attachment) => sum + attachment.size,
    0,
  );
  const usage = estimateCacheUsage(bodyBytes, attachmentBytes);
  await ctx.db.patch(account._id, {
    cacheBytes: usage.totalBytes,
    cacheBodyBytes: usage.bodyBytes,
    cacheAttachmentBytes: usage.attachmentBytes,
  });
  return usage;
}
