import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play } from "lucide-react";
import type { AutomaticArchiveControlsProps } from "../types";

export function AutomaticArchiveControls({
  autoMonths,
  autoOptions,
  disabled,
  running,
  pendingTotal,
  onChangeMonths,
  onRunNow,
}: AutomaticArchiveControlsProps) {
  return (
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label
          htmlFor="ajustes-archivo-antiguedad"
          className="text-xs text-muted-foreground"
        >
          Antigüedad
        </Label>
        <Select
          value={String(autoMonths)}
          disabled={disabled}
          onValueChange={(value) => onChangeMonths(Number(value))}
        >
          <SelectTrigger id="ajustes-archivo-antiguedad" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {autoOptions.map((option) => (
              <SelectItem key={option.months} value={String(option.months)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        className="gap-2"
        disabled={running || disabled}
        onClick={onRunNow}
      >
        <Play className="size-4" />
        {running
          ? "Archivando..."
          : pendingTotal > 0
            ? `Ejecutar ahora (${pendingTotal})`
            : "Ejecutar ahora"}
      </Button>
    </div>
  );
}
