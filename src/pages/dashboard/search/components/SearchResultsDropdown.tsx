import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuickAction, SearchGroup, SearchHit } from "../types";

export interface SearchResultsDropdownProps {
  open: boolean;
  trimmedQuery: string;
  groups: SearchGroup[];
  quickActions?: QuickAction[];
  safeIndex: number;
  onHoverIndex: (index: number) => void;
  onSelectHit: (hit: SearchHit) => void;
  onRunAction?: (action: QuickAction) => void;
}

export function SearchResultsDropdown({
  open,
  trimmedQuery,
  groups,
  quickActions = [],
  safeIndex,
  onHoverIndex,
  onSelectHit,
  onRunAction,
}: SearchResultsDropdownProps) {
  if (!open || (trimmedQuery.length === 0 && quickActions.length === 0)) {
    return null;
  }

  const visibleGroups = trimmedQuery.length > 0 ? groups : [];
  const totalHits = visibleGroups.reduce(
    (sum, group) => sum + group.hits.length,
    0,
  );
  const hasHits = totalHits > 0;
  const hasActions = quickActions.length > 0;

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-border/70 bg-popover p-1.5 shadow-lg">
      {!hasHits && !hasActions ? (
        <p className="px-3 py-4 text-center text-sm text-muted-foreground">
          Sin resultados para «{trimmedQuery}»
        </p>
      ) : (
        <>
          {visibleGroups.map((group, groupIndex) => {
            const groupOffset = visibleGroups
              .slice(0, groupIndex)
              .reduce((sum, prev) => sum + prev.hits.length, 0);
            return (
              <div key={group.kind} className="mb-1 last:mb-0">
                <p className="flex items-center gap-1.5 px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <group.icon className="size-3" />
                  {group.label}
                </p>
                {group.hits.map((hit, hitIndex) => {
                  const index = groupOffset + hitIndex;
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
            );
          })}

          {hasActions && (
            <div className="mb-1 last:mb-0">
              <p className="flex items-center gap-1.5 px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Zap className="size-3" />
                Acciones rápidas
              </p>
              {quickActions.map((action, actionIndex) => {
                const index = totalHits + actionIndex;
                const active = index === safeIndex;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => onRunAction?.(action)}
                    onMouseEnter={() => onHoverIndex(index)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                      active ? "bg-signal/10" : "hover:bg-muted",
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span
                        className={cn(
                          "truncate text-sm font-medium",
                          active ? "text-signal" : "text-foreground",
                        )}
                      >
                        {action.label}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {action.subtitle}
                      </span>
                    </span>
                    {action.shortcut && (
                      <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                        {action.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
