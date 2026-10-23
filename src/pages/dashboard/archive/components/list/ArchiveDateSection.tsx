import { canRestoreEntry } from "./helpers";
import { ArchiveEntryCard } from "./ArchiveEntryCard";
import type { ArchiveDateSectionProps } from "./types";

export function ArchiveDateSection({
  section,
  compact,
  canArchiveIncidents,
  canArchiveRequests,
  busyId,
  onOpenEntry,
  onRestore,
}: ArchiveDateSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2
        data-row-header
        className="flex items-center justify-between gap-2 rounded-md bg-background/85 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm lg:sticky lg:top-0 lg:z-10"
      >
        {section.label}
        <span className="tabular-nums opacity-70">{section.items.length}</span>
      </h2>
      <div className={compact ? "grid gap-2" : "grid gap-3"}>
        {section.items.map((entry) => {
          const canRestore = canRestoreEntry(
            entry.kind,
            canArchiveIncidents,
            canArchiveRequests,
          );
          return (
            <ArchiveEntryCard
              key={`${entry.kind}-${entry.id}`}
              entry={entry}
              compact={compact}
              canRestore={canRestore}
              busy={busyId === entry.id}
              onOpenEntry={onOpenEntry}
              onRestore={onRestore}
            />
          );
        })}
      </div>
    </section>
  );
}
