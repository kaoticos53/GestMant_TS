import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import { hasAnyCapability, memberStatus } from "./permissions";

const DEFAULT_LIMIT = 80;

export const listByPart = query({
  args: {
    sparePartId: v.id("spareParts"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const status = await memberStatus(ctx);
    if (!status.user) {
      throw new ConvexError(
        "Debes iniciar sesión con una cuenta activa para consultar movimientos de inventario.",
      );
    }
    const allowed = await hasAnyCapability(ctx, status.user, [
      "viewInventory",
      "manageInventory",
      "lookupCatalog",
    ]);
    if (!allowed) {
      throw new ConvexError(
        "No tienes permisos para consultar el historial de repuestos.",
      );
    }

    const limit = Math.min(200, Math.max(1, args.limit ?? DEFAULT_LIMIT));
    return await ctx.db
      .query("stockMovements")
      .withIndex("by_sparePart", (q) => q.eq("sparePartId", args.sparePartId))
      .order("desc")
      .take(limit);
  },
});

export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const status = await memberStatus(ctx);
    if (!status.user) {
      throw new ConvexError(
        "Debes iniciar sesión con una cuenta activa para consultar movimientos de inventario.",
      );
    }
    const allowed = await hasAnyCapability(ctx, status.user, [
      "viewInventory",
      "manageInventory",
      "lookupCatalog",
    ]);
    if (!allowed) {
      throw new ConvexError(
        "No tienes permisos para consultar los movimientos del almacén.",
      );
    }

    const limit = Math.min(200, Math.max(1, args.limit ?? DEFAULT_LIMIT));
    return await ctx.db
      .query("stockMovements")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);
  },
});
