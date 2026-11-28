import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { fetchEmbeddingVector } from "./_ai/embeddings";
import { createOrReuseJob } from "./backgroundJobs";
import { JOB_STATUS, isCancelledJobStatus } from "../lib/backgroundJobs";
import { AI_EMBEDDING_DIMENSIONS } from "../lib/ai/limits";
import {
  formatEquipmentChunk,
  formatEquipmentMovementChunk,
  formatIncidentChunk,
  formatMailChunk,
  formatPartChunk,
  formatPurchaseOrderChunk,
  formatRequestChunk,
  formatStockMovementChunk,
  planMemoryChunkDiff,
  rankMemoryChunks,
  reciprocalRankFusion,
  type AiMemoryModule,
  type MemoryChunkDraft,
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

    if (
      existing &&
      existing.scope === args.scope &&
      existing.ownerUserId === args.ownerUserId &&
      existing.reference === args.reference &&
      existing.title === args.title &&
      existing.compactText === args.compactText &&
      existing.tags.length === args.tags.length &&
      existing.tags.every((tag, idx) => tag === args.tags[idx])
    ) {
      return existing._id;
    }

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
      await ctx.db.patch(existing._id, {
        ...record,
        ...(existing.compactText !== args.compactText
          ? { embedding: undefined }
          : {}),
      });
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

async function applyMemoryChunkDiff(
  ctx: MutationCtx,
  existing: readonly Doc<"aiKnowledgeChunks">[],
  desired: readonly MemoryChunkDraft[],
  ownerUserId?: Id<"users">,
): Promise<number> {
  const now = Date.now();
  const diff = planMemoryChunkDiff(existing, desired);

  for (const id of diff.toDelete) {
    await ctx.db.delete(id);
  }
  for (const { id, draft, clearEmbedding } of diff.toPatch) {
    await ctx.db.patch(id, {
      ...draft,
      ...(ownerUserId !== undefined ? { ownerUserId } : {}),
      updatedAt: now,
      ...(clearEmbedding ? { embedding: undefined } : {}),
    });
  }
  for (const draft of diff.toInsert) {
    await ctx.db.insert("aiKnowledgeChunks", {
      ...draft,
      ...(ownerUserId !== undefined ? { ownerUserId } : {}),
      updatedAt: now,
    });
  }

  return desired.length;
}

async function executeWorkshopRebuild(ctx: MutationCtx): Promise<number> {
  const [
    existingChunks,
    incidents,
    equipment,
    parts,
    manuals,
    requests,
    orders,
    stockMovs,
    eqMovs,
  ] = await Promise.all([
    ctx.db.query("aiKnowledgeChunks").collect(),
    ctx.db.query("incidents").collect(),
    ctx.db.query("equipment").collect(),
    ctx.db.query("spareParts").collect(),
    ctx.db.query("manuals").collect(),
    ctx.db.query("partRequests").collect(),
    ctx.db.query("purchaseOrders").collect(),
    ctx.db
      .query("stockMovements")
      .withIndex("by_createdAt")
      .order("desc")
      .take(200),
    ctx.db
      .query("equipmentMovements")
      .withIndex("by_createdAt")
      .order("desc")
      .take(200),
  ]);

  const desired: MemoryChunkDraft[] = [];

  for (const inc of incidents) {
    if (inc.deletedAt !== undefined || inc.archivedAt !== undefined) continue;
    desired.push(
      formatIncidentChunk({
        id: inc._id,
        reference: inc.reference,
        status: inc.status,
        severity: inc.severity,
        equipmentKind: inc.equipmentKind,
        model: inc.model,
        serialNumber: inc.serialNumber,
        description: inc.description,
      }),
    );
  }

  for (const eq of equipment) {
    desired.push(
      formatEquipmentChunk({
        id: eq._id,
        code: eq.code ?? eq._id,
        name: eq.name,
        brand: eq.brand,
        model: eq.model,
        serialNumber: eq.serialNumber,
        location: eq.location,
        decommissionDate: eq.decommissionDate,
      }),
    );
  }

  for (const part of parts) {
    desired.push(
      formatPartChunk({
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
      }),
    );
  }

  for (const manual of manuals) {
    desired.push({
      scope: "shared",
      module: "manuals",
      entityId: manual._id,
      reference: manual._id,
      title: manual.title,
      compactText: `[Manual | ${manual.type}] ${manual.title}${manual.brand ? ` · ${manual.brand}` : ""}${manual.model ? ` ${manual.model}` : ""}`,
      tags: [manual.type, manual.brand ?? ""].filter(Boolean),
    });
  }

  for (const req of requests) {
    if (req.deletedAt !== undefined || req.archivedAt !== undefined) continue;
    desired.push(
      formatRequestChunk({
        id: req._id,
        reference: req.reference,
        status: req.status,
        priority: req.priority,
        requesterName: req.requesterName,
        equipment: req.equipment,
        linesSummary: req.lines.map((l) => `${l.quantity}x ${l.name}`).join(", "),
      }),
    );
  }

  for (const po of orders) {
    desired.push(
      formatPurchaseOrderChunk({
        id: po._id,
        reference: po.reference,
        status: po.status,
        supplier: po.supplier,
        linesSummary: po.lines.map((l) => `${l.quantity}x ${l.name}`).join(", "),
      }),
    );
  }

  for (const mov of stockMovs) {
    desired.push(
      formatStockMovementChunk({
        id: mov._id,
        partCode: mov.partCode,
        partName: mov.partName,
        kind: mov.kind,
        delta: mov.delta,
        actorName: mov.actorName,
        reason: mov.reason,
      }),
    );
  }

  for (const mov of eqMovs) {
    desired.push(
      formatEquipmentMovementChunk({
        id: mov._id,
        equipmentCode: mov.equipmentCode,
        equipmentName: mov.equipmentName,
        kind: mov.kind,
        fromLocation: mov.fromLocation,
        toLocation: mov.toLocation,
        actorName: mov.actorName,
        note: mov.note,
      }),
    );
  }

  const existingShared = existingChunks.filter((c) => c.scope === "shared");
  return await applyMemoryChunkDiff(ctx, existingShared, desired);
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
      const aiCfg = await ctx.db
        .query("aiSettings")
        .withIndex("by_key", (q) => q.eq("key", "default"))
        .unique();
      if (aiCfg?.embeddingEnabled && aiCfg.embeddingBaseUrl?.trim()) {
        await ctx.scheduler.runAfter(0, internal.aiMemory.runVectorizePendingJob, {});
      }
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

  const [existing, headers] = await Promise.all([
    ctx.db
      .query("aiKnowledgeChunks")
      .withIndex("by_owner", (q) =>
        q.eq("ownerUserId", userId).eq("module", "mailbox"),
      )
      .collect(),
    ctx.db
      .query("mailHeaders")
      .withIndex("by_account", (q) => q.eq("accountId", account._id))
      .take(400),
  ]);

  const desired: MemoryChunkDraft[] = [];
  for (const h of headers) {
    if (h.deletedRemoteAt !== undefined) continue;
    desired.push(
      formatMailChunk({
        messageId: h.messageId,
        subject: h.subject,
        fromName: h.fromName,
        fromAddress: h.fromAddress,
        snippet: h.snippet,
        tags: h.tags,
      }),
    );
  }

  return await applyMemoryChunkDiff(ctx, existing, desired, userId);
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
      const aiCfg = await ctx.db
        .query("aiSettings")
        .withIndex("by_key", (q) => q.eq("key", "default"))
        .unique();
      if (aiCfg?.embeddingEnabled && aiCfg.embeddingBaseUrl?.trim()) {
        await ctx.scheduler.runAfter(0, internal.aiMemory.runVectorizePendingJob, {});
      }
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
      embeddedChunks: chunks.filter(
        (c) =>
          Array.isArray(c.embedding) &&
          c.embedding.length === AI_EMBEDDING_DIMENSIONS,
      ).length,
      factsCount: facts.filter((f) => f.active).length,
    };
  },
});

