import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
import {
  canUseFastDateWindow,
  groupMailHeadersByConversation,
  sortMailHeaders,
} from "../lib/mailClient/listView";
import { readAccount, requireMailboxMember } from "./mailAccounts";

/** Proyección pública de una cabecera de correo para la vista de lista. */
function toMailHeaderView(row: Doc<"mailHeaders">, threadCount: number) {
  return {
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
    threadCount,
  };
}

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
    sortBy: v.optional(
      v.union(
        v.literal("date"),
        v.literal("sender"),
        v.literal("subject"),
        v.literal("attachments"),
      ),
    ),
    sortDir: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    groupByConversation: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireMailboxMember(ctx);
    const account = await readAccount(ctx, user._id);
    if (!account) {
      return { headers: [], total: 0, unread: 0 };
    }

    const limit =
      typeof args.limit === "number" && Number.isFinite(args.limit)
        ? Math.min(200, Math.max(1, Math.trunc(args.limit)))
        : 50;
    const offset =
      typeof args.offset === "number" && Number.isFinite(args.offset)
        ? Math.max(0, Math.trunc(args.offset))
        : 0;
    const sortBy = args.sortBy ?? "date";
    const sortDir = args.sortDir ?? "desc";

    if (
      canUseFastDateWindow({
        search: args.search,
        tag: args.tag,
        groupByConversation: args.groupByConversation,
        sortBy,
      })
    ) {
      const orderedRows = await ctx.db
        .query("mailHeaders")
        .withIndex("by_user_folder_date", (q) =>
          q.eq("userId", user._id).eq("folderRemoteId", args.folderRemoteId),
        )
        .order(sortDir === "asc" ? "asc" : "desc")
        .collect();

      let total = 0;
      let unread = 0;
      const pageSlice: Doc<"mailHeaders">[] = [];
      const windowEnd = offset + limit;

      for (const row of orderedRows) {
        if (row.deletedRemoteAt !== undefined) continue;
        if (total >= offset && total < windowEnd) {
          pageSlice.push(row);
        }
        total += 1;
        if (row.flags.includes("u")) unread += 1;
      }

      return {
        headers: pageSlice.map((row) => toMailHeaderView(row, 1)),
        total,
        unread,
      };
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

    const baseItems = args.groupByConversation
      ? groupMailHeadersByConversation(matched)
      : matched.map((row) => ({ ...row, threadCount: 1 }));

    const sorted = sortMailHeaders(baseItems, sortBy, sortDir);

    return {
      headers: sorted
        .slice(offset, offset + limit)
        .map((row) => toMailHeaderView(row, row.threadCount)),
      total: sorted.length,
      unread: sorted.filter((row) => row.flags.includes("u")).length,
    };
  },
});

export const listThread = query({
  args: {
    conversationId: v.string(),
    folderRemoteId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireMailboxMember(ctx);
    const account = await readAccount(ctx, user._id);
    if (!account) return [];

    const rows = args.folderRemoteId
      ? await ctx.db
          .query("mailHeaders")
          .withIndex("by_user_folder_date", (q) =>
            q
              .eq("userId", user._id)
              .eq("folderRemoteId", args.folderRemoteId!),
          )
          .collect()
      : await ctx.db
          .query("mailHeaders")
          .withIndex("by_account", (q) => q.eq("accountId", account._id))
          .collect();

    return rows
      .filter(
        (r) =>
          r.deletedRemoteAt === undefined &&
          r.conversationId === args.conversationId,
      )
      .sort((a, b) => b.date - a.date)
      .map((row) => ({
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
        threadCount: 1,
      }));
  },
});
