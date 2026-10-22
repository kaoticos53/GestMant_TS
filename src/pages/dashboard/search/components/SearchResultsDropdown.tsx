import { cn } from "@/lib/utils";
import type { SearchGroup, SearchHit } from "../types";

export interface SearchResultsDropdownProps {
  open: boolean;
  trimmedQuery: string;
  groups: SearchGroup[];
  safeIndex: number;
  onHoverIndex: (index: number) => void;
  onSelectHit: (hit: SearchHit) => void;
}

export function SearchResultsDropdown({
  open,
  trimmedQuery,
  groups,
  safeIndex,
  onHoverIndex,
  onSelectHit,
}: SearchResultsDropdownProps) {
  if (!open || trimmedQuery.length === 0) {
    return null;
  }

  const hasHits = groups.some((group) => group.hits.length > 0);
  let runningIndex = -1;

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-border/70 bg-popover p-1.5 shadow-lg">
      {!hasHits ? (
        <p className="px-3 py-4 text-center text-sm text-muted-foreground">
          Sin resultados para «{trimmedQuery}»
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.kind} className="mb-1 last:mb-0">
            <p className="flex items-center gap-1.5 px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <group.icon className="size-3" />
              {group.label}
            </p>
            {group.hits.map((hit) => {
              runningIndex += 1;
              const index = runningIndex;
              const active = index === safeIndex;
              return (
                <button
                  key={`${hit.kind}-${hit.id}`}
                  type="button"
                  onClick={() => onSelectHit(hit)}
                  onMouseEnter={() => onHoverIndex(index)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                    active ? "bg-signal/10" : "hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "truncate text-sm font-medium",
                      active ? "text-signal" : "text-foreground",
                    )}
                  >
                    {hit.title}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {hit.subtitle}
                  </span>
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
