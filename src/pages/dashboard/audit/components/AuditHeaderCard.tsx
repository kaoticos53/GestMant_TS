import { CalendarDays, FileClock } from "lucide-react";
import { describeAuditRange } from "@/lib/audit";
import type { AuditHeaderCardProps } from "../types";

/** Tarjeta superior con la descripción del módulo y el rango temporal filtrado. */
export function AuditHeaderCard({ rango, audit }: AuditHeaderCardProps) {
  return (
    <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-signal/10 text-signal">
          <FileClock className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">
            Auditoría de documentos
          </h2>
          <p className="mt-0.5 max-w-3xl text-xs leading-5 text-muted-foreground">
            Cada alta, edición, reemplazo de archivo y retirada de un documento
            del expediente, de todas las incidencias y con quién lo firmó. Lo
            retirado ya no está en la ficha —y de un archivo reemplazado tampoco
            queda el anterior—: su movimiento es la única constancia que queda.
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {describeAuditRange(rango)}
              {audit === undefined
                ? ""
                : ` · ${audit.summary.total} de ${audit.unfilteredTotal} movimientos del historial`}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
