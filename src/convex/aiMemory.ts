import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  formatEquipmentChunk,
  formatIncidentChunk,
  formatMailChunk,
  formatPartChunk,
  rankMemoryChunks,
  reciprocalRankFusion,
  type AiMemoryModule,
} from "../lib/ai/memory";
import { readAccount, requireMailboxMember } from "./mailAccounts";
import { memberStatus, requireAdmin } from "./permissions";

const moduleValidator = v.union(
  v.literal("incidents"),
  v.literal("equipment"),
  v.literal("parts"),
  v.literal("requests"),
  v.literal("purchasing"),
  v.literal("manuals"),
  v.literal("movements"),
  v.literal("mailbox"),
);

export const upsertChunk = internalMutation({
  args: {
    scope: v.union(v.literal("shared"), v.literal("mailbox")),
    ownerUserId: v.optional(v.id("users")),
    module: moduleValidator,
    entityId: v.string(),
    reference: v.string(),
    title: v.string(),
    compactText: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("aiKnowledgeChunks")
      .withIndex("by_entity", (q) =>
        q.eq("module", args.module).eq("entityId", args.entityId),
      )
      .first();

    const record = {
      scope: args.scope,
      ownerUserId: args.ownerUserId,
      module: args.module,
      entityId: args.entityId,
      reference: args.reference,
      title: args.title,
      compactText: args.compactText,
      tags: args.tags,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, record);
      return existing._id;
    }
    return await ctx.db.insert("aiKnowledgeChunks", record);
  },
});

export const removeChunk = internalMutation({
  args: {
    module: moduleValidator,
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("aiKnowledgeChunks")
      .withIndex("by_entity", (q) =>
        q.eq("module", args.module).eq("entityId", args.entityId),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const rebuildWorkshopIndex = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx, "reindexar la memoria de la IA");
    const now = Date.now();

    const existing = await ctx.db.query("aiKnowledgeChunks").collect();
    for (const chunk of existing) {
      if (chunk.scope === "shared") {
        await ctx.db.delete(chunk._id);
      }
    }

    let count = 0;

    const incidents = await ctx.db.query("incidents").collect();
    for (const inc of incidents) {
      if (inc.deletedAt !== undefined || inc.archivedAt !== undefined) continue;
      const draft = formatIncidentChunk({
        id: inc._id,
        reference: inc.reference,
        status: inc.status,
        severity: inc.severity,
        equipmentKind: inc.equipmentKind,
        model: inc.model,
        serialNumber: inc.serialNumber,
        description: inc.description,
      });
      await ctx.db.insert("aiKnowledgeChunks", { ...draft, updatedAt: now });
      count += 1;
    }

    const equipment = await ctx.db.query("equipment").collect();
    for (const eq of equipment) {
      const draft = formatEquipmentChunk({
        id: eq._id,
        code: eq.code ?? eq._id,
        name: eq.name,
        brand: eq.brand,
        model: eq.model,
        serialNumber: eq.serialNumber,
        location: eq.location,
        decommissionDate: eq.decommissionDate,
      });
      await ctx.db.insert("aiKnowledgeChunks", { ...draft, updatedAt: now });
      count += 1;
    }

    const parts = await ctx.db.query("spareParts").collect();
    for (const part of parts) {
      const draft = formatPartChunk({
        id: part._id,
        code: part.code,
        name: part.name,
        category: part.category,
        stock: part.stock,
        minStock: part.minStock,
        unit: part.unit,
        location: part.location,
        supplier: part.supplier,
        partNumber: part.partNumber,
      });
      await ctx.db.insert("aiKnowledgeChunks", { ...draft, updatedAt: now });
      count += 1;
    }

    const manuals = await ctx.db.query("manuals").collect();
    for (const manual of manuals) {
      await ctx.db.insert("aiKnowledgeChunks", {
        scope: "shared",
        module: "manuals",
        entityId: manual._id,
        reference: manual._id,
        title: manual.title,
        compactText: `[Manual | ${manual.type}] ${manual.title}${manual.brand ? ` · ${manual.brand}` : ""}${manual.model ? ` ${manual.model}` : ""}`,
        tags: [manual.type, manual.brand ?? ""].filter(Boolean),
        updatedAt: now,
      });
      count += 1;
    }

    return { indexed: count };
  },
});

export const rebuildMyMailboxIndex = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireMailboxMember(ctx);
    const account = await readAccount(ctx, user._id);
    if (!account) return { indexed: 0 };

    const existing = await ctx.db
      .query("aiKnowledgeChunks")
      .withIndex("by_owner", (q) =>
        q.eq("ownerUserId", user._id).eq("module", "mailbox"),
      )
      .collect();
    for (const chunk of existing) {
      await ctx.db.delete(chunk._id);
    }

    const headers = await ctx.db
      .query("mailHeaders")
      .withIndex("by_account", (q) => q.eq("accountId", account._id))
      .take(400);

    const now = Date.now();
    let indexed = 0;
    for (const h of headers) {
      if (h.deletedRemoteAt !== undefined) continue;
      const draft = formatMailChunk({
        messageId: h.messageId,
        subject: h.subject,
        fromName: h.fromName,
        fromAddress: h.fromAddress,
        snippet: h.snippet,
        tags: h.tags,
      });
      await ctx.db.insert("aiKnowledgeChunks", {
        ...draft,
        ownerUserId: user._id,
        updatedAt: now,
      });
      indexed += 1;
    }

    return { indexed };
  },
});

