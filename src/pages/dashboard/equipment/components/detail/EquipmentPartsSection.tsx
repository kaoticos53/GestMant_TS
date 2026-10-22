import { Badge } from "@/components/ui/badge";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { STOCK_META, stockState } from "@/lib/workshop";
import { Boxes } from "lucide-react";

interface EquipmentPartsSectionProps {
  compatible: Doc<"spareParts">[];
}

/**
 * Sección de repuestos compatibles con el equipo y sus niveles de stock actuales.
 */
export function EquipmentPartsSection({
  compatible,
}: EquipmentPartsSectionProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Boxes className="size-3.5" />
        Repuestos compatibles
      </p>
      {compatible.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
          Ningún repuesto está marcado como compatible con este equipo todavía.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border/70">
          {compatible.map((part) => {
            const meta = STOCK_META[stockState(part.stock, part.minStock)];
            return (
              <li
                key={part._id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{part.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {part.code}
                    {part.partNumber ? ` · ${part.partNumber}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {part.stock}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {part.unit}
                    </span>
                  </p>
                  <Badge
                    variant="outline"
                    className={cn("mt-1", meta.badgeClassName)}
                  >
                    {meta.label}
                  </Badge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
