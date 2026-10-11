import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { QueryCtx, mutation, query } from "./_generated/server";

/** Sesión iniciada para leer avisos. */
async function requireUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError("Debes iniciar sesión para ver tus notificaciones.");
  }
  return userId;
}

/** Últimos avisos del usuario (más recientes primero). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(30);
  },
});

/** Marca un aviso como leído (solo el propietario). */
export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const notification = await ctx.db.get(args.id);
    if (!notification || notification.userId !== userId) {
      throw new ConvexError("La notificación ya no existe.");
    }
    if (notification.read) return;
    await ctx.db.patch(args.id, { read: true });
  },
});

/** Marca todos los avisos del usuario como leídos. */
export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", userId).eq("read", false),
      )
      .collect();
    for (const notification of unread) {
      await ctx.db.patch(notification._id, { read: true });
    }
    return unread.length;
  },
});
