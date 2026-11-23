import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { normalizeCatalogString } from "../../lib/catalogs";

/**
 * Resuelve el `Id<"catalogs">` canónico correspondiente a un nombre (p. ej. proveedor o SAT)
 * usando el índice `by_kind_normalized`, devolviendo `undefined` si aún no existe.
 */
export async function resolveCatalogId(
  ctx: QueryCtx | MutationCtx,
  kind: Exclude<Doc<"catalogs">["kind"], "location">,
  name: string | undefined,
): Promise<Id<"catalogs"> | undefined> {
  const clean = name?.trim();
  if (!clean) return undefined;
  const normalized = normalizeCatalogString(clean);
  if (!normalized) return undefined;
  const match = await ctx.db
    .query("catalogs")
    .withIndex("by_kind_normalized", (q) =>
      q.eq("kind", kind).eq("normalized", normalized),
    )
    .first();
  return match?._id;
}
