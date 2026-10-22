import { cn } from "@/lib/utils";
import { DENSITY_OPTIONS } from "../helpers";
import type { DataTableToolbarDensityProps } from "../types";

export function DataTableToolbarDensity({
  isCompact,
  densityAriaLabel = "Densidad de la tabla",
  onToggleDensity,
}: DataTableToolbarDensityProps) {
  return (
    <div
      role="group"
      aria-label={densityAriaLabel}
      className="inline-flex items-center rounded-md border border-border/70 bg-card p-0.5 shadow-xs"
    >
      {DENSITY_OPTIONS.map((option) => {
        const active = isCompact === option.compactValue;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggleDensity(option.compactValue)}
            title={option.description}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <option.icon className="size-3.5" aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
