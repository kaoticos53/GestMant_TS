import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
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
 * Consulta las trazas de auditoría de seguridad del sistema, por cursor.
 * Solo disponible para usuarios con rol de administrador activo.
 *
 * Se pagina en el servidor —y no se devuelve «las últimas N»— porque esta tabla
 * no se vacía nunca: es la trazabilidad de seguridad del taller y crece con cada
 * cambio de privilegios o acceso no autorizado. Con un cursor, el navegador pide
 * la siguiente ventana cuando la necesita y una instalación con años de historia
 * sigue contestando en el mismo tiempo que una recién puesta en marcha.
 *
 * El filtro por acción tiene su propio índice (`by_action_and_at`): así la
 * ventana sale ordenada por fecha dentro de la acción sin leer lo demás.
 */
export const securityAuditLogs = query({
  args: {
    paginationOpts: paginationOptsValidator,
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

    const action = args.action;
    if (action) {
      return await ctx.db
        .query("securityAuditLog")
        .withIndex("by_action_and_at", (q) => q.eq("action", action))
        .order("desc")
        .paginate(args.paginationOpts);
    }

    return await ctx.db
      .query("securityAuditLog")
      .withIndex("by_at")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/**
 * Deja constancia de una impresión de etiquetas. Una etiqueta saca el código de
 * un equipo o de un repuesto del taller y lo deja pegado en una estantería: es
 * una acción con efecto fuera de la aplicación, y el rastro de seguridad es
 * donde se apunta quién la hizo y cuándo.
 *
 * No guarda el contenido de la etiqueta —ni su medida ni las copias—, solo qué
 * códigos salieron y de qué tipo: suficiente para reconstruir una impresión
 * indebida sin llenar la tabla de datos que se pueden volver a mirar en la
 * ficha.
 */
export const logLabelPrint = mutation({
  args: {
    kind: v.union(v.literal("equipment"), v.literal("part")),
    /** Los códigos impresos, uno por etiqueta. */
    codes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const user = userId === null ? null : await ctx.db.get(userId);
    // Imprimir una etiqueta es una acción del taller: la hace quien ha entrado,
    // no un visitante anónimo.
    if (!user || user.isAnonymous === true || user.active === false) {
      throw new ConvexError(
        "Solo los miembros del taller pueden imprimir etiquetas.",
      );
    }

    // Un lote de etiquetas es corto; si viniera una lista enorme, se recorta en
    // vez de escribir una fila de auditoría del tamaño de un catálogo.
    const codes = args.codes
      .map((code) => code.trim())
      .filter((code) => code !== "")
      .slice(0, 50);
    if (codes.length === 0) {
      throw new ConvexError(
        "La etiqueta no lleva ningún código que registrar.",
      );
    }

    await logSecurityEvent(ctx, {
      actorId: user._id,
      action: "label_print",
      target: codes.join(", ").slice(0, 300),
      metadata: { kind: args.kind, count: codes.length },
    });
  },
});
