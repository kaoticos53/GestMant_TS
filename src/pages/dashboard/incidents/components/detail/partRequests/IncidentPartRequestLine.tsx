import type { IncidentPartRequestLineProps } from "./types";
import { getLineProgress, untouchedLineLabel } from "./helpers";

export function IncidentPartRequestLine({
  line,
  requestStatus,
  material,
}: IncidentPartRequestLineProps) {
  const { delivered, remaining } = getLineProgress(line, requestStatus);

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5">
      <span className="min-w-0 truncate">
        <span className="font-mono text-xs text-muted-foreground">
          {line.code}
        </span>{" "}
        {line.name}
      </span>
      <span className="shrink-0 text-xs tabular-nums">
        <span className="text-muted-foreground">pedido </span>
        <span className="font-semibold text-foreground">
          ×{line.quantity}
        </span>
        <span className="text-muted-foreground">{" · "}</span>
        {delivered > 0 ? (
          <>
            <span className="text-muted-foreground">entregado </span>
            <span className="font-semibold text-foreground">
              ×{delivered}
            </span>
            {remaining > 0 && (
              <>
                <span className="text-muted-foreground">
                  {" · faltan "}
                </span>
                <span className="font-semibold text-foreground">
                  ×{remaining}
                </span>
              </>
            )}
            {material === "returned" && (
              <span className="text-muted-foreground">
                {" · devuelto"}
              </span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">
            {untouchedLineLabel(material)}
          </span>
        )}
      </span>
    </li>
  );
}
