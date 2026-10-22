import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import type { AssociateMode } from "../types";

export interface AssociateModeToggleProps {
  mode: AssociateMode;
  onChange: (mode: AssociateMode) => void;
  disabled?: boolean;
}

export function AssociateModeToggle({
  mode,
  onChange,
  disabled = false,
}: AssociateModeToggleProps) {
  return (
    <div className="grid gap-2">
      <Label>Origen del repuesto</Label>
      <div className="inline-flex w-fit rounded-lg border border-border/70 bg-card p-1 shadow-sm">
        <button
          type="button"
          onClick={() => onChange("existing")}
          disabled={disabled}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "existing"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Catálogo existente
        </button>
        <button
          type="button"
          onClick={() => onChange("new")}
          disabled={disabled}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "new"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Investigación nueva
        </button>
      </div>
    </div>
  );
}
