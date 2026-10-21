import { FileText, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/workshop";
import type { ReceptionDoc } from "../types";

export interface MovementsSectionProps {
  receptions: ReceptionDoc[];
}

/** Movimientos de recepción: cada entrada de un proveedor con su albarán. */
export function MovementsSection({ receptions }: MovementsSectionProps) {
  if (receptions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
          <Truck className="size-5" />
        </span>
        <p className="mt-4 text-base font-semibold tracking-tight">
          No ha entrado material todavía
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
          Cada entrada de un proveedor deja aquí su movimiento con el albarán
          adjunto, y es lo que mete el stock en el almacén.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {receptions.map((row) => (
        <Card key={row._id}>
          <CardContent className="grid gap-2 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {row.orderReference} · {row.supplier}
              </p>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(row.receivedAt)} · {row.receivedBy}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {row.lines
                .map((line) => `${line.code} · ${line.name} × ${line.quantity}`)
                .join(" · ")}
            </p>
            {row.note && (
              <p className="text-xs text-muted-foreground">{row.note}</p>
            )}
            {row.deliveryNoteUrl ? (
              <a
                href={row.deliveryNoteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-1 text-xs text-signal underline"
              >
                <FileText className="size-3" />
                {row.deliveryNote.name}
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">
                {row.deliveryNote.name} (ya no está disponible)
              </span>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
