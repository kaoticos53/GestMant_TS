import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { createOrReuseJob } from "./backgroundJobs";
import { JOB_STATUS, isCancelledJobStatus } from "../lib/backgroundJobs";
import {
  formatEquipmentChunk,
  formatEquipmentMovementChunk,
  formatIncidentChunk,
  formatMailChunk,
  formatPartChunk,
  formatPurchaseOrderChunk,
  formatRequestChunk,
  formatStockMovementChunk,
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

async function executeWorkshopRebuild(ctx: MutationCtx): Promise<number> {
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

    const requests = await ctx.db.query("partRequests").collect();
    for (const req of requests) {
      if (req.deletedAt !== undefined || req.archivedAt !== undefined) continue;
      const draft = formatRequestChunk({
        id: req._id,
        reference: req.reference,
        status: req.status,
        priority: req.priority,
        requesterName: req.requesterName,
        equipment: req.equipment,
        linesSummary: req.lines.map((l) => `${l.quantity}x ${l.name}`).join(", "),
      });
      await ctx.db.insert("aiKnowledgeChunks", { ...draft, updatedAt: now });
      count += 1;
    }

    const orders = await ctx.db.query("purchaseOrders").collect();
    for (const po of orders) {
      const draft = formatPurchaseOrderChunk({
        id: po._id,
        reference: po.reference,
        status: po.status,
        supplier: po.supplier,
        linesSummary: po.lines.map((l) => `${l.quantity}x ${l.name}`).join(", "),
      });
      await ctx.db.insert("aiKnowledgeChunks", { ...draft, updatedAt: now });
      count += 1;
    }

    const stockMovs = await ctx.db
      .query("stockMovements")
      .withIndex("by_createdAt")
      .order("desc")
      .take(200);
    for (const mov of stockMovs) {
      const draft = formatStockMovementChunk({
        id: mov._id,
        partCode: mov.partCode,
        partName: mov.partName,
        kind: mov.kind,
        delta: mov.delta,
        actorName: mov.actorName,
        reason: mov.reason,
      });
      await ctx.db.insert("aiKnowledgeChunks", { ...draft, updatedAt: now });
      count += 1;
    }

    const eqMovs = await ctx.db
      .query("equipmentMovements")
      .withIndex("by_createdAt")
      .order("desc")
      .take(200);
    for (const mov of eqMovs) {
      const draft = formatEquipmentMovementChunk({
        id: mov._id,
        equipmentCode: mov.equipmentCode,
        equipmentName: mov.equipmentName,
        kind: mov.kind,
        fromLocation: mov.fromLocation,
        toLocation: mov.toLocation,
        actorName: mov.actorName,
        note: mov.note,
      });
      await ctx.db.insert("aiKnowledgeChunks", { ...draft, updatedAt: now });
      count += 1;
    }

  return count;
}

export const rebuildWorkshopIndex = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx, "reindexar la memoria de la IA");
    const indexed = await executeWorkshopRebuild(ctx);
    return { indexed };
  },
});

/** Inicia la reindexación completa de la memoria IA del taller en segundo plano. */
export const startRebuildWorkshopIndex = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAdmin(ctx, "reindexar la memoria de la IA");
    const { jobId, reused } = await createOrReuseJob(ctx, {
      userId: user._id,
      type: "ai_memory_workshop",
      title: "Indexación de memoria IA",
      detail: "Indexando módulos del taller…",
      dedupeKey: "ai_memory_workshop",
    });
    if (!reused) {
      await ctx.scheduler.runAfter(0, internal.aiMemory.runRebuildWorkshopJob, {
        jobId,
      });
    }
    return { jobId, reused };
  },
});

export const runRebuildWorkshopJob = internalMutation({
  args: { jobId: v.id("backgroundJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || isCancelledJobStatus(job.status)) return;
    try {
      const now = Date.now();
      await ctx.db.patch(args.jobId, {
        status: JOB_STATUS.RUNNING,
        updatedAt: now,
      });
      const indexed = await executeWorkshopRebuild(ctx);
      const doneAt = Date.now();
      await ctx.db.patch(args.jobId, {
        status: JOB_STATUS.COMPLETED,
        processed: indexed,
        total: indexed,
        detail: `${indexed} fragmentos compactos indexados.`,
        updatedAt: doneAt,
        finishedAt: doneAt,
      });
    } catch (error) {
      const doneAt = Date.now();
      await ctx.db.patch(args.jobId, {
        status: JOB_STATUS.FAILED,
        error:
          error instanceof Error
            ? error.message
            : "Error al reindexar la memoria del taller.",
        updatedAt: doneAt,
        finishedAt: doneAt,
      });
    }
  },
});

async function executeMailboxRebuild(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<number> {
  const account = await readAccount(ctx, userId);
  if (!account) return 0;

  const existing = await ctx.db
    .query("aiKnowledgeChunks")
    .withIndex("by_owner", (q) =>
      q.eq("ownerUserId", userId).eq("module", "mailbox"),
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
      ownerUserId: userId,
      updatedAt: now,
    });
    indexed += 1;
  }

  return indexed;
}

export const rebuildMyMailboxIndex = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireMailboxMember(ctx);
    const indexed = await executeMailboxRebuild(ctx, user._id);
    return { indexed };
  },
});

/** Inicia la indexación privada de correos en memoria IA en segundo plano. */
export const startRebuildMyMailboxIndex = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireMailboxMember(ctx);
    const { jobId, reused } = await createOrReuseJob(ctx, {
      userId: user._id,
      type: "ai_memory_mailbox",
      title: "Indexación de correos en IA",
      detail: "Indexando cabeceras del buzón…",
      dedupeKey: `ai_memory_mailbox:${user._id}`,
    });
    if (!reused) {
      await ctx.scheduler.runAfter(0, internal.aiMemory.runRebuildMailboxJob, {
        jobId,
        userId: user._id,
      });
    }
    return { jobId, reused };
  },
});

export const runRebuildMailboxJob = internalMutation({
  args: { jobId: v.id("backgroundJobs"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || isCancelledJobStatus(job.status)) return;
    try {
      await ctx.db.patch(args.jobId, {
        status: JOB_STATUS.RUNNING,
        updatedAt: Date.now(),
      });
      const indexed = await executeMailboxRebuild(ctx, args.userId);
      const doneAt = Date.now();
      await ctx.db.patch(args.jobId, {
        status: JOB_STATUS.COMPLETED,
        processed: indexed,
        total: indexed,
        detail: `${indexed} correos indexados en tu memoria privada.`,
        updatedAt: doneAt,
        finishedAt: doneAt,
      });
    } catch (error) {
      const doneAt = Date.now();
      await ctx.db.patch(args.jobId, {
        status: JOB_STATUS.FAILED,
        error:
          error instanceof Error
            ? error.message
            : "Error al indexar los correos.",
        updatedAt: doneAt,
        finishedAt: doneAt,
      });
    }
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
