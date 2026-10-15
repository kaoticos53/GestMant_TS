import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { hasAnyCapability, hasCapability } from "../permissions";

/** Toda la gestión de compras requiere sesión iniciada. */
export async function requireUser(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError("Debes iniciar sesión para gestionar las compras.");
  }
  const user = await ctx.db.get(userId);
  if (!user || user.active === false || user.isAnonymous === true) {
    throw new ConvexError(
      user?.active === false
        ? "Esta cuenta ha sido dada de baja o no está activa."
        : "Debes iniciar sesión con una cuenta registrada para gestionar las compras.",
    );
  }
  return userId;
}

/** Comprar y recepcionar: capacidad «managePurchasing» (el admin siempre). */
export async function requirePurchasing(
  ctx: QueryCtx,
  action: string,
): Promise<Id<"users">> {
  const userId = await requireUser(ctx);
  const user = await ctx.db.get(userId);
  if (!user || !(await hasCapability(ctx, user, "managePurchasing"))) {
    throw new ConvexError(
      `No tienes permisos para ${action}. Revisa la configuración de tu rol con el administrador.`,
    );
  }
  return userId;
}

/** Leer las compras: «viewPurchasing» o «managePurchasing» bastan. */
export async function requireReading(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await requireUser(ctx);
  const user = await ctx.db.get(userId);
  if (
    !user ||
    !(await hasAnyCapability(ctx, user, ["viewPurchasing", "managePurchasing"]))
  ) {
    throw new ConvexError(
      "No tienes permisos para ver las compras. Revisa la configuración de tu rol con el administrador.",
    );
  }
  return userId;
}

/** Nombre visible de quien firma una decisión de compra. */
export async function actorName(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<string> {
  const user = await ctx.db.get(userId);
  return user?.name || user?.email || "Responsable de repuestos";
}

/** El proveedor con el que se agrupa: si el repuesto no dice ninguno, se pide. */
export const NO_SUPPLIER = "Sin proveedor";

/**
 * Las líneas de una petición que el almacén **no** puede cubrir: las que piden
 * más de lo que hay (los repuestos nuevos nacen con stock cero, así que entran
 * por aquí solas). Devuelve también por qué falta cada una, que es lo que se
 * apunta en la petición de compra.
 */
export type MissingLine = {
  sparePartId: Id<"spareParts">;
  code: string;
  name: string;
  unit: string;
  supplier: string;
  quantity: number;
  reason: "noStock" | "newPart";
};

export async function missingLines(
  ctx: QueryCtx,
  request: {
    lines: { sparePartId: Id<"spareParts">; quantity: number }[];
  },
  only?: Id<"spareParts">[],
): Promise<MissingLine[]> {
  const wanted = only ? new Set(only) : null;
  const missing: MissingLine[] = [];
  for (const line of request.lines) {
    if (wanted && !wanted.has(line.sparePartId)) continue;
    const part = await ctx.db.get(line.sparePartId);
    if (!part) {
      throw new ConvexError(
        `El repuesto ${line.sparePartId} ya no está en el catálogo: no se puede comprar.`,
      );
    }
    const falta = line.quantity - part.stock;
    if (falta <= 0) continue;
    missing.push({
      sparePartId: part._id,
      code: part.code,
      name: part.name,
      unit: part.unit,
      supplier: part.supplier?.trim() || NO_SUPPLIER,
      quantity: falta,
      // Un repuesto recién dado de alta en la petición nace sin stock: no es
      // que se haya agotado, es que nunca ha estado en el almacén.
      reason: part.stock === 0 ? "newPart" : "noStock",
    });
  }
  return missing;
}
