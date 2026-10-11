import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { DEFAULT_AUDIT_ALERT_ROLES } from "../lib/audit";
import { MutationCtx, QueryCtx, mutation, query } from "./_generated/server";
import {
  hasCapability,
  normalizeSettingsRoleKeys,
  settingsRoleOptions,
} from "./permissions";

/**
 * Avisos de auditoría del expediente: un documento retirado —su movimiento es
 * la única constancia que queda de él— o cualquier movimiento del expediente de
 * una incidencia ya cerrada. Aquí vive a qué roles les llegan; la decisión de
 * qué movimiento avisa y con qué texto está en `../lib/audit`, compartida con
 * sus pruebas.
 *
 * Quien los recibe no se decide con una capacidad sino con esta lista: es un
 * reparto, no un permiso. Lo configura quien audita el expediente, que es quien
 * lee el rastro completo en su módulo.
 */

/** Una sola fila de ajustes: se lee y se escribe siempre en el mismo sitio. */
const SETTINGS_KEY = "default";

/** Sesión iniciada: sin usuario no hay ajustes que leer ni que cambiar. */
async function requireSession(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  const user = userId === null ? null : await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError(
      "Debes iniciar sesión para consultar los avisos del expediente.",
    );
  }
  return user;
}

/** Quien audita el expediente decide quién recibe sus avisos. */
async function requireAuditManager(ctx: QueryCtx | MutationCtx) {
  const user = await requireSession(ctx);
  if (!(await hasCapability(ctx, user, "viewAudit"))) {
    throw new ConvexError(
      "Solo quien audita el expediente puede configurar estos avisos. Revisa la configuración de tu rol con el administrador.",
    );
  }
  return user;
}

function actorName(user: { name?: string; email?: string }): string {
  return user.name?.trim() || user.email?.trim() || "Auditoría del taller";
}

async function readSettings(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("auditAlertSettings")
    .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
    .unique();
}

/**
 * Roles a los que les llega el aviso ahora mismo: la lista guardada o, sin fila
 * todavía, la de partida. La usan los ajustes y el propio aviso (`incidents`)
 * para saber a quién avisar, así que las dos leen siempre lo mismo.
 */
export async function readAuditAlertRoles(
  ctx: QueryCtx | MutationCtx,
): Promise<string[]> {
  const row = await readSettings(ctx);
  return row?.roleKeys ?? [...DEFAULT_AUDIT_ALERT_ROLES];
}

/** Ajustes vigentes: a qué roles les llegan los avisos del expediente. */
export const settings = query({
  args: {},
  handler: async (ctx) => {
    await requireAuditManager(ctx);
    const row = await readSettings(ctx);
    return {
      roleKeys: row?.roleKeys ?? [...DEFAULT_AUDIT_ALERT_ROLES],
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
    };
  },
});

/** Roles a los que se puede apuntar el aviso: los del sistema y los propios. */
export const roleOptions = query({
  args: {},
  handler: async (ctx) => {
    await requireAuditManager(ctx);
    return await settingsRoleOptions(ctx);
  },
});

/**
 * Fija los roles que reciben los avisos del expediente. Una lista vacía es
 * válida —y significa que no avisan a nadie—: el rastro sigue leyéndose entero
 * en el módulo de Auditoría, así que se puede decidir no avisar.
 */
export const setAudience = mutation({
  args: { roleKeys: v.array(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireAuditManager(ctx);
    const roleKeys = await normalizeSettingsRoleKeys(ctx, args.roleKeys);

    const now = Date.now();
    const by = actorName(user);
    const row = await readSettings(ctx);
    if (row) {
      await ctx.db.patch(row._id, {
        roleKeys,
        updatedAt: now,
        updatedBy: by,
      });
      return;
    }
    await ctx.db.insert("auditAlertSettings", {
      key: SETTINGS_KEY,
      roleKeys,
      updatedAt: now,
      updatedBy: by,
    });
  },
});
