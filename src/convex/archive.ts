import { ConvexError, v } from "convex/values";
import {
  AUTO_ARCHIVE_BY,
  DEFAULT_AFTER_MONTHS,
  MAX_AFTER_MONTHS,
  MIN_AFTER_MONTHS,
  requestArchiveDate,
} from "../lib/archive";
import { monthsAgo } from "../lib/browse";
import { isClosedIncident } from "../lib/incidentFlow";
import { isRequestInMotion } from "../lib/requestFlow";
import {
  MutationCtx,
  QueryCtx,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { requireCoordinator } from "./permissions";

/**
 * Archivo del taller. Aquí vive todo lo que comparten el archivado a mano
 * (masivo por antigüedad y ficha a ficha) y el automático de cada noche, para
 * que las dos vías apliquen exactamente las mismas reglas: solo sale del día a
 * día lo terminado, y lo archivado se sigue consultando en el módulo Archivo.
 */

/** Una sola fila de ajustes: se lee y se escribe siempre en el mismo sitio. */
const SETTINGS_KEY = "default";

/* ------------------------------------------------------------------ */
/* Reglas de qué se archiva (las usan el modo manual y el automático)   */
/* ------------------------------------------------------------------ */

/**
 * Manda al archivo las incidencias cerradas antes de `before`. Devuelve cuántas
 * se archivaron. Cada una deja su traza en el historial.
 */
export async function archiveClosedIncidentsBefore(
  ctx: MutationCtx,
  args: { before: number; by: string; now?: number },
): Promise<number> {
  const now = args.now ?? Date.now();
  const items = await ctx.db.query("incidents").collect();
  let archived = 0;
  for (const incident of items) {
    if (incident.archivedAt !== undefined) continue;
    // Lo retirado no se archiva: está en la papelera esperando a volver o a
    // borrarse, y devolverlo al archivo lo sacaría de la pantalla que lo guarda.
    if (incident.deletedAt !== undefined) continue;
    if (!isClosedIncident(incident.status)) continue;
    const closedAt = incident.closedAt ?? incident.updatedAt;
    if (closedAt >= args.before) continue;
    await ctx.db.patch(incident._id, {
      archivedAt: now,
      archivedBy: args.by,
      updatedAt: now,
      history: [
        ...incident.history,
        { status: incident.status, at: now, by: args.by, note: "Archivada" },
      ],
    });
    archived += 1;
  }
  return archived;
}

/**
 * Manda al archivo las peticiones ya decididas antes de `before`. Devuelve
 * cuántas se archivaron.
 */
export async function archiveDecidedRequestsBefore(
  ctx: MutationCtx,
  args: { before: number; by: string; now?: number },
): Promise<number> {
  const now = args.now ?? Date.now();
  const requests = await ctx.db.query("partRequests").collect();
  let archived = 0;
  for (const request of requests) {
    if (request.archivedAt !== undefined) continue;
    // Lo retirado no se archiva: está en la papelera esperando a volver o a
    // borrarse, y devolverlo al archivo lo sacaría de la pantalla que lo guarda.
    if (request.deletedAt !== undefined) continue;
    // Lo que sigue en movimiento no se archiva, tampoco por la noche: una
    // petición pendiente o en espera no está terminada. Es la misma regla que
    // la del archivado a mano de una petición (`partRequests.archive`), para
    // que las tres vías —a mano, masiva y automática— digan lo mismo.
    if (isRequestInMotion(request.status)) continue;
    if (requestArchiveDate(request) >= args.before) continue;
    await ctx.db.patch(request._id, {
      archivedAt: now,
      archivedBy: args.by,
    });
    archived += 1;
  }
  return archived;
}

/* ------------------------------------------------------------------ */
/* Ajustes del archivado automático                                    */
/* ------------------------------------------------------------------ */

/** Quien coordina incidencias o decide peticiones gestiona el archivo. */
async function requireArchiveManager(ctx: QueryCtx | MutationCtx) {
  return await requireCoordinator(ctx, "gestionar el archivo");
}

/** Nombre visible de quien firma el archivado automático de cada noche. */
export { AUTO_ARCHIVE_BY };

async function readSettings(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("archiveSettings")
    .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
    .unique();
}

function actorName(user: { name?: string; email?: string }): string {
  return user.name?.trim() || user.email?.trim() || "Coordinación del taller";
}

/** Ajustes vigentes; sin fila guardada se devuelven los de por defecto. */
export const settings = query({
  args: {},
  handler: async (ctx) => {
    await requireArchiveManager(ctx);
    const row = await readSettings(ctx);
    return {
      enabled: row?.enabled ?? true,
      afterMonths: row?.afterMonths ?? DEFAULT_AFTER_MONTHS,
      lastRunAt: row?.lastRunAt ?? null,
      lastRunArchived: row?.lastRunArchived ?? null,
      updatedBy: row?.updatedBy ?? null,
    };
  },
});

/** Enciende o apaga el archivado automático y fija su antigüedad. */
export const setSettings = mutation({
  args: {
    enabled: v.boolean(),
    afterMonths: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireArchiveManager(ctx);
    const afterMonths = Math.round(args.afterMonths);
    if (
      !Number.isFinite(afterMonths) ||
      afterMonths < MIN_AFTER_MONTHS ||
      afterMonths > MAX_AFTER_MONTHS
    ) {
      throw new ConvexError(
        `La antigüedad del archivado automático debe estar entre ${MIN_AFTER_MONTHS} y ${MAX_AFTER_MONTHS} meses.`,
      );
    }

    const now = Date.now();
    const by = actorName(user);
    const row = await readSettings(ctx);
    if (row) {
      await ctx.db.patch(row._id, {
        enabled: args.enabled,
        afterMonths,
        updatedAt: now,
        updatedBy: by,
      });
      return;
    }
    await ctx.db.insert("archiveSettings", {
      key: SETTINGS_KEY,
      enabled: args.enabled,
      afterMonths,
      updatedAt: now,
      updatedBy: by,
    });
  },
});

/** Anota la última pasada automática (solo la usa el cron). */
async function recordRun(ctx: MutationCtx, archived: number) {
  const now = Date.now();
  const row = await readSettings(ctx);
  if (row) {
    await ctx.db.patch(row._id, { lastRunAt: now, lastRunArchived: archived });
  } else {
    await ctx.db.insert("archiveSettings", {
      key: SETTINGS_KEY,
      enabled: true,
      afterMonths: DEFAULT_AFTER_MONTHS,
      lastRunAt: now,
      lastRunArchived: archived,
      updatedAt: now,
    });
  }
}

/** Archivado con el corte que toque; lo usan las dos vías. */
async function archiveCutoff(
  ctx: MutationCtx,
  args: { before: number; by: string },
): Promise<{ incidents: number; requests: number; total: number }> {
  const incidents = await archiveClosedIncidentsBefore(ctx, args);
  const requests = await archiveDecidedRequestsBefore(ctx, args);
  return { incidents, requests, total: incidents + requests };
}

/**
 * Pasada automática (cada noche, desde `crons.ts`): archiva lo terminado según
 * los ajustes guardados. Con el automático apagado no toca nada.
 */
export const runAutoArchive = internalMutation({
  args: {},
  handler: async (ctx) => {
    const row = await readSettings(ctx);
    const enabled = row?.enabled ?? true;
    if (!enabled) return 0;

    const afterMonths = row?.afterMonths ?? DEFAULT_AFTER_MONTHS;
    const { total } = await archiveCutoff(ctx, {
      before: monthsAgo(afterMonths),
      by: AUTO_ARCHIVE_BY,
    });
    await recordRun(ctx, total);
    return total;
  },
});

/**
 * «Ejecutar ahora»: la misma limpieza, a mano y con la antigüedad configurada.
 * Funciona aunque el automático esté apagado (es justo la alternativa manual).
 */
export const runNow = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireArchiveManager(ctx);
    const row = await readSettings(ctx);
    const afterMonths = row?.afterMonths ?? DEFAULT_AFTER_MONTHS;
    const before = monthsAgo(afterMonths);
    const result = await archiveCutoff(ctx, {
      before,
      by: actorName(user),
    });
    return { ...result, before, afterMonths };
  },
});
