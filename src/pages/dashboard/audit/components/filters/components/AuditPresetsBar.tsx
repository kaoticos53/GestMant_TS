import { FileDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AUDIT_PRESETS } from "@/lib/audit";
import { isResetDisabled } from "../helpers";
import type { AuditPresetsBarProps } from "../types";

export function AuditPresetsBar({
  activePreset,
  filterCount,
  search,
  sortedCount,
  onApplyPreset,
  onResetFilters,
  onExport,
}: AuditPresetsBarProps) {
  const resetDisabled = isResetDisabled(filterCount, search);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {AUDIT_PRESETS.map((preset) => {
        const active = activePreset === preset.id;
        return (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            aria-pressed={active}
            onClick={() => onApplyPreset(preset.id)}
          >
            {preset.label}
          </Button>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="gap-2"
        disabled={resetDisabled}
        onClick={onResetFilters}
      >
        <RotateCcw className="size-3.5" />
        Reiniciar filtros
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="ml-auto gap-2"
        onClick={onExport}
        disabled={sortedCount === 0}
        title="Descarga en CSV los movimientos del tramo filtrado (persona, fechas y tipo) en el orden que se ve"
      >
        <FileDown className="size-4" />
        Exportar CSV ({sortedCount})
      </Button>
    </div>
  );
}
