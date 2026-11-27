import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pendingQuantity } from "@/lib/purchasing";
import type { ReceiveLinesInputsProps } from "../types";

export function ReceiveLinesInputs({
  lines,
  cantidades,
  onChangeCantidad,
  onFillAllPending,
  onClearAllQuantities,
  disabled = false,
}: ReceiveLinesInputsProps) {
  const pendingLines = lines.filter((line) => pendingQuantity(line) > 0);

  return (
    <>
      {pendingLines.length > 0 &&
        (onFillAllPending || onClearAllQuantities) && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {onFillAllPending && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={onFillAllPending}
                disabled={disabled}
              >
                Todo pendiente
              </Button>
            )}
            {onClearAllQuantities && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={onClearAllQuantities}
                disabled={disabled}
              >
                Todo a 0
              </Button>
            )}
          </div>
        )}
      {pendingLines.map((line) => {
        const pending = pendingQuantity(line);
        return (
          <div key={line.purchaseRequestId} className="grid gap-1">
            <Label htmlFor={`cantidad-${line.purchaseRequestId}`}>
              {line.code} · {line.name} — faltan {pending} {line.unit}
            </Label>
            <Input
              id={`cantidad-${line.purchaseRequestId}`}
              type="number"
              min={0}
              max={pending}
              value={cantidades[line.purchaseRequestId] ?? ""}
              onChange={(event) =>
                onChangeCantidad(line.purchaseRequestId, event.target.value)
              }
              disabled={disabled}
            />
          </div>
        );
      })}
    </>
  );
}
