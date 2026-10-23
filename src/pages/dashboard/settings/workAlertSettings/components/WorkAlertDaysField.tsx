import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_WORK_WITHOUT_TRACE_DAYS,
  MIN_WORK_WITHOUT_TRACE_DAYS,
} from "@/lib/workshop";
import { formatDaysHelpText } from "../helpers";
import type { WorkAlertDaysFieldProps } from "../types";

export function WorkAlertDaysField({
  days,
  daysValid,
  value,
  disabled,
  onChangeDays,
}: WorkAlertDaysFieldProps) {
  return (
    <div className="mt-4 grid gap-2">
      <Label htmlFor="ajustes-aviso-margen" className="text-sm">
        Margen sin constancia (días)
      </Label>
      <Input
        id="ajustes-aviso-margen"
        type="number"
        inputMode="numeric"
        min={MIN_WORK_WITHOUT_TRACE_DAYS}
        max={MAX_WORK_WITHOUT_TRACE_DAYS}
        step={1}
        value={days}
        disabled={disabled}
        onChange={(event) => onChangeDays(event.target.value)}
        className="w-28"
      />
      <p className="text-xs leading-5 text-muted-foreground">
        {formatDaysHelpText(daysValid, value)}
      </p>
    </div>
  );
}
