import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";

/** Tiempo mínimo entre reenvíos de OTP a la misma dirección (30 segundos). */
export const OTP_RESEND_COOLDOWN_MS = 30_000;

/** Ventana tras la cual la marca de envío caduca y puede purgarse (1 hora). */
export const OTP_LIMIT_TTL_MS = 60 * 60 * 1000;

const PURGE_LIMIT = 100;

/**
 * Evita ráfagas de envío OTP (*OTP bombing*) sobre la misma dirección de correo.
 */
export const admitSend = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const now = Date.now();
    const existing = await ctx.db
      .query("otpSendLimits")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing !== null && now - existing.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.max(
        1,
        Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000),
      );
      throw new ConvexError(
        `Ya se ha enviado un código recientemente. Espera ${waitSeconds} segundos antes de pedir otro.`,
      );
    }

    if (existing === null) {
      await ctx.db.insert("otpSendLimits", { email, lastSentAt: now });
    } else {
      await ctx.db.patch(existing._id, { lastSentAt: now });
    }
  },
});

/** Limpieza nocturna de marcas OTP caducadas. */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - OTP_LIMIT_TTL_MS;
    const rows = await ctx.db
      .query("otpSendLimits")
      .withIndex("by_lastSentAt", (q) => q.lte("lastSentAt", cutoff))
      .take(PURGE_LIMIT);
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return rows.length;
  },
});