const VECTORIZE_BATCH_SIZE = 25;

type PendingEmbeddingBatch = {
  totalChunks: number;
  totalPending: number;
  batch: Array<{ id: Id<"aiKnowledgeChunks">; text: string }>;
};

export const listPendingEmbeddingChunks = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<PendingEmbeddingBatch> => {
    const limit = Math.min(50, Math.max(1, args.limit ?? VECTORIZE_BATCH_SIZE));
    const all = await ctx.db.query("aiKnowledgeChunks").collect();
    const pending = all.filter(
      (c) =>
        !Array.isArray(c.embedding) ||
        c.embedding.length !== AI_EMBEDDING_DIMENSIONS,
    );
    return {
      totalChunks: all.length,
      totalPending: pending.length,
      batch: pending.slice(0, limit).map((c) => ({
        id: c._id,
        text: `${c.title}\n${c.compactText}`.slice(0, 2000),
      })),
    };
  },
});

export const getChunksByIds = internalQuery({
  args: { ids: v.array(v.id("aiKnowledgeChunks")) },
  handler: async (ctx, args) => {
    const docs = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
    return docs.filter((d): d is Doc<"aiKnowledgeChunks"> => d !== null);
  },
});

export const patchChunkEmbeddings = internalMutation({
  args: {
    updates: v.array(
      v.object({
        id: v.id("aiKnowledgeChunks"),
        embedding: v.array(v.float64()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const item of args.updates) {
      await ctx.db.patch(item.id, { embedding: item.embedding });
    }
  },
});

export const updateVectorJobStatus = internalMutation({
  args: {
    jobId: v.id("backgroundJobs"),
    status: v.string(),
    processed: v.optional(v.number()),
    total: v.optional(v.number()),
    detail: v.optional(v.string()),
    error: v.optional(v.string()),
    finished: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || isCancelledJobStatus(job.status)) return false;
    const now = Date.now();
    await ctx.db.patch(args.jobId, {
      status: args.status,
      ...(args.processed !== undefined ? { processed: args.processed } : {}),
      ...(args.total !== undefined ? { total: args.total } : {}),
      ...(args.detail !== undefined ? { detail: args.detail } : {}),
      ...(args.error !== undefined ? { error: args.error } : {}),
      updatedAt: now,
      ...(args.finished ? { finishedAt: now } : {}),
    });
    return true;
  },
});

/** Inicia la vectorización en segundo plano de los fragmentos pendientes. */
export const startVectorizePending = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAdmin(ctx, "vectorizar la memoria de la IA");
    const { jobId, reused } = await createOrReuseJob(ctx, {
      userId: user._id,
      type: "ai_memory_vectors",
      title: "Vectorización semántica de memoria IA",
      detail: "Generando embeddings pendientes…",
      dedupeKey: "ai_memory_vectors",
    });
    if (!reused) {
      await ctx.scheduler.runAfter(0, internal.aiMemory.runVectorizePendingJob, {
        jobId,
      });
    }
    return { jobId, reused };
  },
});

