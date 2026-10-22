import { Input } from "@/components/ui/input";
import { lineRemaining } from "@/lib/requestFlow";
import { clampDeliveryQuantity } from "../helpers";
import type { DecisionIssueBatchPanelProps } from "../types";

export function DecisionIssueBatchPanel({
  lines,
  requestStatus,
  entrega,
  busy,
  onChangeDelivery,
}: DecisionIssueBatchPanelProps) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Qué se entrega en esta tanda
      </p>
      <ul className="mt-2 space-y-2">
        {lines.map((line) => {
          const remaining = lineRemaining(line, requestStatus);
          const quantity = entrega[line.sparePartId] ?? 0;
          return (
            <li
              key={line.sparePartId}
              className="flex items-center justify-between gap-3"
            >
              <span className="min-w-0 text-sm">
                <span className="font-mono text-xs">{line.code}</span>{" "}
                <span className="text-muted-foreground">{line.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {remaining === 0
                    ? "ya está entregado"
                    : `quedan ${remaining} por entregar`}
                </span>
              </span>
              <Input
                type="number"
                min={0}
                max={remaining}
                inputMode="numeric"
                aria-label={`Unidades de ${line.name} que se entregan`}
                className="w-20 shrink-0 text-right tabular-nums"
                value={quantity}
                disabled={busy || remaining === 0}
                onChange={(event) => {
                  const clamped = clampDeliveryQuantity(
                    Number(event.target.value),
                    remaining,
                  );
                  onChangeDelivery(line.sparePartId, clamped);
                }}
              />
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Lo que quede a cero sigue en el almacén: la petición no se da por
        entregada hasta que se haya sacado todo.
      </p>
    </div>
  );
}
