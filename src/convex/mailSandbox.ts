import { v } from "convex/values";
import { MAIL_SANDBOX_LIMIT } from "../lib/mail";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { requireAdmin } from "./permissions";

/**
 * Buzón interno de pruebas y depuración (`mailSandbox`).
 *
 * Cuando el servicio de correo configurado es `sandbox`, todos los correos
 * salientes se guardan aquí completos (remitente, destinatarios, asunto, texto
 * plano y HTML) sin abrir conexiones externas ni enviar mensajes reales.
 */

const originValidator = v.union(
  v.literal("incidencia"),
  v.literal("equipo"),
  v.literal("resumen"),
  v.literal("prueba"),
);

/** Mantiene acotada la tabla eliminando los mensajes más antiguos si supera el límite. */
async function prune(ctx: MutationCtx): Promise<void> {
  const rows = await ctx.db
    .query("mailSandbox")
    .withIndex("by_at")
    .order("asc")
    .take(MAIL_SANDBOX_LIMIT + 50);
  const excess = rows.length - MAIL_SANDBOX_LIMIT;
  if (excess <= 0) return;
  for (const row of rows.slice(0, excess)) {
    await ctx.db.delete(row._id);
  }
}

/** Guarda un correo interceptado en modo pruebas. Solo uso interno desde `_mail/deliver`. */
export const record = internalMutation({
  args: {
    what: v.string(),
    origin: originValidator,
    from: v.string(),
    to: v.array(v.string()),
    bcc: v.array(v.string()),
    replyTo: v.optional(v.string()),
    subject: v.string(),
    text: v.string(),
    html: v.string(),
    relatedId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("mailSandbox", {
      at: Date.now(),
      what: args.what,
      origin: args.origin,
      from: args.from,
      to: args.to,
      bcc: args.bcc,
      ...(args.replyTo === undefined ? {} : { replyTo: args.replyTo }),
      subject: args.subject,
      text: args.text,
      html: args.html,
      ...(args.relatedId === undefined ? {} : { relatedId: args.relatedId }),
    });
    await prune(ctx);
    return id;
  },
});

/** Lista los correos capturados del más reciente al más antiguo. Solo administrador. */
export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, "consultar el buzón interno de pruebas");
    const want = Math.min(
      Math.max(Math.trunc(args.limit ?? 50), 1),
      MAIL_SANDBOX_LIMIT,
    );
    return await ctx.db
      .query("mailSandbox")
      .withIndex("by_at")
      .order("desc")
      .take(want);
  },
});

/** Vacía todos los correos del buzón interno de pruebas. Solo administrador. */
export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx, "vaciar el buzón interno de pruebas");
    const rows = await ctx.db.query("mailSandbox").collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return { deleted: rows.length };
  },
});
