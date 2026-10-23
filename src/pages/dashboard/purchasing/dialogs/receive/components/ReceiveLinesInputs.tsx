import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pendingQuantity } from "@/lib/purchasing";
import type { ReceiveLinesInputsProps } from "../types";

export function ReceiveLinesInputs({
  lines,
  cantidades,
  onChangeCantidad,
  disabled = false,
}: ReceiveLinesInputsProps) {
  const pendingLines = lines.filter((line) => pendingQuantity(line) > 0);

  return (
    <>
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
