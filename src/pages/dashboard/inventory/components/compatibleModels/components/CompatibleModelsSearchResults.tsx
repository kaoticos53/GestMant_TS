import { Plus } from "lucide-react";
import { modelLabel } from "../helpers";
import type { CompatibleModelsSearchResultsProps } from "../types";

export function CompatibleModelsSearchResults({
  matches,
  disabled,
  onSelectModel,
}: CompatibleModelsSearchResultsProps) {
  if (matches.length === 0) return null;

  return (
    <ul
      aria-label="Modelos que coinciden"
      className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm"
    >
      {matches.map((item) => (
        <li key={item._id}>
          <button
            type="button"
            onClick={() => onSelectModel(item._id)}
            disabled={disabled}
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/60"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium text-foreground">
                {modelLabel(item)}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {item.name}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
              {item.category && <span>{item.category}</span>}
              <Plus className="size-3.5" />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
