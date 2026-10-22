import { CircleAlert, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatShortagePurchasesHint } from "../helpers";
import type { DecisionStockApprovalPanelProps } from "../types";

export function DecisionStockApprovalPanel({
  lines,
  partById,
  shortages,
  compradas,
  canPurchase,
  busy,
  onPurchase,
}: DecisionStockApprovalPanelProps) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Stock al aprobar
      </p>
      <ul className="mt-2 space-y-1.5">
        {lines.map((line) => {
          const part = partById.get(line.sparePartId);
          const remaining = (part?.stock ?? 0) - line.quantity;
          const hasShortage = !part || remaining < 0;
          return (
            <li
              key={line.sparePartId}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="truncate">
                <span className="font-mono text-xs">{line.code}</span>{" "}
                <span className="text-muted-foreground">{line.name}</span>
              </span>
              <span
                className={cn(
                  "shrink-0 tabular-nums",
                  hasShortage
                    ? "font-semibold text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {part?.stock ?? 0} − {line.quantity} ={" "}
                <span className="font-semibold text-foreground">
                  {Math.max(remaining, 0)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {shortages.length > 0 && (
        <div className="mt-3 grid gap-2 rounded-md bg-destructive/10 px-2.5 py-2 text-xs leading-5 text-destructive">
          <p className="flex items-start gap-2">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
            {formatShortagePurchasesHint(shortages.length, compradas)}
          </p>
          {canPurchase && compradas < shortages.length && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit gap-2"
              disabled={busy}
              onClick={onPurchase}
            >
              <ShoppingCart className="size-4" />
              Comprar lo que falta
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
