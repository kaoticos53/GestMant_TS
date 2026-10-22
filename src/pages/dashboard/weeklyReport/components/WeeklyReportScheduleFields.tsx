import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { WEEKDAY_OPTIONS } from "@/lib/weeklyReport";
import { formatScheduleNotice } from "../helpers";
import type { WeeklyReportScheduleFieldsProps } from "../types";

export function WeeklyReportScheduleFields({
  enabled,
  weekday,
  disabled,
  onEnabledChange,
  onWeekdayChange,
}: WeeklyReportScheduleFieldsProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-border/70 p-3">
      <div className="flex items-center gap-3">
        <Switch
          checked={enabled}
          aria-label="Enviar el resumen cada semana"
          onCheckedChange={onEnabledChange}
          disabled={disabled}
        />
        <div>
          <p className="text-sm font-medium">
            {enabled ? "Resumen activado" : "Resumen apagado"}
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            {formatScheduleNotice(enabled, Number(weekday))}
          </p>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label
          htmlFor="resumen-dia"
          className="text-xs text-muted-foreground"
        >
          Día del envío
        </Label>
        <Select
          value={weekday}
          disabled={disabled}
          onValueChange={onWeekdayChange}
        >
          <SelectTrigger id="resumen-dia" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEEKDAY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
