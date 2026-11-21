import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { logSecurityEvent } from "./audit";
import { readAccount, requireMailboxMember } from "./mailAccounts";
import { hasCapability } from "./permissions";
import {
  clearHeaderCache,
  deleteAccountContent,
  deleteMessageContent,
  recountAccount,
} from "./_mail/cache";
import {
  selectExpiredMessages,
  type CachedMessage,
} from "../lib/mailClient/cache";

/** Consumo y ajustes de la caché propia, sin contenido ni credenciales. */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireMailboxMember(ctx);
    const account = await readAccount(ctx, user._id);
    if (!account) return null;
    const headers = await ctx.db
      .query("mailHeaders")
      .withIndex("by_account", (q) => q.eq("accountId", account._id))
      .collect();
    return {
      cacheBytes: account.cacheBytes,
      cacheBodyBytes: account.cacheBodyBytes,
      cacheAttachmentBytes: account.cacheAttachmentBytes,
      cacheLimitBytes: account.cacheLimitBytes,
      cacheRetentionDays: account.cacheRetentionDays,
      cachedMessages: headers.filter((header) => header.bodyState === "cached")
        .length,
      indexedHeaders: headers.length,
    };
  },
});

/** «Vaciar caché»: solo el contenido descargado de la cuenta propia. */
export const empty = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireMailboxMember(ctx);
    const account = await readAccount(ctx, user._id);
    if (!account) return { bytes: 0, messages: 0 };
    const headers = await ctx.db
      .query("mailHeaders")
      .withIndex("by_account", (q) => q.eq("accountId", account._id))
      .collect();
    const messages = headers.filter(
      (header) => header.bodyState === "cached",
    ).length;
    const bytes = account.cacheBytes;
    await deleteAccountContent(ctx, account._id);
    await ctx.db.patch(account._id, {
      cacheBytes: 0,
      cacheBodyBytes: 0,
      cacheAttachmentBytes: 0,
      updatedAt: Date.now(),
    });
    await logSecurityEvent(ctx, {
      actorId: user._id,
      action: "mail_cache_clear",
      target: `user:${user._id}`,
      metadata: { messages, bytes },
    });
    return { bytes, messages };
  },
});

/**
 * Barrido diario: caducidad por `lastOpenedAt`, restos sin cabecera cacheada y
 * reconciliación de contadores. No toca cabeceras ni copias compartidas.
 */
export const sweepExpired = internalMutation({
  args: { now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const accounts = await ctx.db.query("mailAccounts").collect();
    let removed = 0;

    for (const account of accounts) {
      const owner = await ctx.db.get(account.userId);
      const canRead =
        owner !== null && (await hasCapability(ctx, owner, "viewMailbox"));
      if (!canRead) {
        // Una cuenta sin capacidad ya no puede abrir su buzón; el contenido
        // descargado se purga aunque su retención no haya vencido.
        const cached = await ctx.db
          .query("mailHeaders")
          .withIndex("by_account", (q) => q.eq("accountId", account._id))
          .collect();
        removed += cached.filter(
          (header) => header.bodyState === "cached",
        ).length;
        await deleteAccountContent(ctx, account._id);
        await recountAccount(ctx, account);
        continue;
      }

      const headers = await ctx.db
        .query("mailHeaders")
        .withIndex("by_account", (q) => q.eq("accountId", account._id))
        .collect();
      const cached = headers.filter((header) => header.bodyState === "cached");
      const messages: CachedMessage[] = cached.map((header) => ({
        messageId: header.messageId,
        cachedBytes: header.cachedBytes ?? 0,
        lastOpenedAt: header.lastOpenedAt ?? 0,
        cachedAt: header.cachedAt ?? 0,
      }));
      const expired = new Set(
        selectExpiredMessages({
          messages,
          now,
          retentionDays: account.cacheRetentionDays,
        }),
      );
      for (const header of cached) {
        if (!expired.has(header.messageId)) continue;
        await deleteMessageContent(ctx, header);
        await clearHeaderCache(ctx, header);
        removed += 1;
      }

      // Un adjunto cuya cabecera ya no está cacheada es un resto de una
      // apertura interrumpida; no puede quedar medio mensaje.
      const cachedIds = new Set(cached.map((header) => header.messageId));
      const attachments = await ctx.db
        .query("mailAttachments")
        .withIndex("by_account", (q) => q.eq("accountId", account._id))
        .collect();
      for (const attachment of attachments) {
        if (cachedIds.has(attachment.messageId)) continue;
        await ctx.storage.delete(attachment.storageId);
        await ctx.db.delete(attachment._id);
      }

      await recountAccount(ctx, account);
    }
    return { messages: removed };
  },
});
