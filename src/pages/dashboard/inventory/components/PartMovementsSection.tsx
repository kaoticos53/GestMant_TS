import { Boxes, History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Doc } from "@/convex/_generated/dataModel";
import { STOCK_MOVEMENT_META, type StockMovementKind } from "@/lib/movements";
import { formatDateTime } from "@/lib/workshop";

export interface PartMovementsSectionProps {
  unit: string;
  movements: Doc<"stockMovements">[] | undefined;
}

export function PartMovementsSection({
  unit,
  movements,
}: PartMovementsSectionProps) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <History className="size-3.5" />
        Últimos movimientos de stock
      </h3>
      {movements === undefined ? (
        <div className="space-y-2" aria-label="Cargando movimientos">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      ) : movements.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <Boxes className="size-4 shrink-0" />
          <span>Sin movimientos registrados para este repuesto.</span>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {movements.map((mov) => {
            const kindMeta =
              STOCK_MOVEMENT_META[mov.kind as StockMovementKind] ?? {
                label: mov.kind,
                signTone: "neutral",
              };
            const signedDelta =
              mov.delta > 0 ? `+${mov.delta}` : String(mov.delta);
            return (
              <li
                key={mov._id}
                className="flex items-start justify-between gap-3 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-medium">{kindMeta.label}</p>
                  <p className="truncate text-muted-foreground">
                    {mov.actorName}
                    {mov.reason ? ` · ${mov.reason}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDateTime(mov.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <span
                    className={
                      mov.delta > 0
                        ? "font-semibold text-emerald-600 dark:text-emerald-400"
                        : mov.delta < 0
                          ? "font-semibold text-rose-600 dark:text-rose-400"
                          : "font-semibold"
                    }
                  >
                    {signedDelta} {unit}
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    {mov.previousStock} → {mov.nextStock}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
