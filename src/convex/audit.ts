import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, query } from "./_generated/server";
import { ROLES } from "./schema";

/**
 * Registra un evento inmutable de auditoría de seguridad del taller.
 * Centraliza la trazabilidad de cambios de privilegios, estados de cuenta,
 * vaciado del taller e intentos de acceso no autorizados.
 */
export async function logSecurityEvent(
  ctx: MutationCtx,
  args: {
    actorId?: Id<"users"> | null;
    actorEmail?: string;
    action: string;
    target: string;
    metadata?: Record<string, unknown> | string;
  },
): Promise<Id<"securityAuditLog">> {
  const at = Date.now();
  const metadata =
    args.metadata === undefined
      ? undefined
      : typeof args.metadata === "object"
        ? JSON.stringify(args.metadata)
        : String(args.metadata);

  let actorEmail = args.actorEmail;
  if (!actorEmail && args.actorId) {
    const user = await ctx.db.get(args.actorId);
    actorEmail = user?.email ?? undefined;
  }

  return await ctx.db.insert("securityAuditLog", {
    actorId: args.actorId ?? undefined,
    actorEmail,
    action: args.action,
    target: args.target,
    metadata,
    at,
  });
}

/**
 * Consulta las trazas de auditoría de seguridad del sistema.
 * Solo disponible para usuarios con rol de administrador activo.
 */
export const securityAuditLogs = query({
  args: {
    limit: v.optional(v.number()),
    action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const user = userId === null ? null : await ctx.db.get(userId);
    if (
      !user ||
      user.role !== ROLES.ADMIN ||
      user.active === false ||
      user.isAnonymous === true
    ) {
      throw new ConvexError(
        "Solo el administrador puede consultar las trazas de auditoría de seguridad.",
      );
    }

    const limit = args.limit ?? 100;
    if (args.action) {
      const action = args.action;
      return await ctx.db
        .query("securityAuditLog")
        .withIndex("by_action", (q) => q.eq("action", action))
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("securityAuditLog")
      .withIndex("by_at")
      .order("desc")
      .take(limit);
  },
});
