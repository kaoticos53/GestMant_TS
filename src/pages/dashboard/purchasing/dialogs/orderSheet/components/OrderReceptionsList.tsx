import { FileText } from "lucide-react";
import { formatDateTime } from "@/lib/workshop";
import { formatReceptionLinesSummary } from "../helpers";
import type { OrderReceptionsListProps } from "../types";

export function OrderReceptionsList({
  receptions,
}: OrderReceptionsListProps) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Recepciones</p>
      {receptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no ha entrado nada de esta orden.
        </p>
      ) : (
        receptions.map((row) => (
          <div
            key={row._id}
            className="grid gap-1 rounded-lg border border-border px-3 py-2 text-sm"
          >
            <span>
              {formatDateTime(row.receivedAt)} · {row.receivedBy}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatReceptionLinesSummary(row.lines)}
            </span>
            {row.deliveryNoteUrl ? (
              <a
                href={row.deliveryNoteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-signal underline"
              >
                <FileText className="size-3" />
                {row.deliveryNote.name}
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">
                {row.deliveryNote.name} (ya no está disponible)
              </span>
            )}
          </div>
        ))
      )}
    </div>
  );
}
