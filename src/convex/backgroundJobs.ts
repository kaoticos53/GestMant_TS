import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { memberStatus } from "./permissions";
import {
  JOB_STATUS,
  canCancelJob,
  canTransitionJob,
  isActiveJobStatus,
  isCancelledJobStatus,
  type BackgroundJobStatus,
  type BackgroundJobType,
} from "../lib/backgroundJobs";

async function requireMemberUser(ctx: QueryCtx | MutationCtx) {
  const { user, issue } = await memberStatus(ctx);
  if (issue || !user) {
    throw new ConvexError("Debes iniciar sesión para gestionar trabajos.");
  }
  return user;
}

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_VISIBLE_JOBS = 20;

/**
 * Crea un trabajo nuevo o reutiliza uno activo si comparte `dedupeKey`.
 */
export async function createOrReuseJob(
  ctx: MutationCtx,
  params: {
    userId: Id<"users">;
    type: BackgroundJobType;
    title: string;
    total?: number;
    detail?: string;
    dedupeKey?: string;
  },
): Promise<{ jobId: Id<"backgroundJobs">; reused: boolean }> {
  const now = Date.now();
  if (params.dedupeKey) {
    for (const activeStatus of [JOB_STATUS.QUEUED, JOB_STATUS.RUNNING] as const) {
      const existing = await ctx.db
        .query("backgroundJobs")
        .withIndex("by_dedupe", (q) =>
          q.eq("dedupeKey", params.dedupeKey).eq("status", activeStatus),
        )
        .first();
      if (existing && existing.userId === params.userId) {
        return { jobId: existing._id, reused: true };
      }
    }
  }

  const jobId = await ctx.db.insert("backgroundJobs", {
    userId: params.userId,
    type: params.type,
    title: params.title,
    status: JOB_STATUS.QUEUED,
    processed: 0,
    total: params.total,
    detail: params.detail,
    dedupeKey: params.dedupeKey,
    createdAt: now,
    updatedAt: now,
  });

  return { jobId, reused: false };
}

/** Lista los trabajos activos y recientes (últimas 24 h) del usuario autenticado. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const { user, issue } = await memberStatus(ctx);
    if (issue || !user) return [];
    const cutoff = Date.now() - RECENT_WINDOW_MS;
    const rows = await ctx.db
      .query("backgroundJobs")
      .withIndex("by_user_updated", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(MAX_VISIBLE_JOBS);

    return rows.filter(
      (job) => isActiveJobStatus(job.status) || job.updatedAt >= cutoff,
    );
  },
});

/** Marca un trabajo activo del usuario como cancelado. */
export const cancel = mutation({
  args: { jobId: v.id("backgroundJobs") },
  handler: async (ctx, args) => {
    const user = await requireMemberUser(ctx);
    const job = await ctx.db.get(args.jobId);
    if (!job || job.userId !== user._id) {
      throw new ConvexError("No se encontró el trabajo.");
    }
    if (!canCancelJob(job.status)) {
      return { ok: false };
    }
    const now = Date.now();
    await ctx.db.patch(job._id, {
      status: JOB_STATUS.CANCELLED,
      finishedAt: now,
      updatedAt: now,
      detail: "Cancelado por el usuario.",
    });
    return { ok: true };
  },
});

/** Elimina de la lista del usuario un trabajo ya finalizado. */
export const dismiss = mutation({
  args: { jobId: v.id("backgroundJobs") },
  handler: async (ctx, args) => {
    const user = await requireMemberUser(ctx);
    const job = await ctx.db.get(args.jobId);
    if (!job || job.userId !== user._id) return { ok: false };
    if (isActiveJobStatus(job.status)) {
      throw new ConvexError("No se puede ocultar un trabajo en curso.");
    }
    await ctx.db.delete(job._id);
    return { ok: true };
  },
});

/** Elimina todos los trabajos finalizados del usuario. */
export const clearFinished = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireMemberUser(ctx);
    const rows = await ctx.db
      .query("backgroundJobs")
      .withIndex("by_user_updated", (q) => q.eq("userId", user._id))
      .collect();
    let deleted = 0;
    for (const row of rows) {
      if (!isActiveJobStatus(row.status)) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
    }
    return { deleted };
  },
});

export const isCancelled = internalQuery({
  args: { jobId: v.id("backgroundJobs") },
  handler: async (ctx, args): Promise<boolean> => {
    const job = await ctx.db.get(args.jobId);
    return !job || isCancelledJobStatus(job.status);
  },
});

export const advanceProgress = internalMutation({
  args: {
    jobId: v.id("backgroundJobs"),
    processed: v.number(),
    total: v.optional(v.number()),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    const current = job.status as BackgroundJobStatus;
    if (!canTransitionJob(current, JOB_STATUS.RUNNING)) return;

    await ctx.db.patch(job._id, {
      status: JOB_STATUS.RUNNING,
      processed: args.processed,
      total: args.total ?? job.total,
      detail: args.detail ?? job.detail,
      updatedAt: Date.now(),
    });
  },
});

export const complete = internalMutation({
  args: {
    jobId: v.id("backgroundJobs"),
    processed: v.optional(v.number()),
    total: v.optional(v.number()),
    detail: v.optional(v.string()),
    resultStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    const current = job.status as BackgroundJobStatus;
    if (!canTransitionJob(current, JOB_STATUS.COMPLETED)) return;

    const now = Date.now();
    await ctx.db.patch(job._id, {
      status: JOB_STATUS.COMPLETED,
      processed: args.processed ?? job.processed,
      total: args.total ?? job.total,
      detail: args.detail ?? job.detail,
      resultStorageId: args.resultStorageId ?? job.resultStorageId,
      updatedAt: now,
      finishedAt: now,
    });
  },
});

export const fail = internalMutation({
  args: {
    jobId: v.id("backgroundJobs"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    const current = job.status as BackgroundJobStatus;
    if (!canTransitionJob(current, JOB_STATUS.FAILED)) return;

    const now = Date.now();
    await ctx.db.patch(job._id, {
      status: JOB_STATUS.FAILED,
      error: args.error,
      updatedAt: now,
      finishedAt: now,
    });
  },
});

/** Purga trabajos antiguos finalizados (más de 7 días). */
export const purgeOld = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const all = await ctx.db.query("backgroundJobs").collect();
    let purged = 0;
    for (const job of all) {
      if (!isActiveJobStatus(job.status) && job.updatedAt < cutoff) {
        await ctx.db.delete(job._id);
        purged += 1;
      }
    }
    return { purged };
  },
});
