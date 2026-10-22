import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REPORT_PERIOD_BASES,
  type ReportPeriodBasis,
} from "@/lib/report";
import type { IncidentReportsDateRangeFieldsProps } from "../types";

export function IncidentReportsDateRangeFields({
  from,
  to,
  basis,
  onChangeFrom,
  onChangeTo,
  onChangeBasis,
}: IncidentReportsDateRangeFieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="grid gap-1.5">
        <Label
          htmlFor="lote-desde"
          className="text-xs text-muted-foreground"
        >
          Desde
        </Label>
        <Input
          id="lote-desde"
          type="date"
          value={from}
          onChange={(event) => onChangeFrom(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label
          htmlFor="lote-hasta"
          className="text-xs text-muted-foreground"
        >
          Hasta
        </Label>
        <Input
          id="lote-hasta"
          type="date"
          value={to}
          onChange={(event) => onChangeTo(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label
          htmlFor="lote-base"
          className="text-xs text-muted-foreground"
        >
          Entran por
        </Label>
        <Select
          value={basis}
          onValueChange={(value) => onChangeBasis(value as ReportPeriodBasis)}
        >
          <SelectTrigger
            id="lote-base"
            aria-label="Por qué fecha entra la incidencia"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORT_PERIOD_BASES.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {`Fecha de ${option.label.toLowerCase()}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
