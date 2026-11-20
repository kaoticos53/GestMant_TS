import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import { hasAnyCapability, memberStatus } from "./permissions";

const DEFAULT_LIMIT = 80;

export const listByEquipment = query({
  args: {
    equipmentId: v.id("equipment"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const status = await memberStatus(ctx);
    if (!status.user) {
      throw new ConvexError(
        "Debes iniciar sesión con una cuenta activa para consultar desplazamientos de equipos.",
      );
    }
    const allowed = await hasAnyCapability(ctx, status.user, [
      "viewEquipment",
      "manageEquipment",
      "lookupEquipment",
    ]);
    if (!allowed) {
      throw new ConvexError(
        "No tienes permisos para consultar el historial del equipo.",
      );
    }

    const limit = Math.min(200, Math.max(1, args.limit ?? DEFAULT_LIMIT));
    return await ctx.db
      .query("equipmentMovements")
      .withIndex("by_equipment", (q) => q.eq("equipmentId", args.equipmentId))
      .order("desc")
      .take(limit);
  },
});
