import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DataTableToolbarResetProps } from "../types";

export function DataTableToolbarReset({
  onResetFilters,
  resetFiltersLabel = "Limpiar filtros",
}: DataTableToolbarResetProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onResetFilters}
      className="h-9 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
      title={resetFiltersLabel}
    >
      <RotateCcw className="size-3.5" aria-hidden="true" />
      {resetFiltersLabel}
    </Button>
  );
}
