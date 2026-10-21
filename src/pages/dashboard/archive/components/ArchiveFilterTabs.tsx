import { cn } from "@/lib/utils";
import type { ArchiveKind } from "../types";

export interface ArchiveFilterTabsProps {
  kind: ArchiveKind;
  onKindChange: (kind: ArchiveKind) => void;
  counts: Record<ArchiveKind, number>;
}

const KIND_FILTERS: { id: ArchiveKind; label: string }[] = [
  { id: "all", label: "Todo" },
  { id: "incident", label: "Incidencias" },
  { id: "request", label: "Peticiones" },
];

export function ArchiveFilterTabs({
  kind,
  onKindChange,
  counts,
}: ArchiveFilterTabsProps) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-border/70 bg-card p-1 shadow-sm">
      {KIND_FILTERS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onKindChange(option.id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            kind === option.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
          <span className="ml-1.5 text-xs tabular-nums opacity-70">
            {counts[option.id]}
          </span>
        </button>
      ))}
    </div>
  );
}
