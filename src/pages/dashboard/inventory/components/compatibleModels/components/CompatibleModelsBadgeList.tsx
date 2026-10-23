import { X } from "lucide-react";
import { modelLabel } from "../helpers";
import type { CompatibleModelsBadgeListProps } from "../types";

export function CompatibleModelsBadgeList({
  models,
  disabled,
  onRemoveModel,
}: CompatibleModelsBadgeListProps) {
  if (models.length === 0) {
    return (
      <p className="text-xs leading-5 text-muted-foreground">
        Ningún modelo asociado todavía.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {models.map((item) => (
        <button
          key={item._id}
          type="button"
          onClick={() => onRemoveModel(item._id)}
          disabled={disabled}
          title="Quitar modelo compatible"
          aria-label={`Quitar ${modelLabel(item)}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-signal bg-signal/10 px-3 py-1 text-xs font-medium text-signal transition-colors hover:border-destructive/40 hover:text-destructive"
        >
          {modelLabel(item)}
          <X className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
