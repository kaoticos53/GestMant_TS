import { ConvexError, v } from "convex/values";
import {
  MAX_MAIL_ATTEMPTS,
  classifyMailFailure,
  nextRetryDelayMs,
} from "../lib/mailRetry";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { identityNotice, secureMutation } from "./_auth/secureMutation";
import { deliverMailLogged } from "./_mail/deliver";
import { notifyUsers } from "./notify";
import { requireAdmin } from "./permissions";
import { ROLES } from "./schema";

const OUTBOX_PURGE_DAYS = 14;
const OUTBOX_PURGE_BATCH = 100;

const originValidator = v.union(
  v.literal("incidencia"),
  v.literal("equipo"),
  v.literal("resumen"),
  v.literal("prueba"),
);

function oneLine(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

async function notifyAdminsOfMailFailure(
  ctx: MutationCtx,
  args: {
    what: string;
    subject: string;
    error?: string;
    relatedId?: string;
  },
): Promise<void> {
  const users = await ctx.db.query("users").collect();
  const adminIds = users
    .filter(
      (u) =>
        u.role === ROLES.ADMIN && u.active !== false && u.isAnonymous !== true,
    )
    .map((u) => u._id);
  if (adminIds.length === 0) return;

  const detail = args.error ? `: ${oneLine(args.error, 140)}` : "";
  const text = `No se pudo enviar ${oneLine(args.what, 60)} («${oneLine(args.subject, 60)}»)${detail}`;
  await notifyUsers(ctx, adminIds, text);
}

/**
 * Encola un correo fallido en `mailOutbox`. Si el fallo es transitorio,
 * programa reintentos automáticos con backoff; si es permanente, avisa a los
 * administradores.
 */
export const enqueueFailure = internalMutation({
  args: {
    what: v.string(),
    origin: originValidator,
    relatedId: v.optional(v.string()),
    to: v.array(v.string()),
    subject: v.string(),
    text: v.string(),
    html: v.string(),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const classification = classifyMailFailure(args.lastError);
    const delayMs = classification.retryable ? nextRetryDelayMs(1) : null;
    const status = delayMs !== null ? "retrying" : "failed";

    const outboxId = await ctx.db.insert("mailOutbox", {
      what: oneLine(args.what, 120),
      origin: args.origin,
      ...(args.relatedId === undefined ? {} : { relatedId: args.relatedId }),
      to: args.to,
      subject: oneLine(args.subject, 200),
      text: args.text,
      html: args.html,
      status,
      attempts: 1,
      maxAttempts: MAX_MAIL_ATTEMPTS,
      ...(delayMs === null ? {} : { nextRetryAt: now + delayMs }),
      ...(args.lastError === undefined
        ? {}
        : { lastError: oneLine(args.lastError, 400) }),
      lastAttemptAt: now,
      createdAt: now,
    });

    if (delayMs !== null) {
      await ctx.scheduler.runAfter(delayMs, internal.mailOutbox.attemptSend, {
        outboxId,
      });
    } else {
      await notifyAdminsOfMailFailure(ctx, {
        what: args.what,
        subject: args.subject,
        error: args.lastError,
        relatedId: args.relatedId,
      });
    }

    return outboxId;
  },
});

export const getForAttempt = internalQuery({
  args: { outboxId: v.id("mailOutbox") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.outboxId);
  },
});

export const recordAttemptResult = internalMutation({
  args: {
    outboxId: v.id("mailOutbox"),
    ok: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.outboxId);
    if (!row || row.status === "sent" || row.status === "discarded") return;

    const now = Date.now();
    if (args.ok) {
      await ctx.db.patch(args.outboxId, {
        status: "sent",
        nextRetryAt: undefined,
        lastError: undefined,
        lastAttemptAt: now,
      });
      return;
    }

    const nextAttempts = row.attempts + 1;
    const classification = classifyMailFailure(args.error);
    const delayMs =
      classification.retryable && nextAttempts < row.maxAttempts
        ? nextRetryDelayMs(nextAttempts)
        : null;

    if (delayMs !== null) {
      await ctx.db.patch(args.outboxId, {
        status: "retrying",
        attempts: nextAttempts,
        nextRetryAt: now + delayMs,
        ...(args.error === undefined
          ? {}
          : { lastError: oneLine(args.error, 400) }),
        lastAttemptAt: now,
      });
      await ctx.scheduler.runAfter(delayMs, internal.mailOutbox.attemptSend, {
        outboxId: args.outboxId,
      });
      return;
    }

    await ctx.db.patch(args.outboxId, {
      status: "failed",
      attempts: nextAttempts,
      nextRetryAt: undefined,
      ...(args.error === undefined
        ? {}
        : { lastError: oneLine(args.error, 400) }),
      lastAttemptAt: now,
    });
    await notifyAdminsOfMailFailure(ctx, {
      what: row.what,
      subject: row.subject,
      error: args.error,
      relatedId: row.relatedId,
    });
  },
});