export const searchMemory = internalQuery({
  args: {
    userId: v.id("users"),
    query: v.string(),
    allowedModules: v.array(v.string()),
    includeMailbox: v.boolean(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const allowed = new Set(args.allowedModules as AiMemoryModule[]);
    const limit = Math.min(12, Math.max(1, args.limit ?? 8));

    const ftsWorkshop = await ctx.db
      .query("aiKnowledgeChunks")
      .withSearchIndex("search_text", (q) =>
        q.search("compactText", args.query).eq("scope", "shared"),
      )
      .take(25);

    const ftsFiltered = ftsWorkshop.filter((c) => allowed.has(c.module));

    const ftsMailbox = args.includeMailbox
      ? await ctx.db
          .query("aiKnowledgeChunks")
          .withSearchIndex("search_text", (q) =>
            q
              .search("compactText", args.query)
              .eq("scope", "mailbox")
              .eq("ownerUserId", args.userId),
          )
          .take(10)
      : [];

    // BM25 + sinónimos sobre un muestreo reciente para capturar sinónimos que FTS literal no vea
    const recentWorkshop = (
      await ctx.db.query("aiKnowledgeChunks").order("desc").take(250)
    ).filter(
      (c) =>
        (c.scope === "shared" && allowed.has(c.module)) ||
        (args.includeMailbox &&
          c.scope === "mailbox" &&
          c.ownerUserId === args.userId),
    );

    const bm25Hits = rankMemoryChunks(recentWorkshop, args.query, limit);
    const ftsHits = [...ftsFiltered, ...ftsMailbox];

    const fused = reciprocalRankFusion([bm25Hits, ftsHits], limit);

    const facts = (
      await ctx.db
        .query("aiMemoryFacts")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect()
    ).filter(
      (f) => f.module === "general" || allowed.has(f.module as AiMemoryModule),
    );

    const rankedFacts = rankMemoryChunks(
      facts.map((f) => ({
        entityId: f._id,
        compactText: `[${f.title}] ${f.fact}`,
        tags: [f.module, f.sourceRef ?? ""].filter(Boolean),
        updatedAt: f.createdAt,
      })),
      args.query,
      4,
    );

    return {
      chunks: fused.map((c) => ({
        module: c.module,
        reference: c.reference,
        title: c.title,
        compactText: c.compactText,
      })),
      facts: rankedFacts.map((f) => f.compactText),
    };
  },
});

export const memoryStats = query({
  args: {},
  handler: async (ctx) => {
    const status = await memberStatus(ctx);
    if (!status.user || status.user.role !== "admin") {
      return null;
    }
    const chunks = await ctx.db.query("aiKnowledgeChunks").collect();
    const facts = await ctx.db.query("aiMemoryFacts").collect();
    return {
      totalChunks: chunks.length,
      workshopChunks: chunks.filter((c) => c.scope === "shared").length,
      mailboxChunks: chunks.filter((c) => c.scope === "mailbox").length,
      factsCount: facts.filter((f) => f.active).length,
    };
  },
});

export const listFacts = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx, "consultar hechos de memoria de la IA");
    const facts = await ctx.db.query("aiMemoryFacts").collect();
    return facts.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const saveFact = mutation({
  args: {
    id: v.optional(v.id("aiMemoryFacts")),
    title: v.string(),
    fact: v.string(),
    module: v.string(),
    sourceRef: v.optional(v.string()),
    active: v.boolean(),
  },
  handler: async (ctx, args): Promise<Id<"aiMemoryFacts">> => {
    const admin = await requireAdmin(ctx, "guardar hechos de memoria de la IA");
    const title = args.title.trim();
    const fact = args.fact.trim();
    if (!title || !fact) {
      throw new ConvexError("El título y el contenido del hecho son obligatorios.");
    }
    if (args.id) {
      await ctx.db.patch(args.id, {
        title,
        fact,
        module: args.module,
        sourceRef: args.sourceRef?.trim() || undefined,
        active: args.active,
      });
      return args.id;
    }
    return await ctx.db.insert("aiMemoryFacts", {
      title,
      fact,
      module: args.module,
      sourceRef: args.sourceRef?.trim() || undefined,
      active: args.active,
      createdBy: admin._id,
      createdAt: Date.now(),
    });
  },
});

export const deleteFact = mutation({
  args: { id: v.id("aiMemoryFacts") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, "eliminar hechos de memoria de la IA");
    await ctx.db.delete(args.id);
  },
});
