import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/workshop";
import { ArchiveRestore, Eye } from "lucide-react";
import { KIND_META } from "../../types";
import type { ArchiveEntryCardProps } from "./types";

export function ArchiveEntryCard({
  entry,
  compact,
  canRestore,
  busy,
  onOpenEntry,
  onRestore,
}: ArchiveEntryCardProps) {
  const kindMeta = KIND_META[entry.kind];

  return (
    <article
      data-row
      className={cn(
        "flex flex-wrap items-start gap-3 rounded-xl border border-border/70 bg-card shadow-sm transition-colors hover:border-signal/30",
        compact ? "p-3" : "p-4",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <kindMeta.icon className="size-4" />
      </span>

      <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-muted-foreground">
            {entry.reference}
          </span>
          <Badge variant="outline" className={entry.statusClassName}>
            {entry.statusLabel}
          </Badge>
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {kindMeta.label}
          </span>
        </div>
        <p className="text-sm font-medium leading-5">{entry.title}</p>
        {!compact && entry.subtitle !== "" && (
          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
            {entry.subtitle}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Archivada el {formatDateTime(entry.date)}
          {entry.archivedBy ? ` por ${entry.archivedBy}` : ""}
        </p>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-2"
        onClick={() => onOpenEntry({ kind: entry.kind, id: entry.id })}
      >
        <Eye className="size-4" />
        Ver ficha
      </Button>
      {canRestore && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={busy}
          onClick={() => void onRestore(entry)}
        >
          <ArchiveRestore className="size-4" />
          Recuperar
        </Button>
      )}
    </article>
  );
}