export const runVectorizePendingJob = internalAction({
  args: {
    jobId: v.optional(v.id("backgroundJobs")),
    alreadyProcessed: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ processed: number; remaining: number }> => {
    const config = await ctx.runQuery(internal.aiSettings.resolved, {});
    if (!config.embeddingEnabled || !config.embeddingBaseUrl.trim()) {
      if (args.jobId) {
        await ctx.runMutation(internal.aiMemory.updateVectorJobStatus, {
          jobId: args.jobId,
          status: JOB_STATUS.FAILED,
          error:
            "Activa y guarda primero la configuración de embeddings en Ajustes.",
          finished: true,
        });
      }
      return { processed: 0, remaining: 0 };
    }

    const pending: PendingEmbeddingBatch = await ctx.runQuery(
      internal.aiMemory.listPendingEmbeddingChunks,
      { limit: VECTORIZE_BATCH_SIZE },
    );

    if (args.jobId) {
      const stillActive = await ctx.runMutation(
        internal.aiMemory.updateVectorJobStatus,
        {
          jobId: args.jobId,
          status: JOB_STATUS.RUNNING,
          total: pending.totalChunks,
          detail: `Vectorizando lote (${pending.totalPending} pendientes)…`,
        },
      );
      if (!stillActive) return { processed: 0, remaining: pending.totalPending };
    }

    if (pending.batch.length === 0) {
      if (args.jobId) {
        await ctx.runMutation(internal.aiMemory.updateVectorJobStatus, {
          jobId: args.jobId,
          status: JOB_STATUS.COMPLETED,
          processed: pending.totalChunks,
          total: pending.totalChunks,
          detail: "Todos los fragmentos ya tienen vector semántico.",
          finished: true,
        });
      }
      return { processed: 0, remaining: 0 };
    }

    try {
      const updates: Array<{
        id: Id<"aiKnowledgeChunks">;
        embedding: number[];
      }> = [];

      // Procesamos en mini-tandas de 5 para equilibrar velocidad y límites del endpoint.
      for (let i = 0; i < pending.batch.length; i += 5) {
        const slice = pending.batch.slice(i, i + 5);
        const vectors = await Promise.all(
          slice.map((item) =>
            fetchEmbeddingVector({
              baseUrl: config.embeddingBaseUrl,
              apiKey: config.embeddingApiKey || undefined,
              model: config.embeddingModel,
              input: item.text,
            }),
          ),
        );
        for (let j = 0; j < slice.length; j += 1) {
          const vec = vectors[j];
          if (vec.length !== AI_EMBEDDING_DIMENSIONS) {
            throw new Error(
              `El modelo devolvió ${vec.length} dimensiones y el índice espera ${AI_EMBEDDING_DIMENSIONS}.`,
            );
          }
          updates.push({ id: slice[j].id, embedding: vec });
        }
      }

      if (updates.length > 0) {
        await ctx.runMutation(internal.aiMemory.patchChunkEmbeddings, {
          updates,
        });
      }

      const processedSoFar = (args.alreadyProcessed ?? 0) + updates.length;
      const remaining = Math.max(0, pending.totalPending - updates.length);

      if (remaining > 0 && updates.length > 0) {
        if (args.jobId) {
          await ctx.runMutation(internal.aiMemory.updateVectorJobStatus, {
            jobId: args.jobId,
            status: JOB_STATUS.RUNNING,
            processed: pending.totalChunks - remaining,
            total: pending.totalChunks,
            detail: `${processedSoFar} vectorizados; quedan ${remaining} pendientes…`,
          });
        }
        await ctx.scheduler.runAfter(
          300,
          internal.aiMemory.runVectorizePendingJob,
          {
            jobId: args.jobId,
            alreadyProcessed: processedSoFar,
          },
        );
      } else if (args.jobId) {
        await ctx.runMutation(internal.aiMemory.updateVectorJobStatus, {
          jobId: args.jobId,
          status: JOB_STATUS.COMPLETED,
          processed: pending.totalChunks,
          total: pending.totalChunks,
          detail: `${processedSoFar} fragmentos vectorizados correctamente.`,
          finished: true,
        });
      }

      return { processed: updates.length, remaining };
    } catch (error) {
      if (args.jobId) {
        await ctx.runMutation(internal.aiMemory.updateVectorJobStatus, {
          jobId: args.jobId,
          status: JOB_STATUS.FAILED,
          error:
            error instanceof Error
              ? error.message
              : "Error al vectorizar los fragmentos.",
          finished: true,
        });
      }
      return { processed: 0, remaining: pending.totalPending };
    }
  },
});

