import { cn } from "@/lib/utils";
import type { AuditGroupSectionProps } from "../types";
import { AuditMovementRow } from "./AuditMovementRow";

/** Sección agrupada por día con cabecera sticky y lista de movimientos. */
export function AuditGroupSection({
  label,
  compact,
  entries,
  onOpenIncident,
}: AuditGroupSectionProps) {
  return (
    <section className="rounded-xl border border-border/70 bg-card shadow-sm">
      <h3
        data-row-header
        className={cn(
          "rounded-t-[11px] border-b border-border/60 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm lg:sticky lg:top-0 lg:z-10",
          compact ? "px-3 py-1.5" : "px-4 py-2",
        )}
      >
        {label}
      </h3>
      <ul className="divide-y divide-border/60">
        {entries.map((entry) => (
          <AuditMovementRow
            key={entry._id}
            entry={entry}
            compact={compact}
            onOpenIncident={onOpenIncident}
          />
        ))}
      </ul>
    </section>
  );
}
