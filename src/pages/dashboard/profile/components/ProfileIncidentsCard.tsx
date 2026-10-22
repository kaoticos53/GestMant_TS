import { Badge } from "@/components/ui/badge";
import { INCIDENT_STATUS_META, formatRelativeTime } from "@/lib/workshop";
import { ArrowRight } from "lucide-react";
import type { ProfileIncidentsCardProps } from "../types";

/** Tarjeta con el listado de incidencias asignadas recientemente al usuario. */
export function ProfileIncidentsCard({
  incidents,
  onOpenIncidents,
}: ProfileIncidentsCardProps) {
  return (
    <section className="rounded-xl border border-border/70 bg-card shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <h3 className="text-sm font-semibold">Mis incidencias</h3>
        <button
          type="button"
          onClick={onOpenIncidents}
          className="flex items-center gap-1 text-xs font-medium text-signal hover:underline"
        >
          Ver cola
          <ArrowRight className="size-3.5" />
        </button>
      </header>
      {incidents.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          No tienes ninguna incidencia asignada todavía.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {incidents.map((incident) => {
            const meta = INCIDENT_STATUS_META[incident.status];
            return (
              <li key={incident._id}>
                <button
                  type="button"
                  onClick={onOpenIncidents}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                >
                  <span className="font-mono text-xs font-semibold text-muted-foreground">
                    {incident.reference}
                  </span>
                  <Badge variant="outline" className={meta.badgeClassName}>
                    {meta.label}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {incident.equipmentKind} · {incident.model}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(incident.updatedAt)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
