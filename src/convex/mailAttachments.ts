import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { action, internalQuery } from "./_generated/server";
import { requireMailboxMember } from "./mailAccounts";

interface AttachmentContext {
  storageId: Id<"_storage">;
  filename: string | null;
  contentType: string;
  size: number;
}

/** La fila del adjunto, ya comprobada contra el dueño de la sesión. */
export const attachmentContext = internalQuery({
  args: { attachmentId: v.id("mailAttachments") },
  handler: async (ctx, args): Promise<AttachmentContext> => {
    const user = await requireMailboxMember(ctx);
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment || attachment.userId !== user._id) {
      throw new ConvexError("Ese adjunto no pertenece a tu buzón.");
    }
    const header = await ctx.db
      .query("mailHeaders")
      .withIndex("by_user_message", (q) =>
        q
          .eq("userId", user._id)
          .eq("accountId", attachment.accountId)
          .eq("messageId", attachment.messageId),
      )
      .first();
    if (!header || header.bodyState !== "cached") {
      throw new ConvexError("El mensaje ya no está en la caché.");
    }
    return {
      storageId: attachment.storageId,
      filename: attachment.filename ?? null,
      contentType: attachment.contentType,
      size: attachment.size,
    };
  },
});

/** URL de descarga solo para el dueño del buzón; nunca para un tercero. */
export const download = action({
  args: { attachmentId: v.id("mailAttachments") },
  handler: async (
    ctx,
    args,
  ): Promise<{ url: string; filename: string | null; contentType: string }> => {
    const attachment = await ctx.runQuery(
      internal.mailAttachments.attachmentContext,
      { attachmentId: args.attachmentId },
    );
    const url = await ctx.storage.getUrl(attachment.storageId);
    if (url === null) {
      throw new ConvexError(
        "El archivo del adjunto ya no está disponible; vuelve a abrir el mensaje.",
      );
    }
    return {
      url,
      filename: attachment.filename,
      contentType: attachment.contentType,
    };
  },
});
