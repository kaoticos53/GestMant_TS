import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock } from "lucide-react";
import { CUTOFF_OPTIONS } from "../../../types";
import type { BulkArchiveHeaderProps } from "../types";

export function BulkArchiveHeader({
  cutoffMonths,
  onCutoffChange,
}: BulkArchiveHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <CalendarClock className="size-4" />
        </span>
        <div>
          <p className="text-sm font-semibold tracking-tight">
            Archivar lo antiguo a mano
          </p>
          <p className="mt-0.5 max-w-xl text-xs leading-5 text-muted-foreground">
            Elige una antigüedad y mándalo al archivo ahora mismo; no cambia
            el automático. Solo entra lo terminado, y una ficha concreta se
            archiva desde su propio detalle.
          </p>
        </div>
      </div>
      <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
        <div className="grid gap-1.5">
          <Label
            htmlFor="archivo-antiguedad"
            className="text-xs text-muted-foreground"
          >
            Antigüedad
          </Label>
          <Select
            value={cutoffMonths}
            onValueChange={onCutoffChange}
          >
            <SelectTrigger id="archivo-antiguedad" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CUTOFF_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
