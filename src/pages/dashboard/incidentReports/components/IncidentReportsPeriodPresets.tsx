import { Button } from "@/components/ui/button";
import { REPORT_PERIODS } from "@/lib/report";
import type { IncidentReportsPeriodPresetsProps } from "../types";

export function IncidentReportsPeriodPresets({
  activePreset,
  onSelectPreset,
}: IncidentReportsPeriodPresetsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {REPORT_PERIODS.map((preset) => {
        const active = activePreset === preset.id;
        return (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            aria-pressed={active}
            onClick={() => onSelectPreset(preset.id)}
          >
            {preset.label}
          </Button>
        );
      })}
    </div>
  );
}