/** Ejecuta un reintento de envío de una entrada de `mailOutbox`. */
export const attemptSend = internalAction({
  args: { outboxId: v.id("mailOutbox") },
  handler: async (ctx, args) => {
    const row = await ctx.runQuery(internal.mailOutbox.getForAttempt, {
      outboxId: args.outboxId,
    });
    if (!row || row.status === "sent" || row.status === "discarded") return;

    const config = await ctx.runQuery(internal.mailSettings.delivery, {});
    const result = await deliverMailLogged(
      ctx,
      config,
      {
        to: row.to,
        subject: row.subject,
        text: row.text,
        html: row.html,
      },
      row.what,
      row.origin,
      row.relatedId,
      { skipOutbox: true },
    );

    await ctx.runMutation(internal.mailOutbox.recordAttemptResult, {
      outboxId: args.outboxId,
      ok: result.ok,
      ...(result.ok || result.error === undefined ? {} : { error: result.error }),
    });
  },
});

/** Lista los envíos en reintento o fallidos para el administrador. */
export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, "ver la cola de correos fallidos");
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const [retrying, failed] = await Promise.all([
      ctx.db
        .query("mailOutbox")
        .withIndex("by_status_created", (q) => q.eq("status", "retrying"))
        .order("desc")
        .take(limit),
      ctx.db
        .query("mailOutbox")
        .withIndex("by_status_created", (q) => q.eq("status", "failed"))
        .order("desc")
        .take(limit),
    ]);
    return [...retrying, ...failed]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  },
});

const retryOneArgs = { outboxId: v.id("mailOutbox") };

/** Reintenta de inmediato un correo fallido o en espera. */
export const retryOne = mutation({
  args: retryOneArgs,
  handler: secureMutation(
    {
      identityMessage: identityNotice(
        "Debes iniciar sesión para reintentar envíos de correo.",
      ),
      authorize: async (_ctx, actor) =>
        actor.role === ROLES.ADMIN
          ? null
          : "Solo el administrador puede reintentar envíos de correo.",
    },
    retryOneArgs,
    async (ctx, args) => {
      const row = await ctx.db.get(args.outboxId);
      if (!row) throw new ConvexError("El envío ya no existe en la cola.");
      if (row.status === "sent" || row.status === "discarded") {
        throw new ConvexError("Este envío ya fue cerrado y no se puede reintentar.");
      }
      const now = Date.now();
      await ctx.db.patch(args.outboxId, {
        status: "retrying",
        nextRetryAt: now,
        maxAttempts: Math.max(row.maxAttempts, row.attempts + 1),
      });
      await ctx.scheduler.runAfter(0, internal.mailOutbox.attemptSend, {
        outboxId: args.outboxId,
      });
    },
  ),
});

const retryAllFailedArgs = {};

/** Reintenta todos los correos en estado fallido. */
export const retryAllFailed = mutation({
  args: retryAllFailedArgs,
  handler: secureMutation(
    {
      identityMessage: identityNotice(
        "Debes iniciar sesión para reintentar envíos de correo.",
      ),
      authorize: async (_ctx, actor) =>
        actor.role === ROLES.ADMIN
          ? null
          : "Solo el administrador puede reintentar envíos de correo.",
    },
    retryAllFailedArgs,
    async (ctx) => {
      const failed = await ctx.db
        .query("mailOutbox")
        .withIndex("by_status_created", (q) => q.eq("status", "failed"))
        .take(50);
      const now = Date.now();
      for (const row of failed) {
        await ctx.db.patch(row._id, {
          status: "retrying",
          nextRetryAt: now,
          maxAttempts: Math.max(row.maxAttempts, row.attempts + 1),
        });
        await ctx.scheduler.runAfter(0, internal.mailOutbox.attemptSend, {
          outboxId: row._id,
        });
      }
      return { scheduled: failed.length };
    },
  ),
});

const discardArgs = { outboxId: v.id("mailOutbox") };

/** Descarta un envío fallido para sacarlo de la cola de pendientes. */
export const discard = mutation({
  args: discardArgs,
  handler: secureMutation(
    {
      identityMessage: identityNotice(
        "Debes iniciar sesión para descartar envíos de correo.",
      ),
      authorize: async (_ctx, actor) =>
        actor.role === ROLES.ADMIN
          ? null
          : "Solo el administrador puede descartar envíos de correo.",
    },
    discardArgs,
    async (ctx, args) => {
      const row = await ctx.db.get(args.outboxId);
      if (!row) return;
      if (row.status === "sent" || row.status === "discarded") return;
      await ctx.db.patch(args.outboxId, {
        status: "discarded",
        nextRetryAt: undefined,
      });
    },
  ),
});

/** Purga entradas ya enviadas o descartadas con más de 14 días. */
export const purgeOld = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - OUTBOX_PURGE_DAYS * 24 * 60 * 60 * 1000;
    let deleted = 0;
    for (const status of ["sent", "discarded"] as const) {
      const stale = await ctx.db
        .query("mailOutbox")
        .withIndex("by_status_created", (q) =>
          q.eq("status", status).lt("createdAt", cutoff),
        )
        .take(OUTBOX_PURGE_BATCH);
      for (const row of stale) {
        await ctx.db.delete(row._id as Id<"mailOutbox">);
        deleted += 1;
      }
    }
    return { deleted };
  },
});
