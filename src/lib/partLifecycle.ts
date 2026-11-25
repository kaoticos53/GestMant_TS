/**
 * Dominio puro del ciclo de vida de un repuesto en el catálogo:
 * activo, con baja disponibilidad o descatalogado (fuera de fabricación)
 * con posible repuesto equivalente.
 */

export type PartLifecycleStatus =
  | "active"
  | "low_availability"
  | "discontinued";

export const PART_LIFECYCLE_META: Record<
  PartLifecycleStatus,
  { label: string; badgeClassName: string }
> = {
  active: {
    label: "Activo",
    badgeClassName:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  low_availability: {
    label: "Baja disponibilidad",
    badgeClassName:
      "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  discontinued: {
    label: "Descatalogado",
    badgeClassName: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

export function isPartPurchasable(status?: PartLifecycleStatus): boolean {
  return status !== "discontinued";
}

/**
 * Valida que asignar `replacementPartId` a `partId` no genere auto-referencia
 * ni ciclos en la cadena de equivalencias (A -> B -> A).
 */
export function validateReplacementPart(
  partId: string,
  replacementPartId: string | undefined,
  allParts: readonly { _id: string; replacementPartId?: string }[],
): void {
  if (!replacementPartId) return;
  if (replacementPartId === partId) {
    throw new Error("Un repuesto no puede ser equivalente de sí mismo.");
  }

  const nextById = new Map(
    allParts.map((part) => [part._id, part.replacementPartId]),
  );
  const visited = new Set<string>([partId]);
  let cursor: string | undefined = replacementPartId;

  while (cursor) {
    if (visited.has(cursor)) {
      throw new Error(
        "La cadena de equivalencias forma un ciclo: elige otro repuesto.",
      );
    }
    visited.add(cursor);
    cursor = nextById.get(cursor);
  }
}
