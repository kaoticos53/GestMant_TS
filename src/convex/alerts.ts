import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import {
  DEFAULT_WORK_WITHOUT_TRACE_DAYS,
  DEFAULT_WORK_WITHOUT_TRACE_ROLES,
  MAX_WORK_WITHOUT_TRACE_DAYS,
  MIN_WORK_WITHOUT_TRACE_DAYS,
} from "../lib/workshop";
import { MutationCtx, QueryCtx, mutation, query } from "./_generated/server";
import {
  hasCapability,
  normalizeSettingsRoleKeys,
  settingsRoleOptions,
} from "./permissions";

/**
 * Aviso de trabajo sin constancia: lo que lleva días en curso sin que su
 * técnico escriba una sola nota. Aquí viven los ajustes que decide quien
 * coordina —con qué margen avisa y a qué roles les llega—; la regla que decide
 * qué incidencias entran está en `../lib/workshop`, compartida con sus pruebas.
 */

/** Una sola fila de ajustes: se lee y se escribe siempre en el mismo sitio. */
const SETTINGS_KEY = "default";

/** Sesión iniciada: el panel necesita los ajustes para pintar el aviso. */
async function requireSession(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  const user = userId === null ? null : await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError(
      "Debes iniciar sesión para consultar el aviso de trabajo sin constancia.",
    );
  }
  return user;
}

/** Quien coordina las incidencias decide el margen y a quién le llega. */
async function requireAlertManager(ctx: QueryCtx | MutationCtx) {
  const user = await requireSession(ctx);
  if (!(await hasCapability(ctx, user, "manageIncidents"))) {
    throw new ConvexError(
      "Solo quien coordina las incidencias puede configurar este aviso. Revisa la configuración de tu rol con el administrador.",
    );
  }
  return user;
}

function actorName(user: { name?: string; email?: string }): string {
  return user.name?.trim() || user.email?.trim() || "Coordinación del taller";
}

async function readSettings(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("alertSettings")
    .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
    .unique();
}

/**
 * Ajustes vigentes; sin fila guardada se devuelven los de partida. Los lee
 * cualquier persona con sesión —el panel los necesita para saber si le toca ver
 * el aviso—, pero solo quien coordina puede cambiarlos.
 */
export const settings = query({
  args: {},
  handler: async (ctx) => {
    await requireSession(ctx);
    const row = await readSettings(ctx);
    return {
      days: row?.days ?? DEFAULT_WORK_WITHOUT_TRACE_DAYS,
      roleKeys: row?.roleKeys ?? [...DEFAULT_WORK_WITHOUT_TRACE_ROLES],
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
    };
  },
});

/** Roles a los que se puede apuntar el aviso: los del sistema y los propios. */
export const roleOptions = query({
  args: {},
  handler: async (ctx) => {
    await requireAlertManager(ctx);
    return await settingsRoleOptions(ctx);
  },
});

/** Fija el margen del aviso y los roles a los que les llega. */
export const setSettings = mutation({
  args: {
    days: v.number(),
    roleKeys: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAlertManager(ctx);
    const days = Math.round(args.days);
    if (
      !Number.isFinite(days) ||
      days < MIN_WORK_WITHOUT_TRACE_DAYS ||
      days > MAX_WORK_WITHOUT_TRACE_DAYS
    ) {
      throw new ConvexError(
        `El margen del aviso debe estar entre ${MIN_WORK_WITHOUT_TRACE_DAYS} y ${MAX_WORK_WITHOUT_TRACE_DAYS} días.`,
      );
    }

    const roleKeys = await normalizeSettingsRoleKeys(ctx, args.roleKeys);

    const now = Date.now();
    const by = actorName(user);
    const row = await readSettings(ctx);
    if (row) {
      await ctx.db.patch(row._id, { days, roleKeys, updatedAt: now, updatedBy: by });
      return;
    }
    await ctx.db.insert("alertSettings", {
      key: SETTINGS_KEY,
      days,
      roleKeys,
      updatedAt: now,
      updatedBy: by,
    });
  },
});
