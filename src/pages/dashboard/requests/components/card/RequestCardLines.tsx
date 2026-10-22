import { Wrench } from "lucide-react";
import type { RequestCardLinesProps } from "./types";

export function RequestCardLines({
  lines,
  noReference,
  canEdit,
  compact,
}: RequestCardLinesProps) {
  return (
    <>
      {lines.length > 0 && !compact && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {lines.map((line) => (
            <li
              key={line.sparePartId}
              className="flex max-w-full items-center gap-2 rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1.5 text-xs"
            >
              <span className="font-mono font-medium">{line.code}</span>
              <span className="max-w-[14ch] truncate text-muted-foreground sm:max-w-[24ch]">
                {line.name}
              </span>
              <span className="font-semibold tabular-nums">
                ×{line.quantity}
              </span>
            </li>
          ))}
        </ul>
      )}

      {noReference && canEdit && !compact && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-amber-900 dark:text-amber-200">
          <Wrench className="mt-0.5 size-3.5 shrink-0" />
          Petición sin repuesto: investiga el proveedor y su nº de parte antes
          de aprobar.
        </p>
      )}
    </>
  );
}
