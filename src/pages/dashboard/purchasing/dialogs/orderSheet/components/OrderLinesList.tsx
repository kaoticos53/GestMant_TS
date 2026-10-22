import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isPurchaseOrderClosed } from "@/lib/purchaseFlow";
import { pendingQuantity } from "@/lib/purchasing";
import { formatDate } from "@/lib/workshop";
import type { OrderLinesListProps } from "../types";

export function OrderLinesList({
  lines,
  canManage,
  orderStatus,
  editando,
  nota,
  onStartEditingNote,
  onChangeNote,
  onSaveNote,
}: OrderLinesListProps) {
  const isClosed = isPurchaseOrderClosed(orderStatus);

  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Artículos</p>
      {lines.map((line) => {
        const pending = pendingQuantity(line);
        const isEditingThisLine = editando === line.purchaseRequestId;

        return (
          <div
            key={line.purchaseRequestId}
            className="grid gap-1 rounded-lg border border-border px-3 py-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {line.code} · {line.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {line.receivedQuantity}/{line.quantity} {line.unit}
                {pending > 0 && ` · faltan ${pending}`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Desde {line.requestReference} · {formatDate(line.requestDate)}
            </p>
            {isEditingThisLine ? (
              <div className="flex gap-2">
                <Input
                  value={nota}
                  onChange={(event) => onChangeNote(event.target.value)}
                  placeholder="Nota de este artículo"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onSaveNote(line)}
                >
                  <Check className="size-4" />
                </Button>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                {line.note ?? "Sin nota"}
                {canManage && !isClosed && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() =>
                      onStartEditingNote(
                        line.purchaseRequestId,
                        line.note ?? "",
                      )
                    }
                  >
                    Editar
                  </Button>
                )}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