type HybridChunkCandidate = {
  entityId: string;
  module: string;
  reference: string;
  title: string;
  compactText: string;
};

type SearchMemoryResult = {
  chunks: Array<{
    module: string;
    reference: string;
    title: string;
    compactText: string;
  }>;
  facts: string[];
};

/** Búsqueda híbrida: combina FTS + BM25 con similitud vectorial cuando embeddings está activo. */
export const searchMemoryHybrid = internalAction({
  args: {
    userId: v.id("users"),
    query: v.string(),
    allowedModules: v.array(v.string()),
    includeMailbox: v.boolean(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SearchMemoryResult> => {
    const lexical = await ctx.runQuery(internal.aiMemory.searchMemory, args);
    const trimmedQuery = args.query.trim();
    if (!trimmedQuery) return lexical;

    const config = await ctx.runQuery(internal.aiSettings.resolved, {});
    if (!config.embeddingEnabled || !config.embeddingBaseUrl.trim()) {
      return lexical;
    }

    try {
      const queryVector = await fetchEmbeddingVector({
        baseUrl: config.embeddingBaseUrl,
        apiKey: config.embeddingApiKey || undefined,
        model: config.embeddingModel,
        input: trimmedQuery,
      });
      if (queryVector.length !== AI_EMBEDDING_DIMENSIONS) {
        return lexical;
      }

      const limit = Math.min(12, Math.max(1, args.limit ?? 8));
      const allowed = new Set(args.allowedModules as AiMemoryModule[]);

      const [sharedMatches, mailboxMatches] = await Promise.all([
        ctx.vectorSearch("aiKnowledgeChunks", "by_embedding", {
          vector: queryVector,
          limit: 20,
          filter: (q) => q.eq("scope", "shared"),
        }),
        args.includeMailbox
          ? ctx.vectorSearch("aiKnowledgeChunks", "by_embedding", {
              vector: queryVector,
              limit: 8,
              filter: (q) => q.eq("ownerUserId", args.userId),
            })
          : Promise.resolve([]),
      ]);

      const scoreById = new Map<Id<"aiKnowledgeChunks">, number>();
      for (const hit of [...sharedMatches, ...mailboxMatches]) {
        const prev = scoreById.get(hit._id) ?? -Infinity;
        if (hit._score > prev) scoreById.set(hit._id, hit._score);
      }

      if (scoreById.size === 0) return lexical;

      const docs: Array<Doc<"aiKnowledgeChunks">> = await ctx.runQuery(
        internal.aiMemory.getChunksByIds,
        {
          ids: [...scoreById.keys()],
        },
      );

      const vectorHits: HybridChunkCandidate[] = docs
        .filter(
          (doc) =>
            (doc.scope === "shared" && allowed.has(doc.module)) ||
            (args.includeMailbox &&
              doc.scope === "mailbox" &&
              doc.ownerUserId === args.userId),
        )
        .sort(
          (a, b) =>
            (scoreById.get(b._id) ?? 0) - (scoreById.get(a._id) ?? 0),
        )
        .map((doc) => ({
          entityId: `${doc.module}:${doc.reference}`,
          module: doc.module,
          reference: doc.reference,
          title: doc.title,
          compactText: doc.compactText,
        }));

      if (vectorHits.length === 0) return lexical;

      const lexicalWithId: HybridChunkCandidate[] = lexical.chunks.map((c) => ({
        entityId: `${c.module}:${c.reference}`,
        ...c,
      }));

      const fused = reciprocalRankFusion<HybridChunkCandidate>(
        [vectorHits, lexicalWithId],
        limit,
      );
      return {
        chunks: fused.map((c) => ({
          module: c.module,
          reference: c.reference,
          title: c.title,
          compactText: c.compactText,
        })),
        facts: lexical.facts,
      };
    } catch {
      return lexical;
    }
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
