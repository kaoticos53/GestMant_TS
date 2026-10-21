import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/workshop";
import { Plus, Wrench } from "lucide-react";
import type { EnrichedRequestLine } from "../../hooks/useRequestLinesStock";

export interface RequestLinesCardProps {
  enrichedLines: EnrichedRequestLine[];
  noReference: boolean;
  canManage: boolean;
  canEdit: boolean;
  showStock: boolean;
  onAssociate?: () => void;
}

export function RequestLinesCard({
  enrichedLines,
  noReference,
  canManage,
  canEdit,
  showStock,
  onAssociate,
}: RequestLinesCardProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Repuestos solicitados
        </p>
        {canManage && canEdit && !noReference && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={onAssociate}
          >
            <Plus className="size-3.5" />
            Asociar otro
          </Button>
        )}
      </div>

      {noReference ? (
        <div className="mt-3 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-4 text-center">
          <p className="text-sm font-medium text-amber-800">
            Todavía sin repuesto asociado
          </p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-amber-800/80">
            Busca el proveedor y el part number a partir de la descripción, y
            asocia el repuesto del catálogo o crea uno nuevo.
          </p>
          {canManage && canEdit && (
            <Button
              type="button"
              size="sm"
              className="mt-3 gap-1.5"
              onClick={onAssociate}
            >
              <Wrench className="size-3.5" />
              Asociar repuesto
            </Button>
          )}
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border/70">
          {enrichedLines.map((line) => (
            <li
              key={line.sparePartId}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{line.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {line.code}
                  {line.partNumber ? ` · ${line.partNumber}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">
                  pedido ×{line.quantity}
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {line.deliveredQuantity > 0
                    ? `entregado ×${line.deliveredQuantity}${
                        line.remainingQuantity > 0
                          ? ` · faltan ×${line.remainingQuantity}`
                          : ""
                      }`
                    : "sin entregar"}
                </p>
                {line.deliveredAt !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(line.deliveredAt)}
                  </p>
                )}
                {showStock && (
                  <p
                    className={cn(
                      "text-xs tabular-nums",
                      line.hasShortage
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {line.part
                      ? `stock ${line.part.stock} ${line.part.unit}`
                      : "no está en catálogo"}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
