import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { createOrReuseJob } from "./backgroundJobs";
import {
  evaluateMailTagRules,
  ruleMatchesHeader,
  sanitizeMailTags,
  type MailTagRule,
} from "../lib/mailClient/tagging";
import { formatMailChunk } from "../lib/ai/memory";
import { safeSlice } from "../lib/text";
import { readAccount, requireMailboxMember } from "./mailAccounts";

const conditionValidator = v.object({
  field: v.union(
    v.literal("from_any"),
    v.literal("from_address"),
    v.literal("subject"),
    v.literal("subject_or_snippet"),
    v.literal("has_attachments"),
  ),
  operator: v.union(
    v.literal("contains"),
    v.literal("domain_is"),
    v.literal("is_true"),
    v.literal("is_false"),
  ),
  value: v.string(),
});

const matchModeValidator = v.union(v.literal("all"), v.literal("any"));

export const listRules = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireMailboxMember(ctx);
    const rules = await ctx.db
      .query("mailTagRules")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return rules.sort((a, b) => a.priority - b.priority);
  },
});

export const saveRule = mutation({
  args: {
    id: v.optional(v.id("mailTagRules")),
    name: v.string(),
    enabled: v.boolean(),
    matchMode: matchModeValidator,
    conditions: v.array(conditionValidator),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireMailboxMember(ctx);
    const name = args.name.trim();
    if (!name) {
      throw new ConvexError("Escribe un nombre para la regla.");
    }
    if (args.conditions.length === 0) {
      throw new ConvexError("Añade al menos una condición para la regla.");
    }
    const tags = sanitizeMailTags(args.tags);
    if (tags.length === 0) {
      throw new ConvexError("Selecciona al menos una etiqueta.");
    }

    const now = Date.now();
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing || existing.userId !== user._id) {
        throw new ConvexError("La regla no existe o no te pertenece.");
      }
      await ctx.db.patch(existing._id, {
        name,
        enabled: args.enabled,
        matchMode: args.matchMode,
        conditions: args.conditions,
        tags,
        updatedAt: now,
      });
      return existing._id;
    }

    const existingRules = await ctx.db
      .query("mailTagRules")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const maxPriority = existingRules.reduce(
      (max, r) => Math.max(max, r.priority),
      -1,
    );

    return await ctx.db.insert("mailTagRules", {
      userId: user._id,
      name,
      enabled: args.enabled,
      priority: maxPriority + 1,
      matchMode: args.matchMode,
      conditions: args.conditions,
      tags,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const toggleRule = mutation({
  args: {
    id: v.id("mailTagRules"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireMailboxMember(ctx);
    const rule = await ctx.db.get(args.id);
    if (!rule || rule.userId !== user._id) {
      throw new ConvexError("La regla no existe o no te pertenece.");
    }
    await ctx.db.patch(rule._id, {
      enabled: args.enabled,
      updatedAt: Date.now(),
    });
  },
});

export const deleteRule = mutation({
  args: { id: v.id("mailTagRules") },
  handler: async (ctx, args) => {
    const user = await requireMailboxMember(ctx);
    const rule = await ctx.db.get(args.id);
    if (!rule || rule.userId !== user._id) {
      throw new ConvexError("La regla no existe o no te pertenece.");
    }
    await ctx.db.delete(rule._id);
  },
});

export const reorderRules = mutation({
  args: { orderedIds: v.array(v.id("mailTagRules")) },
  handler: async (ctx, args) => {
    const user = await requireMailboxMember(ctx);
    const allRules = await ctx.db
      .query("mailTagRules")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const byId = new Map(allRules.map((r) => [r._id, r]));
    const seen = new Set<string>();
    const ordered: typeof allRules = [];

    for (const id of args.orderedIds) {
      if (seen.has(id)) continue;
      const match = byId.get(id);
      if (match) {
        seen.add(id);
        ordered.push(match);
      }
    }
    const remaining = allRules
      .filter((r) => !seen.has(r._id))
      .sort((a, b) => a.priority - b.priority);
    ordered.push(...remaining);

    const now = Date.now();
    for (let i = 0; i < ordered.length; i += 1) {
      const rule = ordered[i];
      if (rule.priority !== i) {
        await ctx.db.patch(rule._id, { priority: i, updatedAt: now });
      }
    }
  },
});

export const previewRuleMatches = query({
  args: {
    matchMode: matchModeValidator,
    conditions: v.array(conditionValidator),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireMailboxMember(ctx);
    const account = await readAccount(ctx, user._id);
    if (!account) {
      return { totalScanned: 0, matchCount: 0, samples: [] };
    }

    const headers = await ctx.db
      .query("mailHeaders")
      .withIndex("by_account", (q) => q.eq("accountId", account._id))
      .take(150);

    const visible = headers.filter((h) => h.deletedRemoteAt === undefined);
    const draftRule: MailTagRule = {
      name: "Vista previa",
      enabled: true,
      priority: 0,
      matchMode: args.matchMode,
      conditions: args.conditions,
      tags: sanitizeMailTags(args.tags),
    };
    if (draftRule.tags.length === 0) {
      draftRule.tags = ["informative"];
    }

    const matches = visible.filter((h) =>
      ruleMatchesHeader(
        {
          messageId: h.messageId,
          subject: h.subject,
          fromName: h.fromName,
          fromAddress: h.fromAddress,
          snippet: h.snippet,
          hasAttachments: h.hasAttachments,
        },
        draftRule,
      ),
    );

    return {
      totalScanned: visible.length,
      matchCount: matches.length,
      samples: matches.slice(0, 5).map((m) => ({
        messageId: m.messageId,
        subject: m.subject,
        from: m.fromName || m.fromAddress,
      })),
    };
  },
});

export const setMessageTags = mutation({
  args: {
    messageId: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireMailboxMember(ctx);
    const account = await readAccount(ctx, user._id);
    if (!account) {
      throw new ConvexError("Todavía no has configurado tu buzón.");
    }
    const header = await ctx.db
      .query("mailHeaders")
      .withIndex("by_user_message", (q) =>
        q
          .eq("userId", user._id)
          .eq("accountId", account._id)
          .eq("messageId", args.messageId),
      )
      .first();
    if (!header) {
      throw new ConvexError("El mensaje seleccionado no existe.");
    }
    const tags = sanitizeMailTags(args.tags);
    await ctx.db.patch(header._id, {
      tags,
      tagSource: "manual",
      tagConfidence: 1,
      tagReason: tags.length > 0 ? "Etiquetado manual" : "Etiquetas limpiadas",
      taggedAt: Date.now(),
    });

    const chunkDraft = formatMailChunk({
      messageId: header.messageId,
      subject: header.subject,
      fromName: header.fromName,
      fromAddress: header.fromAddress,
      snippet: header.snippet,
      tags,
    });
    const existingChunk = await ctx.db
      .query("aiKnowledgeChunks")
      .withIndex("by_entity", (q) =>
        q.eq("module", "mailbox").eq("entityId", header.messageId),
      )
      .first();
    if (existingChunk) {
      await ctx.db.patch(existingChunk._id, {
        ...chunkDraft,
        ownerUserId: user._id,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("aiKnowledgeChunks", {
        ...chunkDraft,
        ownerUserId: user._id,
        updatedAt: Date.now(),
      });
    }
  },
});

export const triageContext = internalQuery({
  args: {
    userId: v.optional(v.id("users")),
    folderRemoteId: v.optional(v.string()),
    messageIds: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = args.userId
      ? await ctx.db.get(args.userId)
      : await requireMailboxMember(ctx);
    if (!user || user.active === false) return null;
    const account = await readAccount(ctx, user._id);
    if (!account) return null;

    const rules = (
      await ctx.db
        .query("mailTagRules")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect()
    ).sort((a, b) => a.priority - b.priority);

    const rawHeaders = args.folderRemoteId
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

    const targetSet = args.messageIds ? new Set(args.messageIds) : null;
    const candidates = rawHeaders
      .filter((h) => {
        if (h.deletedRemoteAt !== undefined) return false;
        if (targetSet) return targetSet.has(h.messageId);
        return h.tagSource !== "manual" && h.taggedAt === undefined;
      })
      .sort((a, b) => b.date - a.date)
      .slice(0, Math.min(500, Math.max(1, args.limit ?? 500)));

    const cachedBodies: Record<string, string> = {};
    for (const header of candidates) {
      if (header.bodyState === "cached") {
        const body = await ctx.db
          .query("mailBodies")
          .withIndex("by_user_message", (q) =>
            q
              .eq("userId", user._id)
              .eq("accountId", account._id)
              .eq("messageId", header.messageId),
          )
          .first();
        if (body?.text) {
          cachedBodies[header.messageId] = safeSlice(body.text, 1500);
        }
      }
    }

    return {
      accountId: account._id,
      rules,
      candidates: candidates.map((h) => ({
        messageId: h.messageId,
        folderRemoteId: h.folderRemoteId,
        subject: h.subject,
        fromName: h.fromName,
        fromAddress: h.fromAddress,
        toSummary: h.toSummary ?? "",
        snippet: h.snippet,
        hasAttachments: h.hasAttachments,
        bodyState: h.bodyState,
      })),
      cachedBodies,
    };
  },
});

/** Inicia el autoetiquetado IA de una carpeta en segundo plano. */
export const startAutoTagFolder = mutation({
  args: { folderRemoteId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireMailboxMember(ctx);
    const { jobId, reused } = await createOrReuseJob(ctx, {
      userId: user._id,
      type: "mail_auto_tag",
      title: "Autoetiquetado IA de correo",
      detail: "Preparando mensajes pendientes…",
      dedupeKey: `mail_auto_tag:${user._id}:${args.folderRemoteId}`,
    });
    if (!reused) {
      await ctx.scheduler.runAfter(
        0,
        internal.mailTaggingActions.runAutoTagBatch,
        {
          jobId,
          userId: user._id,
          folderRemoteId: args.folderRemoteId,
          round: 0,
          totalProcessed: 0,
          totalRule: 0,
          totalAiHeaders: 0,
          totalAiBody: 0,
        },
      );
    }
    return { jobId, reused };
  },
});

/** Cuentas de correo activas para la pasada automática de autoetiquetado. */
export const activeAccountsForAutoTag = internalQuery({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("mailAccounts").collect();
    const eligible: Array<{ userId: typeof accounts[number]["userId"] }> = [];
    for (const acc of accounts) {
      if (!acc.enabled) continue;
      const user = await ctx.db.get(acc.userId);
      if (user && user.active !== false) {
        eligible.push({ userId: acc.userId });
      }
    }
    return eligible;
  },
});

export const applyTriageResults = internalMutation({
  args: {
    accountId: v.id("mailAccounts"),
    allowOverrideManual: v.optional(v.boolean()),
    items: v.array(
      v.object({
        messageId: v.string(),
        tags: v.array(v.string()),
        tagSource: v.union(
          v.literal("rule"),
          v.literal("ai_headers"),
          v.literal("ai_body"),
        ),
        tagConfidence: v.number(),
        tagReason: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return 0;

    const now = Date.now();
    let updated = 0;
    for (const item of args.items) {
      const header = await ctx.db
        .query("mailHeaders")
        .withIndex("by_user_message", (q) =>
          q
            .eq("userId", account.userId)
            .eq("accountId", account._id)
            .eq("messageId", item.messageId),
        )
        .first();
      if (!header || (header.tagSource === "manual" && !args.allowOverrideManual))
        continue;
      await ctx.db.patch(header._id, {
        tags: sanitizeMailTags(item.tags),
        tagSource: item.tagSource,
        tagConfidence: item.tagConfidence,
        tagReason: safeSlice(item.tagReason, 180),
        taggedAt: now,
      });
      updated += 1;
    }
    return updated;
  },
});

/**
 * Reaplica las reglas rápidas activas a todos los correos no manuales del buzón
 * (útil tras crear o modificar una regla en Ajustes). Consume 0 tokens.
 */
export const reapplyRulesToAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireMailboxMember(ctx);
    const account = await readAccount(ctx, user._id);
    if (!account) {
      return { scanned: 0, updated: 0 };
    }

    const rules: MailTagRule[] = (
      await ctx.db
        .query("mailTagRules")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect()
    )
      .sort((a, b) => a.priority - b.priority)
      .map((r) => ({
        id: r._id,
        name: r.name,
        enabled: r.enabled,
        priority: r.priority,
        matchMode: r.matchMode,
        conditions: r.conditions,
        tags: r.tags as MailTagRule["tags"],
      }));

    const headers = await ctx.db
      .query("mailHeaders")
      .withIndex("by_account", (q) => q.eq("accountId", account._id))
      .collect();

    const now = Date.now();
    let scanned = 0;
    let updated = 0;
    for (const h of headers) {
      if (h.deletedRemoteAt !== undefined || h.tagSource === "manual") continue;
      scanned += 1;
      const match = evaluateMailTagRules(
        {
          messageId: h.messageId,
          subject: h.subject,
          fromName: h.fromName,
          fromAddress: h.fromAddress,
          snippet: h.snippet,
          hasAttachments: h.hasAttachments,
        },
        rules,
      );
      if (match) {
        await ctx.db.patch(h._id, {
          tags: match.tags,
          tagSource: "rule",
          tagConfidence: 1,
          tagReason: match.reason,
          taggedAt: now,
        });
        updated += 1;
      }
    }
    return { scanned, updated };
  },
});
