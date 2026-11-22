import { v } from "convex/values";
import { query } from "./_generated/server";
import { readAccount, requireMailboxMember } from "./mailAccounts";

/** Texto comparable para la búsqueda local: sin acentos y en minúsculas. */
function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Listado de una carpeta, ordenado de más reciente a más antiguo. La búsqueda
 * es local y solo mira asunto/remitente: no pide nada al servidor ni toca los
 * cuerpos. Las tumbas de borrado remoto no salen.
 */
export const list = query({
  args: {
    folderRemoteId: v.string(),
    search: v.optional(v.string()),
    tag: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireMailboxMember(ctx);
    const account = await readAccount(ctx, user._id);
    if (!account) {
      return { headers: [], total: 0, unread: 0 };
    }

    const rows = await ctx.db
      .query("mailHeaders")
      .withIndex("by_user_folder_date", (q) =>
        q.eq("userId", user._id).eq("folderRemoteId", args.folderRemoteId),
      )
      .collect();
    const visible = rows.filter((row) => row.deletedRemoteAt === undefined);
    const byTag = args.tag
      ? visible.filter((row) => row.tags?.includes(args.tag as string))
      : visible;

    const term = normalized(args.search?.trim() ?? "");
    const matched =
      term === ""
        ? byTag
        : byTag.filter(
            (row) =>
              normalized(row.subject).includes(term) ||
              normalized(row.fromName).includes(term) ||
              normalized(row.fromAddress).includes(term),
          );

    matched.sort(
      (a, b) => b.date - a.date || a.messageId.localeCompare(b.messageId),
    );

    const limit =
      typeof args.limit === "number" && Number.isFinite(args.limit)
        ? Math.min(200, Math.max(1, Math.trunc(args.limit)))
        : 50;
    const offset =
      typeof args.offset === "number" && Number.isFinite(args.offset)
        ? Math.max(0, Math.trunc(args.offset))
        : 0;

    return {
      headers: matched.slice(offset, offset + limit).map((row) => ({
        messageId: row.messageId,
        folderRemoteId: row.folderRemoteId,
        conversationId: row.conversationId ?? null,
        subject: row.subject,
        fromName: row.fromName,
        fromAddress: row.fromAddress,
        date: row.date,
        size: row.size,
        flags: row.flags,
        hasAttachments: row.hasAttachments,
        snippet: row.snippet,
        bodyState: row.bodyState,
        cachedAt: row.cachedAt ?? null,
        lastOpenedAt: row.lastOpenedAt ?? null,
        tags: row.tags ?? [],
        tagSource: row.tagSource ?? null,
        tagConfidence: row.tagConfidence ?? null,
        tagReason: row.tagReason ?? null,
        taggedAt: row.taggedAt ?? null,
      })),
      total: matched.length,
      unread: matched.filter((row) => row.flags.includes("u")).length,
    };
  },
});
